'use client';
import BusinessAssistant from '../../components/business-assistant';

import PoweredBySelahFlow from '../../components/powered-by-selahflow';

import BusinessNavigation from '../../components/business-navigation';
import RegistrationFields from '../../components/registration-fields';
import MembershipBadge,{type MembershipBadgeDesign} from '../../components/membership-badge';
import {membershipTabs,plansForMembershipTab} from '../../../server/membership-groups.mjs';
import {useEffect,useState,useRef} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,CreditCard,ShieldCheck} from 'lucide-react';
import type {CSSProperties} from 'react';
import {themeStyles} from '../../../server/themes.mjs';
import GoogleBusinessGallery from '../../components/google-business-gallery';
type Plan={usageSummary?:string;intervalCount?:number;creditSummary?:string;id:string;name:string;description:string;interval:'week'|'month'|'year';priceCents:number;groupId:string|null;badge:MembershipBadgeDesign|null};
type Summary={slug:string;name:string;plans:Plan[];groups:{id:string;name:string;badge:MembershipBadgeDesign|null}[];canPay:boolean;theme:any;brandPrimary:string;brandBackground:string;registrationConfig:any};
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function MembershipEnrollment(){
 const [data,setData]=useState<Summary|null>(null),[slug,setSlug]=useState(''),[planId,setPlanId]=useState(''),[step,setStep]=useState(1);
 const [groupTab,setGroupTab]=useState('all');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[accept,setAccept]=useState(false);
 const [details,setDetails]=useState<Record<string,string>>({firstName:'',lastName:'',dateOfBirth:'',phone:''}),[answers,setAnswers]=useState<Record<string,string|boolean>>({});
 const [coupon,setCoupon]=useState(''),[discount,setDiscount]=useState<any>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<{status:string;plan?:string;paidThrough?:string;memberNumber?:string;sessionsLeft?:number}|null>(null);
 const [requested,setRequested]=useState(false),[registeredNumber,setRegisteredNumber]=useState('');
 const lookupGeneration=useRef(0);
 const [lookupBusy,setLookupBusy]=useState(false),[lookupMessage,setLookupMessage]=useState('');
 const requestId=useRef('');
 const [checkoutId,setCheckoutId]=useState('');
 useEffect(()=>{
  const path=window.location.pathname.split('/').filter(Boolean);
  const current=path.length===2&&path[0]==='membership'?path[1]:'';
  setSlug(current);
  fetch('/api/public/memberships?slug='+encodeURIComponent(current),{cache:'no-store'}).then(async r=>{
   const obj=await r.json();if(!r.ok)throw Error(obj.error||'Memberships unavailable.');return obj;
  }).then(setData).catch(e=>setError((e as Error).message));
  const query=new URLSearchParams(window.location.search);
  if(query.get('checkout')==='cancelled')setError('Payment was cancelled. No membership has been activated.');
  if(query.get('checkout')==='success'&&query.get('session_id'))setCheckoutId(query.get('session_id')||'');
 },[]);
 useEffect(()=>{
  if(!checkoutId||!slug)return;
  let cancelled=false,attempts=0;
  const poll=async()=>{
   try{
    const response=await fetch('/api/public/memberships/status?slug='+encodeURIComponent(slug)+'&session_id='+encodeURIComponent(checkoutId),{cache:'no-store'});
    const d=await response.json();
    if(!cancelled)setResult(d);
    if(!cancelled&&d.status==='active'){clearInterval(interval);}
   }catch{}
   if(++attempts>=15)clearInterval(interval);
  };
  const interval=setInterval(poll,3000);void poll();
  return ()=>{cancelled=true;clearInterval(interval);};
 },[checkoutId,slug]);
 const plan=data?.plans.find(p=>p.id===planId);
 const tabs=data?membershipTabs(data.plans,data.groups):[];
 const visiblePlans=data?plansForMembershipTab(data.plans,groupTab):[];
 function chooseGroup(id:string){setGroupTab(id);if(data&&!plansForMembershipTab(data.plans,id).some((p:Plan)=>p.id===planId))setPlanId('');requestId.current='';}
 async function pay(e:React.FormEvent){
  e.preventDefault();
  if(!plan||!data)return;
  const online=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='online';
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/public/memberships',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:online?'checkoutMembership':'requestMembership',couponCode:coupon,recurringAccepted:online&&accept,requestId:requestId.current||(requestId.current=crypto.randomUUID()),slug,planId:plan.id,name,email,...details,customAnswers:answers,termsAccepted:accept})});
   const d=await response.json();
   if(!response.ok)throw Error(d.error||'Secure checkout is unavailable.');
   if(online){if(d.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(d.checkoutUrl))window.location.assign(d.checkoutUrl);else if(d.returnUrl&&new URL(d.returnUrl).origin===window.location.origin)window.location.assign(d.returnUrl);else throw Error('Secure checkout link unavailable.');}
   else {setRegisteredNumber(d.memberNumber||'');setRequested(true);}setBusy(false);
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 async function loadReturningMember(signal?:AbortSignal){
  const generation=++lookupGeneration.current;
  const id=String(details.memberNumber||'').trim().toUpperCase();
  if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(id)){setLookupMessage('Enter your Unique ID to load saved details.');return;}
  setLookupBusy(true);setLookupMessage('');
  try{
   const response=await fetch('/api/public/member-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,memberNumber:id}),signal});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Saved customer not found.');
   if(signal?.aborted||generation!==lookupGeneration.current)return;
   setDetails(old=>({...old,memberNumber:id,dateOfBirth:result.dateOfBirth||'',firstName:result.firstName||'',lastName:result.lastName||'',phone:result.phone||''}));
   setName((result.firstName+' '+result.lastName).trim());setEmail(result.email||'');
   setAnswers(result.customAnswers||{});setLookupMessage('Welcome back! Your saved Unique ID and contact details have been loaded.');
  }catch(e){if(!signal?.aborted&&generation===lookupGeneration.current)setLookupMessage((e as Error).message);}finally{if(!signal?.aborted&&generation===lookupGeneration.current)setLookupBusy(false);}
 }
 useEffect(()=>{
  setLookupBusy(false);
  if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(String(details.memberNumber||'').trim().toUpperCase()))return;
  const controller=new AbortController(),timer=window.setTimeout(()=>void loadReturningMember(controller.signal),400);
  return()=>{controller.abort();window.clearTimeout(timer);lookupGeneration.current++;};
 },[details.memberNumber,slug]);
 const theme=data?themeStyles(data.theme,data.brandPrimary,data.brandBackground) as CSSProperties:undefined;
 return <div className="sf-membership-public" data-selah-theme="true" style={theme}>
  <BusinessNavigation slug={slug} name={data?.name||"Memberships"}/>
  <main className="sf-membership-public-main">
   <section className="sf-membership-public-intro">
    <span className="sf-membership-kicker">MEMBERSHIPS & RECURRING SERVICES</span>
    <h1>{data?.registrationConfig?.pageContent?.membershipTitle||(data?'Memberships at '+data.name:'Choose a membership')}</h1>
    <p>{data?.registrationConfig?.pageContent?.membershipIntro||'Choose a membership and pay securely. No membership approval is required; sessions activate after verified payment.'}</p>
   </section>
   <section className="sf-membership-join-panel">
    {requested?<div role="status"><CheckCircle2 size={36}/><h2>Membership registered</h2><p>Your membership is registered without approval. Payment is still pending; no session credits are active until payment is confirmed.{registeredNumber&&<div role="status" style={{background:'#fff2a8',color:'#392b00',border:'2px solid #e0b000',padding:'14px 18px',borderRadius:12,margin:'16px 0',fontWeight:800,fontSize:20}}>Your client / membership ID: {registeredNumber}</div>}</p>{data?.canPay&&<button type="button" className="primary" onClick={()=>{setRequested(false);setStep(2);}}>Make Payment <CreditCard size={17}/></button>}<a className="outline" href={'/book/'+slug}>Return to booking</a></div>:checkoutId?<div className="sf-membership-finish">
     <ShieldCheck size={36}/><h2>{result?.status==='active'?'Your membership is active!':'Checking your payment'}</h2>
     {result?.status==='active'?<><p>Payment has been verified for <b>{result.plan}</b>.</p><p><b>Your client / membership ID: {result.memberNumber}</b><br/>{result.sessionsLeft} sessions left</p>{result.paidThrough&&<p>Current paid period ends {new Date(result.paidThrough).toLocaleDateString('en-US')}.</p>}</>:
      <><p>{result?.status==='payment_failed'?'Your payment did not complete.': 'Stripe is processing your payment. A membership is not active until the payment is verified.'}</p>{result?.memberNumber&&<div role="status" style={{background:'#fff2a8',color:'#392b00',border:'2px solid #e0b000',padding:'14px 18px',borderRadius:12,fontWeight:800,fontSize:20}}>Your client / membership ID: {result.memberNumber}</div>}</>}
     <a className="primary" href={'/book/'+slug}>Return to booking</a>
    </div>:<>
    <div className="sf-membership-steps">{['Choose plan','Your details',data?.canPay?'Make Payment':'Register · pay later'].map((label,i)=><span key={label} className={step===i+1?'active':''}>{i+1}. {label}</span>)}</div>
    {error&&<p className="sf-membership-error" role="alert">{error}</p>}
    {!data?<p>Loading available plans…</p>:step===1?<><h2>Choose your membership</h2>
     {tabs.length>0&&<div className="sf-membership-type-tabs" role="tablist" aria-label="Membership types">{tabs.map((tab:{id:string;name:string;badge?:MembershipBadgeDesign|null},i:number)=><button key={tab.id} type="button" id={'membership-type-'+tab.id} role="tab" aria-selected={groupTab===tab.id} aria-controls="membership-plan-options" tabIndex={groupTab===tab.id?0:-1} onClick={()=>chooseGroup(tab.id)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();chooseGroup(tabs[next].id);document.getElementById('membership-type-'+tabs[next].id)?.focus();}}>{tab.badge?<MembershipBadge membershipName={tab.name} membershipStatus="active" sessionsIncluded={1} sessionsUsed={0} badge={tab.badge}/>:tab.name}</button>)}</div>}
     <div id="membership-plan-options" role={tabs.length?'tabpanel':undefined} aria-labelledby={tabs.length?'membership-type-'+groupTab:undefined}>
     {data.plans.length?<div className="sf-membership-plans">{visiblePlans.map((p:Plan)=><button key={p.id} type="button" aria-pressed={planId===p.id} className={planId===p.id?'selected':''} onClick={()=>{setPlanId(p.id);requestId.current='';}}>
      <span><b>{p.name}</b>{p.badge&&<span className="sf-membership-plan-badge"><MembershipBadge membershipName={p.name} membershipStatus="active" sessionsIncluded={1} sessionsUsed={0} badge={p.badge}/></span>}<small>{p.description||'Recurring business membership'}</small><small>{p.usageSummary}</small><small>{p.creditSummary}</small></span>
      <strong>{price(p.priceCents)} <small>/ {p.interval}</small></strong>
     </button>)}</div>:<p className="sf-membership-empty">No memberships are available yet. Contact the business for more information.</p>}
     </div>
     {data.plans.length>0&&<p className="sf-membership-warning">{data.registrationConfig?.pageContent?.membershipRequestNote||('Choose your membership and complete registration. No owner approval is required; benefits activate after payment is verified.')}</p>}
     <button type="button" className="primary sf-membership-next" disabled={!planId} onClick={()=>setStep(2)}>Continue <ArrowRight size={17}/></button>
    </>:<form onSubmit={pay}><button type="button" className="sf-membership-back" onClick={()=>setStep(1)}><ArrowLeft size={16}/> Choose another plan</button>
     <label>Coupon code (optional)<input maxLength={40} value={coupon} onChange={e=>{setCoupon(e.target.value.toUpperCase());setDiscount(null);}}/></label><button type="button" disabled={busy||!coupon||!plan} onClick={async()=>{try{const r=await fetch('/api/public/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'quoteCoupon',slug,planId:plan?.id,couponCode:coupon})}),d=await r.json();if(!r.ok)throw Error(d.error);setDiscount(d);}catch(e){setError((e as Error).message);}}}>Apply coupon</button>{discount&&<p>{discount.description} · {discount.duration==='once'?'First payment':'Each payment'}: {price(discount.totalCents)}</p>}<h2>{data.registrationConfig?.pageContent?.membershipDetailsTitle||"Review your membership"}</h2>{plan&&<div className="sf-membership-order"><b>{plan.name}</b><p>{plan.description}</p><p>{plan.usageSummary}</p><p>{plan.creditSummary}</p>
      <div><strong>{price(plan.priceCents)} / {plan.interval}</strong><span>{plan.interval} membership</span></div></div>}
     <RegistrationFields config={data.registrationConfig||{}} form="membership" values={{...details,email}} answers={answers} onValue={(id,value)=>{if(id==='memberNumber'){lookupGeneration.current++;setLookupMessage('');setName('');setEmail('');setAnswers({});setDetails({memberNumber:value.toUpperCase(),firstName:'',lastName:'',dateOfBirth:'',phone:''});}else if(id==='email')setEmail(value);else setDetails(old=>{const next={...old,[id]:value};setName((next.firstName+' '+next.lastName).trim());return next;});}} onAnswer={(id,value)=>setAnswers(old=>({...old,[id]:value}))} identityHelp={<><p><strong>Returning customer?</strong> Enter only your Membership ID to automatically fill your saved registration details. <strong>First membership or first visit?</strong> Leave the ID blank. SelahFlow assigns your business-specific Unique ID when you register: initials + MMDDYY with a birth date, or initials + the next number starting at 1001 without one. First and last name are needed. Required business questions and waiver requirements still apply.</p>{details.memberNumber&&<><button type="button" className="outline" disabled={lookupBusy} onClick={()=>void loadReturningMember()}>{lookupBusy?'Loading customer…':'Load existing customer'}</button>{lookupMessage&&<small role="status">{lookupMessage}</small>}</>}</>}/>
     <label className="sf-membership-agree"><input type="checkbox" required checked={accept} onChange={e=>setAccept(e.target.checked)}/>
      <span>{data.canPay&&plan?`I confirm my details. If I choose Make Payment, I authorize recurring billing of ${price(plan.priceCents)} every ${plan.interval} until cancelled through the business. Registration without payment does not activate membership or reserve appointment times.`:'I confirm my details and understand that my membership remains pending payment. No owner approval is required, and registering does not reserve appointment times.'}</span></label>
     <button type="submit" value="online" className="primary sf-membership-next" disabled={!data.canPay||busy||!accept}><CreditCard size={17}/>{busy?'Opening secure checkout…':'Make Payment'}</button>{!data.canPay&&<p role="note">Online payment requires this business to connect and verify Stripe. You may register without payment now; the owner can confirm an offline payment later.</p>}
     <button type="submit" value="request" className="outline sf-membership-next" disabled={busy||!accept}>
      <CreditCard size={17}/>{busy?'Submitting request…':data.registrationConfig?.pageContent?.membershipSubmit||'Register without payment'}</button>
     <small>{data.canPay?'Make Payment opens Stripe secure checkout without owner approval. Sessions activate only after verified payment. You can also register without paying.':'Registration requires no approval. Membership stays pending until the business confirms payment.'}</small>
    </form>}
    </>}
   </section>
   {slug&&data&&<div className="sf-membership-google"><GoogleBusinessGallery slug={slug} compact/></div>}
  </main>
  <PoweredBySelahFlow/>
 <BusinessAssistant slug={slug} name={data?.name}/>
 </div>;
}
