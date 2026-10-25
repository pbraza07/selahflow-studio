import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {
 validateMembershipPlan,googleListingUrl,verifyStripeWebhook,invoicePaidThrough,
 invoiceSubscriptionId,shouldActivateInvoice,paymentConfigured
} from '../server/membership-payments.mjs';
import {validGalleryMatch,validPhotoResource,approvedGooglePhotoUri} from '../server/google-business-gallery.mjs';

test('weekly, monthly and yearly memberships require a real advance amount and valid plan',()=>{
 for(const interval of ['week','month','year']){
  assert.deepEqual(validateMembershipPlan({name:'Customer Membership',description:'Sessions included',interval,priceCents:4500}),
   {name:'Customer Membership',description:'Sessions included',interval,price:4500});
 }
 assert.throws(()=>validateMembershipPlan({name:'Membership',interval:'day',priceCents:5000}),/plan name/i);
 assert.throws(()=>validateMembershipPlan({name:'Membership',interval:'month',priceCents:0}),/price/i);
 assert.throws(()=>validateMembershipPlan({name:'Membership',interval:'year',priceCents:900.45}),/price/i);
});
test('only valid official Google maps links may become gallery sources',()=>{
 assert.equal(googleListingUrl(''), '');
 assert.equal(googleListingUrl('https://maps.app.goo.gl/example'),'https://maps.app.goo.gl/example');
 assert.match(googleListingUrl('https://www.google.com/maps/place/Fitness+Studio/'),/^https:\/\/www.google.com\/maps/);
 for(const url of ['javascript:alert(1)','http://www.google.com/maps/place/foo','https://evil.com/google/maps',
  'https://www.google.com.evil.com/maps','https://www.google.com@evil.com/maps']){
  assert.throws(()=>googleListingUrl(url),/Google Maps/i,url);
 }
});
test('Google business gallery matches selected business names and only trusted photo media addresses',()=>{
 assert.equal(validGalleryMatch('Arcila Training','Arcila Training'),true);
 assert.equal(validGalleryMatch('Arcila Training','Another Barber'),false);
 assert.equal(validPhotoResource('places/ChIJj61dQgK6j4AR/photos/Aaw_FcKly0DEv3EWmDJy'),true);
 assert.equal(validPhotoResource('https://evil.com/photo'),false);
 assert.equal(approvedGooglePhotoUri('https://lh3.googleusercontent.com/example'),'https://lh3.googleusercontent.com/example');
 assert.equal(approvedGooglePhotoUri('https://googleusercontent.com.evil.com/bad'),null);
});
test('Stripe Connect signatures reject tampering, wrong secret and expired events',()=>{
 const secret='whsec_test-signature',now=1800000000;
 const json=JSON.stringify({id:'evt_123',account:'acct_12345',livemode:false,type:'invoice.paid',data:{object:{id:'in_123'}}});
 const sig=createHmac('sha256',secret).update(now+'.'+json).digest('hex');
 assert.equal(verifyStripeWebhook(json,'t='+now+',v1='+sig,secret,now).id,'evt_123');
 assert.throws(()=>verifyStripeWebhook(json+' ','t='+now+',v1='+sig,secret,now),/invalid/i);
 assert.throws(()=>verifyStripeWebhook(json,'t='+now+',v1='+sig,'wrong-secret',now),/invalid/i);
 assert.throws(()=>verifyStripeWebhook(json,'t='+(now-301)+',v1='+sig,secret,now),/expired/i);
});
test('Only paid Stripe invoices with an advance charge can activate membership',()=>{
 const invoice={status:'paid',paid:true,amount_paid:4500,currency:'usd',parent:{subscription_details:{subscription:'sub_123'}},
  lines:{data:[{period:{end:1803456000}}]}};
 assert.equal(shouldActivateInvoice(invoice),true);
 assert.equal(invoiceSubscriptionId(invoice),'sub_123');
 assert.equal(invoicePaidThrough(invoice),new Date(1803456000*1000).toISOString());
 assert.equal(shouldActivateInvoice({...invoice,paid:false}),false);
 assert.equal(shouldActivateInvoice({...invoice,amount_paid:0}),false);
});
test('membership migration isolates each merchant, keeps ongoing payments linked, and webhook processing is idempotent',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/003_platform_foundation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/012_memberships_google_listing.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('u1','first@example.com','hash'),('u2','second@example.com','hash')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('b1','u1','business-one','Business One'),('b2','u2','business-two','Business Two')");
  await db.query("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES('plan1','b1','Monthly Pass','month',4900),('plan2','b2','Monthly Pass','month',4900)");
  await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,stripe_account_id,price_cents) VALUES('m1','b1','plan1','Alex','alex@example.com','acct_a',4900)");
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_memberships WHERE business_id=$1',['b1'])).rows[0].n,1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM customer_memberships WHERE business_id=$1',['b2'])).rows[0].n,0);
  await assert.rejects(db.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,stripe_account_id,price_cents) VALUES('m3','b2','no-plan','Alex','alex@example.com','acct_b',4900)"));
  await db.query("INSERT INTO membership_webhook_events(event_id,stripe_account_id,event_type) VALUES('evt_1','acct_a','invoice.paid') ON CONFLICT DO NOTHING");
  const duplicate=await db.query("INSERT INTO membership_webhook_events(event_id,stripe_account_id,event_type) VALUES('evt_1','acct_a','invoice.paid') ON CONFLICT DO NOTHING RETURNING event_id");
  assert.equal(duplicate.rowCount,0);
 }finally{await db.close();}
});
test('public booking and business pages link to memberships, owner dashboard can create plans',async()=>{
 const base=new URL('../',import.meta.url);
 const files=await Promise.all([
  'app/studio/owner-dashboard.tsx','app/book/page.tsx','app/[slug]/page.tsx',
  'app/components/owner-brand-profile.tsx','app/components/google-business-gallery.tsx',
  'app/api/public/memberships/route.ts','app/api/stripe/webhook/route.ts',
  'app/api/public/google-gallery/route.ts','app/api/public/google-gallery/photo/route.ts'
 ].map(f=>readFile(new URL(f,base),'utf8')));
 assert.match(files[0],/OwnerMemberships/);
 assert.match(files[1],/Explore memberships/);
 assert.match(files[2],/View memberships/);
 assert.match(files[3],/Google Maps business listing link/);
 assert.match(files[4],/Next photo/);
 assert.match(files[4],/Previous photo/);
 assert.match(files[5],/startMembershipCheckout/);
 const checkout=await readFile(new URL('server/membership-checkout.mjs',base),'utf8');
 assert.match(checkout,/mode:'subscription'/);
 assert.match(checkout,/payment_method_collection/);
 assert.match(files[6],/verifyStripeWebhook/);
 assert.match(files[6],/invoice\.paid/);
 assert.match(files[6],/checkout\.session\.completed/);
 assert.match(files[6],/Do NOT activate here/);
 assert.match(files[7],/Cache-Control/);
 assert.match(files[8],/skipHttpRedirect=true/);
});
