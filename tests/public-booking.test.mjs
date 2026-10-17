
import {paymentConfigured} from '../server/membership-payments.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {customRegistrationFields,validateStandardRegistration,publicRegistrationSettings} from '../server/registration-questions.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';import ts from 'typescript';import {PGlite} from '@electric-sql/pglite';import {postgresSQL,executeBatch} from '../server/database.mjs';import {validOrigin,tokenHash,trustedOrigin} from '../server/security.mjs';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
test('public booking creates protected owner records; exposes catalog only; rejects conflicts and stale quotes',async()=>{
 const pg=new PGlite();const old=process.env.APP_URL;process.env.APP_URL='https://studio.example';
 try{
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.query("INSERT INTO users(id,email,password_hash) VALUES('owner','private@example.com','secret-hash')");
 await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('crawford-biz','owner','crawford','Crawford','barber')");
 let queue=Promise.resolve();const pool={query:(s,v)=>pg.query(s,v),async connect(){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;return {query:(s,v)=>pg.query(s,v),release};}};
 const db=()=>({prepare(sql){return {sql:postgresSQL(sql),values:[],bind(...values){this.values=values;return this;},async first(){return (await pg.query(this.sql,this.values)).rows[0]||null;},async all(){return {results:(await pg.query(this.sql,this.values)).rows};}};},batch:s=>executeBatch(pool,s)});
 const defaults=await import(moduleURL(compile(await readFile(new URL('../lib/defaults.ts',import.meta.url),'utf8'))));
 const terms=await import(moduleURL(compile(await readFile(new URL('../lib/service-terms.ts',import.meta.url),'utf8'))));
 const helpers=await import('../server/booking-approvals.mjs');
 const review=await import('../server/booking-review.mjs');
 const customFields=await import('../server/booking-custom-fields.mjs');
 const scheduling=await import('../server/session-scheduling.mjs');
 const confirmBooking=async ({owner,services,staff,date,start,duration,buffer,id,data})=>{const stm=[db().prepare("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES(?,?,?,?,?,?,?,'Confirmed')").bind(id,owner,date,staff,start,duration,JSON.stringify(data))];for(let minute=start;minute<start+duration+buffer;minute+=15)stm.push(db().prepare('INSERT INTO slots(owner,date,staff,minute,appointment) VALUES(?,?,?,?,?)').bind(owner,date,staff,minute,id));await db().batch(stm);return {id};};
 globalThis.__bookingTest={paymentConfigured,issueMemberId,customRegistrationFields,validateStandardRegistration,publicRegistrationSettings,getPool:()=>pool,randomBytes,db,requireOwner:async()=>{throw Error('AUTH_REQUIRED');},validOrigin,tokenHash,trustedOrigin,...defaults,validDuration:terms.validDuration,isCalendarUnit:terms.isCalendarUnit,validSlotCapacity:helpers.validSlotCapacity,serviceCapacityOpen:helpers.serviceCapacityOpen,confirmBooking,approvalSettings:review.approvalSettings,bookingRequestDetail:review.bookingRequestDetail,...customFields,...scheduling};
 let source=await readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8');source=source.replace(/^import .*;$/gm,'');source='const {paymentConfigured,issueMemberId,customRegistrationFields,validateStandardRegistration,publicRegistrationSettings,getPool,randomBytes,db,requireOwner,validOrigin,tokenHash,trustedOrigin,defaultSettings,today,validDuration,isCalendarUnit,validSlotCapacity,serviceCapacityOpen,confirmBooking,approvalSettings,bookingRequestDetail,validateBookingFields,sanitizeBookingAnswers,bookingDateRange,computeDayAvailability,selectedSession,easternClock}=globalThis.__bookingTest;\n'+source;
 const handler=await import(moduleURL(compile(source)));
 const req=body=>new Request('https://studio.example/api/booking',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json','x-forwarded-for':'198.51.100.25'},body:JSON.stringify(body)});
 const catalog=await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json();
 assert.ok(catalog.config.services.length);assert.equal(catalog.config.products,undefined);assert.equal(catalog.appointments,undefined);assert.doesNotMatch(JSON.stringify(catalog),/private@example|secret-hash/);
 assert.equal((await handler.ownerGet(new Request('https://studio.example/api/studio'))).status,401);
 assert.equal((await handler.studioPost(req({action:'settings',config:{}}),true)).status,403);
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const selection={services:['barber'],staff:'james',date};
 const slots=await (await handler.studioPost(req({action:'availability',...selection}),true)).json();assert.ok(slots.slots.length);
 const booking={action:'book',...selection,start:slots.slots[0],expectedPrice:35,expectedDuration:30,name:'Public Customer',firstName:'Public',lastName:'Customer',dateOfBirth:'2000-01-02',notMember:true,email:'client@example.com',key:crypto.randomUUID(),policyAccepted:true};
 // A client registering online can already have a copied, archived directory
 // record with an older ID. Reuse it without rewriting identity/history.
 await pg.exec("INSERT INTO legacy_business_member_numbers(business_id,member_number) VALUES('crawford-biz','PC010200'); INSERT INTO business_client_profiles(id,owner,name,email,date_of_birth,member_number,archived) VALUES('legacy-profile','owner','Public Customer','client@example.com','2000-01-02','PC010200',TRUE)");
 assert.equal((await handler.studioPost(req({...booking,policyAccepted:false}),true)).status,400);
 assert.equal((await handler.studioPost(req({...booking,expectedPrice:1}),true)).status,409);
 let response=await handler.studioPost(req(booking),true);assert.equal(response.status,200,response.status===200?undefined:await response.text());const first=await response.json();assert.ok(first.id);
 assert.equal(first.memberNumber,'PC010200');
 const profile=(await pg.query("SELECT id,member_number,archived FROM business_client_profiles WHERE id='legacy-profile'")).rows[0];
 assert.deepEqual(profile,{id:'legacy-profile',member_number:'PC010200',archived:false});
 response=await handler.studioPost(req(booking),true);assert.equal(response.status,200);assert.equal((await response.json()).id,first.id);
 response=await handler.studioPost(req({...booking,key:crypto.randomUUID(),email:'second@example.com'}),true);assert.equal(response.status,409);
 const rows=(await pg.query('SELECT * FROM appointments')).rows;assert.equal(rows.length,1);assert.equal(rows[0].owner,'owner');assert.equal(JSON.parse(rows[0].data).channel,'Online booking');
 const after=await (await handler.studioPost(req({action:'availability',...selection}),true)).json();assert.ok(!after.slots.includes(booking.start));
 assert.equal((await handler.studioPost(new Request('https://studio.example/api/booking',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify(booking)}),true)).status,403);
 }finally{delete globalThis.__bookingTest;if(old===undefined)delete process.env.APP_URL;else process.env.APP_URL=old;await pg.close();}
});
