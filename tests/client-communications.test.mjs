import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';import ts from 'typescript';
import * as communications from '../server/client-communications.mjs';
import {deleteClientPermanently} from '../server/delete-client.mjs';
const root=new URL('../',import.meta.url);
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('migrations/'+f,root),'utf8'));
 const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},db={query,release(){}},pool={...db,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('other','other@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status,brand_primary) VALUES('biz','owner','club','Training Club','active','#235544'),('foreign','other','other','Foreign Club','active','#883311'); INSERT INTO settings(owner,data) VALUES('owner','{\"name\":\"Training Club\",\"address\":\"123 Training Lane\"}'),('other','{}')");
 const ids={one:randomUUID(),two:randomUUID(),other:randomUUID(),missing:randomUUID(),archived:randomUUID(),deleted:randomUUID()};
 for(const [id,owner,name,email,archived,deleted] of [[ids.one,'owner','Client One','family@example.test',false,null],[ids.two,'owner','Client Two','FAMILY@example.test',false,null],[ids.other,'other','Other Tenant','family@example.test',false,null],[ids.missing,'owner','No Email','',false,null],[ids.archived,'owner','Archived','archived@example.test',true,null],[ids.deleted,'owner','Deleted','deleted@example.test',false,new Date()]])await query('INSERT INTO business_client_profiles(id,owner,name,email,archived,deleted_at) VALUES($1,$2,$3,$4,$5,$6)',[id,owner,name,email,archived,deleted]);
 return {pg,pool,query,ids,close:()=>pg.close()};
}
const draft=(contactIds)=>({subject:'Update from {{business_name}}',body:'Hello {{client_name}},\nNew sessions are available. <script>alert(1)</script>',contactIds,actionLabel:'View sessions',actionUrl:'https://example.test/book'});
test('contact sync is current, deduplicated and scoped; preview is branded and never sends',async()=>{
 const f=await fixture();try{
 const b=await communications.communicationBusiness(f.pool,'owner'),d=await communications.communicationContacts(f.pool,b);
 assert.equal(d.clientCount,3);assert.equal(d.missingEmail,1);assert.equal(d.contacts.length,1);assert.deepEqual(d.contacts[0].names.sort(),['Client One','Client Two']);assert.equal(d.contacts[0].email,'family@example.test');
 assert.equal((await communications.communicationContacts(f.pool,await communications.communicationBusiness(f.pool,'other'))).contacts.length,1);assert.notEqual(d.contacts[0].id,communications.communicationContactId('foreign','family@example.test'));
 const p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([d.contacts[0].id]),origin:'https://app.example.test'});
 assert.equal(p.recipientCount,1);assert.match(p.html,/Training Club/);assert.match(p.html,/#235544/i);assert.match(p.html,/&lt;script&gt;/);assert.doesNotMatch(p.html,/<script>|Foreign Club/);assert.match(p.html,/Unsubscribe/);assert.match(p.html,/View sessions/);
 assert.equal((await f.query('SELECT status FROM business_communication_recipients')).rows[0].status,'draft');
 await assert.rejects(communications.queueCommunication(f.pool,{owner:'other',campaignId:p.id,env:{APP_ENV:'test'}}),/not found/);
 const sent=[];await communications.processCommunicationEmails(f.pool,{send:async()=>{sent.push(1);return {status:'submitted'};}});assert.equal(sent.length,0,'draft preview sends nothing');
 await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});assert.equal((await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}})).alreadyQueued,true);
 await communications.processCommunicationEmails(f.pool,{send:async(channel,to,m,env,fetcher,context)=>{sent.push(m);assert.equal(channel,'email');assert.equal(to,'family@example.test');assert.equal(context.businessId,'biz');assert.match(m.subject,/Training Club/);assert.match(m.text,/Client One, Client Two/);assert.match(m.text,/123 Training Lane/);assert.equal(m.trackAmbiguous,true);assert.match(m.idempotencyKey,/business-communication-/);return {status:'submitted'};}});
 await communications.processCommunicationEmails(f.pool,{send:async()=>{throw Error('must not replay');}});assert.equal(sent.length,1);
 const h=await communications.communicationCampaigns(f.pool,'biz');assert.equal(h[0].submitted,1);assert.equal(h[0].total,1);assert.equal((await communications.communicationCampaigns(f.pool,'foreign')).length,0);
 }finally{await f.close();}
});
test('unsubscribe is business scoped, idempotent, survives sync and blocks queued/future communications only',async()=>{
 const f=await fixture();try{
 const b=await communications.communicationBusiness(f.pool,'owner'),c=(await communications.communicationContacts(f.pool,b)).contacts[0];
 const p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});
 const row=(await f.query('SELECT * FROM business_communication_recipients')).rows[0],token=row.unsubscribe_url.split('/').at(-1);
 assert.equal(await communications.unsubscribeCommunication(f.pool,'invalid'),null);assert.equal((await communications.unsubscribeCommunication(f.pool,token)).ok,true);assert.equal((await communications.unsubscribeCommunication(f.pool,token)).ok,true);
 assert.equal((await communications.communicationContacts(f.pool,b)).contacts[0].unsubscribed,true);assert.equal((await communications.communicationContacts(f.pool,await communications.communicationBusiness(f.pool,'other'))).contacts[0].unsubscribed,false);
 await assert.rejects(communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'}),/changed or unsubscribed/);
 await communications.processCommunicationEmails(f.pool,{send:async()=>{throw Error('unsubscribed cannot send');}});assert.equal((await f.query('SELECT status FROM business_communication_recipients')).rows[0].status,'skipped');
 assert.equal((await f.query('SELECT count(*)::int AS n FROM booking_receipt_emails')).rows[0].n,0,'transactional queues unchanged');
 }finally{await f.close();}
});
test('preview rejects stale recipients/branding and worker skips archived or changed contacts; unknown sends never replay',async()=>{
 const f=await fixture();try{
 const b=await communications.communicationBusiness(f.pool,'owner'),c=(await communications.communicationContacts(f.pool,b)).contacts[0];
 let p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});
 await f.query("UPDATE businesses SET brand_primary='#112233' WHERE id='biz'");await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}}),/branding changed/);
 p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await f.query("UPDATE business_client_profiles SET name='Edited Name' WHERE id=$1",[f.ids.one]);await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}}),/Contacts changed/);
 p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});await f.query('UPDATE business_client_profiles SET archived=true WHERE id=$1',[f.ids.one]);
 let sends=0;await communications.processCommunicationEmails(f.pool,{send:async()=>{sends++;return {status:'submitted'};}});assert.equal(sends,0,'edited/removed family identity cannot receive a stale personalized message');
 p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});
 await communications.processCommunicationEmails(f.pool,{send:async()=>{sends++;throw Error('ambiguous timeout');}});await communications.processCommunicationEmails(f.pool,{send:async()=>{sends++;return {status:'submitted'};}});assert.equal(sends,1);assert.equal((await communications.communicationCampaigns(f.pool,'biz')).find(x=>x.id===p.id).unknown,1);
 }finally{await f.close();}
});
test('cancellation and permanent client deletion remove eligible communication PII without affecting another tenant',async()=>{
 const f=await fixture();try{
 const b=await communications.communicationBusiness(f.pool,'owner'),c=(await communications.communicationContacts(f.pool,b)).contacts[0];
 let p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});await communications.cancelCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}}),/cancelled/);
 p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});
 await f.query('BEGIN');try{const result=await deleteClientPermanently(f.pool,{owner:'owner',businessId:'biz',client:{id:f.ids.one,name:'Client One',email:'family@example.test',history:[]}});assert.equal(result.removed.business_communication_recipients,2);await f.query('COMMIT');}catch(e){await f.query('ROLLBACK');throw e;}
 assert.equal((await f.query("SELECT count(*)::int AS n FROM business_communication_recipients WHERE business_id='biz'")).rows[0].n,0);assert.equal((await f.query('SELECT id FROM business_client_profiles WHERE id=$1',[f.ids.two])).rows.length,1);assert.equal((await f.query('SELECT id FROM business_client_profiles WHERE id=$1',[f.ids.other])).rows.length,1);
 const current=(await communications.communicationContacts(f.pool,b)).contacts;assert.deepEqual(current[0].names,['Client Two']);
 await communications.processCommunicationEmails(f.pool,{send:async()=>{throw Error('deleted message cannot send');}});
 }finally{await f.close();}
});
test('communication composition rejects unsafe links, headers, empty messages and oversized recipient lists',async()=>{
 for(const patch of [{subject:'bad\r\nBcc: other@example.test'},{actionUrl:'javascript:alert(1)'},{actionUrl:'https://user:password@example.test'},{actionLabel:''},{body:''}])assert.throws(()=>communications.validateCommunication({...draft([]),...patch}));
 const f=await fixture();try{await assert.rejects(communications.previewCommunication(f.pool,{owner:'owner',input:draft(Array.from({length:501},()=> 'a'.repeat(64))),origin:'https://app.example.test'}),/between 1 and 500/);}finally{await f.close();}
});
test('owner API rejects unauthenticated/cross-origin callers; unsubscribe GET does not opt out and POST requires a same-origin confirmation',async()=>{
 const f=await fixture();try{
 const globalKey='__communicationsApiTest';globalThis[globalKey]={...communications,getPool:()=>f.pool,deliveryProviderStatusWithConnection:async()=>({emailConfigured:true,emailProvider:'Gmail'}),requireOwner:async req=>{if(req.headers.get('x-owner'))return req.headers.get('x-owner');throw Error('AUTH_REQUIRED');},validOrigin:req=>req.headers.get('origin')==='https://app.example.test',trustedOrigin:()=> 'https://app.example.test',tokenHash:(await import('../server/security.mjs')).tokenHash};
 const load=async path=>{let source=await readFile(new URL(path,root),'utf8');const names=[...source.matchAll(/^import \{([^}]+)\}[^;]+;/gm)].flatMap(m=>m[1].split(',').map(s=>s.trim()));source='const {'+names.join(',')+'}=globalThis.'+globalKey+';\n'+source.replace(/^import .*;$/gm,'');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));};
 const api=await load('app/api/studio/communications/route.ts');
 const request=(owner,body,origin='https://app.example.test')=>new Request('https://app.example.test/api/studio/communications',{method:body?'POST':'GET',headers:{...(owner?{'x-owner':owner}:{}),origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api.GET(request(null))).status,401);assert.equal((await api.POST(request(null,{action:'preview'}))).status,401);assert.equal((await api.POST(request('owner',{action:'preview'},'https://evil.test'))).status,403);
 const list=await (await api.GET(request('owner'))).json();assert.equal(list.contacts.length,1);assert.doesNotMatch(JSON.stringify(list),/Other Tenant|deleted@example/);
 const p=await (await api.POST(request('owner',{action:'preview',...draft([list.contacts[0].id])}))).json();assert.ok(p.id);
 assert.equal((await api.POST(request('other',{action:'send',campaignId:p.id,env:{APP_ENV:'test'}}))).status,400);
 const row=(await f.query('SELECT unsubscribe_url FROM business_communication_recipients WHERE campaign_id=$1',[p.id])).rows[0],token=row.unsubscribe_url.split('/').at(-1),ctx={params:Promise.resolve({token})},unsubscribe=await load('app/communications/unsubscribe/[token]/route.ts');
 assert.equal((await unsubscribe.GET(new Request(row.unsubscribe_url),ctx)).status,200);assert.equal((await f.query('SELECT * FROM business_communication_suppressions')).rows.length,0,'GET link scanners cannot unsubscribe');
 assert.equal((await unsubscribe.POST(new Request(row.unsubscribe_url,{method:'POST',headers:{origin:'https://evil.test'}}),ctx)).status,403);assert.equal((await unsubscribe.POST(new Request(row.unsubscribe_url,{method:'POST',headers:{origin:'https://app.example.test'}}),ctx)).status,200);
 delete globalThis[globalKey];
 }finally{await f.close();}
});
test('sync includes booking-only, pending and membership-only clients and respects archived membership profiles',async()=>{
 const f=await fixture();try{
 const memberId=randomUUID();
 await f.pg.exec("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Member Plan','month',1000,2)");
 await f.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,date_of_birth,status,price_cents,sessions_included,member_number,stripe_account_id) VALUES($1,'biz','plan','Member Only','member@example.test','2000-02-02','active',1000,2,'MO020200','manual')",[memberId]);
 await f.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,'owner','2030-01-02','coach',600,30,$2,'Confirmed')",[randomUUID(),JSON.stringify({name:'Booking Only',email:'booking@example.test'})]);
 await f.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'biz','owner','2030-01-02','coach',660,30,$2,'owner')",[randomUUID(),JSON.stringify({customerName:'Pending Only',customerEmail:'pending@example.test'})]);
 const business=await communications.communicationBusiness(f.pool,'owner');let d=await communications.communicationContacts(f.pool,business);assert.deepEqual(d.contacts.map(c=>c.email).sort(),['booking@example.test','family@example.test','member@example.test','pending@example.test']);
 await f.query("INSERT INTO business_client_profiles(id,owner,source_key,name,email,archived) VALUES($1,'owner',$2,'Member Only','member@example.test',true)",[randomUUID(),'membership-'+memberId]);
 d=await communications.communicationContacts(f.pool,business);assert.equal(d.contacts.some(c=>c.email==='member@example.test'),false,'archived member cannot reappear from membership fallback');
 }finally{await f.close();}
});
test('failed sends are bounded and ambiguous in-flight outcomes do not replay; client deletion cannot race a claimed email',async()=>{
 const f=await fixture();try{
 const b=await communications.communicationBusiness(f.pool,'owner'),c=(await communications.communicationContacts(f.pool,b)).contacts[0];let p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});
 let sends=0;for(let i=0;i<4;i++){await f.query("UPDATE business_communication_recipients SET next_attempt_at=now()-interval '1 minute'");await communications.processCommunicationEmails(f.pool,{send:async()=>{sends++;return {status:'failed',detail:'Simulated provider rejection'};}});}assert.equal(sends,3);let h=(await communications.communicationCampaigns(f.pool,'biz'))[0];assert.equal(h.failed,1);assert.equal(h.pending,0);
 p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'test'}});await f.query("UPDATE business_communication_recipients SET status='processing' WHERE campaign_id=$1",[p.id]);
 await f.query('BEGIN');await assert.rejects(deleteClientPermanently(f.pool,{owner:'owner',businessId:'biz',client:{id:f.ids.one,name:'Client One',email:'family@example.test',history:[]}}),/currently being sent/);await f.query('ROLLBACK');assert.equal((await f.query('SELECT id FROM business_client_profiles WHERE id=$1',[f.ids.one])).rows.length,1);
 await f.query("UPDATE business_communication_recipients SET updated_at=now()-interval '11 minutes' WHERE campaign_id=$1",[p.id]);await communications.processCommunicationEmails(f.pool,{send:async()=>{throw Error('cannot replay ambiguous claim');}});h=(await communications.communicationCampaigns(f.pool,'biz')).find(x=>x.id===p.id);assert.equal(h.unknown,1);
 }finally{await f.close();}
});

test('personalization preserves literal replacement characters in client and business names',()=>{
 const m=communications.communicationMessage({subject:'{{business_name}}',body:'Hello {{client_name}}',action_url:''},{names:'Client $&',unsubscribe_url:'https://app.example.test/unsubscribe'},{name:'Club $&',data:{}});
 assert.equal(m.subject,'Club $&');assert.match(m.text,/Hello Client \$&/);
});

test('staging preflight rejects disallowed recipients before queueing and history explains failures; retry excludes submitted and unknown',async()=>{
 const f=await fixture();try{
 const c=(await communications.communicationContacts(f.pool,await communications.communicationBusiness(f.pool,'owner'))).contacts[0];
 const p=await communications.previewCommunication(f.pool,{owner:'owner',input:draft([c.id]),origin:'https://app.example.test'});
 const env={APP_ENV:'staging',STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_NOTIFICATION_EMAILS:'approved@example.test'};
 await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env}),/approved test recipients/);
 assert.equal((await f.query('SELECT status FROM business_communication_recipients')).rows[0].status,'draft');
 await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,env:{APP_ENV:'production'}});
 await communications.processCommunicationEmails(f.pool,{send:async()=>({status:'failed',detail:'Gmail rejected email (HTTP 403)'})});
 const h=(await communications.communicationCampaigns(f.pool,'biz'))[0];assert.equal(h.delivery_issues[0].detail,'Gmail rejected email (HTTP 403)');assert.equal(h.delivery_issues[0].attempts,1);assert.ok(h.delivery_issues[0].nextAttemptAt);
 await assert.rejects(communications.queueCommunication(f.pool,{owner:'other',campaignId:p.id,retry:true}),/not found/);
 await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,retry:true,env}),/approved test recipients/);
 await communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,retry:true,env:{APP_ENV:'production'}});
 let sends=0;await communications.processCommunicationEmails(f.pool,{send:async()=>{sends++;return {status:'submitted'};}});
 await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,retry:true}),/No rejected emails/);assert.equal(sends,1);
 await f.query("UPDATE business_communication_recipients SET status='unknown'");await assert.rejects(communications.queueCommunication(f.pool,{owner:'owner',campaignId:p.id,retry:true}),/No rejected emails/);
 assert.equal(communications.communicationSetup({APP_ENV:'staging'}).stagingDeliveryEnabled,false);
 }finally{await f.close();}
});
