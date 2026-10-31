'use client';
import {useEffect,useState} from 'react';
import BusinessServiceAgreement,{blankAcceptance,acceptanceComplete} from '../../components/business-service-agreement';
import {PLAN_CATALOG} from '../../../server/plan-entitlements.mjs';

export default function Billing(){
 const [info,setInfo]=useState<any>(null),[plan,setPlan]=useState('professional'),[agreement,setAgreement]=useState(blankAcceptance('professional')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){
  const r=await fetch('/api/studio/platform-billing',{cache:'no-store'}),d=await r.json();
  if(r.status===401){location.assign('/login');return;}if(!r.ok)throw Error(d.error);
  setInfo(d);if(['professional','business'].includes(d.requestedPlan)){setPlan(d.requestedPlan);setAgreement(a=>a.planCode===d.requestedPlan?a:blankAcceptance(d.requestedPlan));}
 }
 useEffect(()=>{void load().catch(e=>setError(e.message));if(!new URLSearchParams(location.search).has('session_id'))return;let count=0;const timer=setInterval(()=>{void load().catch(e=>setError(e.message));if(++count>=10)clearInterval(timer);},3000);return()=>clearInterval(timer);},[]);
 const agreementAlreadySigned=info?.agreementPlan===plan;
 const paymentVerified=info?.billingStatus==='active'&&info?.planCode===info?.requestedPlan&&info?.requestedPlan===plan;
 const action=async(portal=false)=>{
  setBusy(true);setError('');
  try{
   const body:any={action:portal?'portal':'checkout',planCode:plan};if(!portal&&!agreementAlreadySigned)body.agreement=agreement;
   const r=await fetch('/api/studio/platform-billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);
   const url=d.url||d.checkoutUrl;if(!/^https:\/\/(checkout|billing)\.stripe\.com\//.test(url||''))throw Error('Stripe did not return a safe payment page.');location.assign(url);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 };
 return <main className="panel padded" style={{maxWidth:820,margin:'32px auto'}}>
  <h1>Complete your SelahFlow package signup</h1><p>Package payments go to SelahFlow LLC. Payments for your own clients use your separate connected Stripe account.</p>
  {error&&<p role="alert">{error}</p>}{!info?<p>Loading billing…</p>:<>
   <button type="button" className="outline" onClick={()=>void load().catch(e=>setError(e.message))}>Refresh payment status</button>
   <p><strong>{info.business}</strong> · Selected package: {info.requestedPlan} · Payment: {info.billingStatus}</p>
   {info.periodEnd&&<p>Last verified paid period ends: {new Date(info.periodEnd).toLocaleDateString()}.</p>}
   {paymentVerified&&info.businessStatus==='pending'&&<p role="status"><strong>Stripe payment verified.</strong> Your business page and dashboard remain private until the primary administrator approves the application.</p>}
   {paymentVerified&&info.businessStatus==='active'&&<p role="status"><strong>Signup complete.</strong> Your business workspace is active.</p>}
   {info.riskHold&&<p role="alert">This subscription needs SelahFlow billing review. You can still open Stripe to manage or cancel it.</p>}
   {info.hasSubscription&&<button className="outline" disabled={busy} onClick={()=>void action(true)}>Manage subscription · payment method / cancellation</button>}
   <p>{info.businessStatus==='active'?<a href={`/studio/${info.slug}`}>Open business dashboard</a>:<a href="/registration-status">View application status</a>} · <a href="/pricing">Compare packages</a></p>
   {!paymentVerified&&<section>
    <h2>Sign up now and pay</h2><p>Your signed agreement is required before Stripe Checkout opens. Returning from Stripe alone does not activate the package; SelahFlow waits for Stripe’s verified paid invoice.</p>
    <label>Package<select value={plan} onChange={e=>{setPlan(e.target.value);setAgreement(blankAcceptance(e.target.value));}}>{['professional','business'].map(code=><option value={code} key={code}>{PLAN_CATALOG[code as 'professional'|'business'].name} · ${(PLAN_CATALOG[code as 'professional'|'business'].monthlyCents/100).toFixed(2)}/month</option>)}</select></label>
    {agreementAlreadySigned?<p role="status">Signed services agreement received for this package.</p>:<BusinessServiceAgreement planCode={plan} value={agreement} onChange={setAgreement}/>}
    {!info.configured&&<p>Stripe package billing is awaiting platform configuration. No charge can start yet.</p>}
    <button className="primary" disabled={busy||!info.configured||info.riskHold||(!agreementAlreadySigned&&!acceptanceComplete(agreement))} onClick={()=>void action()}>{busy?'Opening Stripe…':'Make payment · $'+(PLAN_CATALOG[plan as 'professional'|'business'].monthlyCents/100).toFixed(2)+'/month'}</button>
    <p>Monthly renewal begins when you authorize payment in Stripe. Paid package access requires a verified paid invoice.</p>
   </section>}
   <p><small>Stripe Tax collection is not automatically enabled. Tax registration and configuration are separate.</small></p>
  </>}
 </main>;
}
