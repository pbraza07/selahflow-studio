import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnerMembershipDeletion} from '../server/owner-membership-cancellation.mjs';
const member={id:'member',business_id:'biz',stripe_account_id:'acct_one',stripe_checkout_session_id:'cs_test_one',status:'pending_payment',sessions_included:0};
const checkout={id:'cs_test_one',client_reference_id:'member',metadata:{membership_id:'member',selahflow_business_id:'biz'},status:'complete',mode:'payment',payment_status:'no_payment_required',amount_total:0,livemode:false};
test('free one-time package deletion requires no subscription cancellation',async()=>{
 const calls=[];const result=await prepareOwnerMembershipDeletion(member,'biz',async(path,o)=>{calls.push({path,...o});return checkout;});
 assert.deepEqual([...result.completedFreeCheckouts],['acct_one|cs_test_one']);assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');
});
test('confirmed active membership cancellation verifies the saved subscription and does not invoice or prorate',async()=>{
 const m={...member,status:'active',initial_paid_at:'2030-01-01',stripe_checkout_session_id:null,stripe_subscription_id:'sub_one',stripe_customer_id:'cus_one'};
 const calls=[];await prepareOwnerMembershipDeletion(m,'biz',async(path,o)=>{calls.push({path,...o});return {id:'sub_one',customer:'cus_one',metadata:checkout.metadata,livemode:false,status:o.method==='DELETE'?'canceled':'active'};});
 assert.equal(calls[1].method,'DELETE');assert.deepEqual(calls[1].params,{invoice_now:false,prorate:false});
});
test('wrong checkout, subscription, customer and unknown cancellation states cannot authorize deletion',async()=>{
 for(const change of [{client_reference_id:'foreign'},{metadata:{membership_id:'member',selahflow_business_id:'foreign'}},{mode:'subscription',subscription:'sub_other'},{customer:'cus_other'}]){
  let writes=0;await assert.rejects(prepareOwnerMembershipDeletion({...member,stripe_subscription_id:'sub_one',stripe_customer_id:'cus_one'},'biz',async(path,o)=>{if(o.method!=='GET')writes++;return {...checkout,customer:'cus_one',...change};}),/identity/);assert.equal(writes,0);
 }
 await assert.rejects(prepareOwnerMembershipDeletion({...member,stripe_checkout_session_id:null,stripe_subscription_id:'sub_one'},'biz',async()=>({id:'sub_one',metadata:checkout.metadata,livemode:false,status:'active'})),/did not confirm cancellation/);
});
