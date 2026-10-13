import {displayAnswer,dateOnly} from './client-registration-fields.mjs';

/** Read only owner-visible client-directory data; no remote operations. */
const STANDARD_FILTERS=Object.freeze([
 {key:'name',label:'Full name',type:'text'},
 {key:'firstName',label:'First name',type:'text'},
 {key:'lastName',label:'Last name',type:'text'},
 {key:'email',label:'Email address',type:'text'},
 {key:'phone',label:'Phone number',type:'text'},
 {key:'dateOfBirth',label:'Date of birth',type:'date'},
 {key:'memberNumber',label:'Membership ID',type:'text'},
 {key:'membershipName',label:'Membership package',type:'select'},
 {key:'membershipStatus',label:'Membership payment status',type:'select'},
 {key:'membershipInterval',label:'Membership billing interval',type:'select'},
 {key:'services',label:'Booked service',type:'select'},
 {key:'serviceTypes',label:'Service category',type:'select'},
 {key:'staff',label:'Team member / coach',type:'select'},
 {key:'bookingStatus',label:'Appointment status',type:'select'},
 {key:'bookingDate',label:'Appointment date',type:'date'},
 {key:'policyAccepted',label:'Booking policy accepted',type:'select'}
]);
const text=(v)=>v===null||v===undefined?'':String(v).trim();
function one(value){const v=text(value);return v?[v]:[];}
const unique=(values)=>[...new Map(values.filter(v=>v!==null&&v!==undefined&&text(v)!=='').map(v=>[text(v).toLowerCase(),text(v)])).values()];

export function clientFieldValues(client,key){
 const c=client||{};
 const history=Array.isArray(c.history)?c.history:[];
 if(key.startsWith('question:')){
  const id=key.slice(9);
  return unique([
   ...(Array.isArray(c.membershipAnswers)?c.membershipAnswers:[]).filter(a=>a.id===id).map(a=>displayAnswer(a.value)),
   ...history.flatMap(h=>[...(h.answers||[]),...(h.originalAnswers||[])].filter(a=>a.id===id).map(a=>displayAnswer(a.value)))
  ]);
 }
 if(key.startsWith('import:')){const column=key.slice(7);return Object.prototype.hasOwnProperty.call(c.importColumns||{},column)?one(displayAnswer(c.importColumns[column])):[];}
 const originalNames=[c.name,c.membershipRegistration?.name,...history.map(h=>h.customerName),...history.map(h=>h.originalSubmission?.customerName)].map(text).filter(Boolean);
 const firstNames=originalNames.map(name=>name.split(/\s+/)[0]);
 const lastNames=originalNames.map(name=>name.split(/\s+/).slice(1).join(' '));
 const based={
  name:originalNames,firstName:firstNames,lastName:lastNames,
  email:[c.email,c.membershipRegistration?.email,...history.map(h=>h.customerEmail),...history.map(h=>h.originalSubmission?.customerEmail)],
  phone:[c.phone,c.membershipRegistration?.phone,...history.map(h=>h.customerPhone),...history.map(h=>h.originalSubmission?.customerPhone)],
  dateOfBirth:[dateOnly(c.dateOfBirth),dateOnly(c.membershipRegistration?.dateOfBirth),...history.map(h=>dateOnly(h.dateOfBirth))],
  memberNumber:[c.memberNumber,c.membershipRegistration?.memberNumber,...history.map(h=>h.customerMemberNumber)],
  membershipName:one(c.membershipName),membershipStatus:one(c.membershipStatus),
  membershipInterval:one(c.membershipDetails?.interval),
  services:[...(c.serviceNames||[])],
  serviceTypes:[...(c.serviceTypes||[])],
  staff:history.map(h=>h.staff),
  bookingStatus:history.map(h=>h.status),
  bookingDate:history.map(h=>h.date),
  policyAccepted:history.filter(h=>h.policyAccepted!==null&&h.policyAccepted!==undefined).map(h=>h.policyAccepted?'Yes':'No')
 };
 return unique(based[key]||[]);
}

export function registrationFieldCatalog(clients,formFields=[]){
 const fields=new Map(STANDARD_FILTERS.map(field=>[field.key,{...field,options:[]}]));
 for(const f of formFields||[]){
  if(!f?.id||!f.label)continue;
  fields.set('question:'+f.id,{key:'question:'+f.id,label:f.label,type:f.type||'text',options:Array.isArray(f.options)?f.options:[]});
 }
 for(const c of clients||[]){
  for(const answer of [...(c.membershipAnswers||[]),...(c.history||[]).flatMap(v=>[...(v.answers||[]),...(v.originalAnswers||[])])]){
   if(!answer||!answer.id)continue;
   const key='question:'+answer.id;
   if(!fields.has(key))fields.set(key,{key,label:answer.label||answer.id,type:answer.type||(typeof answer.value==='boolean'?'checkbox':'text'),options:[]});
  }
  for(const heading of Object.keys(c.importColumns||{})){
   const key='import:'+heading;
   if(!fields.has(key))fields.set(key,{key,label:'Imported: '+heading,type:'text',options:[]});
  }
 }
 return [...fields.values()].map(field=>({...field,options:unique([
  ...(field.options||[]),...(clients||[]).flatMap(c=>clientFieldValues(c,field.key))
 ])}));
}
export function filterRegistrationClients(clients,{search='',membershipLevel='',fieldKey='',fieldValue=''}={}){
 const q=text(search).toLowerCase(),level=text(membershipLevel),fieldQ=text(fieldValue).toLowerCase();
 return (clients||[]).filter(c=>{
  if(level==='__no_active__'&&c.membershipStatus==='active')return false;
  if(level&&level!=='__no_active__'&&c.membershipName!==level)return false;
  if(q){
   const basic=[c.name,c.email,c.phone,c.dateOfBirth,c.memberNumber,c.membershipName,c.membershipStatus,...(c.serviceNames||[]),...(c.serviceTypes||[])];
   const answers=[...(c.membershipAnswers||[]),...(c.history||[]).flatMap(h=>[...(h.answers||[]),...(h.originalAnswers||[])])].flatMap(a=>[a.label,displayAnswer(a.value)]);
   const imported=Object.entries(c.importColumns||{}).flatMap(([k,v])=>[k,displayAnswer(v)]);
   if(![...basic,...answers,...imported].some(value=>text(value).toLowerCase().includes(q)))return false;
  }
  if(fieldKey&&fieldQ){
   if(!clientFieldValues(c,fieldKey).some(value=>value.toLowerCase().includes(fieldQ)))return false;
  }
  return true;
 });
}
