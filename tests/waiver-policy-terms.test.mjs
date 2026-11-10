import test from 'node:test';
import assert from 'node:assert/strict';
import {waiverDocument,acceptedWaiverVersions,WAIVER_VERSION} from '../server/waiver-content.mjs';
import {WAIVER_POLICY_TERMS_VERSION} from '../server/waiver-policy-terms.mjs';
import {waiverDocumentHash,assertWaiverLegalReview,validateCategoryWaiverSettings} from '../server/participation-waivers.mjs';
const config={name:'Example Club',services:[{id:'training',name:'Training',duration:60,requiresWaiver:true}]};
test('reviewed historic documents remain byte-identical and their signatures do not consent to new payment/no-show terms',()=>{
 const expected={'participation-1':'95be0a92fb861e4a834c51fcf7c595ae8c5803f717721c1d3282339187b6f092','participation-2':'374fae8d3db888d09987cec48c9a44fe529b943357252548ea8317dfeed6b7aa'};
 for(const [version,hash] of Object.entries(expected)){
  const c={...config,waiverLegalReview:{version,reference:'review',reviewedAt:'2026-10-20'}};
  const doc=waiverDocument(c);assert.equal(doc.version,version);assert.equal(waiverDocumentHash(doc),hash);
  assert.ok(acceptedWaiverVersions(c).includes(version));
 }
 assert.deepEqual(acceptedWaiverVersions(config),[WAIVER_VERSION]);
 const next=waiverDocument(config);
 assert.match(next.sections[0][0],/Recurring membership/);assert.match(next.sections[1][0],/24-hour/);
 assert.match(next.sections[0][1],/until I cancel/);assert.match(next.sections[0][1],/One-time session packages do not renew/);
 assert.match(next.sections[1][1],/at least 24 hours before/);assert.match(next.sections[1][1],/applies once/);
 assert.throws(()=>assertWaiverLegalReview({...config,waiverLegalReview:{version:'participation-2',reference:'previous',reviewedAt:'2026-10-20'}},WAIVER_VERSION,{NODE_ENV:'production'}),/legal review/);
});
test('category amendments require exact new review, retain legacy hash and bind new signatures to the revised terms',()=>{
 const old={...config,categoryWaiver:{enabled:true,category:'sports_fitness'}};
 const hash=waiverDocumentHash(waiverDocument(old));assert.equal(hash,'721cb98f5b8e76ad8fcdb2c23f53ec0f1e7d71428fc05c640ef71812d890ea56');
 old.categoryWaiver.review={hash,reference:'Old review',reviewedAt:'2026-10-20'};
 assert.doesNotThrow(()=>validateCategoryWaiverSettings(old));
 const next={...old,categoryWaiver:{...old.categoryWaiver,policyTermsVersion:WAIVER_POLICY_TERMS_VERSION}};
 assert.notEqual(waiverDocumentHash(waiverDocument(next)),hash);
 assert.throws(()=>validateCategoryWaiverSettings(next),/exact category waiver/);
 next.categoryWaiver.review={hash:waiverDocumentHash(waiverDocument(next)),reference:'New review',reviewedAt:'2026-11-10'};
 assert.doesNotThrow(()=>validateCategoryWaiverSettings(next));
 assert.match(waiverDocument(next).sections[0][0],/Recurring membership/);
 assert.match(waiverDocument(next).sections[1][0],/24-hour/);
 assert.throws(()=>validateCategoryWaiverSettings({...next,categoryWaiver:{...next.categoryWaiver,policyTermsVersion:'forged'}}),/policy version/);
});
