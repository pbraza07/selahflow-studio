'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarClock,CheckCircle2,CreditCard,ExternalLink,Plus,RefreshCw,ShieldCheck} from 'lucide-react';
type Plan={id:string;name:string;description:string;interval:'week'|'month'|'year';priceCents:number;active:boolean};
type Member={id:string;customer_name:string;customer_email:string;plan_name:string;interval_unit:string;status:string;paid_through:string|null};
type Payload={businessName:string;plans:Plan[];members:Member[];planBenefits:{name:string;limits:{membershipPlans:number}};payments:{connected:boolean;configured:boolean;ready:boolean}};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function OwnerMemberships({slug}:{slug:string}){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [edit,setEdit]=useState<string|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[interval,setIntervalValue]=useState<'week'|'month'|'year'>('month'),[amount,setAmount]=useState('49.00');
 const load=useCallback(async()=>{
  setLoading(true);try{
   const r=await fetch('/api/studio/memberships',{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to load memberships.');
   setData(d);setError('');
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function post(action:string,body:Record<string,unknown>={}){
  const r=await fetch('/api/studio/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to update memberships.');return d;
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(amount))throw Error('Enter a valid membership price in USD.');
   const priceCents=Math.round(Number(amount)*100);
   await post('save',{...(edit?{id:edit}:{}),name,description,interval,priceCents,active:true});
   setEdit(null);setName('');setDescription('');setAmount('49.00');setMessage('Membership plan saved. Customers can now view it when payment setup is ready.');await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function toggle(plan:Plan){
  setBusy(true);setError('');try{await post('toggle',{id:plan.id,active:!plan.active});await load();setMessage('Membership availability updated. Existing paid subscriptions are unchanged.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function connect(){
  setBusy(true);setError('');setMessage('');
  try{
   const result=await post('connect');
   const url=new URL(result.url);
   if(url.protocol!=='https:'||!url.hostname.endsWith('.stripe.com'))throw Error('Unexpected payment onboarding destination.');
   window.location.assign(url.toString());
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 async function verify(){
  setBusy(true);setError('');try{const r=await post('verify');await load();setMessage(r.ready?'Stripe is connected and ready to collect membership payments.':'Stripe is connected but still needs additional account verification.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const planForEdit=(plan:Plan)=>{setEdit(plan.id);setName(plan.name);setDescription(plan.description);setIntervalValue(plan.interval);setAmount((plan.priceCents/100).toFixed(2));};
 const clear=()=>{setEdit(null);setName('');setDescription('');setIntervalValue('month');setAmount('49.00');};
 return <section className="sf-owner-memberships">
  <header className="sf-owner-memberships-head"><div><span className="sf-membership-kicker">SELAHFLOW · OWNER WORKSPACE</span><h2>Membership plans & payments</h2>
   <p>Sell weekly, monthly and yearly recurring memberships for your business. New memberships activate only after advance payment is verified.</p></div>
   <a className="outline sf-membership-owner-link" href={'/membership/'+encodeURIComponent(slug)} target="_blank" rel="noopener noreferrer">Customer signup <ExternalLink size={15}/></a>
  </header>
  {error&&<p className="sf-membership-error" role="alert">{error}</p>}
  {message&&<p className="sf-membership-success" role="status">{message}</p>}
  {loading?<p>Loading membership management…</p>:<>
   <section className="sf-membership-merchant">
    <div><ShieldCheck size={23}/><div><strong>Secure membership payments</strong>
     <p>{!data?.payments.configured?'Platform setup required: Stripe API and Connect webhook secrets have not been configured.':
      data?.payments.ready?'Stripe connected · accepting advance membership payments':
      data?.payments.connected?'Stripe connected · verify onboarding and charges':
      'Connect your own Stripe account to collect membership fees directly.'}</p></div></div>
    <div className="sf-membership-actions">
     {data?.payments.connected?<button type="button" className="outline" onClick={verify} disabled={busy}><RefreshCw size={16}/> Verify Stripe</button>:null}
     <button type="button" className="primary" onClick={connect} disabled={busy||!data?.payments.configured}>
      <CreditCard size={16}/>{data?.payments.connected?'Complete Stripe setup':'Connect Stripe payments'}</button>
    </div>
    <small>Each business uses its own connected account. Stripe's hosted Checkout processes payment details; customer membership status remains pending until a verified payment webhook confirms the charge.</small>
   </section>
   <p className="sf-membership-plan-allowance" role="status">
   <strong>{data?.planBenefits.name||'Free'} subscription:</strong> {(data?.plans||[]).filter(x=>x.active).length}/{data?.planBenefits.limits.membershipPlans||2} active membership offers. Existing members and plans remain preserved if your subscription changes. <a href="/pricing">Compare SelahFlow plans ↗</a>
  </p>
  <div className="sf-owner-membership-layout">
    <section className="sf-owner-membership-plans"><div className="sf-owner-memberships-title"><h3>Available membership plans</h3><button type="button" className="outline" disabled={!!data&&data.plans.filter(x=>x.active).length>=data.planBenefits.limits.membershipPlans} title="Plan entitlement limit applies to new active membership offers" onClick={clear}><Plus size={16}/> New plan</button></div>
     {data?.plans.length?<div className="sf-owner-plan-list">{data.plans.map(p=><article key={p.id}>
      <div><strong>{p.name}</strong><p>{p.description||'Recurring membership'}</p>
       <span className="sf-plan-status">{p.active?'Available to new customers':'Unavailable for new signups'}</span></div>
      <b>{money(p.priceCents)} / {p.interval}</b>
      <div className="sf-plan-actions"><button type="button" className="outline" disabled={busy} onClick={()=>planForEdit(p)}>Edit</button>
       <button type="button" className="outline" disabled={busy} onClick={()=>void toggle(p)}>{p.active?'Hide plan':'Publish plan'}</button></div>
     </article>)}</div>:<p className="sf-membership-empty">No membership plans yet. Create your first weekly, monthly or yearly option below.</p>}
    </section>
    <section className="sf-owner-membership-form"><h3>{edit?'Edit membership plan':'Create membership plan'}</h3>
     <form onSubmit={save}>
      <label>Membership name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Monthly Training Membership"/></label>
      <label>What is included?<textarea maxLength={1000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe benefits, service access and restrictions"/></label>
      <div className="sf-membership-field-row"><label>Billing frequency<select value={interval} onChange={e=>setIntervalValue(e.target.value as typeof interval)}>
       <option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
       <label>Price in USD<input type="number" min="1" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>
      <p>Members pay <b>{/^\d+(?:\.\d+)?$/.test(amount)?money(Math.round(Number(amount)*100)):'the set price'}</b> immediately, and then automatically every {interval}. No free trial or deferred first payment.</p>
      <button type="submit" className="primary" disabled={busy||!name.trim()}>{busy?'Saving…':edit?'Save membership changes':'Create membership plan'}</button>
      {edit&&<button type="button" className="outline" onClick={clear}>Cancel editing</button>}
     </form>
    </section>
   </div>
   <section className="sf-owner-member-history"><div className="sf-owner-memberships-title"><h3>Member enrollments</h3><span>{data?.members?.length||0} recent members</span></div>
    {data?.members?.length?<div className="sf-owner-membership-scroll"><table><thead><tr><th>Customer</th><th>Plan</th><th>Payment status</th><th>Paid through</th></tr></thead>
     <tbody>{data.members.map(m=><tr key={m.id}><td><b>{m.customer_name}</b><small>{m.customer_email}</small></td><td>{m.plan_name}</td>
      <td><span className={'sf-member-status '+(m.status==='active'?'active':'')}>{m.status.replaceAll('_',' ')}</span></td><td>{m.paid_through?new Date(m.paid_through).toLocaleDateString('en-US'):'Not yet paid'}</td>
     </tr>)}</tbody></table></div>:<p className="sf-membership-empty">Customer memberships will appear here when payment enrollment begins.</p>}
    <p className="muted">Changing the price of a plan affects future signups only; existing Stripe subscriptions retain their original recurring price. This is separate from appointment bookings.</p>
   </section>
  </>}
 </section>;
}
