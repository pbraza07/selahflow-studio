import {uniqueQuestions} from './current-profile-questions.mjs';
/** Current profile values are editable; submitted booking/membership snapshots remain evidence. */
export function clientProfileAnswers(client={}){
 if(Array.isArray(client.currentQuestions))return Object.fromEntries(client.currentQuestions.map(a=>[a.id,a.value]));
 const fromRows=rows=>Object.fromEntries((rows||[]).map(a=>[a.id,a.value]));
 const historical=Object.assign({},...(client.history||[]).slice().reverse().map(r=>fromRows(r.answers)));
 return {...historical,...fromRows(client.membershipAnswers),...(client.registrationAnswers||{})};
}
export function editableClientProfileFields(config={},client={}){
 const answers=clientProfileAnswers(client),savedLabels={...Object.fromEntries([...(client.membershipAnswers||[]),...(client.history||[]).flatMap(r=>r.answers||[])].map(a=>[a.id,a.label])),...client.registrationFieldLabels};
 const fields=uniqueQuestions(config.bookingCustomFields||[]).map(f=>({...f,label:f.label||savedLabels[f.id],required:false,forms:['booking'],serviceIds:[],sessionIds:[],options:f.type==='select'?[...new Set([...(f.options||[]),...(typeof answers[f.id]==='string'&&answers[f.id]?[answers[f.id]]:[])])]:f.options}));
 for(const [id,value] of Object.entries(answers))if(!fields.some(f=>f.id===id))fields.push({id,label:savedLabels[id]||id,type:typeof value==='boolean'?'checkbox':'text',required:false,forms:['booking'],options:[]});
 return fields;
}
