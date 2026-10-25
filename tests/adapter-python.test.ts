import {it,expect} from 'vitest';
import {python as adapter} from '../src/languages/adapters/python.js';
it('selects native Python commands and safe check modes',()=>{
 const content={"pyproject.toml": "[project]\nrequires-python = \">=3.11\"\n[tool.ruff]\n", "uv.lock": ""};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks[0]?.executable).toBe('uv');expect(checks[0]?.args).toEqual(['run','python','-m','pytest']);expect(checks.some(c=>c.kind==='format_check')).toBe(true);
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
