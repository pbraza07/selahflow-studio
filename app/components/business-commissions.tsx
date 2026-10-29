'use client';
import {useEffect,useState} from 'react';
type Row={id:string;kind:string;source_id:string|null;status:string;gross_cents:number;fee_cents:number;refunded_fee_cents:number;created_at:string};
type Settings={stripeSetup?:{ready:boolean;reason:string};bookingEnabled:boolean;membershipEnabled:boolean;acceptedAt:string|null;ratePercent:number;recent:Row[];totals:{kind:string;paid_count:number;collected_cents:number;refunded_cents:number}[]};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function BusinessCommissions(){
 const [data,setData]=useState<Settings|null>(null),[accept,setAccept]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){const r=await fetch('/api/studio/commissions',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function post(body:object){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/studio/commissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);await load();setAccept(false);setNotice('Commission settings updated.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section aria-labelledby="sf-commission-title" className="sf-business-commissions" style={{marginTop:24,paddingTop:20,borderTop:'1px solid #d5e2de'}}>
  <h3 id="sf-commission-title">First-time customer commissions</h3>
  <p>Two independent one-time fees: the greater of 10% or $5 on a client’s first eligible paid booking and, separately, their first paid membership at this business. For payments of $5 or less, the fee is capped at the payment amount minus $0.01.</p>
  {error&&<p role="alert" className="sf-membership-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!data?<p>Loading commission settings…</p>:<>
   {data.stripeSetup&&!data.stripeSetup.ready&&<p role="status">Platform Stripe setup required: {data.stripeSetup.reason}</p>}
   {!data.acceptedAt&&<p role="status">New commissions are paused until you accept the revised 10% or $5 minimum terms. Activation is controlled by the platform administrator.</p>}
   <p><strong>Booking: {data.bookingEnabled?'Enabled · 10% or $5 minimum once':'Off'}</strong> · <strong>Membership: {data.membershipEnabled?'Enabled · 10% or $5 minimum once':'Off'}</strong></p>
   <details><summary>Review the 10% or $5 minimum fee terms</summary><ul>
    <li>The business pays the fee from its Stripe proceeds. It is not added to the client’s price. Stripe processing costs remain separate.</li>
    <li>Booking and membership eligibility are tracked separately for each verified client identity at each business, across your own links, referrals and the marketplace.</li>
    <li>Booking fees use the eligible service amount after discounts; separately recorded products, taxes and tips are excluded. Membership fees use the first paid membership amount after discounts.</li>
    <li>Repeat bookings, membership renewals, free or membership-covered sessions carry no new commission. Existing booking clients at activation and previously paid memberships are protected from retrospective fees.</li>
    <li>Stripe refunds trigger a proportional application-fee refund. A refunded first purchase does not create another first-time fee.</li>
    <li>Changes apply to newly created checkouts. Previously opened checkouts retain their quoted fee; expire an unpaid checkout below before replacing it.</li>
    <li>Minimal commission accounting records are retained when a client is deleted. Unique IDs remain reusable; the fee history belongs to the client identity.</li>
   </ul></details>
   {!data.acceptedAt&&<label style={{display:'flex',alignItems:'flex-start',gap:10,margin:'12px 0'}}><input type="checkbox" style={{accentColor:'#168647'}} checked={accept} onChange={e=>setAccept(e.target.checked)} disabled={busy}/>I am authorized for this business and accept the 10% or $5 minimum commission terms above.</label>}
   <button type="button" className="primary" disabled={busy||!!data.acceptedAt||!accept} onClick={()=>void post({action:'save',acceptTerms:accept})}>{busy?'Saving…':'Accept commission terms'}</button>
   <p className="muted">You can accept the fee terms while both commissions remain off. The primary platform administrator can then enable either condition once Stripe is ready. Only the platform administrator can enable or disable commissions.</p>
   <h4>Commission activity</h4>
   {data.totals.map(t=><p key={t.kind}>{t.kind==='booking'?'Bookings':'Memberships'}: {t.paid_count} paid · collected {money(t.collected_cents)} · refunded {money(t.refunded_cents)} · recorded net {money(t.collected_cents-t.refunded_cents)}</p>)}
   {!data.recent.length?<p>No commission checkouts yet.</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th>Type / created</th><th>Status</th><th>Payment</th><th>Fee / refunded</th><th>Action</th></tr></thead><tbody>{data.recent.map(r=><tr key={r.id}><td>{r.kind}<br/>{new Date(r.created_at).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern</td><td>{r.status==='reserved'?'Awaiting payment':r.status}</td><td>{money(r.gross_cents)}</td><td>{money(r.fee_cents)} / {money(r.refunded_fee_cents)}</td><td>{r.status==='reserved'&&<button type="button" className="outline" disabled={busy} onClick={()=>void post({action:'expire',id:r.id})}>Expire unpaid checkout</button>}</td></tr>)}</tbody></table></div>}
  </>}
 </section>;
}
