'use client';
import SortableTable from './sortable-table';
import {useEffect,useState} from 'react';
import {durationLabel,isTermUnit} from '../../lib/service-terms';
type Any=any;
export default function OwnerTermTracker({services,compact=false}:{services:Any[];compact?:boolean}){
 const [items,setItems]=useState<Any[]>([]),[counts,setCounts]=useState<Any[]>([]),[serviceId,setServiceId]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[start,setStart]=useState(new Date().toISOString().slice(0,10)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const plans=services.filter(s=>isTermUnit(s.durationUnit||'minutes'));
 const hasTermTracking=plans.length>0||items.length>0;
 async function load(){try{const r=await fetch('/api/studio/terms',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load service terms.');setItems(d.enrollments||[]);setCounts(d.counts||[]);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{load();},[]);
 const current=(unit:string)=>counts.filter(c=>c.duration_unit===unit).reduce((n,c)=>n+c.active,0);
 async function perform(body:unknown){setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/studio/terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to save service enrollment.');setMessage('Enrollment tracking updated.');await load();return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 if(!hasTermTracking)return null;
 return <section className="panel padded section-gap" aria-label="Long-term service tracking"><h2>Long-term service tracking</h2><p className="muted">Track customer enrollments for services lasting days, weeks, months, or years. This is manual tracking, not recurring payments or calendar bookings.</p>
 <div className="sf-term-stats"><div><b>{current('months')}</b><span>Active monthly enrollments</span></div><div><b>{current('years')}</b><span>Active annual enrollments</span></div><div><b>{items.length}</b><span>All recorded enrollments</span></div></div>
 {error&&<p role="alert" className="alert">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
 {!compact&&<>{!plans.length?<p className="muted">Create a day-, week-, month-, or year-based service in Settings to begin tracking.</p>:<form onSubmit={async e=>{e.preventDefault();if(await perform({action:'enroll',serviceId,clientName:name,clientEmail:email,startsOn:start})){setName('');setEmail('');}}}>
 <div className="sf-term-form"><label>Term service<select required value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Choose a service</option>{plans.map(s=><option value={s.id} key={s.id}>{s.name} — {durationLabel(s)}</option>)}</select></label><label>Customer name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Customer email (optional)<input type="email" maxLength={200} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Starts on<input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label></div><button className="primary section-gap" type="submit" disabled={busy}>Record service enrollment</button>
 </form>}
 <div className="table-wrap section-gap"><SortableTable><thead><tr><th>Customer</th><th>Service / term</th><th>Start</th><th>End</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.client_name}<small>{item.client_email}</small></td><td>{item.service_name}<small>{item.duration_value} {item.duration_unit}</small></td><td>{item.starts_on}</td><td>{item.ends_on}</td><td>{item.status==='active'&&item.ends_on<new Date().toISOString().slice(0,10)?'Expired':item.status}</td><td>{item.status==='active'&&<div className="sf-term-actions"><button disabled={busy} className="outline" onClick={()=>perform({action:'status',id:item.id,status:'completed'})} type="button">Complete</button><button disabled={busy} className="outline" onClick={()=>perform({action:'status',id:item.id,status:'cancelled'})} type="button">Cancel</button></div>}</td></tr>)}</tbody></SortableTable>{!items.length&&<p className="empty">No term enrollments recorded yet.</p>}</div></>}
 </section>;
}
