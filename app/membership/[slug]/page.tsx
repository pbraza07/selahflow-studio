'use client';
import BusinessNavigation from '../../components/business-navigation';
import RegistrationFields from '../../components/registration-fields';
import MembershipBadge,{type MembershipBadgeDesign} from '../../components/membership-badge';
import {membershipTabs,plansForMembershipTab} from '../../../server/membership-groups.mjs';
import {useEffect,useState,useRef} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,CreditCard,ShieldCheck} from 'lucide-react';
import type {CSSProperties} from 'react';
import {themeStyles} from '../../../server/themes.mjs';
import GoogleBusinessGallery from '../../components/google-business-gallery';
type Plan={id:string;name:string;description:string;interval:'week'|'month'|'year';priceCents:number;groupId:string|null;badge:MembershipBadgeDesign|null};
type Summary={slug:string;name:string;plans:Plan[];groups:{id:string;name:string;badge:MembershipBadgeDesign|null}[];canPay:boolean;theme:any;brandPrimary:string;brandBackground:string;registrationConfig:any};
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function MembershipEnrollment(){
 const [data,setData]=useState<Summary|null>(null),[slug,setSlug]=useState(''),[planId,setPlanId]=useState(''),[step,setStep]=useState(1);
 const [groupTab,setGroupTab]=useState('all');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[accept,setAccept]=useState(false);
 const [details,setDetails]=useState<Record<string,string>>({firstName:'',lastName:'',dateOfBirth:'',phone:''}),[answers,setAnswers]=useState<Record<string,string|boolean>>({});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<{status:string;plan?:string;paidThrough?:string;memberNumber?:string;sessionsLeft?:number}|null>(null);
 const [requested,setRequested]=useState(false);
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
 function chooseGroup(id:string){setGroupTab(id);if(data&&!plansForMembershipTab(data.plans,id).some((p:Plan)=>p.id===planId))setPlanId('');}
 async function pay(e:React.FormEvent){
  e.preventDefault();
  if(!plan||!data)return;
  const online=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='online';
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/public/memberships',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:online?'checkoutMembership':'requestMembership',recurringAccepted:online&&accept,requestId:requestId.current||(requestId.current=crypto.randomUUID()),slug,planId:plan.id,name,email,...details,customAnswers:answers,termsAccepted:accept})});
   const d=await response.json();
   if(!response.ok)throw Error(d.error||'Secure checkout is unavailable.');
   if(online){if(d.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(d.checkoutUrl))window.location.assign(d.checkoutUrl);else if(d.returnUrl&&new URL(d.returnUrl).origin===window.location.origin)window.location.assign(d.returnUrl);else throw Error('Secure checkout link unavailable.');}
   else setRequested(true);setBusy(false);
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 const theme=data?themeStyles(data.theme,data.brandPrimary,data.brandBackground) as CSSProperties:undefined;
 return <div className="sf-membership-public" data-selah-theme="true" style={theme}>
  <BusinessNavigation slug={slug} name={data?.name||"Memberships"}/>
  <main className="sf-membership-public-main">
   <section className="sf-membership-public-intro">
    <span className="sf-membership-kicker">MEMBERSHIPS & RECURRING SERVICES</span>
    <h1>{data?.registrationConfig?.pageContent?.membershipTitle||(data?'Memberships at '+data.name:'Choose a membership')}</h1>
    <p>{data?.registrationConfig?.pageContent?.membershipIntro||'Choose a membership and submit your registration for the team to review.'}</p>
    {slug&&<GoogleBusinessGallery slug={slug} compact/>}
   </section>
   <section className="sf-membership-join-panel">
    {requested?<div role="status"><CheckCircle2 size={36}/><h2>Membership request submitted</h2><p>The {data?.name} team will process your request. Your membership will appear after approval. Payment and session credits are confirmed separately.</p><a className="primary" href={'/book/'+slug}>Return to booking</a></div>:checkoutId?<div className="sf-membership-finish">
     <ShieldCheck size={36}/><h2>{result?.status==='active'?'Your membership is active!':'Checking your payment'}</h2>
     {result?.status==='active'?<><p>Payment has been verified for <b>{result.plan}</b>.</p><p><b>Your Membership ID: {result.memberNumber}</b><br/>{result.sessionsLeft} sessions left</p>{result.paidThrough&&<p>Current paid period ends {new Date(result.paidThrough).toLocaleDateString('en-US')}.</p>}</>:
      <p>{result?.status==='payment_failed'?'Your payment did not complete.': 'Stripe is processing your payment. A membership is not active until the payment is verified.'}</p>}
     <a className="primary" href={'/book/'+slug}>Return to appointment booking</a>
    </div>:<>
    <div className="sf-membership-steps">{['Choose plan','Your details',data?.canPay?'Make Payment':'Submit request'].map((label,i)=><span key={label} className={step===i+1?'active':''}>{i+1}. {label}</span>)}</div>
    {error&&<p className="sf-membership-error" role="alert">{error}</p>}
    {!data?<p>Loading available plans…</p>:step===1?<><h2>Choose your membership</h2>
     {tabs.length>0&&<div className="sf-membership-type-tabs" role="tablist" aria-label="Membership types">{tabs.map((tab:{id:string;name:string;badge?:MembershipBadgeDesign|null},i:number)=><button key={tab.id} type="button" id={'membership-type-'+tab.id} role="tab" aria-selected={groupTab===tab.id} aria-controls="membership-plan-options" tabIndex={groupTab===tab.id?0:-1} onClick={()=>chooseGroup(tab.id)} onKeyDown={e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();chooseGroup(tabs[next].id);document.getElementById('membership-type-'+tabs[next].id)?.focus();}}>{tab.badge?<MembershipBadge membershipName={tab.name} membershipStatus="active" sessionsIncluded={1} sessionsUsed={0} badge={tab.badge}/>:tab.name}</button>)}</div>}
     <div id="membership-plan-options" role={tabs.length?'tabpanel':undefined} aria-labelledby={tabs.length?'membership-type-'+groupTab:undefined}>
     {data.plans.length?<div className="sf-membership-plans">{visiblePlans.map((p:Plan)=><button key={p.id} type="button" aria-pressed={planId===p.id} className={planId===p.id?'selected':''} onClick={()=>setPlanId(p.id)}>
      <span><b>{p.name}</b>{p.badge&&<span className="sf-membership-plan-badge"><MembershipBadge membershipName={p.name} membershipStatus="active" sessionsIncluded={1} sessionsUsed={0} badge={p.badge}/></span>}<small>{p.description||'Recurring business membership'}</small></span>
      <strong>{price(p.priceCents)} <small>/ {p.interval}</small></strong>
     </button>)}</div>:<p className="sf-membership-empty">No memberships are available yet. Contact the business for more information.</p>}
     </div>
     {data.plans.length>0&&<p className="sf-membership-warning">{data.registrationConfig?.pageContent?.membershipRequestNote||('Choose your membership, fill out your information, and a '+data.name+' team member will process your request.')}</p>}
     <button type="button" className="primary sf-membership-next" disabled={!planId} onClick={()=>setStep(2)}>Continue <ArrowRight size={17}/></button>
    </>:<form onSubmit={pay}><button type="button" className="sf-membership-back" onClick={()=>setStep(1)}><ArrowLeft size={16}/> Choose another plan</button>
     <h2>{data.registrationConfig?.pageContent?.membershipDetailsTitle||"Review your membership"}</h2>{plan&&<div className="sf-membership-order"><b>{plan.name}</b><p>{plan.description}</p>
      <div><strong>{price(plan.priceCents)} / {plan.interval}</strong><span>{plan.interval} membership</span></div></div>}
     <RegistrationFields config={data.registrationConfig||{}} form="membership" values={{...details,email}} answers={answers} onValue={(id,value)=>{if(id==='email')setEmail(value);else setDetails(old=>{const next={...old,[id]:value};setName((next.firstName+' '+next.lastName).trim());return next;});}} onAnswer={(id,value)=>setAnswers(old=>({...old,[id]:value}))}/>
     <label className="sf-membership-agree"><input type="checkbox" required checked={accept} onChange={e=>setAccept(e.target.checked)}/>
      <span>{data.canPay&&plan?`I confirm my details. If I choose Make Payment, I authorize recurring billing of ${price(plan.priceCents)} every ${plan.interval} until cancelled through the business. A request alone takes no payment. Membership does not reserve appointment times.`:'I confirm my registration details and request this membership. The business will contact me to process my request and payment. No online payment is taken by this form. Membership does not reserve appointment times.'}</span></label>
     <button type="submit" value="online" className="primary sf-membership-next" disabled={!data.canPay||busy||!accept||!name.trim()||!email.trim()}><CreditCard size={17}/>{busy?'Opening secure checkout…':'Make Payment'}</button>{!data.canPay&&<p role="note">Online payment is unavailable until the business completes its Stripe connection. You can still submit a membership request.</p>}
     <button type="submit" value="request" className="outline sf-membership-next" disabled={busy||!accept||!name.trim()||!email.trim()}>
      <CreditCard size={17}/>{busy?'Submitting request…':data.registrationConfig?.pageContent?.membershipSubmit||'Submit membership request'}</button>
     <small>{data.canPay?'Make Payment opens Stripe secure checkout. Membership activates only after verified payment. You can also send a request without paying.':'Your request is reviewed by the business before membership approval.'}</small>
    </form>}
    </>}
   </section>
  </main>
 </div>;
}
