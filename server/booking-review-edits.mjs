import {customRegistrationFields} from './registration-questions.mjs';
import {randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {sanitizeBookingAnswers} from './booking-custom-fields.mjs';
import {assertRequestReviewer} from './booking-review-access.mjs';

export function editableBookingDetails(original,input,fields=[]){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter valid booking details.');
 const whitelist=['customerName','customerEmail','customerPhone','customAnswers'];
 if(Object.keys(input).some(k=>!whitelist.includes(k)))throw Error('Only customer details and booking question answers can be edited before approval.');
 const customerName=String(input.customerName||'').trim();
 const customerEmail=String(input.customerEmail||'').trim();
 const customerPhone=String(input.customerPhone||'').trim();
 if(customerName.length<2||customerName.length>100)throw Error('Enter a customer name of at least two characters.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)||customerEmail.length>254)throw Error('Enter a valid customer email.');
 if(customerPhone.length>40||/[<>\u0000-\u001f]/.test(customerPhone))throw Error('Phone number must contain no more than 40 valid characters.');
 if(!input.customAnswers||typeof input.customAnswers!=='object'||Array.isArray(input.customAnswers))throw Error('Invalid booking question answers.');
 const allowed=new Set(fields.map(f=>f.id));
 if(Object.keys(input.customAnswers).some(key=>!allowed.has(key)))throw Error('Unknown custom booking question.');
 const customAnswers=sanitizeBookingAnswers(fields,input.customAnswers);
 return {...original,originalSubmission:original.originalSubmission||{customerName:original.customerName,customerEmail:original.customerEmail,customerPhone:original.customerPhone,customAnswers:original.customAnswers||{}},customerName,customerEmail,customerPhone,customAnswers,
  correctedAt:new Date().toISOString()};
}
export async function editPendingRequest(owner,id,reviewer,input,teamAccountId=null){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid booking request.');
 const pool=getPool(),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const result=await client.query(
   "SELECT r.id,r.owner_id,r.staff_id,r.business_id,r.details,r.reviewer,r.status,s.data AS settings_data FROM booking_requests r JOIN settings s ON s.owner=r.owner_id JOIN businesses b ON b.id=r.business_id WHERE r.id=$1 AND r.owner_id=$2 AND b.status='active' FOR UPDATE OF r",
   [id,owner]);
  const row=result.rows[0];
  if(!row||row.status!=='pending')throw Error('This request is no longer awaiting approval.');
  await assertRequestReviewer(client,row,reviewer,teamAccountId);
  const settings=JSON.parse(row.settings_data||'{}');
  const original=JSON.parse(row.details||'{}');
  const update=editableBookingDetails(original,input,customRegistrationFields(settings,'booking',original.sessionId||null,original.serviceIds||[]));
  update.correctedBy=reviewer;
  const oldDetails=JSON.stringify(original),newDetails=JSON.stringify(update);
  await client.query('UPDATE booking_requests SET details=$1 WHERE id=$2 AND business_id=$3 AND status=$4',
   [newDetails,id,row.business_id,'pending']);
  await client.query(
   'INSERT INTO booking_request_edits(id,request_id,business_id,edited_by,before_details,after_details) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
   [randomUUID(),id,row.business_id,reviewer,oldDetails,newDetails]);
  await client.query('COMMIT');
  return {ok:true,id,details:update};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
