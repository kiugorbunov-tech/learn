const TechChecks=(()=>{
  let resources;
  const load=()=>resources||(resources=Promise.all([fetch('check-specs.json').then(r=>{if(!r.ok)throw Error('Не загрузились проверки.');return r.json();}),fetch('code-checks.py').then(r=>{if(!r.ok)throw Error('Не загрузились проверки Python.');return r.text();})]).catch(e=>{resources=null;throw e;}));
  function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(x=>walk(x,visit));else if(value&&typeof value==='object')walk(value,visit);}}
  function inputs(code,values){
    const ast=acorn.parse(code,{ecmaVersion:2022}),edits=[],found=new Set();
    // Only top-level declarations are inputs. Function locals remain untouched.
    for(const statement of ast.body)if(statement.type==='VariableDeclaration')for(const d of statement.declarations){
      if(d.id.type==='Identifier'&&d.init&&Object.hasOwn(values,d.id.name)&&!found.has(d.id.name)){edits.push([d.init.start,d.init.end,JSON.stringify(values[d.id.name])]);found.add(d.id.name);}
    }
    if(Object.keys(values).some(k=>!found.has(k)))throw Error('Сохраните исходные входные переменные задания.');
    for(const [start,end,value]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,start)+value+code.slice(end);
    return code;
  }
  async function javascript(code,spec,expected){
    const cases=[{out:expected},...(spec.variants||[])];
    for(let i=0;i<cases.length;i++){
      const variant=cases[i],lines=[],con={log:(...args)=>lines.push(args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '))};
      try{
        const changed=inputs(code,variant.values||{});
        const checks=i===0?(spec.asserts||[]).map(x=>`if(!(${x}))throw Error('Не пройдена проверка функции на других аргументах.');`).join('\n'):'';
        new Function('console','"use strict";\n'+changed+'\n'+checks)(con);
      }catch(e){return {ok:false,message:e.message};}
      if(!outputMatches(lines.join('\n'),variant.out))return {ok:false,message:(i?'Дополнительный случай '+i:'Исходный пример')+': результат не совпал. Проверьте вычисления на других данных.',out:lines.join('\n')};
    }
    return {ok:true,message:`Пройдено проверок: ${cases.length+(spec.asserts||[]).length}.`};
  }
  async function python(code,spec,expected,status){
    const [,harness]=await load(),py=await loadPy(status);
    await py.loadPackagesFromImports(code);
    const payload=JSON.stringify({code,spec,expected});
    const program=harness+'\n_payload=json.loads('+JSON.stringify(payload)+')\nprint(json.dumps(check_solution(_payload["code"],_payload["spec"],_payload["expected"]),ensure_ascii=False))';
    const result=await runPy(program,status);if(result.err)return {ok:false,message:result.err};
    return JSON.parse(result.out.trim());
  }
  async function task(n,i,code,status){const [specs]=await load(),t=LESSONS[n].code[i],spec=specs[n+'_'+i];if(!spec)throw Error('Для этого задания не найдены проверки.');return t.lang==='js'?javascript(code,spec,t.expect):python(code,spec,t.expect,status);}
  return {task,javascript,python,inputs};
})();

// Keep existing editors and hints; strengthen only the Check action.
const originalCodeTasks=renderCodeTasks;
renderCodeTasks=function(n,lv){
  originalCodeTasks(n,lv);
  (LESSONS[n].code||[]).forEach((t,i)=>{
    const button=lv.querySelector(`[data-check="${i}"]`),editor=lv.querySelector('#ed-'+i),feedback=lv.querySelector('#hint-'+i);
    button.onclick=async()=>{
      if(button.disabled)return;button.disabled=true;feedback.textContent='Проверяю исходный пример и другие случаи…';
      try{const result=await TechChecks.task(n,i,editor.value,feedback);feedback.textContent=result.message;
        if(result.ok){feedback.classList.add('done-mark');const s=L(n);if(!s.code.includes(i)){s.code.push(i);Store.save();updateChips();const counter=document.querySelector('[data-v="tasks"]');if(counter)counter.textContent=`Практика ${practiceDone(n)}/${practiceAll(n)}`;}}
        else feedback.classList.remove('done-mark');
      }catch(e){feedback.textContent='Проверка не завершилась: '+e.message;}
      finally{button.disabled=false;}
    };
  });
};
