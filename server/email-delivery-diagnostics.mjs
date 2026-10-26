/** Read-only, privacy-safe delivery diagnostics. Never log contacts, tokens or message bodies. */
const reasons = new Map([
 ['External staging notifications are disabled for this recipient', 'staging_recipient_not_authorized'],
 ['Gmail OAuth client is not configured', 'gmail_server_configuration_missing'],
 ['The platform administrator must connect Gmail', 'gmail_connection_required'],
 ['Gmail authorization needs reconnection by the platform administrator', 'gmail_reconnect_required'],
 ['Gmail connection is unavailable; contact the platform administrator', 'gmail_connection_unavailable'],
 ['Resend email is not configured', 'resend_configuration_missing'],
 ['Gmail authorization is temporarily unavailable', 'gmail_authorization_unavailable'],
 ['Business email branding is temporarily unavailable', 'business_branding_unavailable']
]);
const events = new Set(['payment_link', 'payment_confirmation']);
const statuses = new Set(['queued', 'failed', 'not_configured', 'unknown', 'invalid_destination']);
const configurationKeys = new Set(['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_TOKEN_ENCRYPTION_KEY']);

export function emailReadinessSummary(providerStatus, gmail = null) {
 const provider = providerStatus?.emailProvider === 'Gmail' ? 'Gmail' : 'Resend';
 const result = {provider, configured: providerStatus?.emailConfigured === true};
 if (provider !== 'Gmail') return result;
 const missingConfiguration = Array.isArray(gmail?.missingConfiguration)
  ? gmail.missingConfiguration.filter(key => configurationKeys.has(key)) : [];
 return {...result, setupComplete: gmail?.setupComplete === true,
  needsReconnect: gmail?.needsReconnect === true, missingConfiguration,
  authorization: !gmail?.setupComplete ? 'server_configuration_missing'
   : gmail.needsReconnect ? 'reconnection_required'
   : !gmail.connected ? 'not_connected' : 'stored_connection_not_live_verified'};
}

export function clientEmailFailureSummary(rows) {
 const totals = new Map();
 for (const row of rows || []) {
  if (!events.has(row.event_type) || !statuses.has(row.status)) continue;
  const count = Number(row.count);
  if (!Number.isSafeInteger(count) || count < 1) continue;
  const reason = reasons.get(row.detail) || 'other_delivery_failure';
  const key = JSON.stringify([row.event_type, row.status, reason]);
  const current = totals.get(key);
  if (current) current.count += count;
  else totals.set(key, {event: row.event_type, status: row.status, reason, count});
 }
 return [...totals.values()];
}

export async function readClientEmailFailures(db) {
 const {rows} = await db.query("SELECT m.event_type,m.status,m.detail,count(*)::int AS count FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id WHERE b.status='active' AND m.channel='email' AND m.status IN ('queued','failed','not_configured','unknown','invalid_destination') AND m.updated_at>=now()-interval '7 days' GROUP BY m.event_type,m.status,m.detail ORDER BY m.event_type,m.status");
 return clientEmailFailureSummary(rows);
}
