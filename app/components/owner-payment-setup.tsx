'use client';
import OwnerTerminalSetup from './owner-terminal-setup';
import {useCallback,useEffect,useState} from 'react';
import OwnerStripePayments from './owner-stripe-payments';
import PaymentProviderComparison from './payment-provider-comparison';
type Provider='stripe'|'helcim';
type Setup={preferredProvider:Provider;activeProvider:'stripe'|null;helcim:{available:boolean;status:string;requestedAt:string|null;notice:string}};
export default function OwnerPaymentSetup(){
 const [setup,setSetup]=useState<Setup|null>(null),[provider,setProvider]=useState<Provider>('stripe');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/studio/payment-provider',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load payment setup.');setSetup(d);setProvider(d.preferredProvider);},[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 async function save(){setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/studio/payment-provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save payment choice.');setSetup(d);setProvider(d.preferredProvider);setMessage(provider==='helcim'?'Helcim preference saved and activation request recorded. Helcim payments are not active. Existing Stripe payments and subscriptions continue.':'Stripe preference saved. Complete and verify Stripe setup below to accept online payments.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="sf-owner-payment-setup">
  <h2>Payment setup</h2><p><a className="outline" href="/settings/package">Manage your SelahFlow package subscription</a></p><p>Choose a payment provider for this business and compare the costs before setting up an account.</p>
  {error&&<p role="alert" className="sf-membership-error">{error}</p>}{message&&<p role="status" className="sf-membership-success">{message}</p>}
  {!setup?<><p role="status">{error?'Payment setup could not be loaded.':'Loading payment setup…'}</p>{error&&<button type="button" className="outline" onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Reload payment setup</button>}</>:<>
   <p><strong>Current online provider:</strong> {setup.activeProvider==='stripe'?'Stripe — verified connection':'No verified payment connection'}. Existing subscriptions stay with their original provider.</p>
   <fieldset className="sf-provider-choice" disabled={busy}><legend>Preferred payment provider</legend>
    <label><input type="radio" name="payment-provider" value="stripe" checked={provider==='stripe'} onChange={()=>{setProvider('stripe');setMessage('');}}/> <span><strong>Stripe</strong><small>Online booking and membership payments after verified setup.</small></span></label>
    <label><input type="radio" name="payment-provider" value="helcim" checked={provider==='helcim'} onChange={()=>{setProvider('helcim');setMessage('');}}/> <span><strong>Helcim</strong><small>Activation request only — payment collection is pending.</small></span></label>
   </fieldset>
   <p className="muted">This choice saves your setup preference. It does not move subscriptions, connect an account or reroute checkout.</p>
   <button type="button" className="primary" disabled={busy} onClick={save}>{busy?'Saving…':provider==='helcim'?'Save Helcim choice & request activation':'Save Stripe choice'}</button>
   {provider==='helcim'&&<section className="sf-helcim-setup" aria-labelledby="sf-helcim-title"><h3 id="sf-helcim-title">Helcim setup</h3>
    <p role="status"><strong>{setup.preferredProvider==='helcim'?'Activation requested':'Not connected'}</strong> — {setup.helcim.notice}</p>
    <ol><li>Review the fee comparison below.</li><li>If Helcim fits your business, create or sign in to your own Helcim account and complete its business and bank verification.</li><li>Save your Helcim choice here to record an activation request for the SelahFlow platform administrator.</li><li>Continue using your verified Stripe connection until SelahFlow confirms Helcim activation. No payment is confirmed merely by opening Helcim.</li></ol>
    <a className="outline" href="https://www.helcim.com/" target="_blank" rel="noopener noreferrer">Open Helcim website</a><p className="muted">Opening Helcim does not link your account. Do not send API keys, passwords or bank details in support messages.</p>
   </section>}
  </>}
  <OwnerTerminalSetup/>
  <PaymentProviderComparison/>
  <section className="sf-existing-stripe-setup" aria-label="Stripe connection and commission settings"><OwnerStripePayments/></section>
 </div>;
}
