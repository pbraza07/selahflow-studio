import test from 'node:test';
import assert from 'node:assert/strict';
import {clientCardBalance} from '../server/client-card-balance.mjs';

const member={id:'m',membership_name:'Training',status:'active',initial_paid_at:'2026-01-01T12:00Z',credit_period_start:'2026-01-01T12:00Z',credit_period_end:'2026-02-01T12:00Z',sessions_used:4,sessions_included:10,weekly_sessions:2};
test('shows the actual current allowance and the shorter February renewal',()=>{
 const result=clientCardBalance(member,new Date('2026-01-20T12:00Z'));
 assert.deepEqual([result.used,result.left,result.total,result.nextTotal],[4,6,10,8]);
 const rolled=clientCardBalance(member,new Date('2026-02-02T12:00Z'));
 assert.deepEqual([rolled.used,rolled.left,rolled.total,rolled.nextTotal],[0,8,8,10]);
});
test('inactive enrollments have zero available and packages do not renew',()=>{
 const result=clientCardBalance({...member,billing_type:'package',status:'pending_payment'});
 assert.deepEqual([result.left,result.total,result.nextDate,result.nextTotal],[0,10,null,null]);
});
