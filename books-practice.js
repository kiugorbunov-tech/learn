const bookOrders=new Map();
function bookOptionOrder(book,question,count){const key=book+':'+question;if(!bookOrders.has(key)){const order=Array.from({length:count},(_,i)=>i);for(let i=count-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}bookOrders.set(key,order);}return bookOrders.get(key);}
function bookLearningState(){const s=Store.data;s.practice=s.practice||{};s.reviews=s.reviews||{};s.cases=s.cases||{};let changed=false;for(const key of Object.keys(s.read)){if(s.read[key]&&BOOKS[key]&&!s.reviews[key]){s.reviews[key]={step:0,due:Date.now()};changed=true;}}if(changed)Store.save();return s;}
const originalBookToday=renderToday;
renderToday=function(){
 originalBookToday();
 const idx=openIdx==null?todayIndex():openIdx,b=BOOKS[idx],key=String(idx),p=$('#p-today'),state=bookLearningState(),long=LONG_BOOKS[idx];
 // Reorder the existing elements, keeping original option IDs and saved answers intact.
 p.querySelectorAll('.opts[data-q]').forEach(box=>{const buttons=[...box.querySelectorAll('button')];for(const i of bookOptionOrder(idx,box.dataset.q,buttons.length))box.appendChild(buttons[i]);});
 if(long){
  const reading=p.querySelector('.read');
  reading.innerHTML=`<p class="note">Расширенный аудиоразбор: ${Math.round(long.duration/60)} минут при скорости 1×. Это учебный пересказ и анализ, а не полный текст книги. Практические ситуации в разборе — наши вымышленные примеры.</p>
    <details class="card" style="margin:18px 0"><summary>Оглавление и главы аудио</summary>${long.chapters.map((c,i)=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><a href="#book-chapter-${i}">${esc(c.title)}</a> <button class="btn small" data-book-chapter="${i}">Слушать с ${fmtTime(c.offset)}</button></div>`).join('')}</details>
    ${long.chapters.map((c,i)=>`<section id="book-chapter-${i}" style="scroll-margin-top:70px"><h3>${esc(c.title)}</h3>${c.paragraphs.map(t=>`<p>${esc(t)}</p>`).join('')}</section>`).join('')}`;
  p.querySelectorAll('[data-book-chapter]').forEach(button=>button.onclick=()=>{
    const offset=long.chapters[+button.dataset.bookChapter].offset;
    if(audioIdx===idx&&Number.isFinite(audio.duration)){audio.currentTime=offset;audio.play().catch(()=>{});}
    else {playbackPositions(idx)[idx]=offset;Store.save();audio.pause();audioIdx=null;renderToday();$('#p-play').click();}
  });
 }
 const section=document.createElement('section');section.className='card';section.style.margin='22px 0';
 const exercise=BOOK_CASES[idx],attempt=state.cases[key],journal=state.practice[key]||{};
 section.innerHTML=`<h3>Примените идею к ситуации</h3><p>${esc(exercise[0])}</p><div class="opts">${bookOptionOrder(idx,'case',exercise[1].length).map(i=>`<button data-case-option="${i}" ${attempt?'disabled':''}>${esc(exercise[1][i])}</button>`).join('')}</div>
   <p data-case-feedback role="status">${attempt?esc((attempt.correct?'Верно. ':'Разбор: ')+exercise[3]):''}</p>
   <h3>Мой эксперимент по книге</h3><p class="note">Выберите одно небольшое действие. Запишите, по чему поймёте, что оно помогло, и вернитесь к результату.</p>
   ${[['situation','Где попробую идею'],['action','Что конкретно сделаю'],['evidence','Как замечу результат'],['outcome','Что получилось на деле']].map(([field,label])=>`<label style="display:block;margin:12px 0">${label}<textarea class="notes" data-journal="${field}" style="min-height:72px">${esc(journal[field]||'')}</textarea></label>`).join('')}
   <label style="display:block;margin:12px 0">Когда вернуться к результату <input type="date" data-journal="reviewAt" value="${esc(journal.reviewAt||'')}"></label>
   <button class="btn" data-journal-done>${journal.done?'✓ Результат записан':'Завершить эксперимент'}</button><p data-journal-status role="status"></p>`;
 p.querySelector('.read').after(section);
 section.querySelectorAll('[data-case-option]').forEach(button=>button.onclick=()=>{
   const choice=+button.dataset.caseOption,correct=choice===exercise[2];state.cases[key]={choice,correct,at:Date.now()};Store.save();
   section.querySelectorAll('[data-case-option]').forEach(x=>{x.disabled=true;if(+x.dataset.caseOption===exercise[2])x.classList.add('right');});
   if(!correct)button.classList.add('wrong');section.querySelector('[data-case-feedback]').textContent=(correct?'Верно. ':'Не совсем. ')+exercise[3];
 });
 section.querySelectorAll('[data-journal]').forEach(input=>input.oninput=()=>{const j=state.practice[key]||(state.practice[key]={});j[input.dataset.journal]=input.value;j.done=false;j.updatedAt=Date.now();Store.save();section.querySelector('[data-journal-done]').textContent='Завершить эксперимент';});
 section.querySelector('[data-journal-done]').onclick=()=>{const j=state.practice[key];if(!j?.action?.trim()||!j?.outcome?.trim()){section.querySelector('[data-journal-status]').textContent='Запишите действие и фактический результат. Он может быть и отрицательным.';return;}j.done=true;j.completedAt=Date.now();Store.save();section.querySelector('[data-journal-status]').textContent='Результат сохранён. Здесь фиксируется ваш опыт, а не автоматическая оценка правильности.';section.querySelector('[data-journal-done]').textContent='✓ Результат записан';};
 const done=$('#b-done'),originalDone=done.onclick;done.onclick=()=>{if(!state.reviews[key])state.reviews[key]={step:0,due:Date.now()+DAY};originalDone();};
 const review=state.reviews[key];
 if(review){
   const box=document.createElement('section');box.className='card';box.style.margin='20px 0';
   box.innerHTML=`<h3>Вспомните без подсказки</h3><p>Какая мысль книги вам пригодится, где она сработает и какое у неё ограничение?</p><textarea class="notes" data-recall-draft placeholder="Сначала ответьте своими словами">${esc(review.draft||'')}</textarea><details style="margin:14px 0"><summary>Открыть опору для сравнения</summary><p>${esc(b.keep)}</p><p>${esc(b.limits)}</p></details><p class="note">Оцените свою попытку честно. Это самооценка, а не проверка ИИ.</p><div class="row"><button class="btn" data-recall-grade="2">Вспомнил самостоятельно</button><button class="btn" data-recall-grade="1">Только с подсказкой</button><button class="btn" data-recall-grade="0">Нужно разобрать снова</button></div><p role="status" data-recall-status></p>`;
   section.after(box);box.querySelector('[data-recall-draft]').oninput=e=>{review.draft=e.target.value;Store.save();};
   box.querySelectorAll('[data-recall-grade]').forEach(button=>button.onclick=()=>{const grade=+button.dataset.recallGrade;if(!review.draft?.trim()){box.querySelector('[data-recall-status]').textContent='Сначала запишите, что удалось вспомнить.';return;}review.step=grade===2?(review.due<=Date.now()?Math.min(3,review.step+1):review.step):0;review.lastGrade=grade;review.last=Date.now();review.due=Date.now()+[1,3,7,14][review.step]*DAY;Store.save();box.querySelector('[data-recall-status]').textContent='Следующее повторение: '+new Date(review.due).toLocaleDateString('ru-RU');box.querySelectorAll('[data-recall-grade]').forEach(x=>x.disabled=true);});
 }
 if(openIdx==null){
   const due=Object.entries(state.reviews).filter(([,r])=>r.due<=Date.now()).slice(0,4);
   const actions=Object.entries(state.practice).filter(([,j])=>j.reviewAt&&j.reviewAt<=todayKey()&&!j.done).slice(0,4);
   if(due.length||actions.length){const box=document.createElement('section');box.className='card';box.style.marginBottom='18px';box.innerHTML='<h3>Вернуться к прочитанному</h3>'+due.map(([i])=>`<button class="btn" data-review-book="${i}" style="margin:5px">Вспомнить: ${esc(BOOKS[i].t)}</button>`).join('')+actions.map(([i])=>`<button class="btn" data-review-book="${i}" style="margin:5px">Итог эксперимента: ${esc(BOOKS[i].t)}</button>`).join('');p.prepend(box);box.querySelectorAll('[data-review-book]').forEach(button=>button.onclick=()=>{openIdx=+button.dataset.reviewBook;renderToday();window.scrollTo(0,0);});}
 }
};
renderToday();
