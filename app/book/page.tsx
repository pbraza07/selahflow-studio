'use client';
import BookingPayment,{makeBookingPayment} from '../components/booking-payment';
import RegistrationFields from '../components/registration-fields';
import {useEffect,useRef,useState} from 'react';
import {Shapes,Clock,MapPin,Check,ChevronLeft,Phone,CalendarDays} from 'lucide-react';
import {today,timeLabel} from '../../lib/defaults';
import type {CSSProperties} from 'react';
import {themeStyles} from '../../server/themes.mjs';
import {durationLabel,isTermUnit} from '../../lib/service-terms';
import {googleMapsDirections,displayBusinessAddress} from '../../lib/maps';
import PublicAvailabilityCalendar,{type PublicCalendarDay} from '../components/public-availability-calendar';
import GoogleBusinessGallery from '../components/google-business-gallery';
import AddToCalendar from '../components/add-to-calendar';
import VerifyRegistration from '../components/verify-registration';
import ShareBusinessPage from '../components/share-business-page';
import CustomerBookingPush from '../components/customer-booking-push';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const bookingApi=()=>{if(typeof window==='undefined')return '/api/booking';const parts=window.location.pathname.split('/').filter(Boolean);const slug=parts.length===2&&parts[0]==='book'?parts[1]:null;return '/api/booking'+(slug?'?slug='+encodeURIComponent(slug):'');};
export default function Booking(){
 const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState('');
 const [issuedId,setIssuedId]=useState('');
 const [confirmedPrice,setConfirmedPrice]=useState<number|null>(null);
 const [memberNumber,setMemberNumber]=useState(''),[verifiedIdentity,setVerifiedIdentity]=useState(''),[memberHasCredits,setMemberHasCredits]=useState(false);
 const [bookingDob,setBookingDob]=useState('');
 const [lookupBusy,setLookupBusy]=useState(false),[lookupMessage,setLookupMessage]=useState('');
 const [customerToken,setCustomerToken]=useState('');
 const [allSessions,setAllSessions]=useState<{date:string;sessions:{id:string;start:number;service:string;staff:string;name:string;staffName:string;capacity:number;remaining:number}[]}[]>([]),[sessionsLoading,setSessionsLoading]=useState(false);
 const [config,setConfig]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[step,setStep]=useState(1),[selected,setSelected]=useState<string[]>([]),[staff,setStaff]=useState(''),[date,setDate]=useState(today()),[times,setTimes]=useState<number[]>([]),[sessionAvailability,setSessionAvailability]=useState<Record<number,{remaining:number;capacity:number;id?:string}>>({}),[calendarView,setCalendarView]=useState<'day'|'week'|'month'>('week'),[calendarAnchor,setCalendarAnchor]=useState(today()),[calendarDays,setCalendarDays]=useState<PublicCalendarDay[]>([]),[calendarBusy,setCalendarBusy]=useState(false),[checked,setChecked]=useState(false),[earliestStart,setEarliestStart]=useState<number|null>(null),[firstAvailable,setFirstAvailable]=useState<number|null>(null),[time,setTime]=useState<number|null>(null),[done,setDone]=useState(''),[pendingApproval,setPendingApproval]=useState(false),[name,setName]=useState(''),[rememberedName,setRememberedName]=useState(false),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[accepted,setAccepted]=useState(false),[website,setWebsite]=useState(''),[customAnswers,setCustomAnswers]=useState<Record<string,string|boolean>>({});
 const key=useRef('');const requestNumber=useRef(0);
 async function load(){setError('');try{const r=await fetch(bookingApi());const d=await r.json();if(!r.ok)throw Error(d.error);setConfig(d.config);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{load();key.current=crypto.randomUUID();},[]);
 useEffect(()=>{
  if(!config?.slug)return;
  try{
   const saved=window.localStorage.getItem('selahflow:remembered-booking-name:'+config.slug)||'';
   if(saved&&saved.length<=100){setName(saved);const parts=saved.trim().split(/\s+/);setFirstName(parts.shift()||'');setLastName(parts.join(' '));setRememberedName(true);}
  }catch{/* Device storage may be disabled; booking still works normally. */}
 },[config?.slug]);
 function clearRememberedName(){
  if(config?.slug)try{window.localStorage.removeItem('selahflow:remembered-booking-name:'+config.slug);}catch{}
  setName('');setFirstName('');setLastName('');setRememberedName(false);
 }
 const [sessionPick,setSessionPick]=useState(0);
 const pendingSession=useRef<{date:string;start:number;staff:string;service:string}|null>(null);
 const services=config?.services.filter((s:any)=>selected.includes(s.id))||[];
 const regularPrice=services.reduce((n:number,s:any)=>n+s.price,0),duration=services.reduce((n:number,s:any)=>n+s.duration,0);
 const selectedSessionId=time===null?null:sessionAvailability[time]?.id||null;
 const selectedSession=config?.bookableSessions?.find((s:any)=>s.id===selectedSessionId);
 const membershipCreditAllowed=selectedSession?selectedSession.membershipCreditAllowed!==false:services.every((s:any)=>s.membershipCreditAllowed!==false);
 const membershipCovered=memberHasCredits&&membershipCreditAllowed;
 const price=membershipCovered?0:regularPrice;
 const eligible=config?.staff.filter((s:any)=>selected.every(id=>s.services.includes(id)))||[];
 async function post(body:any){const r=await fetch(bookingApi(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to process your request.');return d;}
 function resetTimes(){pendingSession.current=null;requestNumber.current++;setTimes([]);setSessionAvailability({});setEarliestStart(null);setFirstAvailable(null);setChecked(false);setTime(null);key.current=crypto.randomUUID();}
 async function availability(targetDate=date){const current=++requestNumber.current;setBusy(true);setError('');try{const d=await post({action:'availability',services:selected,staff,date:targetDate});if(current!==requestNumber.current)return;setTimes(d.slots);setSessionAvailability(d.sessionAvailability||{});setEarliestStart(typeof d.earliestStart==='number'?d.earliestStart:null);setFirstAvailable(typeof d.firstAvailable==='number'?d.firstAvailable:null);setChecked(true);const pick=pendingSession.current;setTime(pick&&pick.date===targetDate&&pick.staff===staff&&selected.includes(pick.service)&&d.slots.includes(pick.start)?pick.start:null);if(pick&&pick.date===targetDate)pendingSession.current=null;}catch(e){if(current===requestNumber.current)setError((e as Error).message);}finally{if(current===requestNumber.current)setBusy(false);}}
useEffect(()=>{
 if(!config||step!==2)return;
 let cancelled=false;
 setSessionsLoading(true);
 post({action:'session_calendar',date:calendarAnchor,view:calendarView}).then(d=>{if(!cancelled)setAllSessions(d.days||[]);}).catch(()=>{if(!cancelled)setAllSessions([]);}).finally(()=>{if(!cancelled)setSessionsLoading(false);});
 return ()=>{cancelled=true;};
},[config?.slug,step,calendarAnchor,calendarView]);
 function chooseCalendarDate(nextDate:string){
 setDate(nextDate);
 setCalendarAnchor(nextDate);
 resetTimes();
}
useEffect(()=>{
 if(step!==2||!staff||!selected.length)return;
 void availability(date);
},[step,staff,date,selected.join(','),sessionPick]);
useEffect(()=>{
 if(step!==2||!staff||!selected.length){setCalendarDays([]);return;}
 let cancelled=false;
 const controller=new AbortController();
 setCalendarBusy(true);
 fetch(bookingApi(),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
  body:JSON.stringify({action:'calendar',services:selected,staff,date:calendarAnchor,view:calendarView})})
  .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Calendar unavailable.');return data;})
  .then(data=>{if(!cancelled)setCalendarDays(data.days||[]);})
  .catch(error=>{if(!cancelled&&error.name!=='AbortError')setError(error.message);})
  .finally(()=>{if(!cancelled)setCalendarBusy(false);});
 return ()=>{cancelled=true;controller.abort();};
},[calendarAnchor,calendarView,staff,selected.join(','),step]);
// Automatically recover a returning player's submitted details once the ID
// and birth date match. Aborting outdated lookups prevents another player's
// response from filling the current form.
useEffect(()=>{
 const id=memberNumber.trim().toUpperCase(),dob=bookingDob,slug=config?.slug;
 if(!slug||!/^[A-Z]{2}[0-9]{4}$/.test(id)||!/^\d{4}-\d{2}-\d{2}$/.test(dob))return;
 let cancelled=false;
 const controller=new AbortController();
 const timer=window.setTimeout(async()=>{
  setLookupBusy(true);setLookupMessage('');
  try{
   const r=await fetch('/api/public/member-lookup',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug,memberNumber:id,dateOfBirth:dob}),signal:controller.signal
   });
   const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load saved player details.');
   if(cancelled)return;
   setFirstName(d.firstName||'');setLastName(d.lastName||'');
   setName([d.firstName,d.lastName].filter(Boolean).join(' '));
   setEmail(d.email||'');setPhone(d.phone||'');
   setCustomAnswers(d.customAnswers&&typeof d.customAnswers==='object'&&!Array.isArray(d.customAnswers)?d.customAnswers:{});
   setMemberHasCredits(d.membershipCovered===true);
   setRememberedName(false);
   setVerifiedIdentity(id+'|'+dob);
   setLookupMessage('Player verified! Name, contact details, and saved booking answers have been filled in. Review them before confirming.');
  }catch(error){
   if(cancelled||controller.signal.aborted)return;
   setVerifiedIdentity('');
   setLookupMessage((error as Error).message);
  }finally{if(!cancelled)setLookupBusy(false);}
 },400);
 return()=>{cancelled=true;window.clearTimeout(timer);controller.abort();};
},[memberNumber,bookingDob,config?.slug]);
function updateMembershipId(value:string){
 const id=value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
 if(verifiedIdentity&&id!==memberNumber){
  setFirstName('');setLastName('');setName('');setEmail('');setPhone('');setCustomAnswers({});
 }
   setVerifiedIdentity('');setLookupBusy(false);setLookupMessage('');setMemberHasCredits(false);setMemberNumber(id);
}
function updateBirthDate(value:string){
 if(verifiedIdentity&&value!==bookingDob){
  setFirstName('');setLastName('');setName('');setEmail('');setPhone('');setCustomAnswers({});
 }
 setVerifiedIdentity('');setLookupBusy(false);setLookupMessage('');setMemberHasCredits(false);setBookingDob(value);
}
 async function confirmBooking(e:React.FormEvent){e.preventDefault();const online=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='online';if(!bookingDob){setError('Date of birth is required.');return;}if(!firstName.trim()||!lastName.trim()){setError('First name and last name are required.');return;}if(memberNumber.trim()&&!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber.trim())){setError('Enter a valid 6-character membership ID or leave it blank for your first visit.');return;}if(memberNumber.trim()&&verifiedIdentity!==memberNumber.trim().toUpperCase()+'|'+bookingDob){setError('Please wait for your Membership ID and birth date to be verified before booking.');return;}setBusy(true);setError('');try{const d=await post({action:'book',key:key.current,services:selected,staff,date,start:time,expectedPrice:regularPrice,expectedDuration:duration,name:(firstName.trim()+' '+lastName.trim()),firstName:firstName.trim(),lastName:lastName.trim(),dateOfBirth:bookingDob,email,phone,policyAccepted:accepted,website,customAnswers,memberNumber:memberNumber.trim()?memberNumber.trim().toUpperCase():null,notMember:!memberNumber.trim()});setConfirmedPrice(typeof d.chargedPrice==='number'?d.chargedPrice:price);setDone(d.id);setIssuedId(d.memberNumber||memberNumber);setName((firstName.trim()+' '+lastName.trim()).trim());setCustomerToken(d.customerToken||'');setPendingApproval(d.pending===true);if(config?.slug&&(firstName.trim()+' '+lastName.trim()).trim())try{window.localStorage.setItem('selahflow:remembered-booking-name:'+config.slug,(firstName.trim()+' '+lastName.trim()).trim().slice(0,100));}catch{}if(online&&!d.pending&&d.chargedPrice>0&&d.customerToken)await makeBookingPayment(config.slug,d.id,d.customerToken);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!config)return <main className="public-loading"><Shapes size={36} aria-hidden="true"/><h1>Book your next visit.</h1><p role="status">{error||'Loading studio details…'}</p>{error&&<button className="primary" onClick={load}>Try again</button>}</main>;
 return <div className="public-page" data-selah-theme="true" style={{...themeStyles(config.theme,config.brand_primary,config.brand_background),'--brand-primary':config.brand_primary||'#123F3A','--brand-background':config.brand_background||'#F7F4EC','--purple':config.brand_primary||'#123F3A'} as CSSProperties}><header className="public-header"><a href={config.slug?"/book/"+encodeURIComponent(config.slug):"/book"} className="public-brand"><span className="sf-business-logo-frame">{config.slug?<img className="sf-business-logo-image" src={'/api/branding/logo?slug='+encodeURIComponent(config.slug)} alt={config.name+' logo'} onError={e=>{e.currentTarget.style.display='none';}}/>:<Shapes size={32}/>}</span><div><b>{config.name}</b><small>APPOINTMENT BOOKING</small></div></a><span className="public-header-note">{config.bookingHeaderNote??'Your time. Your style.'}</span></header><main className="public-main"><aside className="public-intro"><div className="eyebrow">{config.bookingEyebrow??'BOOK YOUR NEXT VISIT'}</div><h1>{config.bookingHeadline??'Find your next opening.'}</h1><p>{config.bookingDescription??config.business_model??'Choose your service, team member, and appointment time.'}</p><div className="studio-facts"><div><Clock size={18}/><span>{timeLabel(config.open*60)}–{timeLabel(config.close*60)}<small>Daily · Eastern time</small></span></div>{displayBusinessAddress(config.address)&&<div><MapPin size={18}/><span><a className="sf-directions-link" href={googleMapsDirections(config.address)} target="_blank" rel="noopener noreferrer" aria-label={'Get Google Maps directions to '+config.name}>{config.address} ↗</a></span></div>}{config.phone&&<div><Phone size={18}/><span>{config.phone}</span></div>}</div><div className="public-policy"><h3>{config.bookingPolicyTitle??'Before your visit'}</h3><p>{config.policy}</p><small>{config.bookingPaymentNote??'Appointment bookings: pay at the business. Memberships require a separate advance payment through secure checkout.'}</small></div>{config.bookingShowMembership!==false&&<div className="sf-booking-membership-link"><strong>{config.bookingMembershipTitle??'Prefer a membership?'}</strong><p>{config.bookingMembershipDescription??'Join weekly, monthly or yearly and pay securely in advance.'}</p><a className="primary" href={'/membership/'+encodeURIComponent(config.slug)}>{config.bookingMembershipButton??'Explore memberships →'}</a></div>}<div style={{margin:'12px 0'}}><ShareBusinessPage name={config.name||'Business'} slug={undefined}/></div><GoogleBusinessGallery slug={config.slug} compact/><a className="owner-signin" href="/login">{config.bookingOwnerLoginLabel??'Studio owner sign in'}</a></aside><section className="public-booking panel">
 {done?<div className="booking-success"><span className="success-icon"><Check size={32}/></span><div className="eyebrow">{pendingApproval?'BOOKING REQUEST RECEIVED':'YOU’RE BOOKED'}</div><h2>{pendingApproval?'Awaiting approval, '+name.split(' ')[0]+'.':'See you soon, '+name.split(' ')[0]+'.'}</h2><p>{services.map((s:any)=>s.name).join(' + ')}</p>{pendingApproval&&<p className="sf-approval-wait">Your booking is a request only. Do not assume the appointment is confirmed until the business accepts.</p>}<b>{new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</b><b>{timeLabel(time!)} Eastern · {config.staff.find((s:any)=>s.id===staff)?.name}</b><p>{money(confirmedPrice??price)} · {(confirmedPrice??price)===0?'No payment due':'Pay online or at the business'}</p>{error&&<p role="alert">{error}</p>}{(confirmedPrice??price)>0&&customerToken&&<BookingPayment slug={config.slug} id={done} token={customerToken} pending={pendingApproval}/>}{issuedId&&<div role="status" style={{background:'#fff2a8',color:'#392b00',border:'2px solid #e0b000',padding:'14px 18px',borderRadius:12,margin:'16px 0',fontWeight:800,fontSize:20}}>Your Unique Membership ID: {issuedId}</div>}<small>{pendingApproval?'Booking request unique ID':'Booking confirmation unique ID'}: {done}<br/>{pendingApproval?'Your appointment is NOT confirmed yet. The business owner or designated team member must accept it, and the requested time is not held. Contact the business for an update.':'Save this screen for your records.'} Push notifications are optional and require your permission.</small><p className="muted">{displayBusinessAddress(config.address)&&<a className="sf-directions-link" href={googleMapsDirections(config.address)} target="_blank" rel="noopener noreferrer">Directions to the business ↗</a>}</p>{customerToken&&<CustomerBookingPush token={customerToken} id={done}/>}{pendingApproval&&<div className="sf-approval-wait" role="note" style={{textAlign:'left',padding:'16px 18px',margin:'16px auto',maxWidth:540}}><strong>How to verify your booking approval</strong><p style={{margin:'8px 0'}}>Return to the booking calendar and select your requested session. If the business provides a participant list, check that your name appears as confirmed.</p><p style={{margin:'8px 0'}}>If your name is not shown, your request may still be pending. Contact the business for confirmation. Saving a calendar reminder does not approve your booking or reserve a seat.</p></div>}<p className="muted">{pendingApproval?'To check your request or choose a new time, contact the business':'To change or cancel, contact the business'}{config.phone?' at '+config.phone:''}.</p>{time!==null&&<AddToCalendar clientName={name} id={done} business={config.name} service={services.map((s:any)=>s.name).join(' + ')} staff={config.staff.find((s:any)=>s.id===staff)?.name||'Team member'} date={date} start={time} duration={duration} address={config.address||''}/>}<button className="primary" onClick={()=>window.print()}>Print confirmation</button><a className="outline" href={config.slug?"/book/"+encodeURIComponent(config.slug):"/book"}>Book another visit</a></div>:<><div className="steps">{['Service','Time & team','Confirm'].map((label,i)=><div key={label} className={step===i+1?'current':step>i+1?'done':''}><span>{step>i+1?<Check size={14}/>:i+1}</span>{label}</div>)}</div><div className="public-form-body">{error&&<div className="alert" role="alert">{error}</div>}
 {step===1&&<><VerifyRegistration api={bookingApi()} onVerified={next=>{setCalendarView('day');chooseCalendarDate(next);}}/><h2>{config.pageContent?.serviceStepTitle||"What brings you in?"}</h2><p className="muted">Choose one or more services.</p><div className="booking-services">{config.services.map((s:any)=><button key={s.id} disabled={isTermUnit(s.durationUnit||'minutes')} className={'booking-service '+(selected.includes(s.id)?'picked':'')} onClick={()=>{setSelected(old=>old.includes(s.id)?old.filter(id=>id!==s.id):[...old,s.id]);setStaff('');resetTimes();}}><span className="select-check">{selected.includes(s.id)&&<Check size={14}/>}</span><div><b>{s.name}</b><small>{s.description}</small><small>{durationLabel(s)} {isTermUnit(s.durationUnit||'minutes')?'· Contact business to enroll; not an appointment':''}</small></div><b>{money(s.price)}</b></button>)}</div></>}
 {step===2&&<><h2>Your chair is waiting.</h2><p className="muted">Find a professional and time that work for you.</p><label>{config.pageContent?.staffLabel||"Choose your professional"}<select value={staff} disabled={busy} onChange={e=>{setStaff(e.target.value);resetTimes();}}><option value="">Select a team member</option>{eligible.map((s:any)=><option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}</select></label>{!eligible.length&&<p className="notice section-gap">No single team member offers this service combination. Go back and choose services from the same specialty.</p>}<section className="panel padded" style={{margin:'12px 0'}} aria-label="Business sessions calendar"><h3>Business sessions and available seats</h3><p className="muted">All scheduled sessions are shown here, even before you choose a service or team member. Select an available session to book.</p>{sessionsLoading&&<p role="status">Loading sessions…</p>}{allSessions.flatMap(day=>day.sessions.map(session=><button type="button" key={day.date+session.id+session.start} className="outline" style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',gap:12,textAlign:'left',margin:'8px 0',padding:12,flexWrap:'wrap'}} disabled={session.remaining<1} onClick={()=>{chooseCalendarDate(day.date);pendingSession.current={date:day.date,start:session.start,staff:session.staff,service:session.service};setSelected([session.service]);setStaff(session.staff);setBusy(true);setSessionPick(n=>n+1);}}><span><strong>{session.name}</strong><small style={{display:'block'}}>{day.date} · {timeLabel(session.start)} · {session.staffName}</small></span><strong>{session.remaining}/{session.capacity} seats available{session.remaining<1?' · Full':''}</strong></button>))}{!sessionsLoading&&allSessions.every(day=>day.sessions.length===0)&&<p className="muted">No scheduled sessions in this calendar period. You can still check regular appointment times below.</p>}</section><PublicAvailabilityCalendar date={date} anchor={calendarAnchor} mode={calendarView} onMode={setCalendarView} onAnchor={setCalendarAnchor} onSelect={chooseCalendarDate} days={calendarDays} loading={calendarBusy}/><label>{config.pageContent?.dateLabel||"Selected date"}<input type="date" min={today()} value={date} disabled={busy} onChange={e=>chooseCalendarDate(e.target.value)}/></label><button className="outline full section-gap" disabled={busy||!staff} onClick={()=>availability()}><CalendarDays size={17}/>{busy?'Checking the calendar…':checked?'Refresh available times':'Check available times'}</button><div className="slot-grid">{times.map(t=><button key={t} className={time===t?'picked':''} onClick={()=>{setTime(t);key.current=crypto.randomUUID();}}><span className="sf-slot-time">{timeLabel(t)}</span>{sessionAvailability[t]&&<small className="sf-slot-count" style={{display:"block",fontWeight:700,color:sessionAvailability[t].remaining<=2?"#b42318":undefined}} aria-label={`${sessionAvailability[t].remaining} of ${sessionAvailability[t].capacity} seats remaining`}>{sessionAvailability[t].remaining} {sessionAvailability[t].remaining===1?"seat":"seats"} left of {sessionAvailability[t].capacity}{sessionAvailability[t].remaining<=2?" · Almost full":""}</small>}</button>)}</div>{checked&&Object.keys(sessionAvailability).length>0&&<p className="sf-slot-availability-hint" role="status" style={{fontWeight:600,marginTop:12}}>Live session capacity is shown below each booking time. Seat counts update when availability is refreshed.</p>}{checked&&<div className="sf-booking-earliest-note" role="status"><Clock size={19} aria-hidden="true"/><div><strong>{firstAvailable!==null?'First available: '+timeLabel(firstAvailable)+' Eastern':'No open times for this selection'}</strong>{earliestStart!==null&&<p>{firstAvailable!==null&&firstAvailable>earliestStart?'The next {config.bookingInterval||15}-minute booking mark is '+timeLabel(earliestStart)+', but that earlier time is unavailable.':'Bookings may begin at '+timeLabel(earliestStart)+' — the next {config.bookingInterval||15}-minute mark.'}</p>}<small>No extra one-hour notice is required. Existing appointments, service duration, cleanup time and opening hours still apply.</small></div></div>}{checked&&!times.length&&<p className="notice">No times are available on this date. Please try another day or team member.</p>}<small>All times are Eastern. If this business requires approval, your seat is reserved only after the request is accepted.</small></>}
 {step===3&&<form id="public-confirm" onSubmit={confirmBooking}><h2>{config.pageContent?.bookingDetailsTitle||"Make it official."}</h2><p className="muted">{config.pageContent?.bookingDetailsDescription||"Review your visit and add your contact details."}</p><div className="booking-summary"><b>{services.map((s:any)=>s.name).join(' + ')}</b><p>{date} · {timeLabel(time!)} Eastern · {duration} minutes</p><p>{config.staff.find((s:any)=>s.id===staff)?.name}</p><b>{money(price)}</b><p>{price===0?'Covered by your membership. No payment due.':config.bookingApprovalEnabled||services.some((s:any)=>s.requiresApproval)?'Payment is available after the business accepts your booking.':config.canPay?'Make Payment opens Stripe secure checkout, or confirm to pay at the business.':'Online payment requires the business to finish its Stripe connection. You can pay at the business.'}</p></div><RegistrationFields config={config} form="booking" sessionId={time===null?null:sessionAvailability[time]?.id||null} values={{memberNumber,dateOfBirth:bookingDob,firstName,lastName,email,phone}} answers={customAnswers}
 onValue={(id,value)=>{if(id==='memberNumber')updateMembershipId(value);else if(id==='dateOfBirth')updateBirthDate(value);else if(id==='firstName'){setFirstName(value);setRememberedName(false);}else if(id==='lastName'){setLastName(value);setRememberedName(false);}else if(id==='email')setEmail(value);else if(id==='phone')setPhone(value);}}
 onAnswer={(id,value)=>setCustomAnswers(v=>({...v,[id]:value}))}
 identityHelp={<><p><strong>Already registered?</strong> Enter your Membership ID and verify your birth date to automatically fill your name, email, phone and previous registration answers. <strong>New player?</strong> Leave the ID blank; SelahFlow will create one when you book.</p>{memberNumber.trim()&&<div aria-live="polite" role="status">{lookupBusy?'Loading your saved details…':lookupMessage||(bookingDob?'Ready to verify your player ID.':'Enter your birth date to load saved details.')}</div>}</>}/>
 {rememberedName&&<div className="sf-returning-name" role="status"><strong>Welcome back!</strong><p>We remembered your name on this device for {config.name}.</p><button type="button" className="outline" onClick={clearRememberedName}>Not you? Clear name</button></div>}<div className="honeypot" aria-hidden="true"><label>Leave blank<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div><label className="consent"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I confirm these appointment details and agree to the policy: {config.policy}</span></label><p className="muted">Your details will be shared with this business to manage your appointment. After a successful booking, only your name is saved on this device for faster future bookings; email, phone and other answers are never stored by this feature. This does not sign you up for marketing.</p></form>}
 </div><div className="modal-footer" style={{flexWrap:'wrap'}}><div><b>{money(price)}</b><small>{duration} minutes</small></div><div className="button-row" style={{flexWrap:'wrap',justifyContent:'flex-end'}}>{step>1&&<button disabled={busy} className="outline" onClick={()=>{setStep(step-1);setError('');}}><ChevronLeft size={16}/>Back</button>}{step<3?<button className="primary" disabled={busy||!selected.length||(step===2&&time===null)} onClick={()=>{setStep(step+1);setError('');}}>{config.pageContent?.bookingContinue||"Continue"}</button>:<>{price>0&&!config.bookingApprovalEnabled&&!services.some((s:any)=>s.requiresApproval)&&<button className="primary" form="public-confirm" type="submit" value="online" disabled={!config.canPay||busy||!accepted}>{busy?'Opening checkout…':'Make Payment'}</button>}<button className="outline" form="public-confirm" type="submit" value="business" disabled={busy||!accepted}>{busy?'Booking…':config.pageContent?.bookingConfirm||'Confirm booking'}</button></>}</div></div></>}
 </section></main><footer className="public-footer">{config.name} · Appointment booking<span className="booking-platform-brand"><img src="/brand/symbol.svg" alt="" width="34" height="24"/>Powered by SelahFlow · Your bookings flow. You breathe.</span></footer></div>;
}
