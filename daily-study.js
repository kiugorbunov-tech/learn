/* A daily route and spaced recall of complete constructions. No notifications. */
(() => {
  const day=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
  const state=()=>{const s=courseState();s.review=s.review||{};s.daily=s.daily||{};return s;};
  const originalRecord=recordCourseRun;
  recordCourseRun=function(run){
    const already=run.recorded;originalRecord(run);if(already)return;
    const s=state(),today=s.daily[day()]||(s.daily[day()]={answered:0,correct:0});
    for(let i=0;i<run.questions.length;i++){
      const q=run.questions[i],response=run.responses[i];if(!response||!q.id)continue;
      const item=s.review[q.id]||(s.review[q.id]={question:q,box:0,independent:0,assisted:0,errors:0});
      item.question={...q,options:null};
      const assisted=!!q.options||!!response.hint;
      today.answered++;if(response.ok)today.correct++;
      if(response.ok){const independent=!assisted&&item.independent>0&&item.lastCorrect&&!item.lastAssisted;const advance=independent&&item.due<=Date.now();if(assisted)item.assisted++;else item.independent++;item.box=advance?Math.min(4,item.box+1):independent?item.box:0;}
      else {item.errors++;item.box=0;}
      item.last=Date.now();item.lastCorrect=response.ok;item.lastAssisted=assisted;
      item.due=item.last+[1,3,7,14,30][item.box]*DAY;
    }
    // Keep detailed daily history bounded while preserving cumulative question mastery.
    const keys=Object.keys(s.daily);if(keys.length>120)keys.slice(0,keys.length-120).forEach(k=>delete s.daily[k]);
    Store.save();
  };
  const originalPlan=renderPlan;
  renderPlan=function(){
    originalPlan();if(courseLesson)return;
    const s=state(),entries=Object.values(s.review),due=entries.filter(x=>x.due<=Date.now()).sort((a,b)=>a.due-b.due);
    const current=s.daily[day()]||{answered:0,correct:0};
    const independent=entries.filter(x=>x.independent>0&&x.lastCorrect).length;
    const assisted=entries.filter(x=>x.assisted>0&&!x.independent).length;
    const next=COURSE.findIndex((_,i)=>!s.lessons[i]?.complete);
    const panel=document.createElement('section');panel.className='card teach';panel.style.marginBottom='20px';
    panel.innerHTML=`<h3>Занятие на сегодня</h3><p>Сначала вспомните прошлый материал, затем разберите одну новую тему и проверьте себя без вариантов ответа.</p>
      <p class="note">Сегодня ответов: ${current.answered}; верных: ${current.correct}. Конструкций к повторению: ${due.length}.</p>
      <div class="row"><button class="btn" data-daily-review ${entries.length?'':'disabled'}>${due.length?'Повторить: '+Math.min(8,due.length):'Закрепить недавнее'}</button>
      <button class="btn primary" data-daily-topic>${next>=0?'Тема: '+esc(COURSE[next].title):'Повторить весь курс'}</button></div>
      <p class="note" style="margin-top:12px">Самостоятельно получилось: ${independent}. Пока с опорой на варианты: ${assisted}. Повторения возвращаются через 1, 3, 7, 14 и 30 дней.</p>`;
    $('#p-plan').prepend(panel);
    panel.querySelector('[data-daily-review]').onclick=()=>{
      const questions=(due.length?due:[...entries].sort((a,b)=>(b.last||0)-(a.last||0))).slice(0,8).map(x=>({...x.question,options:null}));
      courseLesson=null;courseTest=newCourseRun(questions,'daily');vocabularyTests=false;renderTests();openTab('tab-tests');
    };
    panel.querySelector('[data-daily-topic]').onclick=()=>{if(next>=0)openCourse(next);else{courseTestTopic='all';courseTest=null;vocabularyTests=false;renderTests();openTab('tab-tests');}};
  };
  if(typeof renderCourseQuiz==='function'){
    const quiz=renderCourseQuiz;renderCourseQuiz=function(box,run,redraw){quiz(box,run,redraw);if(run.context==='daily'&&run.i>=run.questions.length){box.querySelector('p').textContent='Повторение завершено. Ответы учтены в расписании; теперь можно перейти к новой теме.';const finish=box.querySelector('#course-finish');finish.textContent='К занятию на сегодня';finish.onclick=()=>{stopSpeech();courseTest=null;courseLesson=null;renderPlan();openTab('tab-plan');};}};
  }
  renderPlan();
})();
