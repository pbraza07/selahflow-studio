'use client';
import {useCallback,useEffect,useState} from 'react';
import {CreditCard,RefreshCw,ShieldCheck} from 'lucide-react';

type PaymentStatus={configured:boolean;connected:boolean;ready:boolean};
export default function OwnerStripePayments(){
 const [payments,setPayments]=useState<PaymentStatus|null>(null);
 const [helpOpen,setHelpOpen]=useState(false);
 const [onboardingUrl,setOnboardingUrl]=useState('');
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
  setBusy(true);setError('');setMessage('');setOnboardingUrl('');
  try{
   const result=await post('connect'),url=new URL(result.url);
   if(url.protocol!=='https:'||!url.hostname.endsWith('.stripe.com')||url.username||url.password||url.port)throw Error('Unexpected payment onboarding destination.');
   setOnboardingUrl(url.toString());
   window.location.assign(url.toString());
   setBusy(false);
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
  <div className="sf-stripe-settings-header"><h2><ShieldCheck size={23} aria-hidden="true"/> Business Stripe payments</h2><button type="button" className="outline" aria-expanded={helpOpen} aria-controls="sf-stripe-setup-help" onClick={()=>setHelpOpen(open=>!open)}>Help: set up Stripe</button></div>
  <section id="sf-stripe-setup-help" className="sf-stripe-setup-help" hidden={!helpOpen} aria-labelledby="sf-stripe-help-title">
   <h3 id="sf-stripe-help-title">Set up your business Stripe account</h3>
   <p>Start here in SelahFlow. Stripe securely collects your business, identity and bank information.</p>
   <ol>
    <li><strong>Confirm your business.</strong> Make sure you are in the correct business workspace, then open Settings → Stripe payments.</li>
    <li><strong>Start onboarding.</strong> Select Connect Stripe payments. If you already started, select Complete Stripe setup to resume. You will be redirected to Stripe.</li>
    <li><strong>Follow Stripe’s account prompts.</strong> Use an email address you control for this business. If Stripe offers sign-in or reuse of existing business details, follow the options shown.</li>
    <li><strong>Complete business verification.</strong> Have your legal business name, business type, address, tax details, website or service description, representative details and payout bank information available. Stripe tells you which information and documents are required.</li>
    <li><strong>Return and verify.</strong> Finish Stripe’s steps and return to this page. Select Verify Stripe. Your status should show “Stripe connected · ready to accept payments” when payment acceptance is enabled. Returning to SelahFlow alone does not confirm approval.</li>
    <li><strong>Manage your payments.</strong> Create membership plans and send member payment invitations in Memberships. Eligible service payments use the same business Stripe connection. A ready connection does not mean a customer has paid; SelahFlow updates payment status after Stripe confirms payment.</li>
   </ol>
   <h3>If setup is incomplete</h3>
   <ul>
    <li><strong>Platform setup required or a disabled Connect button:</strong> contact the SelahFlow platform administrator. Business owners do not need to configure server API keys or webhooks.</li>
    <li><strong>An expired or interrupted Stripe page:</strong> return here and select Complete Stripe setup to open a fresh secure onboarding link.</li>
    <li><strong>Additional verification required:</strong> complete the outstanding requests in Stripe, then return and select Verify Stripe again. Stripe may need time to review your information.</li>
    <li><strong>Stripe cannot find an existing connection:</strong> contact the platform administrator before creating another account or attempting another payment.</li>
   </ul>
   <p>Enter sensitive details only on Stripe’s secure pages. Do not share passwords, bank details or secret keys in support messages. Each business completes its own setup.</p>
   <button type="button" className="outline" onClick={()=>setHelpOpen(false)}>Close setup help</button>
  </section>
  <p>Connect this business to Stripe to receive service and membership payments.</p>
  {error&&<p className="sf-membership-error" role="alert">{error}</p>}
  {onboardingUrl&&<p role="status">Opening Stripe’s secure setup page… If you stay here, <a href={onboardingUrl} referrerPolicy="no-referrer">Continue to Stripe</a>. If the link has expired, select Complete Stripe setup again.</p>}
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
