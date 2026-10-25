import {it,expect} from 'vitest';
import {rust as adapter} from '../src/languages/adapters/rust.js';
it('selects native Rust commands and safe check modes',()=>{
 const content={"Cargo.toml": "[package]\nname=\"fixture\"\nversion=\"0.1.0\"\n", "Cargo.lock": ""};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks.find(c=>c.kind==='format_check')?.args).toEqual(['fmt','--','--check']);expect(checks.every(c=>!c.args.includes('--workspace'))).toBe(true);
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
