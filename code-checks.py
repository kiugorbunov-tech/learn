"""Behavioral learning checks, shared by native validation and browser Python."""
import ast, contextlib, io, json, os, sys

def _call_name(node):
    if isinstance(node,ast.Name):return node.id
    if isinstance(node,ast.Attribute):return _call_name(node.value)+'.'+node.attr
    return ''

class _Inputs(ast.NodeTransformer):
    def __init__(self,values):self.values=values;self.done=set()
    def visit_Assign(self,node):
        for target in node.targets:
            if isinstance(target,ast.Name) and target.id in self.values and target.id not in self.done:
                node.value=ast.parse(repr(self.values[target.id]),mode='eval').body;self.done.add(target.id)
        return node
    def visit_AnnAssign(self,node):
        if isinstance(node.target,ast.Name) and node.target.id in self.values and node.target.id not in self.done:
            node.value=ast.parse(repr(self.values[node.target.id]),mode='eval').body;self.done.add(node.target.id)
        return node
    # Test inputs describe top-level variables, never local names inside functions.
    def visit_FunctionDef(self,node):return node
    def visit_AsyncFunctionDef(self,node):return node

def _normal(text):return '\n'.join(line.rstrip() for line in str(text).replace('\r','').split('\n')).strip()

def check_solution(source,spec,expected):
    try:tree=ast.parse(source)
    except SyntaxError as e:return {'ok':False,'message':f'Синтаксическая ошибка: строка {e.lineno}, {e.msg}'}
    nodes=list(ast.walk(tree));names={type(n).__name__ for n in nodes};calls={_call_name(n.func) for n in nodes if isinstance(n,ast.Call)}
    for required in spec.get('ast',[]):
        good=required[5:] in calls if required.startswith('call:') else any(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==required[4:] for n in nodes) if required.startswith('def:') else required in names
        if not good:return {'ok':False,'message':'Используйте конструкцию из задания в выполняемом коде: '+required}
    if sum(isinstance(n,ast.Assert) for n in nodes)<spec.get('minAsserts',0):return {'ok':False,'message':'Добавьте три самостоятельные проверки assert.'}
    for key in spec.get('keywords',[]):
        if not any(isinstance(n,ast.keyword) and n.arg==key for n in nodes):return {'ok':False,'message':'Не найден параметр '+key+' в вызове функции.'}
    if spec.get('computedPrint'):
        expressions=[a for n in nodes if isinstance(n,ast.Call) and _call_name(n.func)=='print' for a in n.args]
        if not any(not isinstance(a,ast.Constant) for a in expressions):return {'ok':False,'message':'Вычислите результат и передайте выражение или переменную в print.'}
    if spec.get('sqlSelect') and not any(isinstance(n,ast.Call) and any(isinstance(a,ast.Constant) and isinstance(a.value,str) and 'SELECT' in a.value.upper() for a in n.args) for n in nodes):return {'ok':False,'message':'Получите число событий запросом SELECT.'}
    cases=[{'out':expected}]+spec.get('variants',[])
    for index,case in enumerate(cases):
        code_tree=ast.parse(source);transform=_Inputs(case.get('values',{}));code_tree=transform.visit(code_tree)
        missing=set(case.get('values',{}))-transform.done
        if missing:return {'ok':False,'message':'Сохраните исходные входные переменные задания: '+', '.join(sorted(missing))}
        scope={'__name__':'__main__'};output=io.StringIO();error=None;steps=0
        old_key=os.environ.get('API_KEY');os.environ.pop('API_KEY',None)
        if case.get('env',{}).get('API_KEY'):os.environ['API_KEY']=case['env']['API_KEY']
        def trace(frame,event,arg):
            nonlocal steps
            if frame.f_code.co_filename=='<learning>':
                frame.f_trace_opcodes=True
                steps+=1
                if steps>250000:raise RuntimeError('Слишком много шагов: проверьте условие завершения цикла.')
            return trace
        previous_trace=sys.gettrace()
        try:
            with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):
                sys.settrace(trace)
                exec(compile(ast.fix_missing_locations(code_tree),'<learning>','exec'),scope)
        except Exception as e:error=e
        finally:
            sys.settrace(previous_trace)
            if old_key is None:os.environ.pop('API_KEY',None)
            else:os.environ['API_KEY']=old_key
        label='Исходный пример' if index==0 else f'Дополнительный случай {index}'
        if case.get('error'):
            if error is None or type(error).__name__!=case['error']:return {'ok':False,'message':label+': проверка должна отклонить неподходящие данные.'}
            continue
        if error:return {'ok':False,'message':label+': '+type(error).__name__+' — '+str(error)}
        if _normal(output.getvalue())!=_normal(case['out']):return {'ok':False,'message':label+': результат не совпал. Проверьте вычисления на других входных данных.','out':output.getvalue()}
        if index==0:
            for expr in spec.get('asserts',[]):
                try:
                    sys.settrace(trace)
                    passed=bool(eval(expr,scope))
                except Exception:passed=False
                finally:sys.settrace(previous_trace)
                if not passed:return {'ok':False,'message':'Функция или структура данных не прошла дополнительную проверку. Проверьте ноль, отрицательные значения и пустые коллекции, если они допустимы по условию.'}
    return {'ok':True,'message':f'Пройдено проверок: {len(cases)+len(spec.get("asserts",[]))}. Результат получен вашим кодом.'}
