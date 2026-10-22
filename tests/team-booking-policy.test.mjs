import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {publicTeamMembers,clientTeamName,sessionTeamDefaults,sessionAutoAssigns,publicSessionTeam,publicBookingStaff,validateTeamBookingPolicy,configuredServiceDefault,defaultServiceStaff,bookingHostHistory} from '../server/team-booking-policy.mjs';
import {sessionInstances} from '../server/session-recurrence.mjs';
const config={services:[{id:'soccer',duration:30,defaultStaffId:'hidden'},{id:'camp',duration:30,defaultStaffId:'hidden'}],staff:[{id:'visible',name:'Visible Coach',role:'Coach',services:['soccer','camp']},{id:'hidden',name:'Private Coach',role:'Private',services:['soccer','camp'],bookingVisible:false},{id:'assistant',name:'Private Assistant',services:['soccer'],bookingVisible:false}],bookableSessions:[{id:'week',date:'2030-11-01',service:'soccer',staff:'hidden',start:600,capacity:5,autoAssignStaff:true,defaultTeamIds:['assistant'],repeat:{frequency:'weekly',every:1,until:'2030-11-15'}}]};
test('hidden staff never become dropdown options or public identities, while the owner config remains intact',()=>{
 assert.deepEqual(publicTeamMembers(config).map(s=>s.id),['visible']);assert.doesNotMatch(JSON.stringify(publicTeamMembers(config)),/Private Coach|Private Assistant/);
 assert.equal(config.staff.length,3);assert.equal(clientTeamName(config,'hidden'),'Session team');assert.equal(clientTeamName(config,'visible'),'Visible Coach');assert.equal(clientTeamName({...config,hideTeamNames:true},'visible'),'Session team');
 const session=publicSessionTeam(config,config.bookableSessions[0]);assert.equal(session.staffVisible,false);assert.equal(session.staffName,'');assert.equal(session.autoAssignStaff,true);
});
test('recurring defaults keep private tracking IDs and resolve canonical hosts without a client team choice',()=>{
 const recurrence=sessionInstances(config,'2030-11-08')[0];assert.equal(sessionAutoAssigns(config,recurrence),true);assert.deepEqual(sessionTeamDefaults(config,recurrence),['hidden','assistant']);
 assert.equal(publicBookingStaff(config,{date:'2030-11-08',services:['soccer'],sessionId:recurrence.id,start:600}),'hidden');
 assert.throws(()=>publicBookingStaff(config,{date:'2030-11-08',services:['soccer'],sessionId:recurrence.id,staff:'visible'}),/assigned team/);
 for(const changes of [{date:'2030-11-09'},{services:['camp']},{start:615},{sessionId:'foreign'}])assert.throws(()=>publicBookingStaff(config,{date:'2030-11-08',services:['soccer'],sessionId:recurrence.id,start:600,...changes}),/configured session/);
 const noDefaults={...config,services:[{id:'soccer'}]};assert.throws(()=>publicBookingStaff(noDefaults,{staff:'hidden',services:['soccer']}),/not available/);
});
test('service defaults are editable, qualified, business-scoped, and unambiguous for multi-service visits',()=>{
 assert.equal(defaultServiceStaff(config,['soccer','camp']),'hidden');assert.equal(configuredServiceDefault({...config,staff:[]},['soccer']),'hidden','public client can use a hidden default without receiving its private staff record');
 assert.equal(publicBookingStaff(config,{services:['soccer']}),'hidden');assert.throws(()=>publicBookingStaff(config,{services:['soccer'],staff:'visible'}),/default team/);
 assert.equal(defaultServiceStaff({...config,services:[config.services[0],{id:'camp',defaultStaffId:'visible'}]},['soccer','camp']),null);
 for(const patch of [{staff:[{...config.staff[0],bookingVisible:'no'}]},{services:[{id:'soccer',defaultStaffId:'foreign'}]},{bookableSessions:[{...config.bookableSessions[0],autoAssignStaff:'yes'}]},{bookableSessions:[{...config.bookableSessions[0],defaultTeamIds:['foreign']}]}])assert.throws(()=>validateTeamBookingPolicy({...config,...patch}));
 assert.doesNotThrow(()=>validateTeamBookingPolicy(config));
});
test('private booking host history retains the saved team and groups clients in the same occurrence',()=>{
 const rows=[{id:'one',date:'2030-11-01',start:600,staff:'hidden',data:JSON.stringify({sessionId:'week',hostTeamIds:['hidden','assistant'],services:['Soccer']})},{id:'two',date:'2030-11-01',start:600,staff:'hidden',data:JSON.stringify({sessionId:'week',hostTeamIds:['hidden','assistant']})},{id:'legacy',date:'2030-11-01',start:660,staff:'old',data:'{}'}];
 const result=bookingHostHistory(rows);assert.equal(result.length,2);assert.equal(result[0].bookings,2);assert.deepEqual(result[0].staffIds,['hidden','assistant']);assert.deepEqual(result[1].staffIds,['old']);
});
test('owner controls and client flow expose per-member hiding and service/session defaults in their proper scopes',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');const owner=await read('app/studio/owner-dashboard.tsx'),client=await read('app/book/page.tsx'),tracking=await read('app/api/studio/team-tracking/route.ts'),approval=await read('lib/booking-review-actions.ts');
 assert.match(owner,/Hide from client booking/);assert.match(owner,/default team member/);assert.match(owner,/Default session host/);assert.match(owner,/Default tracking team/);
 assert.match(client,/s.bookingVisible!==false&&selected.every/);assert.match(client,/automaticTeam\?/);assert.match(client,/sessionChoice.id:selectedSessionId/);assert.match(tracking,/requireOwner\(req\)/);assert.match(tracking,/hostHistory:bookingHostHistory/);assert.match(approval,/hostTeamIds:data.hostTeamIds/);
});

test('owner can remove the session host from default accountability without exposing hidden hosts',()=>{
 const c={...config,bookableSessions:[{...config.bookableSessions[0],trackSessionHost:false,autoAssignStaff:false}]};
 const recurrence=sessionInstances(c,'2030-11-08')[0];
 assert.deepEqual(sessionTeamDefaults(c,recurrence),['assistant']);
 assert.equal(publicSessionTeam(c,recurrence).staffVisible,false);
 assert.equal(publicTeamMembers(c).some(s=>s.id==='hidden'),false);
 validateTeamBookingPolicy(c);
 assert.throws(()=>validateTeamBookingPolicy({...c,bookableSessions:[{...c.bookableSessions[0],trackSessionHost:'no'}]}),/checkbox/);
});
