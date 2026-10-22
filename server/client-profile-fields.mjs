/** Current profile values are editable; submitted booking/membership snapshots remain evidence. */
export function clientProfileAnswers(client={}){
 const fromRows=rows=>Object.fromEntries((rows||[]).map(a=>[a.id,a.value]));
 const historical=Object.assign({},...(client.history||[]).slice().reverse().map(r=>fromRows(r.answers)));
 return {...historical,...fromRows(client.membershipAnswers),...(client.registrationAnswers||{})};
}
export function editableClientProfileFields(config={},client={}){
 const answers=clientProfileAnswers(client),savedLabels={...Object.fromEntries([...(client.membershipAnswers||[]),...(client.history||[]).flatMap(r=>r.answers||[])].map(a=>[a.id,a.label])),...client.registrationFieldLabels};
 const fields=(config.bookingCustomFields||[]).map(f=>({...f,label:savedLabels[f.id]||f.label,required:false,forms:['booking'],serviceIds:[],sessionIds:[],options:f.type==='select'?[...new Set([...(f.options||[]),...(typeof answers[f.id]==='string'&&answers[f.id]?[answers[f.id]]:[])])]:f.options}));
 for(const [id,value] of Object.entries(answers))if(!fields.some(f=>f.id===id))fields.push({id,label:savedLabels[id]||id,type:typeof value==='boolean'?'checkbox':'text',required:false,forms:['booking'],options:[]});
 return fields;
}
