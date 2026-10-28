import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('secondary owner dashboard sections split into lazy chunks without changing screen gates',async()=>{
 const code=await source('app/studio/owner-dashboard.tsx');
 const lazy=['OwnerReports','OwnerMemberships','OwnerHistory','OwnerClientDirectory','OwnerBranding','PasswordChange','RegistrationQuestionSettings','BookingBlockoutSettings','AddressAutocomplete','OwnerExtraTeamSeatRequest','OwnerReviewInvite','NotificationProviderStatus','DevicePushControls'];
 for(const item of lazy){
  assert.match(code,new RegExp('const '+item+'=dynamic\\(\\(\\)=>import\\('),item+' must be loaded lazily');
  assert.doesNotMatch(code,new RegExp('import '+item+' from '),item+' must not be eagerly imported');
 }
 for(const gate of ["view==='History'","view==='Clients'","view==='Memberships'","view==='Reports'","view==='Branding'","view==='Settings'"]){
  assert.ok(code.includes(gate),'Existing workspace screen '+gate+' must remain wired');
 }
 assert.match(code,/import OwnerBookingApprovals from/,'Overview approvals remain eagerly available');
 assert.match(code,/import OwnerMembershipRequests from/,'Overview membership requests remain eagerly available');
 assert.match(code,/import OwnerNotificationBell from/,'Global alerts remain eagerly available');
});
test('owner background refresh pauses only in hidden tab and resumes when visible',async()=>{
 const code=await source('app/studio/owner-dashboard.tsx');
 assert.match(code,/document\.visibilityState==='visible'/);
 assert.match(code,/visibilitychange/);
 assert.match(code,/if\(view==='Settings'\)return/,'Settings refresh should remain disabled while editing');
 assert.match(code,/setInterval\(tick,30000\)/,'Visible dashboard keeps original 30-second polling cadence');
 assert.match(code,/document\.removeEventListener\('visibilitychange',resume\)/,'poll listener must clean up');
});
test('owner API preserves payload and tenant context while loading business name in parallel',async()=>{
 const code=await source('lib/studio-handler.ts');
 assert.match(code,/const \[a,e,roster,membershipPayments,businessDetails\]=await Promise\.all\(/);
 assert.match(code,/SELECT name,business_model,industry FROM businesses WHERE owner_id=\$1 AND status='active'/);
 assert.match(code,/reportBusinessName:businessDetails\.rows\[0\]\?\.name/);
 assert.match(code,/decorateOwnerAppointments\(visits,roster\)/);
 assert.match(code,/visibleReportPayments/);
});
