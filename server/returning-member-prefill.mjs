/** Reuse saved answers only if still accepted by the business's current booking form. */
export function restoreBookingCustomAnswers(fields, ...sources){
 const result={};
 for(const field of Array.isArray(fields)?fields:[]){
  if(!field?.id)continue;
  for(const source of sources){
   if(!source||typeof source!=='object'||Array.isArray(source))continue;
   const raw=source[field.id];
   if(raw===undefined||raw===null)continue;
   if(field.type==='checkbox'){
    if(typeof raw==='boolean'){result[field.id]=raw;break;}
    continue;
   }
   if(typeof raw!=='string'||!raw.trim()||raw.length>500)continue;
   const value=raw.trim();
   if(field.type==='select'&&(!Array.isArray(field.options)||!field.options.includes(value)))continue;
   if(field.type==='number'&&!Number.isFinite(Number(value)))continue;
   if(field.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))continue;
   result[field.id]=value;break;
  }
 }
 return result;
}

/** Owner corrections override historical submissions, including an intentional clear. */
export function restoreCurrentProfileAnswers(fields,profileAnswers,...history){
 const result=restoreBookingCustomAnswers(fields,...history);
 for(const field of Array.isArray(fields)?fields:[]){
  if(!profileAnswers||!Object.hasOwn(profileAnswers,field.id))continue;
  delete result[field.id];
  const value=profileAnswers[field.id];
  if(value===''){result[field.id]='';continue;}
  Object.assign(result,restoreBookingCustomAnswers([field],profileAnswers));
 }
 return result;
}

/** Prefer the latest submitted registration, keeping existing client edits as backup. */
export function restoredContact(identity={},profile={},latest={}){
 const parts=String(identity.customer_name||profile.name||latest.name||latest.customerName||'').trim().split(/\s+/);
 const corrected=profile.first_name&&profile.last_name&&String(profile.name||'').trim().toLowerCase()===String(identity.customer_name||'').trim().toLowerCase();
 const firstName=String(corrected?profile.first_name:parts[0]||latest.firstName||'').trim();
 const lastName=String(corrected?profile.last_name:parts.slice(1).join(' ')||latest.lastName||'').trim();
 return {
  firstName,lastName,
  email:String(corrected?profile.email||'':profile.email||latest.email||latest.customerEmail||identity.customer_email||'').trim(),
  phone:String(corrected?profile.phone||'':profile.phone||latest.phone||latest.customerPhone||identity.customer_phone||'').trim()
 };
}
