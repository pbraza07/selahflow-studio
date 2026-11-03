import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('optional sandbox preparation is bounded and permits web startup; required migration failures still stop startup',()=>{
 const source=readFileSync(new URL('../scripts/start.mjs',import.meta.url),'utf8').replace(/import[^\n]+\n/,'');
 const calls=[],warnings=[];let launched=0,failMigration=false,failStripe=false;
 const process={execPath:'node',env:{PORT:'3000'},on(){},exit(code){throw Error('Required startup failed '+code);}};
 const spawnSync=(cmd,args,options)=>{calls.push({args,options});if(args.includes('scripts/migrate.mjs')&&failMigration)return {status:1};if(args.includes('scripts/prepare-staging-stripe.mjs'))return failStripe?{status:1}:{status:null,error:{code:'ETIMEDOUT'}};return {status:0};};
 const run=()=>new Function('spawnSync','spawn','process','console',source)(spawnSync,()=>{launched++;return {on(){},kill(){}};},process,{warn:m=>warnings.push(m)});
 run();const optional=calls.find(c=>c.args.includes('scripts/prepare-staging-stripe.mjs'));assert.equal(optional.options.timeout,30000);assert.equal(optional.options.killSignal,'SIGKILL');assert.equal(launched,1);assert.match(warnings[0],/existing payment configuration/);
 failStripe=true;assert.throws(run,/Required startup failed/);assert.equal(launched,1);failStripe=false;failMigration=true;assert.throws(run,/Required startup failed/);assert.equal(launched,1);
});
