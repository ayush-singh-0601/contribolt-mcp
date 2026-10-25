import {it,expect} from 'vitest';
import {dart as adapter} from '../src/languages/adapters/dart.js';
it('selects native Dart and Flutter commands and safe check modes',()=>{
 const content={"pubspec.yaml": "name: fixture\nenvironment:\n  sdk: \">=3.5.0\"\ndependencies:\n  flutter:\n    sdk: flutter\n"};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks[0]?.executable).toBe('flutter');expect(checks.find(c=>c.kind==='format_check')?.args).toContain('--set-exit-if-changed');
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
