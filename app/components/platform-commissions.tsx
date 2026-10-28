'use client';
import {useEffect,useState} from 'react';
import styles from '../platform-pages.module.css';
type Business={id:string;name:string;slug:string;status:string;paymentReady:boolean;commissions:{bookingEnabled:boolean;membershipEnabled:boolean;acceptedAt:string|null;totals:{collected_cents:number;refunded_cents:number}[]}};
type StripeSetup={ready:boolean;reason:string};
export function BusinessCommissionControls({business,stripe,busy,onChange}:{business:Business;stripe:StripeSetup|null;busy:boolean;onChange:(kind:'booking'|'membership',enabled:boolean)=>void}){
 const reason=business.status!=='active'?'This business must be active before enabling commissions.':!business.commissions.acceptedAt?'The business owner must accept the commission terms in Business settings → Stripe payments before enabling collection.':!stripe?.ready?'Complete platform Stripe commission setup before enabling collection.':!business.paymentReady?'Complete and verify this business’s Stripe account before enabling collection.':'';
 return <div>
  {(['booking','membership'] as const).map(kind=>{const enabled=business.commissions[kind==='booking'?'bookingEnabled':'membershipEnabled'];return <label key={kind} style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0'}}><input type="checkbox" style={{accentColor:'#168647',width:20,height:20,flexShrink:0}} checked={enabled} disabled={busy||(!enabled&&!!reason)} onChange={e=>onChange(kind,e.target.checked)} aria-label={'Enable 10% first-time '+kind+' commission for '+business.name}/><span>10% on first paid {kind==='booking'?'booking':'membership'} · <strong>{enabled?'Enabled':'Off'}</strong></span></label>;})}
  {reason&&<p>{reason} Enabled commissions can still be switched off.</p>}
 </div>;
}
export default function PlatformCommissions(){
 const [businesses,setBusinesses]=useState<Business[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(''),[stripe,setStripe]=useState<StripeSetup|null>(null),[notice,setNotice]=useState('');
 async function load(){const r=await fetch('/api/platform/commissions',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setBusinesses(d.businesses);setStripe(d.stripe);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function post(body:object,key:string,message:string){setBusy(key);setError('');setNotice('');try{const r=await fetch('/api/platform/commissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);await load();setNotice(message);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <section className={styles.card} id="platform-commissions"><h2>First-time customer commissions · 10%</h2>
  <p>Enable or disable booking and membership commissions separately for each business. Changes save immediately and apply to newly created checkouts. Business fee terms and Stripe verification are required before enabling collection. Repeat bookings and membership renewals have no additional commission.</p>
  <p>Previously opened checkouts retain their quoted fee. Expire an unpaid checkout in the business payment settings before replacing it.</p>
  {stripe&&<p role="status">Stripe commission setup: {stripe.ready?'Ready':'Setup required'} · {stripe.reason}</p>}
  {stripe&&!stripe.ready&&<button type="button" className={styles.button} disabled={!!busy} onClick={()=>void post({action:'configureWebhooks'},'webhooks','Stripe commission setup refreshed.')}>Configure commission webhook events</button>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {businesses.map(b=><div key={b.id} style={{borderBottom:'1px solid #d5e2de',padding:'12px 0'}}><h3>{b.name}</h3>
   <p>{b.commissions.acceptedAt?'Business terms accepted':'Business terms not yet accepted'} · Stripe account: {b.paymentReady?'Ready':'Setup required'}</p>
   <BusinessCommissionControls business={b} stripe={stripe} busy={!!busy} onChange={(kind,enabled)=>void post({action:'setEnabled',businessId:b.id,kind,enabled},b.id,b.name+': '+kind+' commission '+(enabled?'enabled.':'disabled.'))}/>
   <p>Recorded net commissions: ${(b.commissions.totals.reduce((n,t)=>n+t.collected_cents-t.refunded_cents,0)/100).toFixed(2)}</p>
   <a href={'/studio/'+b.slug+'?stripe=connected'}>Business payment settings</a>
   {(b.commissions.bookingEnabled||b.commissions.membershipEnabled)&&<button type="button" className={styles.secondary} disabled={!!busy} onClick={()=>void post({action:'pause',businessId:b.id},b.id,b.name+': both commissions disabled.')}>Disable both commissions</button>}
  </div>)}
 </section>;
}
