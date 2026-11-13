import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasUsableMembership} from '../server/member-badge-state.mjs';
import {validateBookableSessions} from '../server/session-scheduling.mjs';

test('only active memberships with remaining credits qualify for a $0 covered booking',()=>{
 assert.equal(hasUsableMembership({status:'active',sessions_included:4,sessions_used:3}),true);
 assert.equal(hasUsableMembership({status:'active',sessions_included:4,sessions_used:4}),false);
 assert.equal(hasUsableMembership({status:'pending_payment',sessions_included:4,sessions_used:0}),false);
});

test('bookable session credit flag is validated and used in final booking and attendance paths',async()=>{
 const config={open:9,close:18,buffer:0,services:[{id:'s',duration:30,durationUnit:'minutes'}],staff:[{id:'t',services:['s']}],bookableSessions:[{id:'group',date:'2026-11-01',service:'s',staff:'t',start:540,capacity:8,membershipCreditAllowed:false}]};
 assert.doesNotThrow(()=>validateBookableSessions(config));
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[{...config.bookableSessions[0],membershipCreditAllowed:'yes'}]}),/Check each session/);
 const [booking,attendance]=await Promise.all([readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8'),readFile(new URL('../server/appointment-membership-usage.mjs',import.meta.url),'utf8')]);
 assert.match(booking,/membershipCovered\?0/);
 assert.match(booking,/membershipCreditAllowed/);
 assert.match(attendance,/creditAllowed:appointmentData\.membershipCreditAllowed!==false/);
});
test('member lookup drives a zero-price confirmation while preserving the regular price for server validation',async()=>{
 const [page,lookup]=await Promise.all([
  readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../app/api/public/member-lookup/route.ts',import.meta.url),'utf8')
 ]);
 assert.match(page,/const regularPrice=services\.reduce/);
 assert.match(page,/const price=membershipCovered\?0:couponQuote\?couponQuote.totalCents\/100:regularPrice/);
 assert.match(page,/expectedPrice:regularPrice/);
 assert.match(lookup,/membershipCovered/);
 assert.match(lookup,/sessionsLeft/);
});
test('booking surfaces do not show pre-tax wording',async()=>{
 const [publicPage,ownerDashboard]=await Promise.all([
  readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8'),
  readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8')
 ]);
 assert.doesNotMatch(publicPage,/before applicable tax|applicable tax|before tax/i);
 assert.doesNotMatch(ownerDashboard,/before applicable tax|applicable tax|before tax/i);
});

test('owner quote applies lifetime credits only to covered services and honors opt-out and expiry',async()=>{
 const {ownerBookingQuote}=await import('../server/owner-booking-quote.mjs');
 const member={name:'Lifetime Member',sessionsLeft:10,pastCreditAvailable:true,creditEligibility:{mode:'selected',serviceIds:['private'],sessionIds:[]},bookingEligibility:{status:'active',sessions_included:10,sessions_used:0,paid_through:null}};
 const input={services:[{id:'private',price:90}],membership:member,date:'2030-01-02',loaded:true};
 assert.equal(ownerBookingQuote(input).price,0);
 assert.equal(ownerBookingQuote({...input,past:true}).price,0);
 assert.equal(ownerBookingQuote({...input,past:true,applyMembership:false}).price,90);
 assert.equal(ownerBookingQuote({...input,loaded:false}).price,90);
 assert.equal(ownerBookingQuote({...input,services:[{id:'group',price:35}]}).price,35);
 assert.equal(ownerBookingQuote({...input,session:{id:'session',membershipCreditAllowed:false}}).covered,false);
 assert.equal(ownerBookingQuote({...input,membership:{...member,bookingEligibility:{...member.bookingEligibility,paid_through:'2000-01-01'}}}).covered,false);
 assert.equal(ownerBookingQuote({...input,membership:{...member,pastCreditAvailable:false},past:true}).covered,false);
 assert.equal(ownerBookingQuote({...input,membership:{...member,bookingEligibility:{...member.bookingEligibility,sessions_used:10}}}).covered,false);
});
