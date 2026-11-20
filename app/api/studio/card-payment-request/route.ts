import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {prepareBookingReminder} from '../../../../server/payment-reminder-bookings.mjs';
import {prepareMembershipReminder} from '../../../../server/payment-reminder-memberships.mjs';
import {validEmail,sendNotificationChannel} from '../../../../server/notification-delivery.mjs';
import {stripeApi} from '../../../../server/membership-payments.mjs';
import {checkoutUrl,assertTestPayment} from '../../../../server/stripe-checkout.mjs';

export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});
 try{
  const pool=getPool(),owner=await requireOwner(req),input=await req.json();
  const whatsapp=input.channel==='whatsapp';
  const kinds=whatsapp?['booking','membership','invoice','offlineMembership','product']:['invoice','offlineMembership','product'];
  if(!kinds.includes(input.kind)||![input.id,input.key].every(id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)))throw Error('Invalid request.');
  const biz=(await pool.query("SELECT id,name FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!biz)throw Error('Business unavailable.');
  let email='',items:{label:string;url?:string}[]=[];
  if(input.kind==='booking'||input.kind==='membership'){
   const options={businessId:biz.id,sourceId:input.id,origin:trustedOrigin(req),manual:true,destination:input.email};
   const item=input.kind==='booking'?await prepareBookingReminder(pool,options):await prepareMembershipReminder(pool,options);
   if(!item||Array.isArray(item))throw Error('This request no longer matches a payable item.');
   email=item.destination;
   const online=input.kind!=='booking'||item.paymentOptions?.online;
   items=[{label:item.label+' · $'+(item.amountCents/100).toFixed(2)+(online&&item.url?'':' · Contact the business to arrange payment.'),url:online?item.url:undefined}];
  }else if(input.kind==='invoice'){
   const invoices=await prepareMembershipReminder(pool,{businessId:biz.id,sourceId:input.id,origin:trustedOrigin(req),manual:true,destination:input.email});
   if(!Array.isArray(invoices)||!invoices.length)throw Error('No payable invoice was verified. Refresh the client card.');
   email=invoices[0].destination;
   items=invoices.map(i=>({label:i.label+' · $'+(i.amountCents/100).toFixed(2),url:i.url}));
  }else if(input.kind==='offlineMembership'){
   const member=(await pool.query("SELECT m.customer_email,p.name FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE m.id=$1 AND m.business_id=$2 AND m.status IN ('pending_payment','payment_failed','past_due') AND m.stripe_subscription_id IS NULL",[input.id,biz.id])).rows[0];
   if(!member)throw Error('This membership is no longer awaiting payment.');
   email=member.customer_email;items=[{label:member.name+' · Please contact '+biz.name+' to complete your outstanding payment onsite.'}];
  }else{
   const order=(await pool.query("SELECT * FROM product_orders WHERE business_id=$1 AND id=$2 AND status='pending' AND submitted_at IS NOT NULL",[biz.id,input.id])).rows[0];
   if(!order)throw Error('This order is no longer pending.');
   email=order.customer_email;let url;
   if(order.payment_method==='stripe'){
    const session=await stripeApi('checkout/sessions/'+order.stripe_checkout_session_id,{method:'GET',account:order.stripe_account_id});
    assertTestPayment(session);
    if(session.status!=='open'||session.payment_status!=='unpaid'||session.client_reference_id!==order.id)throw Error('This checkout is no longer available.');
    url=checkoutUrl(session);
   }
   items=[{label:'Product order · $'+(order.total_cents/100).toFixed(2)+(url?'':' · Please pay the business by '+order.payment_method+' at pickup.'),url}];
  }
  if(!validEmail(email)||email.toLowerCase()!==String(input.email).toLowerCase())throw Error('Review the saved email address before sending.');
  if(whatsapp){
   const message=['Payment request from '+biz.name,...items.map(item=>[item.label,item.url].filter(Boolean).join('\n'))].join('\n\n');
   return Response.json({message},{headers:{'Cache-Control':'private, no-store'}});
  }
  const claimed=await pool.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'card_payment_request',$4) ON CONFLICT DO NOTHING RETURNING id",[input.key,owner,new Date().toISOString(),JSON.stringify({source:input.id,kind:input.kind,status:'processing'})]);
  if(!claimed.rowCount)throw Error('This request was already started. Check email activity before sending again.');
  const result=await sendNotificationChannel('email',email,{subject:'Payment request from '+biz.name,text:items.map(i=>i.label+(i.url?'\n'+i.url:'')).join('\n\n'),actions:items.filter(i=>i.url).map(i=>({label:i.label,url:i.url})),idempotencyKey:input.key,trackAmbiguous:true},undefined,undefined,{businessId:biz.id,kind:'transactional-client'});
  await pool.query("UPDATE events SET data=(data::jsonb||$3::jsonb)::text WHERE owner=$1 AND id=$2",[owner,input.key,JSON.stringify({status:result.status})]);
  if(result.status!=='submitted')throw Error('Email status: '+result.status+'. Review delivery before resending.');
  return Response.json({sent:true});
 }catch(e:any){return Response.json({error:e.message==='AUTH_REQUIRED'?'Sign in as owner.':/^(Invalid request|Business unavailable|No payable invoice|This (order|request|membership|checkout)|Review the saved email|Email status:)/.test(e.message)?e.message:'Payment request could not be verified or sent. Check the payment and email setup.'},{status:e.message==='AUTH_REQUIRED'?401:409});}
}
