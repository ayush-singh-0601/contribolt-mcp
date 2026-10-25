import {it,expect} from 'vitest';
import {cpp as adapter} from '../src/languages/adapters/cpp.js';
it('selects native C and C++ commands and safe check modes',()=>{
 const content={"CMakeLists.txt": "cmake_minimum_required(VERSION 3.20)\nproject(fixture)\nenable_testing()\n"};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks.find(c=>c.kind==='test')?.executable).toBe('ctest');expect(adapter.planEnvironment(repo).bootstrap[0]?.args).toEqual(['-S','.','-B','build']);
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
