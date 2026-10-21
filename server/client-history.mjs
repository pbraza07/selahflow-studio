import {createHash} from 'node:crypto';

/** Appointment-backed customer directory. Only explicitly checked-in or completed
 * appointments count as attendance; a future/past confirmed booking is not proof
 * the customer attended. Grouping never uses a bare display name.
 */
export const ATTENDED_STATUSES=new Set(['Checked in','Completed']);

const clean=(value,max=250)=>typeof value==='string'?value.trim().slice(0,max):'';
export function isAttended(status){return ATTENDED_STATUSES.has(status);}
export function normalizeClientName(name){
 return clean(name,100).replace(/\s+/g,' ').toLocaleLowerCase('en-US');
}
export function normalizeClientEmail(email){
 const v=clean(email,254).toLowerCase();
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:'';
}
export function normalizeClientPhone(phone){
 const v=clean(phone,40).replace(/[\s().-]/g,'');
 return /^\+?[0-9]{7,16}$/.test(v)?v:'';
}
/** Group bookings only when the provided full name matches AND at least
 * one verified format of contact information (email or phone) matches.
 * A second name using the same family email/phone gets a distinct card.
 */
export function customerIdentity(appointment){
 const data=typeof appointment.data==='string'?JSON.parse(appointment.data||'{}'):(appointment.data||appointment);
 const name=normalizeClientName(data.name);
 const email=normalizeClientEmail(data.email);
 const phone=normalizeClientPhone(data.phone);
 return name+'|'+(email?'email:'+email:phone?'phone:'+phone:'appointment:'+String(appointment.id));
}
export function pendingBookingAsAppointment(row){
 let info={};try{info=typeof row.details==='string'?JSON.parse(row.details):row.details||{};}catch{}
 return {
  id:row.id,date:row.date,start:row.start_minute,duration:row.duration,staff:row.staff_id,
  status:row.status==='pending'?'Pending approval':'Declined',
  data:JSON.stringify({
   name:info.customerName||'',firstName:info.firstName||'',lastName:info.lastName||'',dateOfBirth:info.dateOfBirth||'',email:info.customerEmail||'',phone:info.customerPhone||'',memberNumber:info.memberNumber||null,
   services:Array.isArray(info.services)?info.services:[],
   serviceIds:Array.isArray(info.serviceIds)?info.serviceIds:[],
   price:Number(info.quotedPrice)||0,sessionId:info.sessionId||null,
   customAnswers:info.customAnswers||{},customFieldLabels:info.customFieldLabels||{},customFieldTypes:info.customFieldTypes||{},
   originalSubmission:info.originalSubmission||null,
   source:'Customer booking request',policyAccepted:info.policyAccepted===true,policyAcceptedAt:info.policyAcceptedAt||null,
   created:info.created||row.created_at||null
  })
 };
}
export function buildClientDirectory(appointments,settings={},owner=''){
 const catalog=Array.isArray(settings.services)?settings.services:[];
 const employees=Array.isArray(settings.staff)?settings.staff:[];
 const entries=[];
 for(const row of appointments||[]){
  let data;
  try{data=typeof row.data==='string'?JSON.parse(row.data||'{}'):(row.data||{});}catch{continue;}
  if(!data || typeof data!=='object')continue;
  const name=clean(data.name,100),email=clean(data.email,254),phone=clean(data.phone,40);
  if(!name&&!email&&!phone)continue;
  entries.push({row,data,name,email,phone,normalizedName:normalizeClientName(name),
   normalizedEmail:normalizeClientEmail(email),normalizedPhone:normalizeClientPhone(phone)});
 }
 const parent=entries.map((_,i)=>i);
 function find(n){while(parent[n]!==n){parent[n]=parent[parent[n]];n=parent[n];}return n;}
 function join(a,b){const pa=find(a),pb=find(b);if(pa!==pb)parent[pb]=pa;}
 const byEmail=new Map(),byPhone=new Map();
 for(let i=0;i<entries.length;i++){
  const e=entries[i];
  if(!e.normalizedName)continue;
  if(e.normalizedEmail){
   const k=e.normalizedName+'\x1f'+e.normalizedEmail;
   if(byEmail.has(k))join(i,byEmail.get(k));else byEmail.set(k,i);
  }
  if(e.normalizedPhone){
   const k=e.normalizedName+'\x1f'+e.normalizedPhone;
   if(byPhone.has(k))join(i,byPhone.get(k));else byPhone.set(k,i);
  }
 }
 const contactsByRoot=new Map();
 for(let i=0;i<entries.length;i++){
  const root=find(i);
  if(!contactsByRoot.has(root))contactsByRoot.set(root,[]);
  if(entries[i].normalizedEmail)contactsByRoot.get(root).push('email:'+entries[i].normalizedEmail);
  if(entries[i].normalizedPhone)contactsByRoot.get(root).push('phone:'+entries[i].normalizedPhone);
 }
 const clients=new Map();
 for(let i=0;i<entries.length;i++){
  const {row,data,name,email,phone,normalizedName}=entries[i];
  const root=find(i);
  const contacts=contactsByRoot.get(root)||[];
  const stableContact=contacts.length?contacts.sort()[0]:'appointment:'+String(entries[root].row.id);
  const identity=normalizedName+'\x1f'+stableContact;
  const id=createHash('sha256').update(owner+'\x1f'+identity).digest('hex').slice(0,32);
  let client=clients.get(id);
  if(!client){client={id,name:name||email||phone,email,phone,bookedSessions:0,attendedSessions:0,attendanceDays:[],serviceTypes:[],serviceNames:[],latestDate:'',history:[],firstBooking:null,latestBookingAnswers:[]};clients.set(id,client);}
  if(name)client.name=name;
  if(email)client.email=email;
  if(phone)client.phone=phone;
  if(data.memberNumber&&!client.memberNumber)client.memberNumber=String(data.memberNumber).trim().toUpperCase();
  if(data.dateOfBirth&&!client.dateOfBirth)client.dateOfBirth=clean(data.dateOfBirth,10);
  const serviceNames=Array.isArray(data.services)?data.services.filter(x=>typeof x==='string').map(x=>clean(x,100)):[];
  const ids=Array.isArray(data.serviceIds)?data.serviceIds.filter(x=>typeof x==='string'):[];
  const items=ids.map(sid=>catalog.find(s=>s.id===sid)).filter(Boolean);
  if(!serviceNames.length)serviceNames.push(...items.map(x=>x.name));
  const categories=items.map(x=>clean(x.category,60)).filter(Boolean);
  for(const serviceName of serviceNames){
   const matching=catalog.find(s=>s.name===serviceName);
   if(matching){const cat=clean(matching.category,60);if(cat&&!categories.includes(cat))categories.push(cat);}
  }
  const types=[...new Set(categories)];
  const date=clean(row.date,10),status=clean(row.status,50);
  const attended=isAttended(status);
  const staff=employees.find(x=>x.id===row.staff)?.name || clean(row.staff,100);
  const customAnswers=data.customAnswers&&typeof data.customAnswers==='object'?data.customAnswers:{};
  const labels=data.customFieldLabels&&typeof data.customFieldLabels==='object'?data.customFieldLabels:{};
  const savedTypes=data.customFieldTypes&&typeof data.customFieldTypes==='object'?data.customFieldTypes:{};
  const answers=Object.entries(customAnswers).map(([key,value])=>{
   const current=(settings.bookingCustomFields||[]).find(f=>f.id===key);
   return {id:key,label:clean(labels[key]||current?.label||key,80),value:typeof value==='boolean'?value:clean(value,500),type:savedTypes[key]||current?.type||(typeof value==='boolean'?'checkbox':'text')};
  });
  const original=data.originalSubmission&&typeof data.originalSubmission==='object'?data.originalSubmission:null;
  const originalAnswers=original?.customAnswers&&typeof original.customAnswers==='object'
   ?Object.entries(original.customAnswers).map(([key,value])=>{
     const current=(settings.bookingCustomFields||[]).find(f=>f.id===key);
     return {id:key,label:clean(labels[key]||current?.label||key,80),
      value:typeof value==='boolean'?value:clean(value,500),
      type:savedTypes[key]||current?.type||(typeof value==='boolean'?'checkbox':'text')};
    }):[];
  const visit={
   id:String(row.id),date,time:Number(row.start)||0,duration:Number(row.duration)||0,
   serviceNames,serviceTypes:types,staff,status,attended,
   sessionType:data.sessionId?'Group session':'Individual appointment',
   quotedPrice:Number(data.price)||0,paymentTracking:data.paymentTracking||(data.membershipCovered||data.paymentStatus==='paid'||Number(data.price)===0?'completed':'pending'),bookingTimeline:data.bookingTimeline||[{status:'Submitted',at:data.created||null},{status:status,at:null}],
   customerEmail:email,customerPhone:phone,customerName:name,customerMemberNumber:data.memberNumber||null,dateOfBirth:clean(data.dateOfBirth,10),firstName:clean(data.firstName,50),lastName:clean(data.lastName,50),
   answers,originalAnswers,originalSubmission:data.originalSubmission||null,
   submittedAt:data.created||null,policyAccepted:data.policyAccepted===true,policyAcceptedAt:data.policyAcceptedAt||null
  };
  client.history.push(visit);
  if(!['Cancelled','No-show','Pending approval','Declined'].includes(status))client.bookedSessions++;
  if(attended){client.attendedSessions++;if(date&&!client.attendanceDays.includes(date))client.attendanceDays.push(date);}
  for(const type of types)if(!client.serviceTypes.includes(type))client.serviceTypes.push(type);
  for(const service of serviceNames)if(!client.serviceNames.includes(service))client.serviceNames.push(service);
  if(date>client.latestDate)client.latestDate=date;
 }
 const sorted=[...clients.values()];
 for(const c of sorted){
  c.history.sort((a,b)=>b.date.localeCompare(a.date)||b.time-a.time);
  c.attendanceDays.sort((a,b)=>b.localeCompare(a));
  c.serviceNames.sort((a,b)=>a.localeCompare(b));
  c.serviceTypes.sort((a,b)=>a.localeCompare(b));
  const earliest=[...c.history].sort((a,b)=>a.date.localeCompare(b.date)||a.time-b.time);
  c.firstBooking=earliest[0]||null;
  c.latestBookingAnswers=c.history.find(h=>h.answers?.length)?.answers||[];
 }
 sorted.sort((a,b)=>b.latestDate.localeCompare(a.latestDate)||a.name.localeCompare(b.name));
 return sorted;
}
export function clientWorkbookSheets(clients){
 const selected=Array.isArray(clients)?clients:[];
 const summary=[['Client','Email','Phone','Sessions booked','Sessions attended','Days attended','Service types','Latest appointment']];
 const visits=[['Client','Email','Activity date','Start time (Eastern)','Service used','Service type','Team member','Attendance status','Session kind','Quoted price ($)','Attended']];
 const attendance=[['Client','Email','Date attended','Services attended','Sessions attended']];
 const responses=[['Client','Email','Booking status','Activity date','Activity time','Booking question','Customer response','Original customer response']];
 const timeLabel=n=>((Math.floor(n/60)%12)||12)+':'+String(n%60).padStart(2,'0')+(n<720?' AM':' PM');
 for(const c of selected){
  summary.push([c.name,c.email,c.phone,c.bookedSessions,c.attendedSessions,c.attendanceDays.length,c.serviceTypes.join(', '),c.latestDate]);
  for(const v of c.history){visits.push([
   c.name,c.email,v.date,timeLabel(v.time),v.serviceNames.join(', '),v.serviceTypes.join(', '),v.staff,v.status,v.sessionType,v.quotedPrice,v.attended?'Yes':'No'
  ]);
  if(v.policyAccepted)responses.push([c.name,c.email,v.status,v.date,timeLabel(v.time),'Booking policy consent','Accepted',v.originalSubmission?'Accepted':'']);
  for(const ans of v.answers||[]){
   const original=v.originalSubmission?.customAnswers?.[ans.id];
   responses.push([c.name,c.email,v.status,v.date,timeLabel(v.time),ans.label,String(ans.value),original===undefined?'':String(original)]);
  }
  }
  for(const day of c.attendanceDays){
   const visitsOnDay=c.history.filter(v=>v.date===day&&v.attended);
   attendance.push([c.name,c.email,day,
    [...new Set(visitsOnDay.flatMap(v=>v.serviceNames))].join(', '),visitsOnDay.length]);
  }
 }
 return [
  {name:'Clients',title:'Client directory',rows:summary,widths:[29,35,21,19,19,17,34,22]},
  {name:'Service History',title:'Client service history',rows:visits,widths:[27,33,19,22,34,27,26,23,25,18,15]},
  {name:'Attendance Days',title:'Verified attendance days',rows:attendance,widths:[27,33,21,42,21]},
  {name:'Booking Answers',title:'Customer submitted booking details',rows:responses,widths:[27,33,23,19,20,32,38,38]}
 ];
}
