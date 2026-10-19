import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {readdir,readFile} from 'node:fs/promises';
import {membershipRequestDetails,registerMembershipWithoutApproval} from '../server/membership-requests.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {startMembershipCheckout} from '../server/membership-checkout.mjs';
import {customRegistrationFields,registrationQuestions,validateRegistrationQuestions} from '../server/registration-questions.mjs';
import {sanitizeBookingAnswers,validateBookingFields} from '../server/booking-custom-fields.mjs';

async function setup(){
 const pg=new PGlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
  await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','a@example.com','hash'),('u2','b@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Training','month',1500,4),('p2','b2','Training','month',1500,4);");
 const db={query:async(sql,vars)=>{const x=await pg.query(sql,vars);return {...x,rowCount:x.rowCount??x.rows.length};},release(){}};
 return {pg,pool:{...db,connect:async()=>db}};
}
test('membership signup issues exactly the same Unique ID as a first booking, records a client, and reuses ID on return',async()=>{
 const {pg,pool}=await setup();
 try{
  const details=membershipRequestDetails({}, {firstName:'Caleb',lastName:'Alves',email:'caleb@example.com',dateOfBirth:'2013-08-14'});
  const submit=(requestId=randomUUID(),businessId='b1',ownerId='u1',planId='p1')=>registerMembershipWithoutApproval(pool,{businessId,ownerId,planId,requestId,details});
  const first=await submit();
  assert.equal(first.memberNumber,'CA0814');
  assert.equal(first.paymentPending,true);
  assert.equal((await pg.query("SELECT member_number FROM customer_booking_ids WHERE business_id='b1'")).rows[0].member_number,'CA0814');
  assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE owner='u1'")).rows[0].member_number,'CA0814');
  assert.equal((await pg.query("SELECT status,sessions_included FROM customer_memberships WHERE business_id='b1'")).rows[0].status,'pending_payment');
  assert.equal((await pg.query("SELECT sessions_included FROM customer_memberships WHERE business_id='b1'")).rows[0].sessions_included,0);
  const retry=await submit();
  assert.equal(retry.memberNumber,first.memberNumber);
  const allocated=await (async()=>{await pg.exec('BEGIN');try{const id=await issueMemberId(pg,{businessId:'b1',name:'Caleb Alves',dateOfBirth:'2013-08-14'});await pg.exec('COMMIT');return id;}catch(e){await pg.exec('ROLLBACK');throw e;}})();
  assert.equal(allocated,'CA0814','first booking must find the same ID as membership signup');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM customer_booking_ids WHERE business_id=$1',['b1'])).rows[0].n,1);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM business_client_profiles WHERE owner='u1'")).rows[0].n,1);
  const otherBusiness=await submit(randomUUID(),'b2','u2','p2');
  assert.equal(otherBusiness.memberNumber,'CA0814','different businesses may reuse the same six-character ID');
  const collision=membershipRequestDetails({},{firstName:'Carlos',lastName:'Adams',email:'carlos@example.com',dateOfBirth:'2013-08-14'});
  const another=await registerMembershipWithoutApproval(pool,{businessId:'b1',ownerId:'u1',planId:'p1',requestId:randomUUID(),details:collision});
  assert.equal(another.memberNumber,'CA0001','same-business initials+date collision gets unique fallback');
  assert.equal((await pg.query("SELECT COUNT(DISTINCT member_number)::int AS n FROM customer_booking_ids WHERE business_id='b1'")).rows[0].n,2);
 }finally{await pg.close();}
});
test('first Stripe membership checkout creates the booking identity before payment without granting sessions',async()=>{
 const {pg,pool}=await setup(),old=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  await pg.exec("INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true);");
  const body={slug:'one',planId:'p1',requestId:randomUUID(),firstName:'Noah',lastName:'Alves',email:'noah@example.com',dateOfBirth:'2015-09-06',termsAccepted:true,recurringAccepted:true};
  const checkout={id:'cs_test_signup001',livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/synthetic'};
  const api=async(path,opts)=>path.startsWith('accounts/')?{charges_enabled:true,details_submitted:true}:checkout;
  const result=await startMembershipCheckout(pool,body,'https://staging.example',api);
  assert.equal(result.checkoutUrl,checkout.url);
  const booking=(await pg.query("SELECT member_number FROM customer_booking_ids WHERE business_id='b1'")).rows[0];
  const member=(await pg.query("SELECT member_number,status,sessions_included FROM customer_memberships WHERE business_id='b1'")).rows[0];
  assert.equal(member.member_number,'NA0906');assert.equal(booking.member_number,'NA0906');
  assert.equal(member.status,'pending_payment');assert.equal(member.sessions_included,0);
  assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE owner='u1'")).rows[0].member_number,'NA0906');
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM membership_session_ledger WHERE business_id='b1'")).rows[0].n,0);
  assert.equal((await startMembershipCheckout(pool,{...body,requestId:randomUUID()},'https://staging.example',api)).checkoutUrl,checkout.url);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM customer_booking_ids WHERE business_id='b1'")).rows[0].n,1);
 }finally{
  await pg.close();
  for(const [i,name] of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries()){if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];}
 }
});
test('new and existing service questions apply only to matching selected services, once for multi-service checkout, and enforce required answers',()=>{
 const config={
  services:[{id:'training',name:'Training'},{id:'evaluation',name:'Evaluation',questionRequired:{emergency:true,phone:true}},{id:'existing',name:'Existing service'}],
  bookableSessions:[{id:'trainingSession',service:'training'}],
  bookingCustomFields:[
   {id:'emergency',label:'Emergency contact',type:'text',required:false,showInNotification:false,forms:['booking']},
   {id:'uniform',label:'Uniform size',type:'select',options:['S','M','L'],required:true,showInNotification:false,forms:['booking'],serviceIds:['training']},
   {id:'skill',label:'Player skill',type:'text',required:true,showInNotification:false,forms:['booking'],serviceIds:['training','evaluation']},
   {id:'notes',label:'Session notes',type:'text',required:true,showInNotification:false,forms:['booking'],sessionIds:['trainingSession'],serviceIds:['training']},
   {id:'ageGroup',label:'Age group',type:'text',required:true,showInNotification:false,forms:['booking'],serviceIds:['existing']}
  ]
 };
 validateBookingFields(config.bookingCustomFields,[]);validateRegistrationQuestions(config);
 assert.deepEqual(customRegistrationFields(config,'booking',null,['training']).map(x=>x.id),['emergency','uniform','skill']);
 assert.deepEqual(customRegistrationFields(config,'booking',null,['evaluation']).map(x=>x.id),['emergency','skill']);
 assert.deepEqual(customRegistrationFields(config,'booking',null,['existing']).map(x=>x.id),['emergency','ageGroup']);
 assert.deepEqual(customRegistrationFields(config,'booking',null,[]).map(x=>x.id),['emergency'],'no selected service means service-only question is hidden');
 const multi=registrationQuestions(config,'booking',null,['training','evaluation']).filter(x=>!x.standard);
 assert.deepEqual(multi.map(x=>x.id),['emergency','uniform','skill']);
 assert.equal(new Set(multi.map(x=>x.id)).size,multi.length);
 assert.equal(multi.find(x=>x.id==='emergency').required,true,'evaluation makes shared contact required');
 assert.equal(registrationQuestions(config,'booking',null,['evaluation']).find(x=>x.id==='phone').required,true,'per-service standard requirement');
 assert.equal(registrationQuestions(config,'booking',null,['training']).find(x=>x.id==='phone').required,false,'other services do not inherit service override');
 assert.deepEqual(customRegistrationFields(config,'booking','trainingSession__20261022',['training']).map(x=>x.id),['emergency','uniform','skill','notes']);
 assert.throws(()=>sanitizeBookingAnswers(multi,{uniform:'S'}),/Emergency contact is required/);
 assert.throws(()=>sanitizeBookingAnswers(multi,{emergency:'Parent',uniform:'S'}),/Player skill is required/);
 assert.deepEqual(sanitizeBookingAnswers(multi,{emergency:'Parent',uniform:'S',skill:'Advanced'}),{emergency:'Parent',uniform:'S',skill:'Advanced'});
 assert.throws(()=>validateRegistrationQuestions({...config,bookingCustomFields:[{...config.bookingCustomFields[0],serviceIds:['deleted-service']}]}),/Choose existing services/);
 assert.throws(()=>validateRegistrationQuestions({...config,services:config.services.map(s=>s.id==='training'?{...s,questionRequired:{fake:true}}:s)}),/Invalid service required/);
});
test('service editor is available for both catalog and Services page, and membership UI displays the Unique ID',async()=>{
 const root=new URL('../',import.meta.url);
 const dash=await readFile(new URL('app/studio/owner-dashboard.tsx',root),'utf8');
 const editor=await readFile(new URL('app/components/registration-question-settings.tsx',root),'utf8');
 const booking=await readFile(new URL('app/book/page.tsx',root),'utf8');
 const membership=await readFile(new URL('app/membership/[slug]/page.tsx',root),'utf8');
 assert.match(dash,/Edit service questions/);assert.match(dash,/serviceId=\{serviceQuestionEditor\}/);assert.match(dash,/Add service type/);
 assert.match(editor,/serviceIds:\[serviceId\]/);assert.match(editor,/Apply to booking services/);assert.match(editor,/Remove question from this service/);
 assert.match(booking,/serviceIds=\{selected\}/);assert.match(membership,/Your Unique Membership ID/);
});
