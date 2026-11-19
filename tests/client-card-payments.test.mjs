import test from 'node:test';
import assert from 'node:assert/strict';
import {attachCardPayments} from '../server/client-card-payments.mjs';

test('client cards keep historical payment methods while any remaining item is pending',async()=>{
 const visits=[{id:'paid',serviceNames:['Class'],status:'Confirmed'},{id:'due',serviceNames:['Lesson'],status:'Confirmed',date:'2026-11-19'},{id:'cancelled',serviceNames:['Lesson'],status:'Cancelled'}];
 const clients=[{memberNumber:'AA1001',enrollmentIds:['m'],history:visits},{memberNumber:'BB1002',history:[]}];
 const rows=[
  [{id:'paid',details:{paymentStatus:'paid',paymentProvider:'helcim'}},{id:'due',details:{price:10,email:'a@example.test'}},{id:'cancelled',details:{price:10}}],
  [{id:'m',status:'pending_payment',online_ready:true,name:'Monthly plan',customer_email:'a@example.test'}],
  [{id:'product',member_number:'AA1001',status:'paid',payment_method:'zelle'}],
  [{sale:{memberNumber:'BB1002'}}]
 ];
 await attachCardPayments({query:async()=>({rows:rows.shift()})},{id:'tenant',owner_id:'owner'},clients);
 assert.deepEqual(clients[0].cardPayments.due.map(i=>i.kind),['booking','membership']);
 assert.deepEqual(clients[0].cardPayments.methods,['Helcim','Zelle']);
 assert.deepEqual(clients[1].cardPayments,{due:[],methods:['Cash']});
});
