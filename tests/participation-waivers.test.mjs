import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {waiverDocument,waiverMinor,waiverToday,validateWaiverSignature,requiresWaiver} from '../server/waiver-content.mjs';
import {ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument,assertWaiverLegalReview} from '../server/participation-waivers.mjs';
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
 await pg.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES($1,'Jane','Doe','jane@example.test','1990-01-01','JD0101')",[owner]);
 }return pg;
}
test('signed waivers persist exact wording, are once per verified business identity, and cannot cross businesses',async()=>{
 const pg=await fixture();try{
 const args={businessId:'owner-a',memberNumber:'JD0101',config,services,input:signature(),audit:{ip:'192.0.2.1',userAgent:'test-browser'}};
 await assert.rejects(()=>ensureParticipationWaiver(pg,{...args,input:null}),/sign/);
 await assert.rejects(()=>ensureParticipationWaiver(pg,{...args,input:signature({documentHash:'forged'})}),/changed/);
 const id=await ensureParticipationWaiver(pg,args);assert.ok(id);
 assert.equal(await ensureParticipationWaiver(pg,{...args,input:null}),id,'Existing signature requires no resubmission');
 await assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD0101'});
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-b',config,serviceIds:['training'],memberNumber:'JD0101'}),/required/);
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'XX0101'}),/required/);
 assert.equal(await ensureParticipationWaiver(pg,{...args,services:[{}],input:null}),null);
 const row=(await pg.query('SELECT * FROM participation_waivers WHERE id=$1',[id])).rows[0];
 assert.equal(row.request_ip,'192.0.2.1');assert.equal(row.user_agent,'test-browser');
 assert.equal(row.document.businessName,'Arcila Training');assert.equal(row.document_hash.length,64);assert.equal(row.signer_name,'Jane Doe');
 assert.equal(await ensureParticipationWaiver(pg,{...args,config:{...config,name:'Renamed'},input:null}),id,'Later business name/theme changes do not require repeat signing');
 await pg.query("UPDATE participation_waivers SET document_version='prior-version' WHERE id=$1",[id]);
 await assert.rejects(()=>assertBookingWaiver(pg,{owner:'owner-a',config,serviceIds:['training'],memberNumber:'JD0101'}),/required/);
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
