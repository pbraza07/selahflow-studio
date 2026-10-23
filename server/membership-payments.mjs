import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertSandboxPayments,isStaging} from './staging-safety.mjs';
export const paymentConfigured=()=>Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
export const stripeConfigured=()=>Boolean(process.env.STRIPE_SECRET_KEY);
export function validateMembershipPlan(data){
 const name=String(data?.name||'').trim(),description=String(data?.description||'').trim();
 const interval=String(data?.interval||'');
 const price=Number(data?.priceCents);
 if(name.length<2||name.length>100||description.length>1000||!['week','month','year'].includes(interval)||
 !Number.isSafeInteger(price)||price<100||price>100000000)throw Error('Enter a plan name, weekly/monthly/yearly billing and a valid price of at least $1.00.');
 return {name,description,interval,price};
}
export function googleListingUrl(value){
 const raw=String(value||'').trim();
 if(!raw)return '';
 if(raw.length>500)throw Error('Google Maps listing link cannot exceed 500 characters.');
 let url;try{url=new URL(raw);}catch{throw Error('Enter a complete Google Maps business link.');}
 const host=url.hostname.toLowerCase();
 const allowed=['google.com','www.google.com','maps.google.com','maps.app.goo.gl','goo.gl','www.google.co.uk','www.google.com.br'];
 if(url.protocol!=='https:'||!allowed.includes(host)||url.username||url.password||
 (host==='goo.gl'&&!url.pathname.startsWith('/maps'))||
 (host.endsWith('google.com')&&!(/^\/maps(?:\/|$)/.test(url.pathname)||url.pathname.startsWith('/url'))))
 throw Error('Enter a public Google Maps listing URL (https://maps.google.com or maps.app.goo.gl).');
 return url.toString();
}
export async function stripeApi(endpoint,options={}){
 assertSandboxPayments();
 const secret=process.env.STRIPE_SECRET_KEY;
 if(!secret)throw Error('Stripe payments are not configured for SelahFlow.');
 const {account,params,method='POST',idempotencyKey,namespace='v1'}=options;
 if(!['v1','v2'].includes(namespace))throw Error('Invalid Stripe API namespace.');
 if(account&&(!/^acct_[A-Za-z0-9]+$/.test(account)))throw Error('Invalid connected payment account.');
 const headers={Authorization:'Bearer '+secret};
 if(account)headers['Stripe-Account']=account;
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 if(namespace==='v2')headers['Stripe-Version']='2026-09-30.endive';
 let payload;
 if(params){
  if(namespace==='v2'){
   payload=JSON.stringify(params);
   headers['Content-Type']='application/json';
  }else{
  payload=new URLSearchParams();
  for(const [k,v] of Object.entries(params))if(v!==null&&v!==undefined)payload.append(k,String(v));
  headers['Content-Type']='application/x-www-form-urlencoded';
  }
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('https://api.stripe.com/'+namespace+'/'+endpoint.replace(/^\/+/,''),{
   method,headers,...(payload?{body:payload.toString()}:{}),signal:controller.signal,cache:'no-store'
  });
  const result=await response.json();
  if(!response.ok)throw Error(result?.error?.message||'Stripe payment service could not complete the request.');
  return result;
 }finally{clearTimeout(timer);}
}
// Managed Risk platforms cannot create legacy Express accounts with platform
// loss liability. Full dashboard access supports Stripe-owned risk without a
// preview API. v2 IDs remain compatible with v1 account links and direct charges.
export async function createStripeMerchantAccount(business,email){
 const created=await stripeApi('core/accounts',{namespace:'v2',params:{
  display_name:business.name,...(email?{contact_email:email}:{}),
  identity:{country:'US'},dashboard:'full',
  defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},
  configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},
  metadata:{selahflow_business_id:business.id}
 },idempotencyKey:'selahflow-connect-managed-v2-'+business.id});
 if(!/^acct_[A-Za-z0-9]+$/.test(created.id||''))throw Error('Stripe returned an invalid connected account.');
 return created;
}
// Retain the stable Account Links API verified against hosted onboarding.
// Never return an unvalidated destination to the owner browser.
export async function createStripeOnboardingLink(account,returnUrl,refreshUrl,api=stripeApi){
 if(!/^acct_[A-Za-z0-9]+$/.test(account||''))throw Error('Invalid connected payment account.');
 for(const value of [returnUrl,refreshUrl]){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid Stripe return destination.');
 }
 const link=await api('account_links',{params:{account,type:'account_onboarding',
  return_url:returnUrl,refresh_url:refreshUrl}});
 let url;try{url=new URL(link.url);}catch{throw Error('Stripe did not return an onboarding link. Please try again.');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.stripe.com')||url.username||url.password||url.port)
  throw Error('Unexpected Stripe onboarding destination.');
 return {...link,url:url.toString()};
}
export function verifyStripeWebhook(raw,signature,secret,now=Math.floor(Date.now()/1000),env=process.env){
 if(!signature||!secret)throw Error('Missing payment webhook signature.');
 const attrs=Object.fromEntries(signature.split(',').map(v=>v.trim().split('=').slice(0,2)));
 const timestamp=Number(attrs.t);
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>300)throw Error('Expired payment webhook signature.');
 const mac=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
 const signatures=signature.split(',').map(v=>v.trim()).filter(v=>v.startsWith('v1=')).map(v=>v.slice(3));
 if(!signatures.some(v=>/^[\da-f]{64}$/i.test(v)&&timingSafeEqual(Buffer.from(v,'hex'),Buffer.from(mac,'hex'))))
  throw Error('Payment webhook signature invalid.');
 const event=JSON.parse(raw);
 if(isStaging(env)&&event.livemode!==false)throw Error('Staging accepts only sandbox payment events.');
 if(!event.id||!event.type||!event.data?.object||!event.account)throw Error('Invalid connected-account payment event.');
 return event;
}
export function invoiceSubscriptionId(invoice){
 const s=invoice?.parent?.subscription_details?.subscription || invoice?.subscription ||
 invoice?.lines?.data?.find(v=>v?.parent?.subscription_item_details?.subscription)?.parent?.subscription_item_details?.subscription;
 return typeof s==='string'?s:null;
}
export function invoicePaidThrough(invoice){
 const ends=(invoice?.lines?.data||[]).map(l=>l?.period?.end).filter(x=>Number.isSafeInteger(x)&&x>0);
 return ends.length?new Date(Math.max(...ends)*1000).toISOString():null;
}
export function shouldActivateInvoice(invoice,allowZero=false){
 // Current Stripe invoices omit the legacy paid boolean. Explicit false still
 // rejects contradictory legacy payloads; status and collected amount are required.
 return invoice?.paid!==false&&invoice?.status==='paid'&&Number.isSafeInteger(invoice?.amount_paid)&&(invoice.amount_paid>0||allowZero&&invoice.amount_paid===0);
}
