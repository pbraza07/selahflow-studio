/**
 * Owner-only session roster projection. Input must come from the authenticated
 * tenant's /api/studio owner context, never a public booking payload.
 * A recurring instance is identified by stable occurrence id and date so
 * rescheduling to a new coach never drops its original attendees.
 */
const activeStatuses=new Set(['Confirmed','Checked in','Completed','Pending']);
export function sessionRosterForOwner(session,appointments){
 if(!session||typeof session.id!=='string'||typeof session.date!=='string')
  throw Error('Choose a valid session.');
 const clients=(Array.isArray(appointments)?appointments:[])
  .filter(a=>a&&a.sessionId===session.id&&a.date===session.date&&!a.sample&&
   activeStatuses.has(a.status))
  .map(a=>({
   bookingId:String(a.id||''),name:String(a.name||a.customerName||'Customer'),
   email:String(a.email||a.customerEmail||''),
   phone:String(a.phone||a.customerPhone||''),
   status:a.status,submittedAt:a.created||a.submittedAt||null,
   services:Array.isArray(a.services)?a.services:[],
   quotedPrice:Number.isFinite(Number(a.price))?Number(a.price):null,
   customAnswers:a.customAnswers&&typeof a.customAnswers==='object'&&!Array.isArray(a.customAnswers)?
    a.customAnswers:{},
   customFieldLabels:a.customFieldLabels&&typeof a.customFieldLabels==='object'&&!Array.isArray(a.customFieldLabels)?
    a.customFieldLabels:{},
   originalSubmission:a.originalSubmission&&typeof a.originalSubmission==='object'?a.originalSubmission:null
  }))
  .sort((a,b)=>a.name.localeCompare(b.name)||a.bookingId.localeCompare(b.bookingId));
 return {id:session.id,date:session.date,staff:session.staff,
  capacity:session.capacity,booked:clients.length,
  remaining:Math.max(0,Number(session.capacity||0)-clients.length),clients};
}
