/** Stable field IDs preserve membership identity and historical answers. */
export const STANDARD_REGISTRATION_FIELDS=Object.freeze([
 {id:'memberNumber',label:'Membership ID (returning players)',type:'text',required:false,placeholder:'e.g. LA1103'},
 {id:'dateOfBirth',label:'Date of birth',type:'date',required:true},
 {id:'firstName',label:'First name',type:'text',required:true},
 {id:'lastName',label:'Last name',type:'text',required:true},
 {id:'email',label:'Email',type:'email',required:true},
 {id:'phone',label:'Phone',type:'tel',required:false},
]);
/** @param {any} config @param {string} form @param {string|null|undefined} sessionId */
export function customRegistrationFields(config={},form='booking',sessionId=undefined){
 return (config.bookingCustomFields||[]).filter(f=>(!f.forms||f.forms.includes(form))&&(form!=='booking'||sessionId===undefined||!f.sessionIds?.length||f.sessionIds.includes(String(sessionId||'').replace(/__\d{8}$/, ''))));
}
/** @param {any} config @param {string} form @param {string|null|undefined} sessionId */
export function registrationQuestions(config={},form='booking',sessionId=undefined){
 const edits=config[form+'StandardFields']||{};
 const fields=[...STANDARD_REGISTRATION_FIELDS.map(f=>({...f,...edits[f.id],id:f.id,type:f.type,required:edits[f.id]?.required??f.required,standard:true})),...customRegistrationFields(config,form,sessionId).map(f=>({...f,standard:false}))];
 const session=form==='booking'&&sessionId?(config.bookableSessions||[]).find(s=>s.id===String(sessionId).replace(/__\d{8}$/, '')):null;
 if(session?.questionRequired)for(const f of fields)if(typeof session.questionRequired[f.id]==='boolean')f.required=session.questionRequired[f.id];
 const order=config[form+'QuestionOrder']||[];
 const rank=id=>{const i=order.indexOf(id);return i<0?order.length+fields.findIndex(f=>f.id===id):i;};
 return fields.sort((a,b)=>rank(a.id)-rank(b.id));
}
export function validateRegistrationQuestions(config){
 const standardIds=new Set(STANDARD_REGISTRATION_FIELDS.map(f=>f.id));
 for(const f of config.bookingCustomFields||[]){
  if(f.sessionIds!==undefined&&(!Array.isArray(f.sessionIds)||new Set(f.sessionIds).size!==f.sessionIds.length||f.sessionIds.some(id=>typeof id!=='string'||!config.bookableSessions?.some(s=>s.id===id))))throw Error('Choose existing bookable sessions for each question.');
  if(standardIds.has(f.id))throw Error('Custom question ID conflicts with a standard field.');
  if(f.forms!==undefined&&(!Array.isArray(f.forms)||!f.forms.length||new Set(f.forms).size!==f.forms.length||f.forms.some(x=>!['booking','membership'].includes(x))))throw Error('Choose booking, membership, or both for each question.');
 }
 for(const session of config.bookableSessions||[]){
  if(session.questionRequired!==undefined&&(!session.questionRequired||typeof session.questionRequired!=='object'||Array.isArray(session.questionRequired)||Object.entries(session.questionRequired).some(([id,value])=>typeof value!=='boolean'||!standardIds.has(id)&&!(config.bookingCustomFields||[]).some(f=>f.id===id))))throw Error('Invalid session required-question settings.');
 }
 for(const form of ['booking','membership']){
  const edits=config[form+'StandardFields'];
  if(edits!==undefined){
   if(!edits||typeof edits!=='object'||Array.isArray(edits))throw Error('Invalid standard question settings.');
   for(const [id,edit] of Object.entries(edits)){
    if(!standardIds.has(id)||!edit||typeof edit!=='object'||Array.isArray(edit))throw Error('Invalid standard question.');
    for(const key of Object.keys(edit))if(!['label','help','placeholder','required'].includes(key))throw Error('Standard field types and IDs cannot be changed.');
    for(const [key,max] of [['label',80],['help',300],['placeholder',100]])if(edit[key]!==undefined&&(typeof edit[key]!=='string'||edit[key].length>max||(key==='label'&&!edit[key].trim())))throw Error('Check standard question text.');
    if(edit.required!==undefined&&(typeof edit.required!=='boolean'))throw Error('Invalid required question setting.');
   }
  }
  const order=config[form+'QuestionOrder'];
  const allowed=new Set([...standardIds,...customRegistrationFields(config,form).map(f=>f.id)]);
  if(order!==undefined&&(!Array.isArray(order)||new Set(order).size!==order.length||order.some(id=>!allowed.has(id))))throw Error('Invalid question display order.');
 }
}
export function validateStandardRegistration(config,form,values,sessionId=undefined){
 for(const f of registrationQuestions(config,form,sessionId).filter(f=>f.standard)){
  if(f.required&&!String(values[f.id]||'').trim())throw Error(f.label+' is required.');
 }
}
export function publicRegistrationSettings(config={}){
 return Object.fromEntries(['bookableSessions','bookingStandardFields','membershipStandardFields','bookingQuestionOrder','membershipQuestionOrder','bookingCustomFields','pageContent'].map(key=>[key,config[key]]));
}
