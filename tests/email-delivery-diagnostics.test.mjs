import test from 'node:test';
import assert from 'node:assert/strict';
import {emailReadinessSummary, clientEmailFailureSummary, readClientEmailFailures} from '../server/email-delivery-diagnostics.mjs';

test('Gmail readiness identifies reconnection without exposing the sender or secrets', () => {
 const report = emailReadinessSummary({emailProvider:'Gmail',emailConfigured:false},
  {setupComplete:true,connected:false,needsReconnect:true,sender:'private@example.test',encrypted_refresh_token:'secret'});
 assert.equal(report.authorization,'reconnection_required');
 assert.equal(report.needsReconnect,true);
 assert.equal(report.configured,false);
 assert.doesNotMatch(JSON.stringify(report),/private|secret|token/);
});
test('stored connected status is not represented as a live authentication or inbox-delivery test', () => {
 const report = emailReadinessSummary({emailProvider:'Gmail',emailConfigured:true},
  {setupComplete:true,connected:true,needsReconnect:false});
 assert.equal(report.authorization,'stored_connection_not_live_verified');
});
test('missing configuration logs only recognized setting names', () => {
 const report = emailReadinessSummary({emailProvider:'Gmail',emailConfigured:false},
  {setupComplete:false,missingConfiguration:['GMAIL_CLIENT_ID','private-value']});
 assert.deepEqual(report.missingConfiguration,['GMAIL_CLIENT_ID']);
 assert.equal(report.authorization,'server_configuration_missing');
 assert.equal(emailReadinessSummary({emailProvider:'Gmail'}, {setupComplete:true}).authorization,'not_connected');
 assert.deepEqual(emailReadinessSummary({emailProvider:'Resend',emailConfigured:true}),{provider:'Resend',configured:true});
});
test('failure summaries aggregate allowlisted reasons and never expose arbitrary provider details', () => {
 const rows = [
  {event_type:'payment_confirmation',status:'not_configured',detail:'Gmail authorization needs reconnection by the platform administrator',count:2},
  {event_type:'payment_confirmation',status:'not_configured',detail:'Gmail authorization needs reconnection by the platform administrator',count:1},
  {event_type:'payment_link',status:'failed',detail:'private@example.test token=secret',count:1},
  {event_type:'private@example.test',status:'failed',count:1},
  {event_type:'payment_link',status:'submitted',count:3},
  {event_type:'payment_link',status:'failed',count:-1}
 ];
 assert.deepEqual(clientEmailFailureSummary(rows),[
  {event:'payment_confirmation',status:'not_configured',reason:'gmail_reconnect_required',count:3},
  {event:'payment_link',status:'failed',reason:'other_delivery_failure',count:1}
 ]);
 assert.doesNotMatch(JSON.stringify(clientEmailFailureSummary(rows)),/private|secret/);
});
test('database diagnostics are read-only and scoped to active business email queues', async () => {
 const queries=[];
 const db={query:async sql=>{queries.push(sql);return {rows:[{event_type:'payment_link',status:'not_configured',detail:'The platform administrator must connect Gmail',count:1}]};}};
 assert.equal((await readClientEmailFailures(db))[0].reason,'gmail_connection_required');
 assert.equal(queries.length,1);
 assert.match(queries[0],/^SELECT /);
 assert.match(queries[0],/b.status='active'/);
 assert.match(queries[0],/m.channel='email'/);
 assert.doesNotMatch(queries[0],/\b(?:UPDATE|DELETE|INSERT|destination|encrypted_refresh_token|message)\b/i);
});
