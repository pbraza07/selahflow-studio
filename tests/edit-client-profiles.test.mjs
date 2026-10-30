import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';import ts from 'typescript';
import {issueMemberId} from '../server/member-id-policy.mjs';import {editableClientProfileFields,clientProfileAnswers} from '../server/client-profile-fields.mjs';
const root=new URL('../',import.meta.url);
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('migrations/',root))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('migrations/'+f,root),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('other','other@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','club','Club','active'),('foreign','other','foreign','Other','active')");
 const config={services:[{id:'s',name:'Training',duration:30}],staff:[{id:'coach',name:'Coach',services:['s']}],bookingCustomFields:[{id:'level',label:'Level',type:'select',options:['New'],required:true,forms:['booking'],serviceIds:['s']},{id:'session',label:'Session preference',type:'text',required:true,forms:['booking'],sessionIds:['session']},{id:'membership',label:'Membership goal',type:'text',required:true,forms:['membership']}]};
 await pg.query("INSERT INTO settings(owner,data) VALUES('owner',$1),('other','{}')",[JSON.stringify(config)]);
 const profile=randomUUID(),member=randomUUID(),complete=randomUUID(),future=randomUUID(),pending=randomUUID();
 await pg.query("INSERT INTO business_client_profiles(id,owner,name,first_name,last_name,email,phone,date_of_birth,member_number,registration_answers,registration_field_labels,import_columns) VALUES($1,'owner','Alice Doe','Alice','Doe','old@example.test','8135550000','2000-01-01','AD010100','{\"level\":\"Old\",\"legacy\":\"Saved\"}','{\"legacy\":\"Former question\"}','{\"School\":\"Old school\",\"Permission\":true}')",[profile]);
 await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Alice','Doe','old@example.test','2000-01-01','AD010100'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Gold','month',5000,8)");
 await pg.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,date_of_birth,member_number,status,stripe_account_id,price_cents,sessions_included,sessions_used,registration_answers) VALUES($1,'biz','plan','Alice Doe','old@example.test','2000-01-01','AD010100','active','manual',5000,8,2,'{\"membership\":\"Original goal\"}')",[member]);
 const data={name:'Alice Doe',email:'old@example.test',phone:'8135550000',dateOfBirth:'2000-01-01',memberNumber:'AD010100',services:['Training'],serviceIds:['s'],price:35,customAnswers:{session:'Original session'}};
 for(const [id,status,date] of [[complete,'Completed','2026-01-01'],[future,'Confirmed','2030-01-01']])await pg.query('INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,$2,$3,$4,600,30,$5,$6)',[id,'owner',date,'coach',status,JSON.stringify(data)]);
 await pg.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'biz','owner','2030-01-02','coach',600,30,$2,'owner')",[pending,JSON.stringify({...data,customerName:data.name,customerEmail:data.email,customerPhone:data.phone,quotedPrice:35})]);
 await pg.exec("INSERT INTO participation_waivers(business_id,customer_id,member_number,participant_name,date_of_birth,signer_name,signer_role,signed_date,document_version,document_hash,document) SELECT 'biz',id,'AD010100','Alice Doe','2000-01-01','Alice Doe','self','2026-01-01','v1','original-hash','{\"text\":\"Original signed evidence\"}'::jsonb FROM customer_booking_ids WHERE business_id='biz'");
 const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}},pool={...db,connect:async()=>db};
 const sourceURL=new URL('app/api/studio/clients/route.ts',root),source=await readFile(sourceURL,'utf8'),exports={},nativeRequire=createRequire(sourceURL);const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',compiled)(p=>p.endsWith('/server/database.mjs')?{getPool:()=>pool}:p.endsWith('/lib/auth')?{requireOwner:async req=>{const o=req.headers.get('x-owner');if(!o)throw Error('AUTH_REQUIRED');return o;}}:nativeRequire(p),exports);
 const origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://app.example.test').origin;
 const get=async(owner='owner')=>exports.GET(new Request(origin+'/api/studio/clients',{headers:owner?{'x-owner':owner}:{}}));
 const post=(b,owner='owner',valid=true)=>exports.POST(new Request(origin+'/api/studio/clients',{method:'POST',headers:{'Content-Type':'application/json',...(owner?{'x-owner':owner}:{}),Origin:valid?origin:'https://evil.test'},body:JSON.stringify(b)}));
 const current=async()=>(await (await get()).json()).clients.find(c=>c.id===profile);
 const edit=c=>({action:'update',clientId:c.id,editToken:c.editToken,firstName:c.firstName||'Alice',lastName:c.lastName||'Doe',email:c.email,phone:c.phone,dateOfBirth:c.dateOfBirth,memberNumber:c.memberNumber,notes:c.notes,customAnswers:clientProfileAnswers(c),importColumns:c.importColumns});
 return {pg,pool,profile,member,complete,future,pending,get,post,current,edit,close:()=>pg.close()};
}
test('owner edits every current field atomically, synchronizes current identity and preserves financial/signed/submitted history',async()=>{
 const f=await fixture();try{
 const c=await f.current(),original=(await f.pg.query('SELECT data FROM appointments WHERE id=$1',[f.complete])).rows[0].data,waiver=(await f.pg.query('SELECT * FROM participation_waivers')).rows[0];
 const r=await f.post({...f.edit(c),firstName:'Alicia Mia',lastName:'De Souza',dateOfBirth:'2001-02-03',memberNumber:'AD020301',email:'updated@example.test',phone:'8135559999',notes:'Updated notes',customAnswers:{level:'New',session:'Updated session',membership:'Updated goal',legacy:'Corrected'},importColumns:{School:'New school',Permission:false}});assert.equal(r.status,200,await r.clone().text());
 const n=await f.current();assert.equal(n.name,'Alicia Mia De Souza');assert.equal(n.firstName,'Alicia Mia');assert.equal(n.lastName,'De Souza');assert.equal(n.memberNumber,'AD020301');assert.equal(n.dateOfBirth,'2001-02-03');assert.equal(n.email,'updated@example.test');assert.equal(n.phone,'8135559999');assert.equal(n.notes,'Updated notes');assert.deepEqual(n.importColumns,{School:'New school',Permission:false});assert.equal(n.registrationAnswers.membership,'Updated goal');assert.equal(n.registrationAnswers.legacy,'Corrected');assert.equal(n.history.length,3,'former IDs keep completed history attached');
 const member=(await f.pg.query('SELECT * FROM customer_memberships WHERE id=$1',[f.member])).rows[0];assert.equal(member.customer_name,n.name);assert.equal(member.customer_email,n.email);assert.equal(member.member_number,n.memberNumber);assert.equal(member.price_cents,5000);assert.equal(member.sessions_used,2);assert.equal(member.sessions_included,8);assert.equal(member.registration_answers.membership,'Original goal','original enrollment answer retained');
 assert.equal((await f.pg.query('SELECT data FROM appointments WHERE id=$1',[f.complete])).rows[0].data,original);
 const active=JSON.parse((await f.pg.query('SELECT data FROM appointments WHERE id=$1',[f.future])).rows[0].data);assert.equal(active.name,n.name);assert.equal(active.originalClientProfile.name,'Alice Doe');assert.equal(active.price,35);
 const pending=JSON.parse((await f.pg.query('SELECT details FROM booking_requests WHERE id=$1',[f.pending])).rows[0].details);assert.equal(pending.customerEmail,n.email);assert.equal(pending.originalSubmission.customerName,'Alice Doe');assert.equal(pending.customAnswers.session,'Original session');
 const signed=(await f.pg.query('SELECT * FROM participation_waivers')).rows[0];assert.deepEqual(signed.document,waiver.document);assert.equal(signed.document_hash,waiver.document_hash);assert.equal(signed.participant_name,'Alice Doe');assert.ok(signed.deleted_at);assert.equal(signed.retention_status,'identity_corrected');
 const identity=(await f.pg.query("SELECT * FROM customer_booking_ids WHERE business_id='biz'")).rows[0];assert.equal(identity.first_name,'Alicia Mia');assert.equal(identity.member_number,n.memberNumber);
 assert.equal(await issueMemberId(f.pool,{businessId:'biz',name:n.name,firstName:n.firstName,lastName:n.lastName,dateOfBirth:n.dateOfBirth}),n.memberNumber);
 assert.ok((await f.pg.query("SELECT retired_at FROM business_member_ids WHERE business_id='biz' AND member_number='AD010100'")).rows[0].retired_at);
 assert.equal((await f.post(f.edit(c))).status,409,'stale browser cannot restore previous values');
 }finally{await f.close();}
});
test('contact-only edits allow blank optional answers without requiring unrelated registration questions or a new waiver',async()=>{
 const f=await fixture();try{
 const c=await f.current(),r=await f.post({...f.edit(c),email:'',phone:'',customAnswers:{level:'',session:'',membership:'',legacy:''},notes:'Only current profile changes'});assert.equal(r.status,200,await r.clone().text());const n=await f.current();assert.equal(n.email,'');assert.equal(n.phone,'');assert.equal(n.memberNumber,'AD010100');assert.equal(n.registrationAnswers.level,'');assert.equal((await f.pg.query('SELECT deleted_at FROM participation_waivers')).rows[0].deleted_at,null);
 }finally{await f.close();}
});
test('profile editing rejects foreign, unauthenticated, stale, invalid-date, malformed-ID and collision changes without partial writes',async()=>{
 const f=await fixture();try{
 const c=await f.current();assert.equal((await f.get(null)).status,401);assert.equal((await f.post(f.edit(c),null)).status,401);assert.equal((await f.post(f.edit(c),'owner',false)).status,403);assert.equal((await f.post(f.edit(c),'other')).status,409);
 for(const patch of [{dateOfBirth:'2000-02-30'},{memberNumber:'ZZ999999'},{editToken:'stale'},{importColumns:{NewUnknownField:'value'}},{customAnswers:{unknown:'value'}}]){const r=await f.post({...f.edit(c),...patch});assert.notEqual(r.status,200);assert.equal((await f.current()).email,c.email);}
 await f.pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('biz','Andy','Davis','other@example.test','2001-02-03','AD020301')");
 const collision=await f.post({...f.edit(c),dateOfBirth:'2001-02-03',memberNumber:'AD020301'});assert.equal(collision.status,409,await collision.clone().text());assert.equal((await f.current()).memberNumber,'AD010100');
 }finally{await f.close();}
});
test('a corrected client can be deleted once and both former/current IDs are released without stale restoration',async()=>{
 const f=await fixture();try{
 const c=await f.current();let r=await f.post({...f.edit(c),dateOfBirth:'2001-02-03',memberNumber:'AD020301'});assert.equal(r.status,200,await r.clone().text());const n=await f.current();r=await f.post({action:'delete',clientId:n.id,confirmPhrase:'DELETE CLIENT'});assert.equal(r.status,200,await r.clone().text());assert.equal((await f.pg.query("SELECT * FROM business_member_ids WHERE business_id='biz'")).rows.length,0);assert.equal((await f.post(f.edit(c))).status,409);assert.equal(await issueMemberId(f.pool,{businessId:'biz',name:'Another Doe',dateOfBirth:'2000-01-01'}),'AD010100');
 assert.ok((await f.pg.query('SELECT document FROM participation_waivers')).rows.length,'signed evidence retained');
 }finally{await f.close();}
});
test('editor catalog includes membership/session/service, removed saved questions and current values without editing definitions',()=>{
 const config={bookingCustomFields:[{id:'member',label:'Membership',forms:['membership'],sessionIds:['private'],type:'select',options:['New'],required:true}]},client={registrationAnswers:{member:'Old',removed:false},registrationFieldLabels:{removed:'Former consent'}};const fields=editableClientProfileFields(config,client);assert.equal(fields.length,2);assert.deepEqual(fields[0].options,['New','Old']);assert.equal(fields[0].required,false);assert.equal(fields[1].label,'Former consent');assert.equal(fields[1].type,'checkbox');assert.deepEqual(config.bookingCustomFields[0].forms,['membership']);
});

test('owner creates a no-DOB client with the business sequence and keeps that ID after identity edits',async()=>{
 const f=await fixture();try{
 const config=JSON.parse((await f.pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data);config.bookingStandardFields={dateOfBirth:{required:false}};await f.pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(config)]);
 const created=await f.post({action:'create',firstName:'Alex',lastName:'Brown',dateOfBirth:'',memberNumber:'',email:'alex@example.test',phone:'8135550123',customAnswers:{level:'New'},notes:''});assert.equal(created.status,200,await created.clone().text());
 const {clientId}=await created.json();const client=(await(await f.get()).json()).clients.find(c=>c.id===clientId);assert.equal(client.memberNumber,'AB1001');assert.equal(client.idUsesSequence,true);
 const changed=await f.post({...f.edit(client),clientId,firstName:'Alexandra',lastName:'Brown',dateOfBirth:'2000-02-29',memberNumber:'AB1001'});assert.equal(changed.status,200,await changed.clone().text());
 const after=(await(await f.get()).json()).clients.find(c=>c.id===clientId);assert.equal(after.memberNumber,'AB1001');assert.equal(after.dateOfBirth,'2000-02-29');assert.equal(after.name,'Alexandra Brown');
 assert.equal((await f.pg.query("SELECT member_id_sequence FROM businesses WHERE id='biz'")).rows[0].member_id_sequence,1001);
 const missingId=randomUUID();await f.pg.query("INSERT INTO business_client_profiles(id,owner,name,first_name,last_name,email) VALUES($1,'owner','Chris Davis','Chris','Davis','chris@example.test')",[missingId]);
 const withoutId=(await(await f.get()).json()).clients.find(c=>c.id===missingId);const assigned=await f.post({...f.edit(withoutId),clientId:missingId,firstName:'Chris',lastName:'Davis',dateOfBirth:'',memberNumber:'',phone:'8135550199'});assert.equal(assigned.status,200,await assigned.clone().text());
 const assignedClient=(await(await f.get()).json()).clients.find(c=>c.id===missingId);assert.equal(assignedClient.memberNumber,'CD1002');assert.equal(assignedClient.idUsesSequence,true);

 }finally{await f.close();}
});
