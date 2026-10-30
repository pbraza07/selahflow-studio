import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const load=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function importTs(path){
 const src=await load(path),out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(out).toString('base64'));
}
test('v1.3.7 business industries and states cover the U.S. and diverse business lines',async()=>{
 const {BUSINESS_INDUSTRIES,US_STATES,canonicalState}=await importTs('lib/business-options.ts');
 assert.ok(BUSINESS_INDUSTRIES.length>=70);assert.equal(new Set(BUSINESS_INDUSTRIES.map(x=>x[0])).size,BUSINESS_INDUSTRIES.length);
 assert.equal(US_STATES.length,51);assert.equal(new Set(US_STATES.map(x=>x[0])).size,51);
 assert.equal(canonicalState('FL'),'Florida');assert.equal(canonicalState('Florida'),'Florida');assert.equal(canonicalState('DC'),'District of Columbia');assert.equal(canonicalState('Invalid'),'');
});
test('six duration units validate calendar slots and term enrollments independently',async()=>{
 const {DURATION_UNITS,validDuration,normalizedDuration,durationLabel,isTermUnit,endDateForTerm}=await importTs('lib/service-terms.ts');
 assert.deepEqual(DURATION_UNITS,['minutes','hours','days','weeks','months','years']);
 assert.equal(validDuration({duration:45}),true);
 assert.equal(validDuration({duration:60,durationUnit:'hours',durationValue:1}),true);
 assert.equal(validDuration({duration:480,durationUnit:'hours',durationValue:8}),true);
 assert.equal(validDuration({duration:0,durationUnit:'months',durationValue:1}),true);
 assert.equal(validDuration({duration:0,durationUnit:'years',durationValue:1}),true);
 assert.equal(validDuration({duration:0,durationUnit:'weeks',durationValue:2}),true);
 assert.equal(validDuration({duration:0,durationUnit:'days',durationValue:7}),true);
 assert.equal(validDuration({duration:0,durationUnit:'hours',durationValue:1}),false);
 assert.equal(validDuration({duration:481}),false);
 assert.equal(validDuration({duration:31}),false);
 assert.equal(validDuration({duration:60,durationUnit:'years',durationValue:1}),false);
 assert.equal(durationLabel({duration:0,durationUnit:'months',durationValue:1}),'1 month');
 assert.equal(durationLabel({duration:90}),'90 minutes');
 assert.equal(normalizedDuration({duration:45}).value,45);
 assert.equal(isTermUnit('months'),true);
 assert.equal(isTermUnit('hours'),false);
 assert.equal(endDateForTerm('2028-01-31',1,'months'),'2028-02-29');
 assert.equal(endDateForTerm('2028-02-29',1,'years'),'2029-02-28');
 assert.equal(endDateForTerm('2026-10-09',2,'weeks'),'2026-10-23');
 assert.throws(()=>endDateForTerm('2026-02-31',1,'months'));
});
test('additive migration preserves Crawford and creates pending / rejected business statuses',async()=>{
 const db=new PGlite();try{
 for(const f of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql','005_business_approval_terms.sql'])await db.exec(await load('migrations/'+f));
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','pbraza@gmail.com','hash'),('applicant','new@example.test','hash')");
 await db.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('crawford-id','owner','crawford','Crawford','barber')");
 await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('old-booking','owner','2026-12-01','ava',540,60,'{}','Confirmed')");
 await db.query("INSERT INTO businesses(id,owner_id,slug,name,industry,status,is_listed) VALUES('app-id','applicant','new-spa','Spa','spa','pending',FALSE)");
 assert.equal((await db.query("SELECT status FROM businesses WHERE slug='crawford'")).rows[0].status,'active');
 assert.deepEqual((await db.query("SELECT slug FROM businesses WHERE status='active' AND is_listed=TRUE")).rows,[]);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM businesses WHERE status='pending'")).rows[0].n,1);
 await db.query("UPDATE businesses SET status='active',is_listed=TRUE WHERE id='app-id' AND status='pending'");
 assert.deepEqual((await db.query("SELECT slug FROM businesses WHERE status='active' AND is_listed=TRUE")).rows,[{slug:'new-spa'}]);
 await db.query("INSERT INTO service_enrollments(id,business_id,service_id,service_name,duration_value,duration_unit,client_name,starts_on,ends_on) VALUES('term1','app-id','membership','Monthly membership',1,'months','Customer','2026-10-09','2026-11-09')");
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM service_enrollments WHERE business_id='app-id' AND duration_unit='months'")).rows[0].n,1);
 assert.equal((await db.query("SELECT owner FROM appointments WHERE id='old-booking'")).rows[0].owner,'owner');
 await assert.rejects(db.query("UPDATE businesses SET status='invalid' WHERE id='app-id'"));
 }finally{await db.close();}
});
test('business approval is primary-only; new registrants cannot bypass via direct APIs',async()=>{
 const signup=await load('app/api/auth/signup/route.ts');
 assert.match(signup,/status,is_listed,listing_requested/);assert.match(signup,/'pending',FALSE,FALSE/);
 const overview=await load('app/api/platform/overview/route.ts');
 const activation=await load('server/business-activation.mjs');
 assert.match(overview,/getPlatformRole\(pool,actor\)/);assert.match(overview,/!=='primary'/);
 assert.match(activation,/is_listed=TRUE,listing_requested=FALSE/);
 assert.match(overview,/activatePendingBusiness/);assert.match(activation,/business_service_agreements/);assert.match(activation,/billing_status='active'/);
 assert.match(activation,/requested_plan_code IN \('professional','business'\)/);
 const server=await load('lib/studio-handler.ts');
 assert.match(server,/business.status!=='active'/);
 assert.match(server,/isCalendarUnit/);
 const termApi=await load('app/api/studio/terms/route.ts');
 assert.match(termApi,/requireOwner\(req\)/);
 assert.match(termApi,/b.status='active'/);
 assert.match(termApi,/isTermUnit\(unit\)/);
 const owner=await load('app/studio/owner-dashboard.tsx');
 assert.match(owner,/OwnerTermTracker/);
 assert.match(owner,/DURATION_UNITS/);
 const admin=await load('app/admin/platform/platform-dashboard.tsx');
 assert.match(admin,/pendingRegistrations/);assert.match(admin,/termEnrollmentMetrics/);
});
