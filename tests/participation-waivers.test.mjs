import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {waiverDocument,waiverMinor,waiverToday,validateWaiverSignature,requiresWaiver} from '../server/waiver-content.mjs';
import {ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument,assertWaiverLegalReview} from '../server/participation-waivers.mjs';
import {deleteClientPermanently} from '../server/delete-client.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
const config={name:'Arcila Training',services:[{id:'training',requiresWaiver:true}]},services=config.services;
const signature=(options={})=>({signature:'Jane Doe',role:'self',date:waiverToday(),accepted:true,version:'participation-1',documentHash:publicWaiverDocument(config).hash,...options});
test('waiver branding uses only the business identity and readable palette',()=>{
 const doc=waiverDocument(config,'#000000','#831100');
 assert.equal(doc.businessName,'Arcila Training');assert.equal(doc.colors.header,'#000000');assert.equal(doc.colors.hero,'#831100');
 assert.doesNotMatch(JSON.stringify(doc),/selah\s?flow/i);assert.match(JSON.stringify(doc),/Arcila Training/);
 assert.equal(requiresWaiver([{requiresWaiver:true}]),true);assert.equal(requiresWaiver([{}]),false);
});
test('signing requires explicit consent, current date and version, matching adult signature or a guardian for minors',()=>{
 const context={participantName:'Jane Doe',dateOfBirth:'1990-01-01'};
 assert.equal(validateWaiverSignature(signature(),context).signerName,'Jane Doe');
 for(const input of [null,signature({accepted:false}),signature({version:'stale'}),signature({date:'2000-01-01'}),signature({signature:'Other Person'}),signature({role:'coach'}),signature({signature:'<script>'})])assert.throws(()=>validateWaiverSignature(input,context));
 assert.throws(()=>validateWaiverSignature(signature(),{...context,dateOfBirth:'2015-01-01'}),/guardian/);
 assert.equal(validateWaiverSignature(signature({role:'parent',signature:'Parent Doe'}),{...context,dateOfBirth:'2015-01-01'}).signerRole,'parent');
 assert.equal(waiverMinor('2008-10-20','2026-10-20'),false);assert.equal(waiverMinor('2008-10-21','2026-10-20'),true);
 assert.equal(waiverToday(new Date('2026-10-20T02:00:00Z')),'2026-10-19');
});
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 for(const owner of ['owner-a','owner-b']){
 await pg.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','hash']);
 await pg.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES($1,$1,$1,'Example','active')",[owner]);
 await pg.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES($1,'Jane','Doe','jane@example.test','1990-01-01','JD010190')",[owner]);
 }return pg;
}
test('signed waivers persist exact wording, are once per verified business identity, and cannot cross businesses',async()=>{
 const pg=await fixture();try{
 const args={businessId:'owner-a',memberNumber:'JD010190',config,services,input:signature(),audit:{ip:'192.0.2.1',userAgent:'test-browser'}};
 await assert.rejects(()=>ensureParticipationWaiver(pg,{...args,input:null}),/sign/);
 await assert.rejects(()=>ensureParticipationWaiver(pg,{...args,input:signature({documentHash:'forged'})}),/changed/);
 const id=await ensureParticipationWaiver(pg,args);assert.ok(id);
 assert.equal(await ensureParticipationWaiver(pg,{...args,input:null}),id,'Existing signature requires no resubmission');
 await assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD010190'});
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-b',config,serviceIds:['training'],memberNumber:'JD010190'}),/required/);
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'XX0101'}),/required/);
 assert.equal(await ensureParticipationWaiver(pg,{...args,services:[{}],input:null}),null);
 const row=(await pg.query('SELECT * FROM participation_waivers WHERE id=$1',[id])).rows[0];
 assert.equal(row.request_ip,'192.0.2.1');assert.equal(row.user_agent,'test-browser');
 assert.equal(row.document.businessName,'Arcila Training');assert.equal(row.document_hash.length,64);assert.equal(row.signer_name,'Jane Doe');
 assert.equal(await ensureParticipationWaiver(pg,{...args,config:{...config,name:'Renamed'},input:null}),id,'Later business name/theme changes do not require repeat signing');
 await pg.query("UPDATE participation_waivers SET document_version='prior-version' WHERE id=$1",[id]);
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD010190'}),/required/);
 await assert.rejects(()=>ensureParticipationWaiver(pg,{...args,input:null}),/sign/);
 const next=await ensureParticipationWaiver(pg,args);assert.notEqual(next,id);
 await pg.query('DELETE FROM participation_waivers WHERE id=$1',[next]);
 await pg.query("DELETE FROM customer_booking_ids WHERE business_id='owner-a'");
 assert.equal((await pg.query('SELECT * FROM participation_waivers')).rows.length,1,'Consent evidence survives deletion');
 assert.equal((await pg.query('SELECT customer_id FROM participation_waivers')).rows[0].customer_id,null,'Retained consent cannot donate its signature to a new identity');
 assert.equal((await pg.query("SELECT * FROM customer_booking_ids WHERE business_id='owner-b'")).rows.length,1);
 }finally{await pg.close();}
});

test('production requires explicit current-version legal review; staging remains testable',()=>{
 assert.throws(()=>assertWaiverLegalReview({},'participation-1',{NODE_ENV:'production'}),/legal review/);
 assert.throws(()=>assertWaiverLegalReview({waiverLegalReview:{version:'old',reference:'review',reviewedAt:'2026-10-01'}},'participation-1',{NODE_ENV:'production'}),/legal review/);
 assert.doesNotThrow(()=>assertWaiverLegalReview({},'participation-1',{NODE_ENV:'production',APP_ENV:'staging'}));
 assert.doesNotThrow(()=>assertWaiverLegalReview({waiverLegalReview:{version:'participation-1',reference:'review',reviewedAt:'2026-10-01'}},'participation-1',{NODE_ENV:'production'}));
});

test('deleted client can reclaim the same eight-character ID without restoring records or inheriting detached consent',async()=>{
 const pg=await fixture();try{
  const db={query:async(sql,args)=>{const result=await pg.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};}};
  await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,member_number,date_of_birth) VALUES('profile-a','owner-a','Jane Doe','jane@example.test','JD010190','1990-01-01')");
  const previous=(await pg.query("SELECT * FROM customer_booking_ids WHERE business_id='owner-a'")).rows[0];
  const args={businessId:'owner-a',memberNumber:'JD010190',config,services,input:signature()};
  const signedId=await ensureParticipationWaiver(db,args);
  const nextService={...config,services:[{id:'soccer',requiresWaiver:true}]};
  assert.equal(await ensureParticipationWaiver(db,{...args,config:nextService,services:nextService.services,input:null}),signedId);
  await assertBookingWaiver(db,{owner:'owner-a',config:nextService,serviceIds:['soccer'],memberNumber:'JD010190'});
  await pg.query('BEGIN');
  await deleteClientPermanently(db,{owner:'owner-a',businessId:'owner-a',client:{id:'profile-a',name:'Jane Doe',email:'jane@example.test',dateOfBirth:'1990-01-01',memberNumber:'JD010190'}});
  await pg.query('COMMIT');
  const retained=(await pg.query('SELECT w.* FROM participation_waivers w JOIN businesses b ON b.id=w.business_id WHERE w.id=$1 AND b.owner_id=$2',[signedId,'owner-a'])).rows[0];
  assert.equal(retained.customer_id,null);assert.equal(retained.signer_name,'Jane Doe');assert.equal(retained.document.businessName,'Arcila Training');
  assert.equal((await pg.query('SELECT w.id FROM participation_waivers w JOIN businesses b ON b.id=w.business_id WHERE w.id=$1 AND b.owner_id=$2',[signedId,'owner-b'])).rows.length,0);
  await assert.rejects(pg.query('INSERT INTO customer_booking_ids(id,business_id,first_name,last_name,email,date_of_birth,member_number) VALUES($1,$2,$3,$4,$5,$6,$7)',[previous.id,'owner-a','Jane','Doe','jane@example.test','1990-01-01','JD010190']),/cannot be restored/);
  await pg.query('BEGIN');
  assert.equal(await issueMemberId(db,{businessId:'owner-a',name:'Jane Doe',dateOfBirth:'1990-01-01'}),'JD010190');
  const fresh=(await pg.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('owner-a','Jane','Doe','jane@example.test','1990-01-01','JD010190') RETURNING id")).rows[0];
  await pg.query('COMMIT');assert.notEqual(fresh.id,previous.id);
  await assert.rejects(ensureParticipationWaiver(db,{...args,input:null}),/sign/);
  const freshSigned=await ensureParticipationWaiver(db,args);assert.notEqual(freshSigned,signedId);
  assert.equal(await ensureParticipationWaiver(db,{...args,input:null}),freshSigned);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM participation_waivers WHERE business_id='owner-a'")).rows[0].n,2);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM customer_booking_ids WHERE business_id='owner-b'")).rows[0].n,1);
 }finally{await pg.close();}
});

test('released eight-character ID can be reassigned to another client without transferring signed consent',async()=>{
 const pg=await fixture();try{
  const db={query:async(sql,args)=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
  await pg.query("INSERT INTO business_client_profiles(id,owner,name,email,member_number,date_of_birth) VALUES('profile-a','owner-a','Jane Doe','jane@example.test','JD010190','1990-01-01')");
  const signedId=await ensureParticipationWaiver(db,{businessId:'owner-a',memberNumber:'JD010190',config,services,input:signature()});
  await pg.query('BEGIN');
  await deleteClientPermanently(db,{owner:'owner-a',businessId:'owner-a',client:{id:'profile-a',name:'Jane Doe',email:'jane@example.test',dateOfBirth:'1990-01-01',memberNumber:'JD010190'}});
  assert.equal(await issueMemberId(db,{businessId:'owner-a',name:'Jack Davis',dateOfBirth:'1990-01-01'}),'JD010190');
  await pg.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('owner-a','Jack','Davis','jack@example.test','1990-01-01','JD010190')");
  await pg.query('COMMIT');
  await assert.rejects(assertBookingWaiver(db,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD010190'}),/required/);
  const row=(await pg.query('SELECT signer_name,customer_id FROM participation_waivers WHERE id=$1',[signedId])).rows[0];
  assert.equal(row.signer_name,'Jane Doe');assert.equal(row.customer_id,null);
 }finally{await pg.close();}
});

test('owner waiver deletion is private, repeat-safe, retains evidence and requires fresh consent',async()=>{
 const pg=await fixture();try{
 const {createRequire}=await import('node:module'),{default:ts}=await import('typescript');
 const url=new URL('../app/api/studio/waivers/[id]/route.ts',import.meta.url),nativeRequire=createRequire(url),exports={};
 const compiled=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const db={query:(s,p)=>pg.query(s,p),release(){}},pool={...db,connect:async()=>db};
 new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>pool}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exports);
 const args={businessId:'owner-a',memberNumber:'JD010190',config,services,input:signature()},id=await ensureParticipationWaiver(pg,args);
 const original=(await pg.query('SELECT * FROM participation_waivers WHERE id=$1',[id])).rows[0];
 const origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test';
 const remove=(owner='owner-a',phrase='DELETE WAIVER',valid=true)=>exports.DELETE(new Request(new URL('/api/studio/waivers/'+id,origin),{method:'DELETE',headers:{'Content-Type':'application/json',...(owner?{'x-test-owner':owner}:{}),Origin:valid?new URL(origin).origin:'https://untrusted.invalid'},body:JSON.stringify({confirmPhrase:phrase})}),{params:Promise.resolve({id})});
 assert.equal((await remove('')).status,401);
 assert.equal((await remove('owner-b')).status,404);
 assert.equal((await remove('owner-a','')).status,400);
 assert.equal((await remove('owner-a','DELETE WAIVER',false)).status,403);
 assert.equal(await ensureParticipationWaiver(pg,{...args,input:null}),id);
 assert.equal((await remove()).status,200);
 assert.equal((await remove()).status,200);
 const retained=(await pg.query('SELECT * FROM participation_waivers WHERE id=$1',[id])).rows[0];
 assert.ok(retained.deleted_at);assert.equal(retained.deleted_by,'owner-a');
 for(const field of ['document','document_hash','signer_name','signed_at','audit_id','retention_status'])assert.deepEqual(retained[field],original[field]);
 await assert.rejects(assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD010190'}),/required/);
 await assert.rejects(ensureParticipationWaiver(pg,{...args,input:null}),/sign/);
 const next=await ensureParticipationWaiver(pg,args);assert.notEqual(next,id);
 await assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD010190'});
 assert.equal((await remove()).status,200,'old deletion retry does not revoke the new signature');
 assert.equal(await ensureParticipationWaiver(pg,{...args,input:null}),next);
 const get=owner=>exports.GET(new Request(new URL('/api/studio/waivers/'+id,origin),{headers:{'x-test-owner':owner}}),{params:Promise.resolve({id})});
 assert.equal((await get('owner-a')).status,200);assert.equal((await get('owner-b')).status,404);
 assert.equal((await pg.query('SELECT count(*)::int n FROM participation_waivers WHERE deleted_at IS NULL')).rows[0].n,1);
 }finally{await pg.close();}
});
