const normalized=label=>String(label||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ').replace(/[?:]+$/,'').trim();
export function questionKey(field){
 // Consent records remain specific to the exact checkbox consented to.
 if(field.standard||field.type==='checkbox')return 'id:'+field.id;
 return JSON.stringify([normalized(field.label)||field.id,field.type||'text',field.type==='select'?[...(field.options||[])].sort():null]);
}
export function uniqueQuestions(fields){
 const unique=new Map();
 for(const field of fields){
  const key=questionKey(field),prior=unique.get(key);
  if(!prior)unique.set(key,field);
  else if(field.required&&!prior.required)unique.set(key,{...prior,required:true});
 }
 return [...unique.values()];
}
export function currentProfileQuestions(client,fields){
 const byId=new Map(fields.map(f=>[f.id,f]));
 const canonical=new Map(uniqueQuestions(fields).map(f=>[questionKey(f),f]));
 const latest=new Map();
 function apply(rows,explicit=false){
  for(const row of rows||[]){
   const original=byId.get(row.id);
   const key=questionKey(original||row),field=canonical.get(key);
   if(!field)continue;
   if(row.value==null||row.value===''){if(explicit)latest.delete(key);continue;}
   latest.set(key,{id:field.id,label:field.label,type:field.type,value:row.value});
  }
 }
 for(const [heading,value] of Object.entries(client.importColumns||{})){
  const field=fields.find(f=>f.id===heading||normalized(f.label)===normalized(heading));
  if(field&&field.type!=='checkbox')apply([{...field,value}]);
 }
 const events=(client.history||[]).slice().reverse().map(v=>({at:v.submittedAt||v.date,rows:[...(v.originalAnswers||[]),...(v.answers||[])]}));
 events.push(...(client.membershipAnswerSources||[{at:client.membershipDetails?.registeredAt,rows:client.membershipAnswers||[]}]));
 const profile=Object.entries(client.registrationAnswers||{}).map(([id,value])=>({id,label:client.registrationFieldLabels?.[id]||id,type:typeof value==='boolean'?'checkbox':'text',value}));
 // A current field wins over a retired alias from the same owner edit.
 profile.sort((a,b)=>Number(canonical.get(questionKey(byId.get(a.id)||a))?.id===a.id)-Number(canonical.get(questionKey(byId.get(b.id)||b))?.id===b.id));
 const stamp=v=>Date.parse(v)||0;
 if(client.profileUpdatedAt)events.push({at:client.profileUpdatedAt,rows:profile,explicit:true});
 events.sort((a,b)=>stamp(a.at)-stamp(b.at)).forEach(e=>apply(e.rows,e.explicit));
 if(!client.profileUpdatedAt)apply(profile,true);
 return [...canonical.keys()].flatMap(key=>latest.has(key)?[latest.get(key)]:[]);
}

export function distinctImportedFields(columns,fields){
 const known=new Set(fields.flatMap(f=>[normalized(f.label),normalized(f.id)]));
 return Object.entries(columns||{}).filter(([heading])=>!known.has(normalized(heading)));
}
