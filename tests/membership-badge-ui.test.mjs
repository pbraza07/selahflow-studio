import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('player badges use a consistent pill with tier colors and a neutral ID fallback',async()=>{
 const component=await readFile(new URL('../app/components/membership-badge.tsx',import.meta.url),'utf8');
 assert.match(component,/borderRadius:999/);
 assert.match(component,/border:'1\.5px solid #171717'/);
 for(const tier of ['gold','platinum','silver','bronze','pro','academy','basic'])assert.match(component,new RegExp(tier));
 assert.match(component,/membershipStatus/);
 assert.match(component,/active=String\(membershipStatus/);
 assert.match(component,/'ID '\+id/);
 assert.match(component,/background:'#f1f2f4'/);
});

test('player badge appears beside names in client cards, detail view, and membership enrollment',async()=>{
 const client=await readFile(new URL('../app/components/owner-client-directory.tsx',import.meta.url),'utf8');
 const enrollment=await readFile(new URL('../app/components/owner-memberships.tsx',import.meta.url),'utf8');
 assert.match(client,/<MembershipBadge memberNumber=\{c\.memberNumber\}/);
 assert.match(client,/<MembershipBadge memberNumber=\{selected\.memberNumber\}/);
 assert.match(enrollment,/<MembershipBadge memberNumber=\{m\.member_number\}/);
});
