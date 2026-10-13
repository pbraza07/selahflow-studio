'use client';
import OwnerMembershipRequests from './owner-membership-requests';
import SortableTable from './sortable-table';
import RegistrationFields from './registration-fields';
import {customRegistrationFields} from '../../server/registration-questions.mjs';
import {useCallback,useEffect,useState} from 'react';
import {CalendarClock,CheckCircle2,CreditCard,ExternalLink,Plus,RefreshCw,ShieldCheck} from 'lucide-react';
import MembershipBadge from './membership-badge';
type Plan={id:string;name:string;description:string;interval:'week'|'month'|'year';priceCents:number;sessionsIncluded:number;active:boolean};
type Member={id:string;customer_name:string;customer_email:string;member_number:string|null;plan_id:string;sessions_included:number;sessions_used:number;recorded_sessions:number;history:{appointment_id:string;event_type:string;session_delta:number;created_at:string;appointment_status?:string|null}[];plan_name:string;interval_unit:string;status:string;paid_through:string|null};
type Payload={businessName:string;plans:Plan[];members:Member[];planBenefits:{name:string;limits:{membershipPlans:number}};payments:{connected:boolean;configured:boolean;ready:boolean}};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function OwnerMemberships({slug,prefill}:{slug:string;prefill?:{name:string;email:string;phone:string}|null}){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(!prefill)return;const parts=prefill.name.trim().split(/\s+/);setMemberFirst(parts[0]||'');setMemberLast(parts.slice(1).join(' '));setNewMemberEmail(prefill.email||'');setMemberPhone(prefill.phone||'');},[prefill]);
 const [manualMemberNumber,setManualMemberNumber]=useState('');
 const [memberDob,setMemberDob]=useState('');
 const [memberFirst,setMemberFirst]=useState(''),[memberLast,setMemberLast]=useState(''),[memberPhone,setMemberPhone]=useState(''),[memberAnswers,setMemberAnswers]=useState<Record<string,string|boolean>>({}),[bookingFields,setBookingFields]=useState<any[]>([]),[registrationConfig,setRegistrationConfig]=useState<any>({});
 const [renewing,setRenewing]=useState<string|null>(null),[renewPlan,setRenewPlan]=useState(''),[renewNumber,setRenewNumber]=useState('');
 const [sessionsIncluded,setSessionsIncluded]=useState(0),[newMemberName,setNewMemberName]=useState(''),[newMemberEmail,setNewMemberEmail]=useState(''),[newMemberPlan,setNewMemberPlan]=useState('');
 const [edit,setEdit]=useState<string|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[interval,setIntervalValue]=useState<'week'|'month'|'year'>('month'),[amount,setAmount]=useState('49.00');
 const load=useCallback(async()=>{
  setLoading(true);try{
   const r=await fetch('/api/studio/memberships',{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to load memberships.');
   setData(d);setError('');
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{fetch('/api/booking?slug='+encodeURIComponent(slug)).then(r=>r.json()).then(d=>{setRegistrationConfig(d.config||{});setBookingFields(customRegistrationFields(d.config||{},'membership'));}).catch(()=>{});},[slug]);
 useEffect(()=>{if(!memberDob)return;const age='U'+(new Date().getFullYear()-Number(memberDob.slice(0,4))+1);setMemberAnswers(v=>{const next={...v};for(const field of bookingFields){if(field.type==='select'&&Array.isArray(field.options)&&field.options.some((o:string)=>/^U\d{1,2}$/i.test(o))){const match=field.options.find((o:string)=>o.toUpperCase()===age.toUpperCase());if(match)next[field.id]=match;}}return next;});},[memberDob,bookingFields]);
 async function post(action:string,body:Record<string,unknown>={}){
  const r=await fetch('/api/studio/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to update memberships.');return d;
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(amount))throw Error('Enter a valid membership price in USD.');
   const priceCents=Math.round(Number(amount)*100);
   await post('save',{...(edit?{id:edit}:{}),name,description,interval,priceCents,sessionsIncluded,active:true});
   setEdit(null);setName('');setDescription('');setAmount('49.00');setSessionsIncluded(0);setMessage('Membership plan saved. Customers can now view it when payment setup is ready.');await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function reorderPlan(id:string,offset:number){if(!data)return;const ids=data.plans.map(p=>p.id),i=ids.indexOf(id),j=i+offset;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];setBusy(true);try{await post('reorderPlans',{ids});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function toggle(plan:Plan){
  setBusy(true);setError('');try{await post('toggle',{id:plan.id,active:!plan.active});await load();setMessage('Membership availability updated. Existing paid subscriptions are unchanged.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function loadExistingMember(){
  if(!manualMemberNumber.trim()||!memberDob){setError('Enter membership ID and date of birth.');return;}
  setBusy(true);setError('');try{
   const r=await fetch('/api/public/member-lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,memberNumber:manualMemberNumber,dateOfBirth:memberDob})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Member not found.');
   setMemberFirst(d.firstName||'');setMemberLast(d.lastName||'');setNewMemberEmail(d.email||'');setMemberPhone(d.phone||'');setMemberAnswers(d.customAnswers||{});
   setMessage('Existing member loaded. ID '+d.memberNumber+' will be reused.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function assignMember(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const r=await post('assignMember',{name:(memberFirst.trim()+' '+memberLast.trim()).trim(),firstName:memberFirst,lastName:memberLast,email:newMemberEmail,dateOfBirth:memberDob,phone:memberPhone,customAnswers:memberAnswers,planId:newMemberPlan,memberNumber:''});setMessage(r.existingMember?'Existing player found. Reuse membership ID '+r.memberNumber+'. No duplicate ID was created.':'Member assigned. Number: '+r.memberNumber+'. Payment remains pending until verified.');setNewMemberName('');setMemberFirst('');setMemberLast('');setMemberDob('');setMemberPhone('');setMemberAnswers({});setNewMemberEmail('');setManualMemberNumber('');await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function confirmPayment(m:Member,renew=false){
  if(busy)return;
  if(renew&&(!renewPlan||renewNumber.trim().toUpperCase()!==String(m.member_number||'').toUpperCase())){setError('Select a package and enter the correct player membership number.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const d=await post(renew?'renewMembership':'confirmManualPayment',{id:m.id,requestId:crypto.randomUUID(),...(renew?{memberNumber:renewNumber.trim().toUpperCase(),planId:renewPlan}:{})});
   setMessage((renew?'Membership renewed: ':'Payment confirmed: ')+d.credited+' credits added.');setRenewing(null);setRenewNumber('');setRenewPlan('');await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function deleteMember(m:Member){
  if(busy)return;
  const confirmation=window.prompt('Delete '+m.customer_name+' ('+(m.member_number||'no number')+') and their membership history? This cannot be undone. Type DELETE to confirm:');
  if(confirmation!=='DELETE')return;
  setBusy(true);setError('');setMessage('');
  try{await post('deleteMember',{id:m.id});setMessage('Member deleted.');await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function editMember(m:Member){
  const selected=window.prompt('Membership plan ID (choose from current package IDs):',m.plan_id);
  if(!selected)return;
  const included=window.prompt('Sessions included in membership:',String(m.sessions_included));
  if(included===null)return;
  const used=window.prompt('Sessions already taken:',String(m.sessions_used));
  if(used===null)return;
  setBusy(true);setError('');
  try{await post('updateMember',{id:m.id,planId:selected,sessionsIncluded:Number(included),sessionsUsed:Number(used)});await load();setMessage('Membership updated.');}
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
 const planForEdit=(plan:Plan)=>{setEdit(plan.id);setName(plan.name);setDescription(plan.description);setIntervalValue(plan.interval);setAmount((plan.priceCents/100).toFixed(2));setSessionsIncluded(plan.sessionsIncluded||0);};
 const clear=()=>{setEdit(null);setName('');setDescription('');setIntervalValue('month');setAmount('49.00');setSessionsIncluded(0);};
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
     {data?.plans.length?<div className="sf-owner-plan-list">{data.plans.map((p,i)=><article key={p.id}>
      <div><strong>{p.name}</strong><p>{p.description||'Recurring membership'}</p>
       <span className="sf-plan-status">{p.active?'Available to new customers':'Unavailable for new signups'}</span></div>
      <b>{money(p.priceCents)} / {p.interval}</b>
      <div className="sf-plan-actions"><button type="button" className="outline" disabled={busy||i===0} onClick={()=>void reorderPlan(p.id,-1)}>Move up</button><button type="button" className="outline" disabled={busy||i===data.plans.length-1} onClick={()=>void reorderPlan(p.id,1)}>Move down</button><button type="button" className="outline" disabled={busy} onClick={()=>planForEdit(p)}>Edit</button>
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
      <label>Sessions included per membership<input type="number" min={0} max={100000} value={sessionsIncluded} onChange={e=>setSessionsIncluded(Number(e.target.value))}/></label><p>Package price: <b>{/^\d+(?:\.\d+)?$/.test(amount)?money(Math.round(Number(amount)*100)):'the set price'}</b> per {interval}. Public registrations are requests; confirm payment separately to credit sessions.</p>
      <button type="submit" className="primary" disabled={busy||!name.trim()}>{busy?'Saving…':edit?'Save membership changes':'Create membership plan'}</button>
      {edit&&<button type="button" className="outline" onClick={clear}>Cancel editing</button>}
     </form>
    </section>
   </div>
   <OwnerMembershipRequests onChanged={()=>void load()}/><section className="sf-owner-member-history"><h3>Assign a member to a membership package</h3><p className="muted">Member numbers are unique per business and generated automatically if left blank. Edit membership questions and their order under Business Settings → Booking & membership questions. Added questions count toward your plan allowance.</p><form onSubmit={assignMember} style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><RegistrationFields config={registrationConfig} form="membership" values={{memberNumber:manualMemberNumber,dateOfBirth:memberDob,firstName:memberFirst,lastName:memberLast,email:newMemberEmail,phone:memberPhone}} answers={memberAnswers}
 onValue={(id,value)=>{if(id==='memberNumber')setManualMemberNumber(value.toUpperCase());else if(id==='dateOfBirth')setMemberDob(value);else if(id==='firstName')setMemberFirst(value);else if(id==='lastName')setMemberLast(value);else if(id==='email')setNewMemberEmail(value);else if(id==='phone')setMemberPhone(value);}}
 onAnswer={(id,value)=>setMemberAnswers(v=>({...v,[id]:value}))}
 identityHelp={<><p>Returning player? Enter the ID and birth date, then load saved details. New players receive a permanent six-character ID.</p><button type="button" className="outline" disabled={busy||!manualMemberNumber||!memberDob} onClick={()=>void loadExistingMember()}>Load existing member</button></>}/>
 <label>Membership package<select required value={newMemberPlan} onChange={e=>setNewMemberPlan(e.target.value)}><option value="">Choose package</option>{data?.plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="submit" className="primary" disabled={busy}>Assign member</button></form><div className="sf-owner-memberships-title"><h3>Member enrollments</h3><span>{data?.members?.length||0} recent members</span></div>
    {data?.members?.length?<div className="sf-owner-membership-scroll"><SortableTable><thead><tr><th>Customer / Member ID</th><th>Plan</th><th>Sessions used</th><th>Payment status / actions</th></tr></thead>
     <tbody>{data.members.map(m=><tr key={m.id}><td data-sort-value={m.customer_name}><span style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><b>{m.customer_name}</b><MembershipBadge memberNumber={m.member_number} membershipName={m.plan_name} membershipStatus={m.status} sessionsIncluded={m.sessions_included} sessionsUsed={m.sessions_used}/></span><small>{m.customer_email}</small><details  style={{border:'1px solid #ddd',borderRadius:10,padding:12}}><summary><span style={{display:'inline-flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><strong>{m.customer_name}</strong><MembershipBadge memberNumber={m.member_number} membershipName={m.plan_name} membershipStatus={m.status} sessionsIncluded={m.sessions_included} sessionsUsed={m.sessions_used}/></span> · Membership and attendance history</summary><div style={{marginTop:10}}>{(m.history||[]).length?(m.history||[]).map((h,i)=><p key={i} style={{margin:'6px 0'}}>{new Date(h.created_at).toLocaleString('en-US')} · {h.event_type==='payment_confirmed'?'Membership started / renewed · +'+h.session_delta+' credits':h.event_type==='session_used'?(h.appointment_status==='No-show'?'No-show · 1 membership session deducted':h.appointment_status==='Checked in'?'Checked in · 1 membership session deducted':'Completed visit · 1 membership session deducted'):h.event_type+' · '+h.session_delta} · {h.appointment_id}</p>):<p>No membership activity yet.</p>}</div></details></td><td>{m.plan_name}{m.status==='active'&&m.sessions_included<=m.sessions_used&&<small style={{color:'#8b5412',fontWeight:700}}>Package exhausted · ID-only badge until renewed</small>}</td><td data-sort-value={m.sessions_used}>{m.sessions_used}/{m.sessions_included} <small>({m.recorded_sessions||0} check-in / no-show / completion session deductions recorded)</small> <button type="button" className="outline" disabled={busy} onClick={()=>void editMember(m)}>Edit</button> <button type="button" className="outline" disabled={busy} onClick={()=>void deleteMember(m)}>Delete member</button></td>
      <td><span className={'sf-member-status '+(m.status==='active'&&m.sessions_included>m.sessions_used?'active':'')}>{m.status==='active'&&m.sessions_included<=m.sessions_used?'Sessions exhausted · regular player':m.status.replaceAll('_',' ')}</span><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{m.status==='active'?<button type="button" className="outline" disabled={busy} onClick={()=>{setRenewing(renewing===m.id?null:m.id);setRenewPlan(m.plan_id);setRenewNumber('');}}>Renew membership</button>:<button type="button" className="outline" disabled={busy} onClick={()=>void confirmPayment(m,false)}>Confirm membership payment</button>}</div><small>Remaining: {Math.max(0,m.sessions_included-m.sessions_used)} · Activity: {m.history?.length||0} entries</small>{renewing===m.id&&<div style={{display:'grid',gap:8,marginTop:8}}><label>Renewal package<select value={renewPlan} onChange={e=>setRenewPlan(e.target.value)}>{data?.plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {p.sessionsIncluded} sessions</option>)}</select></label><label>Confirm player number<input value={renewNumber} onChange={e=>setRenewNumber(e.target.value.toUpperCase())} placeholder={m.member_number||'Member number'}/></label><button type="button" className="primary" disabled={busy||!renewPlan||renewNumber.trim().toUpperCase()!==String(m.member_number||'').toUpperCase()} onClick={()=>void confirmPayment(m,true)}>Confirm renewal</button></div>}</td>
     </tr>)}</tbody></SortableTable></div>:<p className="sf-membership-empty">Customer memberships will appear here when payment enrollment begins.</p>}
    <p className="muted">Changing the price of a plan affects future signups only; existing Stripe subscriptions retain their original recurring price. This is separate from appointment bookings.</p>
   </section>
  </>}
 </section>;
}
