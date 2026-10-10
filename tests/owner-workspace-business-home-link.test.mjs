import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessPath,dashboardPath,bookingPath} from '../server/route-slugs.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('owner business workspace card opens the matching tenant public homepage, not a global/booking page',async()=>{
 const source=await read('app/studio/owner-dashboard.tsx');
 const match=source.match(/<a className="studio-switch studio-switch-link"[\s\S]*?<\/a>/);
 assert.ok(match,'Business workspace card is a semantic, clickable anchor');
 const card=match[0];
 assert.match(card,/href=\{businessPath\(publicSlug\|\|businessSlug\)\}/);
 assert.match(card,/aria-label=\{"Open "\+config\.name\+" business homepage"\}/);
 assert.match(card,/title=\{"View "\+config\.name\+" business homepage"\}/);
 assert.match(card,/onClick=\{\(\)=>setMobile\(false\)\}/);
 assert.match(card,/<b>\{config\.name\}<\/b>/);
 assert.match(card,/Business workspace · View home/);
 assert.match(card,/className="studio-switch-go"/);
 assert.match(card,/encodeURIComponent\(publicSlug\|\|businessSlug\)/);
 assert.doesNotMatch(card,/target="_blank"/,'Opens the business page in the same tab');
 assert.doesNotMatch(card,/setView\('Overview'\)/);
 assert.doesNotMatch(card,/href="\/"/);
 assert.doesNotMatch(card,/href=\{bookingPath/);
});
test('workspace destination matches each tenant without mixing customer-facing route and dashboard',()=>{
 for(const slug of ['arcila-training','capstone-pavers','car-shine','crawford-studio','my-dog-groomer']){
  assert.equal(businessPath(slug),'/'+slug);
  assert.equal(dashboardPath(slug),'/studio/'+slug);
  assert.equal(bookingPath(slug),'/book/'+slug);
  assert.notEqual(businessPath(slug),bookingPath(slug));
 }
 assert.throws(()=>businessPath('../admin'));
 assert.throws(()=>businessPath(''));
});
test('business public homepage remains tenant-scoped and owner tile works on mobile and desktop',async()=>{
 const [page,css,owner]=await Promise.all([
  read('app/[slug]/page.tsx'),read('app/globals.css'),read('app/studio/owner-dashboard.tsx')
 ]);
 assert.match(page,/b\.slug=\$1 AND b\.status='active'/);
 assert.match(page,/if\(!row\)notFound\(\)/);
 assert.match(owner,/setPublicSlug\(d\.business\?\.slug\|\|businessSlug\)/);
 assert.match(css,/\.sidebar a\.studio-switch-link:focus-visible/);
 assert.match(css,/\.sidebar a\.studio-switch-link:hover/);
 assert.match(css,/@media\(max-width:750px\)/);
 assert.match(css,/\.sidebar a\.studio-switch-link img/);
 assert.match(css,/--sf-on-header/);
});
