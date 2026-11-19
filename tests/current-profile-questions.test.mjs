import test from 'node:test';
import assert from 'node:assert/strict';
import {currentProfileQuestions,uniqueQuestions} from '../server/current-profile-questions.mjs';
const fields=[{id:'club',label:'Current club?',type:'text'},{id:'alias',label:' current  CLUB ',type:'text'},{id:'consent',label:'Contact permission',type:'checkbox'}];
test('current profile uses submission order, combines aliases, and omits retired questions',()=>{
 const c={history:[{date:'2031-01-01',submittedAt:'2025-01-01',answers:[{id:'club',value:'Earlier'}]},{date:'2024-01-01',submittedAt:'2026-04-02',answers:[{id:'alias',value:'Latest'},{id:'retired',label:'Former question',value:'Old'}]}],membershipAnswerSources:[{at:'2026-03-01',rows:[{id:'club',value:'Middle'}]}],profileUpdatedAt:'2026-02-01',registrationAnswers:{consent:false}};
 assert.deepEqual(currentProfileQuestions(c,fields).map(a=>[a.id,a.value]),[['club','Latest'],['consent',false]]);
 c.registrationAnswers.club='';c.profileUpdatedAt='2026-05-01';
 assert.deepEqual(currentProfileQuestions(c,fields).map(a=>a.id),['consent']);
 assert.equal(uniqueQuestions([...fields,{id:'separate',type:'checkbox',label:'Contact permission'}]).length,3);
});
