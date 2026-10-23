/** ID-only status uses the existing limited public booking lookup, never profile prefill. */
/** @param {string} message @param {'membership'|'booking'|'both'|null} pending */
export function assistantStatusRequest(message,pending=null){
 const input=String(message||'').trim();
 const id=input.match(/\b[A-Z]{2}(?:\d{6}|\d{4})\b/i)?.[0]?.toUpperCase();
 const membership=/\b(memberships?|members?|credits?)\b/i.test(input);
 const booking=/\b(bookings?|appointments?|registrations?)\b/i.test(input);
 const intent=/\b(status|check|lookup|active|inactive|remaining|left)\b/i.test(input)&&(membership||booking);
 if(!id&&!intent&&!pending)return null;
 const mode=intent?(membership&&booking?'both':membership?'membership':'booking'):pending||'both';
 return {mode,id:id||null,invalid:!!pending&&!id&&!intent};
}
export function assistantStatusUrl(slug){
 if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))throw Error('Choose a business before checking status.');
 return '/api/booking?slug='+encodeURIComponent(slug);
}
export function assistantStatusPrompt(mode,invalid=false){
 const subject=mode==='membership'?'membership':mode==='booking'?'latest booking':'membership and latest booking';
 return `${invalid?'Please enter a valid unique ID. ':''}Enter only your unique client ID to check your ${subject} status at this business (for example, AB031513). No email or date of birth is needed for this status check.`;
}
const label=value=>String(value||'Not available').replaceAll('_',' ').slice(0,100);
/** Explicit output projection: no contacts, DOB, answers, amounts, IDs, tokens or payment links. */
export function formatAssistantStatus(data,mode='both'){
 const lines=[];
 if(mode!=='booking'){
  const m=data?.membership;
  if(!m)lines.push('Membership status: no membership found for this ID at this business.');
  else{
   lines.push('Membership status: '+label(m.status));
   if(typeof m.name==='string'&&m.name.trim())lines.push('Plan: '+m.name.slice(0,200));
   if(typeof m.type==='string'&&m.type!==m.name)lines.push('Membership type: '+m.type.slice(0,200));
   if(Number.isSafeInteger(m.sessionsLeft)&&m.sessionsLeft>=0)lines.push('Sessions remaining: '+m.sessionsLeft);
  }
 }
 if(mode!=='membership'){
  const b=data?.latest;
  if(!b)lines.push('Booking status: no booking found for this ID at this business.');
  else{
   lines.push('Latest booking status: '+label(b.status));
   if(typeof b.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.date))lines.push('Booking date: '+b.date);
   const payment={paid:'Completed',covered:'Covered by membership or no charge',awaiting_approval:'Pending approval',due:'Pending payment',contact_business:'Contact the business for payment',unavailable:'Not available'}[data?.payment?.state];
   if(payment)lines.push('Payment status: '+payment);
  }
 }
 lines.push('Status checked now. For changes or detailed account information, contact the business.');
 return lines.join('\n');
}

/** Separate status topics using the same explicit privacy projection as the text fallback. */
export function assistantStatusSections(data,mode='both'){
 const footer='Status checked now. For changes or detailed account information, contact the business.';
 return ['membership','booking'].filter(kind=>mode==='both'||mode===kind).map(kind=>({
  title:kind==='membership'?'Membership status':'Latest booking status',
  items:[{title:kind==='membership'?'Plan and remaining sessions':'Booking and payment',text:formatAssistantStatus(data,kind).replace('\n'+footer,'')}]
 }));
}
