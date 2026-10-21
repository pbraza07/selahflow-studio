import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {membershipAllows,validateMembershipEligibility} from '../server/membership-eligibility.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
const selected={mode:'selected',serviceIds:['training'],sessionIds:['pickup']};
test('plan scope covers selected services or recurring series, rejects mixed/unlisted selections and foreign catalog IDs',()=>{
 assert.equal(membershipAllows(null,{serviceIds:['anything']}),true);
 assert.equal(membershipAllows(selected,{serviceIds:['training']}),true);
 assert.equal(membershipAllows(selected,{serviceIds:['training','party']}),false);
 assert.equal(membershipAllows(selected,{serviceIds:['soccer'],sessionId:'pickup__20300102'}),true);
 assert.equal(membershipAllows(selected,{serviceIds:['soccer'],sessionId:'other'}),false);
 assert.equal(membershipAllows(selected,{}),false);
 const config={services:[{id:'training'}],bookableSessions:[{id:'pickup'}]};
 assert.deepEqual(validateMembershipEligibility(selected,config),selected);
 assert.throws(()=>validateMembershipEligibility({...selected,serviceIds:['foreign']},config),/this business/);
 assert.throws(()=>validateMembershipEligibility({mode:'selected',serviceIds:[],sessionIds:[]},config),/at least one/);
 assert.deepEqual(validateMembershipEligibility({mode:'all'},config),{mode:'all',serviceIds:[],sessionIds:[]});
});
async function fixture(){
 const pg=new PGlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','test-biz','Test','active'),('foreign','other','foreign-biz','Other','active'); INSERT INTO business_subscriptions(business_id,plan_code) VALUES('biz','business'),('foreign','business');");
 const config={open:8,close:20,buffer:0,services:[{id:'training',name:'Training',duration:30,price:30},{id:'party',name:'Party',duration:30,price:90}],staff:[{id:'coach',services:['training','party']}],bookableSessions:[]};
 await pg.query("INSERT INTO settings(owner,data) VALUES('owner',$1),('other','{}')",[JSON.stringify(config)]);
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.affectedRows||r.rows.length};},release(){}},pool={...db,connect:async()=>db};
 const url=new URL('../app/api/studio/memberships/route.ts',import.meta.url),exports={},nativeRequire=createRequire(url);
 const compiled=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>pool}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exports);
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const post=(body,owner='owner',valid=true)=>exports.POST(new Request(new URL('/api/studio/memberships',origin),{method:'POST',headers:{'Content-Type':'application/json',...(owner?{'x-test-owner':owner}:{}),Origin:valid?new URL(origin).origin:'https://untrusted.invalid'},body:JSON.stringify(body)}));
 return {pg,pool,post,config};
}
test('owner saves and edits plan coverage within own catalog; booking approval and manual credit usage enforce it',async()=>{
 const {pg,pool,post,config}=await fixture();try{
 const input={action:'save',name:'Training only',description:'Training credits',interval:'month',priceCents:10000,sessionsIncluded:8,creditEligibility:{mode:'selected',serviceIds:['training'],sessionIds:[]}};
 assert.equal((await post(input,'')).status,401);
 assert.equal((await post(input,'owner',false)).status,403);
 const invalid=await post({...input,creditEligibility:{...input.creditEligibility,serviceIds:['foreign']}});assert.equal(invalid.status,400,await invalid.text());
 const saved=await post(input);assert.equal(saved.status,200,await saved.text());
 const plan=(await pg.query("SELECT * FROM membership_plans WHERE business_id='biz'")).rows[0];
 assert.deepEqual(plan.credit_eligibility,input.creditEligibility);
 assert.notEqual((await post({...input,id:plan.id},'other')).status,200);
 await pg.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,sessions_included,sessions_used,member_number,stripe_account_id) VALUES('11111111-1111-4111-8111-111111111111','biz',$1,'Test Member','test@example.test','active',10000,8,0,'TM010190','manual')",[plan.id]);
 const book=service=>confirmBooking({pool,owner:'owner',services:[config.services.find(s=>s.id===service)],staff:'coach',date:'2030-01-01',start:600,duration:30,buffer:0,id:'booking-'+service,data:{memberNumber:'TM010190',serviceIds:[service],membershipCovered:true,membershipCreditAllowed:true,price:0}});
 await assert.rejects(book('party'),/do not cover/);
 await book('training');
 await pg.query("UPDATE appointments SET status='Completed' WHERE id='booking-training'");
 await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('party-paid','owner','2030-01-02','coach',600,30,'Completed',$1)",[JSON.stringify({memberNumber:'TM010190',serviceIds:['party'],membershipCreditAllowed:true,price:90})]);
 assert.notEqual((await post({action:'recordSession',id:'11111111-1111-4111-8111-111111111111',appointmentId:'party-paid'})).status,200);
 assert.equal((await pg.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,0);
 assert.equal((await post({action:'recordSession',id:'11111111-1111-4111-8111-111111111111',appointmentId:'booking-training'})).status,200);
 assert.equal((await pg.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,1);
 const updated=await post({...input,id:plan.id,creditEligibility:{mode:'all'}});assert.equal(updated.status,200,await updated.text());
 assert.equal((await pg.query('SELECT credit_eligibility FROM membership_plans WHERE id=$1',[plan.id])).rows[0].credit_eligibility.mode,'all');
 assert.equal((await pg.query('SELECT sessions_used FROM customer_memberships')).rows[0].sessions_used,1);
 }finally{await pg.close();}
});
