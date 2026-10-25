import {defineAdapter,command,has,text,type RepositoryContext} from '../adapter.js';
function invoke(r:RepositoryContext,args:string[]){return has(r,'uv.lock')?{exe:'uv',args:['run',...args]}:has(r,'poetry.lock')?{exe:'poetry',args:['run',...args]}:{exe:args[0]!,args:args.slice(1)};}
export const python=defineAdapter({id:'python',matches:f=>/^(pyproject\.toml|setup\.py|requirements.*\.txt|tox\.ini)$/.test(f),tools:['python'],requirements:r=>[text(r,'.python-version'),text(r,'pyproject.toml').match(/requires-python\s*=\s*["']([^"']+)/)?.[1]??''].filter(Boolean),bootstrap:r=>[command(r,'python','bootstrap',has(r,'uv.lock')?'uv':has(r,'poetry.lock')?'poetry':'python',has(r,'uv.lock')?['sync','--frozen']:has(r,'poetry.lock')?['install']:['-m','pip','install','-e','.[test]'],'pyproject.toml',false)],commands:r=>{
 const source=has(r,'pyproject.toml')?'pyproject.toml':has(r,'tox.ini')?'tox.ini':'requirements.txt';const raw=text(r,source),checks=[];
 const test=invoke(r,has(r,'tox.ini')||/\[tool\.tox\]/.test(raw)?['tox']:['python','-m','pytest']);checks.push(command(r,'python','test',test.exe,test.args,source));
 if(/ruff/.test(raw)){for(const [kind,args]of [['lint',['ruff','check','.']],['format_check',['ruff','format','--check','.']]] as const){const tool=invoke(r,[...args]);checks.push(command(r,'python',kind,tool.exe,tool.args,source));}}
 if(/mypy/.test(raw)){const tool=invoke(r,['mypy','.']);checks.push(command(r,'python','typecheck',tool.exe,tool.args,source));}return checks;
}});
