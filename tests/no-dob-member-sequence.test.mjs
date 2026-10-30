import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {issueMemberId,memberRegistrationIdentity} from '../server/member-id-policy.mjs';
import {ensureMemberBookingIdentity} from '../server/shared-member-identity.mjs';
import {membershipRequestDetails,registerMembershipWithoutApproval} from '../server/membership-requests.mjs';
async function fixture(t){
 const pg=new PGlite();t.after(()=>pg.close());
 for(const file of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','x'),('u2','two@example.test','x');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','business-one','One','active'),('b2','u2','business-two','Two','active');");
 const pool={query:async(sql,args)=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0};},connect:async()=>({...pool,release(){}})};
 const issue=async(name,{businessId='b1',registrationIdentity=randomUUID(),...rest}={})=>{await pg.exec('BEGIN');try{const number=await issueMemberId(pool,{businessId,name,dateOfBirth:null,registrationIdentity,...rest});await pg.exec('COMMIT');return number;}catch(e){await pg.exec('ROLLBACK');throw e;}};
 return {pg,pool,issue};
}
test('each business sequence starts at 1001, spans initials, is retry-safe and never merges namesakes',async t=>{
 const {pg,pool,issue}=await fixture(t),identity=randomUUID();
 assert.equal(await issue('John Smith',{registrationIdentity:identity}),'JS1001');
 assert.equal(await issue('Alice Brown'),'AB1002');assert.equal(await issue('John Smith'),'JS1003');
 assert.equal(await issue('John Smith',{registrationIdentity:identity}),'JS1001');
 assert.equal(await issue('John Smith',{businessId:'b2'}),'JS1001');
 assert.equal((await pg.query("SELECT member_id_sequence FROM businesses WHERE id='b1'")).rows[0].member_id_sequence,1003);
 assert.equal(await issue('Caleb Alves',{dateOfBirth:'2013-08-14',registrationIdentity:null}),'CA081413');
 assert.equal(await issue('Eva Jones'),'EJ1004','birth-date issuance does not consume sequence');
 assert.equal(await memberRegistrationIdentity(pool,'b1','CA081413'),null);
 assert.equal(await memberRegistrationIdentity(pool,'b2','JS1003'),null);
});
test('sequences skip historical collisions, roll back failed allocations, retain deletion progress and stop at four digits',async t=>{
 const {pg,pool,issue}=await fixture(t);
 await pg.exec("INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES('b1','JS1001','historical-reservation')");
 assert.equal(await issue('John Smith'),'JS1002');
 await pg.exec('BEGIN');assert.equal(await issueMemberId(pool,{businessId:'b1',name:'Alex Brown',registrationIdentity:randomUUID(),dateOfBirth:null}),'AB1003');await pg.exec('ROLLBACK');
 assert.equal(await issue('Alex Brown'),'AB1003');
 await pg.exec("DELETE FROM business_member_ids WHERE business_id='b1' AND member_number='AB1003'");assert.equal(await issue('Alex Brown'),'AB1004');
 for(const patch of [{name:'Only'},{name:'1 John'},{registrationIdentity:'bad'},{dateOfBirth:'2000-02-30'}])await assert.rejects(issue(patch.name||'Client Test',patch));
 await pg.exec("UPDATE businesses SET member_id_sequence=9998 WHERE id='b1'");assert.equal(await issue('Last Client'),'LC9999');await assert.rejects(issue('Next Client'),/all four-digit/);
 assert.equal(await issue('Other Business',{businessId:'b2'}),'OB1001');
});
test('no-DOB identity is shared between booking/profile/membership and only its matching client can reuse it',async t=>{
 const {pg,pool,issue}=await fixture(t),registrationIdentity=randomUUID(),number=await issue('John Smith',{registrationIdentity});
 await pg.exec('BEGIN');await ensureMemberBookingIdentity(pool,{businessId:'b1',ownerId:'u1',firstName:'John',lastName:'Smith',email:'john@example.test',dateOfBirth:null,memberNumber:number,registrationIdentity});await pg.exec('COMMIT');
 assert.equal(await issue('John Smith',{requested:number}),number);
 assert.equal(await issue('John Smith',{requested:number,registrationIdentity:randomUUID()}),number);
 await assert.rejects(issue('Other Person',{requested:number}),/does not belong/);
 await assert.rejects(issue('John Smith',{requested:number,businessId:'b2'}),/does not belong/);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='u1'")).rows[0].n,1);
 assert.equal((await pg.query("SELECT member_number FROM customer_booking_ids WHERE business_id='b1'")).rows[0].member_number,number);
 const config={membershipStandardFields:{dateOfBirth:{required:false}}};
 const plan=randomUUID();await pg.query("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES($1,'b1','Plan','month',5000,8)",[plan]);
 const requestId=randomUUID(),details=membershipRequestDetails(config,{requestId,firstName:'John',lastName:'Smith',email:'john@example.test',phone:'8135550100',dateOfBirth:'',memberNumber:number});
 const result=await registerMembershipWithoutApproval(pool,{businessId:'b1',ownerId:'u1',planId:plan,requestId,details});assert.equal(result.memberNumber,number);
 const membership=(await pg.query('SELECT registration_identity,member_number,date_of_birth FROM customer_memberships WHERE id=$1',[result.membershipId])).rows[0];assert.equal(membership.registration_identity,registrationIdentity);assert.equal(membership.date_of_birth,null);
 assert.equal((await pg.query("SELECT member_id_sequence FROM businesses WHERE id='b1'")).rows[0].member_id_sequence,1001);
 await assert.rejects(pg.query("UPDATE business_client_profiles SET registration_identity=$1 WHERE owner='u1'",[randomUUID()]),/immutable|already belongs/);
});

test('owner membership assignment without DOB uses the shared sequence and stable identity',async t=>{
 const {pg,pool}=await fixture(t);const {createRequire}=await import('node:module'),{default:ts}=await import('typescript');
 await pg.exec("INSERT INTO business_subscriptions(business_id,plan_code) VALUES('b1','business');INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','b1','Gold','month',5000,8)");
 await pg.query("INSERT INTO settings(owner,data) VALUES('u1',$1)",[JSON.stringify({membershipStandardFields:{dateOfBirth:{required:false}}})]);
 const sourceURL=new URL('../app/api/studio/memberships/route.ts',import.meta.url),nativeRequire=createRequire(sourceURL),exp={};const source=ts.transpileModule(await readFile(sourceURL,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',source)(id=>id.endsWith('/server/database.mjs')?{getPool:()=>pool}:id.endsWith('/lib/auth')?{requireOwner:async()=> 'u1'}:nativeRequire(id),exp);
 const origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://app.example.test').origin;
 const payload={requestId:randomUUID(),action:'assignMember',planId:'plan',name:'Alice Brown',firstName:'Alice',lastName:'Brown',email:'alice@example.test',phone:'8135550123',dateOfBirth:'',memberNumber:''};
 const post=body=>exp.POST(new Request(origin+'/api/studio/memberships',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const response=await post(payload);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).memberNumber,'AB1001');
 const retry=await post(payload);assert.equal(retry.status,200,await retry.clone().text());assert.equal((await retry.json()).memberNumber,'AB1001');
 assert.equal((await pg.query("SELECT count(*)::int n FROM customer_memberships WHERE business_id='b1'")).rows[0].n,1);
 assert.equal((await pg.query("SELECT count(*)::int n FROM business_client_profiles WHERE owner='u1'")).rows[0].n,1);
});
