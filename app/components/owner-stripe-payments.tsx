'use client';
import {useCallback,useEffect,useState} from 'react';
import {CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';

type PaymentStatus={configured:boolean;connected:boolean;ready:boolean};
export default function OwnerStripePayments(){
 const [payments,setPayments]=useState<PaymentStatus|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  const response=await fetch('/api/studio/memberships',{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Unable to load Stripe payment settings.');
  setPayments(data.payments);
 },[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 async function post(action:'connect'|'verify'){
  const response=await fetch('/api/studio/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Unable to update Stripe payment settings.');
  return data;
 }
 async function connect(){
  setBusy(true);setError('');setMessage('');
  try{
   const result=await post('connect'),url=new URL(result.url);
   if(url.protocol!=='https:'||!url.hostname.endsWith('.stripe.com'))throw Error('Unexpected payment onboarding destination.');
   window.location.assign(url.toString());
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 async function verify(){
  setBusy(true);setError('');setMessage('');
  try{
   const result=await post('verify');await load();
   setMessage(result.ready?'Stripe is connected and ready to collect payments.':'Stripe is connected but still needs additional account verification.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="sf-owner-stripe-payments">
  <h2><ShieldCheck size={23} aria-hidden="true"/> Business Stripe payments</h2>
  <p>Connect this business to Stripe to receive service and membership payments.</p>
  {error&&<p className="sf-membership-error" role="alert">{error}</p>}
  {message&&<p className="sf-membership-success" role="status">{message}</p>}
  {!payments?<p role="status">{error?'Payment settings could not be loaded.':'Loading Stripe payment settings…'}</p>:<>
   <p role="status">{!payments.configured?'Platform setup required: ask the platform administrator to configure the Stripe API key and Connect webhook signing secret.':payments.ready?'Stripe connected · ready to accept payments':payments.connected?'Stripe connected · verify onboarding and payment readiness':'Connect your business Stripe account to start accepting payments.'}</p>
   <div className="button-row">
    {payments.connected&&<button type="button" className="outline" onClick={verify} disabled={busy||!payments.configured}><RefreshCw size={16}/> Verify Stripe</button>}
    {<button type="button" className="primary" onClick={connect} disabled={busy||!payments.configured}><CreditCard size={16}/>{payments.connected?'Complete Stripe setup':'Connect Stripe payments'}</button>}
   </div>
  </>}
  <p className="muted">Each business uses its own connected account. Enter business and bank details only on Stripe’s secure onboarding page. Server API keys are managed by the platform administrator.</p>
  <p className="muted">Stripe connection changes take effect directly; Save business settings is not required. Manage membership plans and recurring billing in Memberships. Payment status updates after verified Stripe events.</p>
  {error&&<button type="button" className="outline" disabled={busy} onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Reload payment settings</button>}
 </div>;
}
