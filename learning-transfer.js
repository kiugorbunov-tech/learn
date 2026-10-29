/* A portable backup contains only these three apps' learning progress. */
(() => {
  const APPS={english:{key:'tech-english-v1',name:'Английский'},books:{key:'book-of-day-v1',name:'Книга дня'},course:{key:'it-course-v1',name:'Техника и ИИ'}};
  const SAFETY='learning-before-import-v1', DAILY='learning-daily-backup-v1';
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function safeTree(x,depth=0) {
    if(depth>35)throw Error('Файл слишком сложный. Выберите резервную копию этого приложения.');
    if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){
      if(['__proto__','prototype','constructor'].includes(k))throw Error('Недопустимые поля в файле.');
      safeTree(v,depth+1);
    }
  }
  function parse(text) {
    if(text.length>10*1024*1024)throw Error('Размер резервной копии превышает 10 МБ.');
    let value;try{value=JSON.parse(text);}catch{throw Error('Это не JSON-файл резервной копии.');}
    safeTree(value);
    if(!plain(value)||value.format!=='learning-progress'||value.version!==1||!plain(value.apps))throw Error('Формат копии не поддерживается.');
    const ids=Object.keys(value.apps);
    if(!ids.length||ids.some(id=>!APPS[id]||!plain(value.apps[id])))throw Error('В копии нет корректных данных приложений.');
    for(const id of ids){const data=value.apps[id];const required=id==='english'?['cards','tests','daily','settings']:id==='books'?['read','notes','quiz','days']:['lessons'];
      for(const key of required)if(key==='tests'?!Array.isArray(data[key]):!plain(data[key]))throw Error(`Повреждён раздел «${APPS[id].name}»: ${key}.`);
    }
    return value;
  }
  function snapshot(storage=localStorage) {
    const apps={};
    for(const [id,a]of Object.entries(APPS)){const raw=storage.getItem(a.key);if(raw){try{const data=JSON.parse(raw);if(plain(data))apps[id]=data;}catch{}}}
    return {format:'learning-progress',version:1,createdAt:new Date().toISOString(),apps};
  }
  function apply(value,ids,storage=localStorage) {
    parse(JSON.stringify(value));
    if(!ids.length||ids.some(id=>!APPS[id]||!value.apps[id]))throw Error('Выберите приложения для переноса.');
    const previous={};for(const id of ids)previous[id]=storage.getItem(APPS[id].key);
    // Write the rollback copy first. If storage is full, no current data changes.
    const backup=snapshot(storage),defaults={english:{cards:{},tests:[],daily:{},settings:{newPerDay:12,rate:0.85},updatedAt:0},books:{read:{},notes:{},quiz:{},days:{},updatedAt:0},course:{lessons:{},current:1,updatedAt:0}};
    for(const id of ids)if(!backup.apps[id])backup.apps[id]=defaults[id];
    storage.setItem(SAFETY,JSON.stringify(backup));
    try{for(const id of ids)storage.setItem(APPS[id].key,JSON.stringify({...value.apps[id],updatedAt:Date.now()}));}
    catch(error){for(const id of ids)storage.removeItem(APPS[id].key);for(const id of ids)if(previous[id]!==null)storage.setItem(APPS[id].key,previous[id]);throw Error('Не хватило места. Текущий прогресс оставлен без изменений.');}
    return ids;
  }
  function download(value) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='learning-progress-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function mount(parent) {
    if(!parent||parent.querySelector('[data-learning-transfer]'))return;
    const panel=document.createElement('section');panel.dataset.learningTransfer='';panel.className='card';panel.style.marginTop='24px';
    panel.innerHTML='<h3>Резервная копия и перенос</h3><p>Сохраните одним файлом прогресс приложений, который хранится в этом браузере. Передайте его на другой телефон или компьютер и откройте здесь. Это ручной перенос, автоматической синхронизации нет.</p><div class="row"><button class="btn" data-export>Сохранить копию</button><button class="btn" data-import>Открыть копию</button><button class="btn" data-rollback>Копия до последнего переноса</button></div><input type="file" accept=".json,application/json" hidden data-file><div data-preview></div><p role="status" aria-live="polite" data-status></p>';
    parent.appendChild(panel);
    const status=panel.querySelector('[data-status]'),file=panel.querySelector('[data-file]'),preview=panel.querySelector('[data-preview]');
    panel.querySelector('[data-export]').onclick=()=>{const value=snapshot();if(!Object.keys(value.apps).length){status.textContent='Пока нет сохранённого прогресса.';return;}download(value);status.textContent='Файл подготовлен. На iPhone сохраните его в «Файлы». В нём есть ваши учебные заметки.';};
    const show=value=>{
      preview.replaceChildren();const title=document.createElement('p');title.textContent='Выберите, какие данные заменить на этом устройстве. Текущие данные сохранятся отдельной копией.';preview.appendChild(title);
      for(const id of Object.keys(value.apps)){
        const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=id;checkbox.checked=true;
        label.style.cssText='display:block;padding:10px 0';label.append(checkbox,' '+APPS[id].name);const date=Number(value.apps[id].updatedAt);if(Number.isFinite(date)&&date>0)label.append(' — '+new Date(date).toLocaleString('ru-RU'));preview.appendChild(label);
      }
      const button=document.createElement('button');button.className='btn primary';button.textContent='Перенести выбранный прогресс';preview.appendChild(button);
      button.onclick=()=>{try{
        const ids=[...preview.querySelectorAll('input:checked')].map(x=>x.value);apply(value,ids);preview.replaceChildren();
        if(typeof Store!=='undefined'&&typeof KEY!=='undefined'&&ids.some(id=>APPS[id].key===KEY)){
          clearTimeout(Store._timer);Store.data=JSON.parse(localStorage.getItem(KEY));Store.save();if(typeof renderAll==='function')renderAll();
        }
        status.textContent='Прогресс перенесён. Предыдущее состояние доступно в копии до переноса.';
        // renderAll may replace the panel; keep the result visible in the new one too.
        document.querySelectorAll('[data-learning-transfer] [data-status]').forEach(x=>x.textContent=status.textContent);
      }catch(e){status.textContent=e.message;}};
    };
    panel.querySelector('[data-import]').onclick=()=>file.click();
    file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>10*1024*1024)throw Error('Файл больше 10 МБ.');show(parse(await selected.text()));status.textContent='Копия прочитана. Проверьте выбор перед переносом.';}catch(e){status.textContent=e.message;}finally{file.value='';}};
    panel.querySelector('[data-rollback]').onclick=()=>{try{const raw=localStorage.getItem(SAFETY)||localStorage.getItem(DAILY);if(!raw){status.textContent='Предыдущей копии пока нет.';return;}show(parse(raw));status.textContent='Открыта сохранённая копия. Выберите приложения для восстановления.';}catch(e){status.textContent=e.message;}};
  }
  window.LearningTransfer={parse,snapshot,apply,mount};
  try{const current=snapshot(),last=JSON.parse(localStorage.getItem(DAILY)||'null');if(Object.keys(current.apps).length&&(!last||last.createdAt.slice(0,10)!==current.createdAt.slice(0,10)))localStorage.setItem(DAILY,JSON.stringify(current));}catch{}
  if(typeof renderStats==='function'){const original=renderStats;renderStats=function(...args){original(...args);mount(document.getElementById('p-stats'));};}
  mount(document.getElementById('p-stats')||document.getElementById('learning-transfer'));
})();
