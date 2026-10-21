import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const profile='11111111-1111-4111-8111-111111111111';
async function fixture(){
 const pg=new PGlite();
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','business','Business','active'),('other-biz','other','other-business','Other','active'); INSERT INTO settings(owner,data) VALUES('owner','{}'),('other','{}');");
 await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,date_of_birth,member_number) VALUES($1,'owner','Test Person','test@example.test','1990-01-01','TP010190')",[profile]);
 await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Test','Person','test@example.test','1990-01-01','TP010190'),('other-biz','Test','Person','test@example.test','1990-01-01','TP010190')");
 await pg.query("INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('visit','owner','2030-01-01',600,30,'coach','Confirmed',$1)",[JSON.stringify({name:'Test Person',email:'test@example.test',dateOfBirth:'1990-01-01',memberNumber:'TP010190'})]);
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0}},release(){}},pool={...db,connect:async()=>db};
 const url=new URL('../app/api/studio/clients/route.ts',import.meta.url),source=await readFile(url,'utf8'),nativeRequire=createRequire(url),exports={};
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>pool}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const post=(body,owner='owner',validOrigin=true)=>exports.POST(new Request(new URL('/api/studio/clients',origin),{method:'POST',headers:{'Content-Type':'application/json',...(owner?{'x-test-owner':owner}:{}),Origin:validOrigin?new URL(origin).origin:'https://untrusted.invalid'},body:JSON.stringify(body)}));
 return {pg,post};
}
test('one confirmed owner request deletes client without operator paperwork; retries cannot delete a new holder of the released ID',async()=>{
 const {pg,post}=await fixture();try{
 const body={action:'delete',clientId:profile,confirmPhrase:'DELETE CLIENT'};
 assert.equal((await post(body,'')).status,401);
 assert.equal((await post(body,'owner',false)).status,403);
 assert.equal((await post(body,'other')).status,409);
 assert.equal((await post({...body,confirmPhrase:''})).status,409);
 assert.equal((await pg.query('SELECT count(*)::int n FROM client_deletion_authorizations')).rows[0].n,0);
 const first=await post(body);assert.equal(first.status,200,await first.text());
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='owner'")).rows[0].n,0);
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_booking_ids WHERE business_id='biz'")).rows[0].n,0);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_member_ids WHERE business_id='biz'")).rows[0].n,0);
 assert.equal((await post(body)).status,200);
 const created=await post({action:'create',firstName:'Terry',lastName:'Parker',dateOfBirth:'1990-01-01',email:'terry@example.test'});
 assert.equal(created.status,200,await created.text());
 assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE owner='owner'")).rows[0].member_number,'TP010190');
 assert.equal((await post(body)).status,200);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='owner'")).rows[0].n,1,'retry cannot delete the new ID holder');
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_booking_ids WHERE business_id='other-biz'")).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM client_deletion_audit')).rows[0].n,1);
 }finally{await pg.close();}
});
test('anonymized deleted-client card and removed-list retry are deletable without touching other clients',async()=>{
 const {pg,post}=await fixture();try{
 const removed='22222222-2222-4222-8222-222222222222';
 await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,archived) VALUES($1,'owner','Deleted client','',false)",[removed]);
 assert.equal((await post({action:'delete',clientId:removed,confirmPhrase:'DELETE CLIENT'})).status,200);
 assert.equal((await post({action:'deleteArchived',clientIds:[removed],confirmPhrase:'DELETE REMOVED CLIENTS'})).status,200);
 assert.equal((await pg.query('SELECT id FROM business_client_profiles')).rows[0].id,profile);
 const denied=await post({action:'deleteArchived',clientIds:[profile],confirmPhrase:'DELETE REMOVED CLIENTS'});
 assert.equal(denied.status,409);
 }finally{await pg.close();}
});
