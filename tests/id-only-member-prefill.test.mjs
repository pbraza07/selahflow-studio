import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {publicBookingServiceSummary} from '../server/public-booking-service.mjs';
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','o@example.test','hash'),('other','x@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','club-one','One','active'),('other-biz','other','club-two','Two','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Academy','month',6000,5); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,customer_phone,date_of_birth,member_number,status,price_cents,sessions_included,sessions_used,stripe_account_id) VALUES('member','biz','plan','Alicia Brooks','old@example.test','8135550100','2013-03-15','AB031513','active',6000,5,1,'manual'); INSERT INTO business_client_profiles(id,owner,name,first_name,last_name,email,phone,date_of_birth,member_number,notes,registration_answers) VALUES('profile','owner','Alicia Brooks','Alicia','Brooks','current@example.test','8135550222','2013-03-15','AB031513','PRIVATE_INTERNAL_NOTE','{\"level\":\"Beginner\",\"consent\":false,\"extra\":\"\"}'),('foreign','other','Andrew Brown','Andrew','Brown','FOREIGN_EMAIL','FOREIGN_PHONE','2013-03-15','AB031513','FOREIGN_NOTE','{}'),('profile-only','owner','Terry Parker','Terry','Parker','terry@example.test','8135550333','1990-01-01','TP010190','PRIVATE_NOTE','{}');");
 const config={bookingCustomFields:[{id:'level',label:'Level',type:'select',options:['Beginner','Advanced']},{id:'consent',label:'Photo consent',type:'checkbox'},{id:'extra',label:'Extra',type:'text'}]};
 await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('visit','owner','2030-01-02','coach',600,30,'Confirmed',$1)",[JSON.stringify({memberNumber:'AB031513',name:'Alicia Brooks',email:'history@example.test',customAnswers:{level:'Advanced',consent:true,extra:'Old value',unknown:'PRIVATE_UNKNOWN'},created:'2030-01-01T18:00Z'})]);
 const pool={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.affectedRows||r.rows.length};}};
 const url=new URL('../app/api/public/member-lookup/route.ts',import.meta.url),nativeRequire=createRequire(url),exports={};
 new Function('require','exports',ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(p=>p.endsWith('/server/database.mjs')?{getPool:()=>pool}:nativeRequire(p),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const lookup=(body,from=origin)=>exports.POST(new Request(origin+'/api/public/member-lookup',{method:'POST',headers:{Origin:from,'Content-Type':'application/json','x-forwarded-for':'198.51.100.12'},body:JSON.stringify(body)}));
 return {pg,lookup};
}
test('ID alone restores saved contact, birth date and current answers within one business, without internal records or credit changes',async()=>{
 const {pg,lookup}=await fixture();try{
 const before=(await pg.query('SELECT * FROM customer_memberships')).rows;
 const response=await lookup({slug:'club-one',memberNumber:' ab031513 '});assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('cache-control'),/no-store/);
 const data=await response.json();assert.equal(data.firstName,'Alicia');assert.equal(data.lastName,'Brooks');assert.equal(data.dateOfBirth,'2013-03-15');assert.equal(data.email,'current@example.test');assert.equal(data.phone,'8135550222');assert.equal(data.memberNumber,'AB031513');
 assert.deepEqual(data.customAnswers,{level:'Beginner',consent:false,extra:''});assert.equal(data.membership.sessionsLeft,4);assert.equal(data.membershipCovered,true);
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE_|FOREIGN_|password|stripe_|notes|unknown/);
 assert.deepEqual((await pg.query('SELECT * FROM customer_memberships')).rows,before);
 const foreign=await (await lookup({slug:'club-two',memberNumber:'AB031513'})).json();assert.equal(foreign.firstName,'Andrew');assert.equal(foreign.email,'FOREIGN_EMAIL');assert.notEqual(foreign.email,data.email);
 const profile=await (await lookup({slug:'club-one',memberNumber:'TP010190'})).json();assert.equal(profile.firstName,'Terry');assert.equal(profile.dateOfBirth,'1990-01-01');assert.equal(profile.membership,null);
 await pg.exec("UPDATE customer_memberships SET status='pending_payment',sessions_included=0 WHERE id='member'");
 const unpaid=await (await lookup({slug:'club-one',memberNumber:'AB031513'})).json();assert.equal(unpaid.membershipCovered,false);assert.equal(unpaid.firstName,'Alicia');
 }finally{await pg.close();}
});
test('ID-only recovery preserves validation, active-business/deleted-client boundaries, optional DOB compatibility and throttling',async()=>{
 const {pg,lookup}=await fixture();try{
 assert.equal((await lookup({slug:'club-one',memberNumber:'AB031513'},'https://untrusted.invalid')).status,403);
 assert.equal((await lookup(null)).status,400);assert.equal((await lookup({slug:'club-one',memberNumber:'invalid'})).status,400);
 assert.equal((await lookup({slug:'club-one',memberNumber:'AB031513',dateOfBirth:'2013-02-30'})).status,400);
 assert.equal((await lookup({slug:'club-one',memberNumber:'AB031513',dateOfBirth:'2014-03-15'})).status,404);
 assert.equal((await lookup({slug:'club-one',memberNumber:'ZZ000000'})).status,404);
 await pg.exec("UPDATE business_client_profiles SET deleted_at=now() WHERE id='profile-only'");assert.equal((await lookup({slug:'club-one',memberNumber:'TP010190'})).status,404);
 await pg.exec("UPDATE businesses SET status='archived' WHERE id='other-biz'");assert.equal((await lookup({slug:'club-two',memberNumber:'AB031513'})).status,404);
 for(let i=0;i<9;i++)await lookup({slug:'club-one',memberNumber:'AB031513'});
 assert.equal((await lookup({slug:'club-one',memberNumber:'AB031513'})).status,429);
 }finally{await pg.close();}
});
test('service status projection supports named and ID-only services, current canonical details and malformed legacy JSON',()=>{
 const config={services:[{id:'one',name:'Private Training',category:'Coaching'},{id:'two',name:'Small Group',category:'Soccer'}]};
 assert.deepEqual(publicBookingServiceSummary({services:['Small Group'],serviceIds:['two'],email:'PRIVATE'},config),{service:'Small Group',serviceType:'Soccer'});
 assert.deepEqual(publicBookingServiceSummary({serviceIds:['one']},config),{service:'Private Training',serviceType:'Coaching'});
 assert.deepEqual(publicBookingServiceSummary({sessionId:'group'},{}),{service:'Session',serviceType:'Group session'});
 for(const raw of ['null','[]','{bad'])assert.deepEqual(publicBookingServiceSummary(raw,config),{service:'Session',serviceType:'Individual appointment'});
});
