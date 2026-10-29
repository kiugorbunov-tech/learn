const LEARNING_PROJECTS=[
 {id:'csv',title:'От таблицы к отчёту',lessons:[4,5,6,16],lang:'py',goal:'Напишите обработчик CSV: прочитайте данные, найдите ошибки и получите отчёт по мощности устройств.',
 starter:'import csv, io\n\ndef read_devices(text):\n    # Верните список словарей name (строка), watts (число).\n    # Пропускайте строки с пустым именем или неверными watts.\n    pass\n\ndef power_summary(rows):\n    # Верните словарь count, total, maximum; для пустого списка значения 0.\n    pass\n\ndef make_report(text):\n    # Используйте две предыдущие функции. Формат: Устройств: 2; мощность: 35.0 Вт\n    pass\n',
 steps:[
  {title:'Прочитать и очистить таблицу',help:'Используйте csv.DictReader(io.StringIO(text), delimiter=";"). Переводите watts в float внутри try/except ValueError.',asserts:["read_devices('name;watts\\nCPU;10\\nGPU;25') == [{'name':'CPU','watts':10.0},{'name':'GPU','watts':25.0}]","read_devices('name;watts\\n;10\\nGPU;bad') == []","read_devices('name;watts') == []"]},
  {title:'Посчитать итог',help:'count — len(rows), total — сумма watts, maximum — max с default=0. Верните данные, не печатайте их.',asserts:["power_summary([])=={'count':0,'total':0,'maximum':0}","power_summary([{'name':'A','watts':10},{'name':'B','watts':25}])=={'count':2,'total':35,'maximum':25}"]},
  {title:'Собрать готовый отчёт',help:'Вызовите read_devices, затем power_summary. Для суммы используйте формат :.1f.',asserts:["make_report('name;watts\\nCPU;10\\nGPU;25')=='Устройств: 2; мощность: 35.0 Вт'","make_report('name;watts')=='Устройств: 0; мощность: 0.0 Вт'"]}
 ]},
 {id:'web',title:'Мини-приложение для задач',lessons:[7,8,16],lang:'js',goal:'Создайте поиск, статистику и HTML-список задач. Результат можно посмотреть прямо здесь.',
 starter:'function findTasks(tasks, query) {\n  // Поиск по title без учёта регистра. Исходный массив не изменяйте.\n}\n\nfunction taskStats(tasks) {\n  // Верните {total, done, active}.\n}\n\nfunction taskList(tasks) {\n  // Верните <ul><li>...</li>...</ul>. Экранируйте &, <, > в названиях.\n}\n',
 steps:[
  {title:'Найти нужные задачи',help:'filter + title.toLowerCase().includes(query.toLowerCase()). Пустой запрос возвращает все задачи.',asserts:["findTasks([{title:'Купить чай'},{title:'Работа'}],'ЧАЙ').length===1","findTasks([{title:'A'}],'missing').length===0","findTasks([{title:'A'}],'').length===1"]},
  {title:'Посчитать выполненное',help:'total — длина списка; done — число записей с done === true; active — разница.',asserts:["(()=>{const s=taskStats([]);return s.total===0&&s.done===0&&s.active===0})()","(()=>{const s=taskStats([{done:true},{done:false},{done:false}]);return s.total===3&&s.done===1&&s.active===2})()","taskStats([{done:true}]).done===1"]},
  {title:'Показать список',help:'map и join собирают элементы li. До вставки замените & на &amp;, затем < на &lt; и > на &gt;.',asserts:["taskList([{title:'Чай'}]).includes('<li>Чай</li>')","taskList([]).replace(/\\s/g,'')==='<ul></ul>'","taskList([{title:'<img>&'}]).includes('&lt;img&gt;&amp;')"]}
 ]},
 {id:'search',title:'Поиск по своим документам',lessons:[9,13,14,15],lang:'py',goal:'Соберите учебный поиск по словам с указанием источника. Если совпадений нет, система должна честно отказаться от ответа.',
 starter:'import re\n\ndef words(text):\n    # Набор слов в нижнем регистре, без пунктуации.\n    pass\n\ndef find_document(docs, question):\n    # docs: список {id, text}. Верните запись с максимальным числом общих слов.\n    # При равенстве — первую. Если общих слов нет — None.\n    pass\n\ndef answer_from_document(docs, question):\n    # Формат: Источник: <id>\\n<text>. При отсутствии: Нет данных в документах.\n    pass\n',
 steps:[
  {title:'Подготовить слова',help:'re.findall с диапазонами a-zа-яё0-9 после lower(). Результат превратите в set.',asserts:["words('Труба, ТРУБА! 20')=={'труба','20'}","words('')==set()"]},
  {title:'Найти источник',help:'Оценка — len(words(question) & words(doc["text"])). Обновляйте лучший результат только при строго большем числе совпадений.',asserts:["find_document([{'id':'A','text':'труба вода'},{'id':'B','text':'тепло отопление'}],'отопление')['id']=='B'","find_document([{'id':'A','text':'труба'}],'космос') is None","find_document([],'труба') is None"]},
  {title:'Ответить с опорой на документ',help:'Используйте найденный документ без выдуманных дополнений. Если find_document вернул None, выдайте сообщение об отсутствии данных.',asserts:["answer_from_document([{'id':'A','text':'труба вода'}],'вода')=='Источник: A\\nтруба вода'","answer_from_document([],'вода')=='Нет данных в документах.'"]}
 ]}
];
let projectOpen=null;
function projectState(id){const p=Store.data.projects||(Store.data.projects={});return p[id]||(p[id]={code:LEARNING_PROJECTS.find(x=>x.id===id).starter,passed:[]});}
function renderProjects(){
 const p=$('#p-projects');
 if(!projectOpen){p.innerHTML='<h2>Соберите работающий результат</h2><p class="lead">Три проекта соединяют несколько уроков. Пишите функции в одном редакторе и проверяйте каждый этап на обычных и крайних случаях.</p>'+LEARNING_PROJECTS.map(x=>`<div class="card" style="margin:14px 0"><h3>${esc(x.title)}</h3><p>${esc(x.goal)}</p><p class="note">${Store.data.projects?.[x.id]?.passed.length||0} из ${x.steps.length} этапов проверены</p><button class="btn primary" data-project="${x.id}">Открыть проект</button></div>`).join('');p.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>{projectOpen=b.dataset.project;renderProjects();});return;}
 const project=LEARNING_PROJECTS.find(x=>x.id===projectOpen),state=projectState(project.id);
 p.innerHTML=`<button class="btn" id="project-back">Все проекты</button><h2>${esc(project.title)}</h2><p>${esc(project.goal)}</p><div class="row">${project.lessons.map(n=>`<button class="btn small" data-project-lesson="${n}">Урок ${n}</button>`).join('')}</div>
 <p class="note">Функции возвращают значения; печатать ответы не нужно. Код сохраняется автоматически. После изменения пройдите проверки заново.</p>
 <label>Код проекта<textarea class="editor" id="project-code" spellcheck="false" autocapitalize="off" style="min-height:330px">${esc(state.code)}</textarea></label>
 ${project.steps.map((step,i)=>`<section class="card" style="margin-top:14px"><h3>${i+1}. ${esc(step.title)}</h3><button class="btn primary" data-project-check="${i}">${state.passed.includes(i)?'✓ Проверить снова':'Проверить этап'}</button><details style="margin-top:12px"><summary>Подсказка</summary><p>${esc(step.help)}</p></details><p data-project-status="${i}" role="status"></p></section>`).join('')}
 ${project.id==='web'?'<section class="card" style="margin-top:14px"><h3>Предпросмотр приложения</h3><label>Поиск по задачам<input id="project-query" type="text" value="" placeholder="Например: отчёт"></label><button class="btn" id="project-preview">Показать результат</button><iframe id="project-frame" sandbox="" title="Предпросмотр списка задач" style="display:block;width:100%;border:1px solid var(--line);margin-top:12px"></iframe><p id="project-preview-status" role="status"></p></section>':''}`;
 $('#project-back').onclick=()=>{projectOpen=null;renderProjects();};
 p.querySelectorAll('[data-project-lesson]').forEach(b=>b.onclick=()=>{Store.data.current=+b.dataset.projectLesson;lessonView='theory';quiz=null;Store.save();renderLesson();openTab('tab-lesson');});
 $('#project-code').oninput=e=>{state.code=e.target.value;state.passed=[];Store.save();p.querySelectorAll('[data-project-status]').forEach(x=>x.textContent='Код изменён — проверьте заново.');p.querySelectorAll('[data-project-check]').forEach(x=>x.textContent='Проверить этап');};
 p.querySelectorAll('[data-project-check]').forEach(button=>button.onclick=async()=>{
   if(button.disabled)return;const i=+button.dataset.projectCheck,status=p.querySelector(`[data-project-status="${i}"]`),code=state.code;button.disabled=true;status.textContent='Проверяю…';
   try{const spec={asserts:project.steps[i].asserts},result=await (project.lang==='js'?TechChecks.javascript(code,spec,''):TechChecks.python(code,spec,'',status));
     if(state.code!==code){status.textContent='Код изменился во время проверки. Запустите её ещё раз.';return;}
     status.textContent=result.message;if(result.ok&&!state.passed.includes(i)){state.passed.push(i);Store.save();button.textContent='✓ Проверить снова';}
   }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 });
 if(project.id==='web')$('#project-preview').onclick=()=>{try{
   const tasks=[{title:'Подготовить отчёт',done:false},{title:'Купить чай',done:true},{title:'Проверить код',done:false}],query=$('#project-query').value;
   const result=new Function('tasks','query','"use strict";\n'+state.code+'\nreturn {html:taskList(findTasks(tasks,query)),stats:taskStats(tasks)};')(tasks,query);
   $('#project-frame').srcdoc='<meta charset="utf-8"><style>body{font:16px/1.6 system-ui;padding:12px}</style>'+String(result.html);
   $('#project-preview-status').textContent=`Всего: ${result.stats.total}; выполнено: ${result.stats.done}; осталось: ${result.stats.active}.`;
 }catch(e){$('#project-preview-status').textContent='Пока не удалось показать приложение: '+e.message;}};
}
const originalOpenTab=openTab;openTab=function(id){originalOpenTab(id);if(id==='tab-projects')renderProjects();};
const originalRenderAll=renderAll;renderAll=function(){originalRenderAll();if(!$('#p-projects').hidden)renderProjects();};
