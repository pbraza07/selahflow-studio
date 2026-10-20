import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dashboardPath,bookingPath,businessPath,isReservedBusinessSlug} from '../server/route-slugs.mjs';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Crawford and new businesses receive dedicated routes',()=>{
 assert.equal(dashboardPath('crawford'),'/studio/crawford');
 assert.equal(businessPath('crawford'),'/crawford');
 assert.equal(bookingPath('crawford'),'/book/crawford');
 assert.equal(dashboardPath('pet-groomer'),'/studio/pet-groomer');
 assert.throws(()=>dashboardPath('../admin'));
 for(const slug of ['crawford','studio','login','signup','admin','api','book'])assert.equal(isReservedBusinessSlug(slug),true);
});
test('owner dashboard requires session and enforces slug',async()=>{
 const source=await read('app/studio/[slug]/page.tsx');
 assert.match(source,/cookies\(\)/);
 assert.match(source,/sessions s JOIN businesses b ON b.owner_id=s.user_id/);
 assert.match(source,/s.expires_at>now\(\)/);
 assert.match(source,/if\(actualSlug!==slug\)redirect/);
 const signup=await read('app/api/auth/signup/route.ts');
 assert.match(signup,/isReservedBusinessSlug\(slug\)/);
 assert.match(signup,/dashboardUrl:'\/registration-status'/);
 const login=await read('app/api/auth/login/route.ts');
 assert.match(login,/dashboardUrl:target/);
});
test('startup preserves administrator initialization without recreating Crawford',async()=>{
 const source=await read('scripts/migrate.mjs');
 assert.match(source,/ensurePlatformAdministrator/);
 assert.doesNotMatch(source,/INSERT INTO businesses|UPDATE businesses SET slug/);
 const health=await read('app/api/health/route.ts');
 assert.match(health,/version:APP_VERSION/);
});
