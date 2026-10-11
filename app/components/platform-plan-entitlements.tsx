'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,RefreshCw,ShieldCheck} from 'lucide-react';
import {PLANS} from '../../lib/plans';
import styles from '../platform-pages.module.css';

type PlanCode='free'|'professional'|'business';
type Business={id:string;name:string;slug:string;status:string;planCode:PlanCode;
 hasConnectedSubscription:boolean;planBenefits:{name:string;limits:{services:number;bookingFields:number;sessionSeries:number;membershipPlans:number}}};
type Log={business_id:string;business_name:string;previous_plan:string;new_plan:string;reason:string;created_at:string};
export default function PlatformPlanEntitlements({onChanged}:{onChanged:()=>Promise<void>}){
 const [businesses,setBusinesses]=useState<Business[]>([]),[history,setHistory]=useState<Log[]>([]);
 const [canChange,setCanChange]=useState(false),[selected,setSelected]=useState(''),[target,setTarget]=useState<PlanCode>('free');
 const [reason,setReason]=useState(''),[confirmName,setConfirmName]=useState(''),[ack,setAck]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  setLoading(true);
  try{
   const r=await fetch('/api/platform/plans',{cache:'no-store'});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to load subscription information.');
   setBusinesses(d.businesses||[]);setHistory(d.recentChanges||[]);setCanChange(d.canChange===true);
  }catch(e){setError((e as Error).message);}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const current=businesses.find(x=>x.id===selected);
 async function assign(){
  if(!current||busy)return;
  if(!window.confirm('Manually assign '+PLANS[target].name+' benefits to '+current.name+'? No payment will be collected and existing records will remain.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/platform/plans',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({businessId:current.id,planCode:target,reason,confirmName,acknowledgeNoPayment:ack})
   });
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to change business entitlements.');
   setNotice(d.message);setReason('');setConfirmName('');setAck(false);
   await load();await onChanged();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section id="plan-entitlements" className={styles.planEntitlements} aria-label="Plan benefits assignment">
  <header className={styles.planAdminHeader}>
   <div><span className={styles.planAdminEyebrow}><ShieldCheck size={15}/> PLATFORM PLAN ENTITLEMENTS</span>
    <h2>Business subscription benefits</h2>
    <p>Each business receives the limits of its assigned Free, Professional or Business plan. Only primary administrators can manually assign plan entitlements. No billing is initiated here.</p>
   </div>
   <button type="button" className={styles.planAdminRefresh} disabled={loading||busy} onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>
  </header>
  {error&&<p role="alert" className={styles.alert}>{error}</p>}
  {notice&&<p role="status" className={styles.success}>{notice}</p>}
  {loading&&!businesses.length?<p>Loading business plans…</p>:<div className={styles.planAdminGrid}>
   <div>
    <label className={styles.planAdminLabel}>Select registered business
     <select value={selected} onChange={e=>{
      const id=e.target.value;
      setSelected(id);setTarget((businesses.find(b=>b.id===id)?.planCode||'free'));
      setReason('');setConfirmName('');setAck(false);
     }}>
      <option value="">Choose a business</option>
      {businesses.map(b=><option key={b.id} value={b.id}>{b.name} · {PLANS[b.planCode]?.name||'Free'} · {b.status}</option>)}
     </select>
    </label>
    {current&&<div className={styles.planAdminCurrent}>
     <h3>{current.name}</h3>
     <p>Current plan: <strong>{current.planBenefits.name}</strong> · {current.status}</p>
     <p>Up to <b>{current.planBenefits.limits.services}</b> catalog services, <b>{current.planBenefits.limits.bookingFields}</b> booking questions, <b>{current.planBenefits.limits.sessionSeries}</b> session templates and <b>{current.planBenefits.limits.membershipPlans}</b> membership offers.</p>
     {current.hasConnectedSubscription&&<p>A Stripe subscription exists for this business; change its tier through billing management, not manual assignment.</p>}
    </div>}
    {canChange&&current&&current.status==='active'&&!current.hasConnectedSubscription&&<div className={styles.planAdminForm}>
     <label className={styles.planAdminLabel}>Assign benefits for
      <select value={target} onChange={e=>setTarget(e.target.value as PlanCode)}>
       {(Object.entries(PLANS) as [PlanCode,(typeof PLANS)[PlanCode]][]).map(([code,p])=>
        <option key={code} value={code}>{p.name} — up to {p.bookableStaff} staff, {p.limits.services} services</option>)}
      </select>
     </label>
     <label className={styles.planAdminLabel}>Reason / external authorization reference
      <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={1000}
       placeholder="Document who approved the plan assignment outside SelahFlow"/>
     </label>
     <label className={styles.planAdminLabel}>Confirm exact business name
      <input value={confirmName} onChange={e=>setConfirmName(e.target.value)} placeholder={current.name}/>
     </label>
     <label className={styles.planAdminCheck}>
      <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
      <span>I understand this only changes feature entitlements. No payment is collected and this is not a paid Stripe subscription.</span>
     </label>
     <button type="button" className={styles.button} disabled={busy||target===current.planCode||reason.trim().length<10||confirmName!==current.name||!ack}
      onClick={()=>void assign()}><CheckCircle2 size={16}/>{busy?'Applying…':'Apply verified plan benefits'}</button>
    </div>}
    {!canChange&&<p className={styles.planAdminNotice}>Only the primary platform administrator may change a plan.</p>}
   </div>
   <div className={styles.planAdminHistory}>
    <h3>Recent manual plan assignments</h3>
    {history.length?history.slice(0,12).map((h,i)=><article key={h.business_id+h.created_at+i}>
     <b>{h.business_name}</b>
     <p>{PLANS[h.previous_plan as PlanCode]?.name||h.previous_plan} <ArrowRight size={13}/> {PLANS[h.new_plan as PlanCode]?.name||h.new_plan}</p>
     <small>{new Date(h.created_at).toLocaleString()} · {h.reason}</small>
    </article>):<p>No manual subscription benefit changes have been recorded.</p>}
   </div>
  </div>}
  <p className={styles.planAdminNotice}>A change never deletes existing bookings, services, custom fields, memberships or clients. If a new plan has lower limits, existing records remain available; adding items above the new limit is restricted. One-time, admin-approved extra staff seats are counted separately.</p>
 </section>;
}
