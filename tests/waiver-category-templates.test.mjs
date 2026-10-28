import test from 'node:test';
import assert from 'node:assert/strict';
import {WAIVER_CATEGORIES,normalizeWaiverCategory,waiverTemplateForCategory} from '../server/waiver-category-templates.mjs';

test('every supported category generates a scoped draft requiring legal review',()=>{
 for(const [category,definition] of Object.entries(WAIVER_CATEGORIES)){
  const doc=waiverTemplateForCategory(category,{businessName:'Example Business',serviceName:'Private Session'});
  assert.equal(doc.category,category);
  assert.equal(doc.label,definition.label);
  assert.equal(doc.requiresLegalReview,true);
  assert.equal(doc.mediaConsentDefault,false);
  assert.match(doc.sections[0].text,/Private Session/);
  assert.match(doc.sections[0].text,/Example Business/);
  assert.ok(doc.sections.some(s=>s.key==='limitations'));
  assert.equal(doc.sections.some(s=>s.key==='guardian'),definition.guardian);
 }
});
test('unknown categories fall back to general instead of inheriting sports risks',()=>{
 assert.equal(normalizeWaiverCategory('unknown'),'general');
 const doc=waiverTemplateForCategory('unknown');
 assert.equal(doc.category,'general');
 assert.doesNotMatch(JSON.stringify(doc),/soccer|birthday parties|training camps/i);
});
