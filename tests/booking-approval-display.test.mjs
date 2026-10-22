import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 APPROVAL_STANDARD_FIELDS,approvalFieldsForBusiness,validateApprovalVisibleFields,
 sessionReviewSummary,businessServiceTypes
} from '../server/booking-approval-display.mjs';

const coach={id:'coach',name:'Coach',services:['group','private']};
const services=[
 {id:'group',name:'Small Group Session',duration:60,category:'Soccer training'},
 {id:'private',name:'Private Coaching',duration:60,category:'Soccer training'}
];
const session={id:'session-1',date:'2026-10-12',start:1020,service:'group',staff:'coach',capacity:10};
const config={services,staff:[coach],bookableSessions:[session],bookingCustomFields:[
 {id:'playerLevel',label:'Player Level',type:'text',required:false,showInNotification:false},
 {id:'ageGroup',label:'Age group',type:'select',required:false,showInNotification:false,options:['U13']}
]};
const request=(id)=>({id,status:'pending',date:session.date,start_minute:1020,staff_id:'coach',details:{sessionId:session.id,serviceIds:['group'],customAnswers:{playerLevel:'3',ageGroup:'U13'}}});
const attendees=Array.from({length:7},(_,i)=>({
 id:String(i),date:session.date,start:session.start,staff:session.staff,status:'Confirmed',
 data:JSON.stringify({sessionId:session.id})
}));

test('calendar legend uses only this business service categories and no global hair/barber/color labels',()=>{
 const types=businessServiceTypes(services);
 assert.deepEqual(types.map(t=>t.name),['Soccer training']);
 assert.deepEqual(businessServiceTypes([{category:'Pet grooming'},{category:'Nail care'}]).map(t=>t.name),['Pet grooming','Nail care']);
 assert.deepEqual(businessServiceTypes([{category:''},{category:' '},{category:null}]),[]);
});
test('business owner can select approval card fields, and custom questions default to visible',()=>{
 const defaults=approvalFieldsForBusiness(config);
 assert.ok(defaults.includes('playerLevel')&&defaults.includes('ageGroup'));
 assert.ok(APPROVAL_STANDARD_FIELDS.every(f=>defaults.includes(f)));
 const selected={...config,bookingApprovalVisibleFields:['services','customerPhone','playerLevel']};
 assert.deepEqual(approvalFieldsForBusiness(selected),['services','customerPhone','playerLevel']);
 assert.equal(validateApprovalVisibleFields(selected),true);
 assert.throws(()=>validateApprovalVisibleFields({...config,bookingApprovalVisibleFields:['employeeSalary']}),/only existing/i);
 assert.throws(()=>validateApprovalVisibleFields({...config,bookingApprovalVisibleFields:['services','services']}),/selection/i);
});
test('approval card shows confirmed seats and pending requests separately without holding seats',()=>{
 const requests=[request('req1'),request('req2')];
 const info=sessionReviewSummary(config,requests[0],attendees,requests);
 assert.deepEqual(info,{id:session.id,booked:7,capacity:10,remaining:3,waiting:2});
 const cancelled=[...attendees,{...attendees[0],status:'Cancelled'}];
 assert.equal(sessionReviewSummary(config,requests[0],cancelled,requests).booked,7);
 assert.equal(sessionReviewSummary(config,{...requests[0],details:{serviceIds:['private']}},attendees,requests),null);
 assert.equal(sessionReviewSummary({...config,bookableSessions:[]},requests[0],attendees,requests),null);
});
test('approval and theme integration keep occupancy mandatory and service legend tenant-based',async()=>{
 const root=new URL('../',import.meta.url);
 const dashboard=await readFile(new URL('app/studio/owner-dashboard.tsx',root),'utf8');
 const review=await readFile(new URL('app/components/booking-request-cards.tsx',root),'utf8');
 const ownerAPI=await readFile(new URL('app/api/studio/approvals/route.ts',root),'utf8');
 const teamAPI=await readFile(new URL('app/api/team/review/route.ts',root),'utf8');
 const customer=await readFile(new URL('app/book/page.tsx',root),'utf8');
 const css=await readFile(new URL('app/globals.css',root),'utf8');
 assert.match(dashboard,/businessServiceTypes\(config\.services/);
 assert.doesNotMatch(dashboard,/dot purple"\/>Hair/);
 assert.doesNotMatch(dashboard,/dot blue"\/>Barber/);
 assert.match(dashboard,/sf-business-service-legend/);
 const questionCenter=await readFile(new URL('app/components/registration-question-settings.tsx',root),'utf8');
 assert.match(questionCenter,/Details displayed on approval review cards/);
 assert.doesNotMatch(dashboard,/sf-approval-field-choices/);
 assert.match(review,/sf-approval-activity/);
 assert.match(review,/sf-approval-seats/);
 assert.match(review,/booking request/);
 assert.match(ownerAPI,/owner=\$1/);
 assert.match(ownerAPI,/sessionReviewSummary/);
 assert.match(teamAPI,/business_id=\$1 AND reviewer=\$2/);
 assert.match(customer,/sf-slot-count/);
 assert.match(css,/\.slot-grid button \.sf-slot-count.*color:inherit!important/);
});
