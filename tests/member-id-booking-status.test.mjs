import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildClientDirectory,pendingBookingAsAppointment} from '../server/client-history.mjs';
import {applyClientProfiles} from '../server/client-profile-logic.mjs';

test('appointment status lookup requires only a business-scoped membership ID',async()=>{
 const code=await readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8');
 const section=code.split("if(b.action==='registration_latest_status'){")[1]?.split("if(b.action==='verify_registration'){")[0];
 assert.ok(section);
 assert.match(section,/b\.memberNumber/);
 assert.match(section,/latest-status-member/);
 assert.match(section,/WHERE owner_id=\?/);
 assert.doesNotMatch(section,/validEmail|b\.email|b\.name|tokenHash\(email\)/);
});

test('new and returning booking records attach to one managed client with the same membership ID',()=>{
 const owner='owner-soccer';
 const memberNumber='JS0315';
 const settings={services:[{id:'training',name:'Training',category:'Youth'}],staff:[{id:'coach',name:'Coach'}]};
 const pending=pendingBookingAsAppointment({
  id:'pending-1',date:'2026-10-15',start_minute:600,duration:60,staff_id:'coach',status:'pending',
  details:JSON.stringify({memberNumber,customerName:'John Smith',customerEmail:'john@example.com',customerPhone:'8135550190',services:['Training'],serviceIds:['training']})
 });
 const confirmed={id:'confirmed-1',date:'2026-10-20',start:600,duration:60,staff:'coach',status:'Confirmed',
 data:JSON.stringify({memberNumber,name:'John Smith',email:'john@example.com',phone:'8135550190',services:['Training'],serviceIds:['training']})};
 const derived=buildClientDirectory([pending,confirmed],settings,owner);
 assert.equal(derived.length,1);
 assert.equal(derived[0].memberNumber,memberNumber);
 const profile={id:'profile-1',owner,source_key:null,anchor_appointment_id:null,name:'John Smith',email:'john@example.com',phone:'8135550190',member_number:memberNumber,date_of_birth:'2014-03-15',notes:'First online booking',archived:false,import_columns:{}};
 const result=applyClientProfiles(derived,[profile]);
 assert.equal(result.clients.length,1);
 assert.equal(result.clients[0].id,profile.id);
 assert.equal(result.clients[0].memberNumber,memberNumber);
 assert.equal(result.clients[0].history.length,2);
 assert.equal(result.clients[0].bookedSessions,1);
});
