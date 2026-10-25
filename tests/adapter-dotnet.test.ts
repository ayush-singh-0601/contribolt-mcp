import {it,expect} from 'vitest';
import {dotnet as adapter} from '../src/languages/adapters/dotnet.js';
it('selects native C# F# and .NET commands and safe check modes',()=>{
 const content={"Fixture.sln": "Microsoft Visual Studio Solution File", "global.json": "{\"sdk\":{\"version\":\"9.0.100\"}}"};const repo={root:process.cwd(),scope:'',files:Object.keys(content),content};
 expect(adapter.detect(repo).matched).toBe(true);const checks=adapter.commands(repo);
 expect(checks[0]?.args).toEqual(['test','Fixture.sln','--no-restore']);expect(adapter.planEnvironment(repo).tools).toContain('dotnet');
 expect(adapter.parseResults({exitCode:null,available:false})).toBe('UNAVAILABLE');
 expect(adapter.parseResults({exitCode:1,available:true})).toBe('FAIL');
});
