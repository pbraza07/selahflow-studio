import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildClientDirectory,clientWorkbookSheets} from '../server/client-history.mjs';
import {applyClientProfiles,validateClientInput,sameClientContact} from '../server/client-profile-logic.mjs';

const settings={services:[{id:'lesson',name:'Private lesson',category:'Training'}],staff:[{id:'coach',name:'Coach'}]};
const appointment=(id,name,email,date,status,phone='')=>({
 id,date,start:540,duration:60,staff:'coach',status,
 data:JSON.stringify({name,email,phone,services:['Private lesson'],serviceIds:['lesson'],price:45})
});
function profile(id,source,anchor,overrides={}){
 return {id,source_key:source.id,anchor_appointment_id:anchor,name:source.name,email:source.email,
  phone:source.phone,notes:'Business note',archived:false,...overrides};
}
test('owner can add a manually created client with no appointment and export it',()=>{
 const added={id:'manual-uuid-1',source_key:null,anchor_appointment_id:null,name:'New Client',
  email:'new@example.com',phone:'',notes:'First consultation',archived:false};
 const {clients,archived}=applyClientProfiles([], [added]);
 assert.equal(clients.length,1);
 assert.equal(clients[0].id,'manual-uuid-1');
 assert.equal(clients[0].name,'New Client');
 assert.equal(clients[0].notes,'First consultation');
 assert.equal(clients[0].bookedSessions,0);
 assert.equal(archived.length,0);
 const sheets=clientWorkbookSheets(clients);
 assert.equal(sheets[0].rows.length,2);
 assert.equal(sheets[1].rows.length,1);
});
test('editing a derived client preserves all appointments and days attended even after name changes',()=>{
 const old=[appointment('visit-one','Original Name','old@example.com','2026-10-01','Completed'),
  appointment('visit-two','Original Name','old@example.com','2026-10-02','Confirmed')];
 const baseline=buildClientDirectory(old,settings,'owner');
 assert.equal(baseline.length,1);
 const edited=profile('edited-uuid-1',baseline[0],'visit-one',{
  name:'Updated Name',email:'updated@example.com',phone:'8135550192'});
 const attached=applyClientProfiles(baseline,[edited]);
 assert.equal(attached.clients.length,1);
 assert.equal(attached.clients[0].id,'edited-uuid-1');
 assert.equal(attached.clients[0].name,'Updated Name');
 assert.equal(attached.clients[0].bookedSessions,2);
 assert.equal(attached.clients[0].attendedSessions,1);
 assert.deepEqual(attached.clients[0].attendanceDays,['2026-10-01']);
 assert.equal(attached.clients[0].history.length,2);
 // New bookings using the edited name and contact still attach to the same profile.
 const future=appointment('visit-three','Updated Name','updated@example.com','2026-10-05','Checked in','8135550192');
 const reloaded=buildClientDirectory([...old,future],settings,'owner');
 const merged=applyClientProfiles(reloaded,[edited]);
 assert.equal(merged.clients.length,1);
 assert.equal(merged.clients[0].id,'edited-uuid-1');
 assert.equal(merged.clients[0].attendedSessions,2);
 assert.deepEqual(merged.clients[0].history.map(h=>h.id).sort(),['visit-one','visit-three','visit-two']);
});
test('editing does not merge different clients using the same email or phone',()=>{
 const a=appointment('first','Jordan S','family@example.com','2026-10-01','Completed','8135550123');
 const b=appointment('second','Taylor S','family@example.com','2026-10-02','Completed','8135550123');
 const derived=buildClientDirectory([a,b],settings,'owner');
 const jordan=derived.find(x=>x.name==='Jordan S');
 const edited=profile('edit-jordan',jordan,'first',{phone:'8135550123'});
 const {clients}=applyClientProfiles(derived,[edited]);
 assert.equal(clients.length,2);
 assert.deepEqual(clients.map(c=>c.name).sort(),['Jordan S','Taylor S']);
 assert.equal(sameClientContact({name:'Jordan S',email:'family@example.com'},{name:'Taylor S',email:'family@example.com'}),false);
});
test('archive and restore hide a client while keeping all service history',()=>{
 const original=buildClientDirectory([appointment('visit-a','Zoe S','zoe@example.com','2026-10-01','Completed')],settings,'owner')[0];
 const deleted=profile('profile-1',original,'visit-a',{archived:true});
 const hidden=applyClientProfiles([original],[deleted]);
 assert.equal(hidden.clients.length,0);
 assert.deepEqual(hidden.archived.map(c=>c.name),['Zoe S']);
 const restored=applyClientProfiles([original],[{...deleted,archived:false}]);
 assert.equal(restored.clients.length,1);
 assert.equal(restored.clients[0].attendedSessions,1);
});
test('create/update validation rejects invalid email, contact or oversize notes',()=>{
 assert.deepEqual(validateClientInput({name:' Client ',email:'EMAIL@Example.com',phone:'813-555-0100',notes:'ok'}),
  {name:'Client',email:'EMAIL@Example.com',phone:'813-555-0100',notes:'ok'});
 assert.throws(()=>validateClientInput({name:''}),/name/i);
 assert.throws(()=>validateClientInput({name:'Client',email:'not-an-email'}),/email/i);
 assert.throws(()=>validateClientInput({name:'Client',phone:'abc'}),/phone/i);
 assert.throws(()=>validateClientInput({name:'Client',notes:'x'.repeat(1001)}),/notes/i);
});
test('migration allows per-owner profiles, enforces source uniqueness and archives without changing appointments',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/011_business_client_profiles.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/031_membership_client_archive_source.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/032_client_registration_answers.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('first','first@example.com','hash'),('second','second@example.com','hash')");
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('appointment-one','first','2026-10-01','coach',540,60,'{}','Completed')");
  await db.query("INSERT INTO business_client_profiles(id,owner,source_key,anchor_appointment_id,name,email) VALUES('p1','first','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','appointment-one','Client A','shared@example.com')");
  await db.query("INSERT INTO business_client_profiles(id,owner,source_key,name,email) VALUES('p2','second','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Client B','shared@example.com')");
  await db.query("INSERT INTO business_client_profiles(id,owner,source_key,name,email) VALUES('membership-profile','first','membership-0eb06d1e-6228-4a61-b0c6-41f2752dd29d','Membership client','member@example.com')");
  assert.equal((await db.query('SELECT id FROM business_client_profiles WHERE owner=$1',['first'])).rows.length,2);
  await assert.rejects(db.query("INSERT INTO business_client_profiles(id,owner,source_key,name) VALUES('p3','first','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Other')"));
  await db.query("UPDATE business_client_profiles SET archived=TRUE WHERE owner='first' AND id='p1'");
  assert.equal((await db.query('SELECT archived FROM business_client_profiles WHERE id=$1',['p1'])).rows[0].archived,true);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM appointments WHERE owner='first'")).rows[0].n,1);
  assert.ok((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='business_client_profiles' AND column_name IN ('registration_answers','registration_field_labels')")).rows.length===2);
 }finally{await db.close();}
});
test('client-management endpoints enforce owner scope and require explicit permanent deletion',async()=>{
 const base=new URL('../',import.meta.url);
 const route=await readFile(new URL('app/api/studio/clients/route.ts',base),'utf8');
 const screen=await readFile(new URL('app/components/owner-client-directory.tsx',base),'utf8');
 const css=await readFile(new URL('app/globals.css',base),'utf8');
 assert.match(route,/requireOwner\(req\)/);
 assert.match(route,/validOrigin\(req\)/);
 assert.match(route,/WHERE owner=\$1/);
 assert.match(route,/deleteOwnerClient/);assert.match(route,/DELETE CLIENT/);
 assert.match(route,/membershipClientId/);
 assert.match(route,/source_key===virtualId/);
 assert.doesNotMatch(route,/DELETE FROM appointments/i);
 assert.doesNotMatch(route,/DELETE FROM business_client_profiles/i);
 assert.match(screen,/Add client/);
 assert.match(screen,/registrationConfig/);
 assert.match(screen,/Edit client/);
 assert.match(screen,/Delete permanently/);
 assert.match(screen,/aria-modal="true"/);
 assert.match(screen,/Removed clients/);
 assert.match(screen,/Restore/);
 assert.match(css,/\.sf-client-editor-backdrop/);
 assert.match(css,/var\(--sf-surface/);
});
test('owner client editor reuses booking registration fields and persists their answers',async()=>{
 const base=new URL('../',import.meta.url);
 const editor=await readFile(new URL('app/components/client-editor.tsx',base),'utf8');
 const route=await readFile(new URL('app/api/studio/clients/route.ts',base),'utf8');
 assert.match(editor,/RegistrationFields/);
 assert.match(editor,/form="booking"/);
 assert.match(editor,/sessionId=\{null\}/);
 assert.match(route,/validateStandardRegistration\(settings,'booking',body\)/);
 assert.match(route,/registration_answers/);
 assert.match(route,/registration_field_labels/);
});
