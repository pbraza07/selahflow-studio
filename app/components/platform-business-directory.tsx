'use client';
import {useState} from 'react';
import styles from '../platform-pages.module.css';
import {BUSINESS_INDUSTRIES} from '../../lib/business-options';
import {googleMapsDirections,displayBusinessAddress} from '../../lib/maps';

export type BusinessSummary={id:string;slug:string;name:string;industry:string;description?:string;city:string;region:string;status:string;is_listed:boolean;created_at:string;archived_at?:string|null;restored_at?:string|null;owner_email:string;plan_code:string;appointment_count:number};
type Client={name:string;email:string;visits:number;lastDate:string};
type Appointment={id:string;date:string;start:number;duration:number;status:string;customerName:string;customerEmail:string;customerPhone:string;services:string[];quotedPrice:number;channel:string};
type Term={id:string;service_name:string;duration_value:number;duration_unit:string;client_name:string;starts_on:string;ends_on:string;status:string};
type Detail={business:{id:string;slug:string;name:string;industry:string;description:string;businessModel:string;ownerEmail:string;city:string;region:string;address:string;phone:string;status:string;isListed:boolean;plan:string;subscriptionStatus:string;createdAt:string;services:{id:string;name:string;type:string;durationUnit:string;durationValue?:number;duration:number;price:number|null}[];team:{name:string;role:string}[]};
history:{totalAppointments:number;uniqueClients:number;appointments:Appointment[];clients:Client[]};
termEnrollments?:Term[];historyLimit:number};
const readable=(industry:string)=>BUSINESS_INDUSTRIES.find(([id])=>id===industry)?.[1]||industry.replace(/-/g,' ');
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const time=(minute:number)=>Number.isFinite(minute)?String(Math.floor(minute/60)%12||12)+':'+String(minute%60).padStart(2,'0')+(minute<720?' AM':' PM'):'';

export default function PlatformBusinessDirectory({businesses}:{businesses:BusinessSummary[]}){
 const [chosen,setChosen]=useState(''),[detail,setDetail]=useState<Detail|null>(null),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const listed=businesses.filter(b=>b.status==='active');
 const shown=businesses.filter(b=>(filter==='all'||filter==='listed'&&b.status==='active'||filter==='pending'&&b.status==='pending'||filter==='other'&&!['pending','active'].includes(b.status))&&(!search.trim()||[b.name,b.owner_email,b.slug,b.industry,b.city].some(value=>value.toLowerCase().includes(search.toLowerCase().trim()))));
 async function open(id:string){
  if(chosen===id){setChosen('');setDetail(null);return;}
  setChosen(id);setDetail(null);setLoading(true);setError('');
  try{const response=await fetch('/api/platform/businesses/'+encodeURIComponent(id),{cache:'no-store'}),data=await response.json();
   if(!response.ok)throw Error(data.error||'Unable to load this business.');
   setDetail(data as Detail);
  }catch(e){setError((e as Error).message);}finally{setLoading(false);}
 }
 return <section id="business-directory" className={styles.card}>
 <div className={styles.directoryHeading}><div><h2>All registered businesses</h2><p>Click a business to inspect its profile, services, team, customer records, and appointment history. Customer information is restricted to platform administrators.</p></div><span className={styles.directoryCount}>{listed.length} active / {businesses.length} total</span></div>
 <div className={styles.directoryControls}><label>Filter businesses<select aria-label="Business status filter" value={filter} onChange={e=>{setFilter(e.target.value);setChosen('');setDetail(null);}}><option value="all">All businesses</option><option value="listed">Approved · marketplace</option><option value="pending">Awaiting approval</option><option value="other">Declined / suspended / archived</option></select></label><label>Find a business<input type="search" aria-label="Search registered businesses" placeholder="Name, owner, category, city…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className={styles.directoryGrid}>{shown.map(b=><button type="button" key={b.id} className={styles.directoryTile+' '+(chosen===b.id?styles.directoryTileSelected:'')} aria-expanded={chosen===b.id} onClick={()=>open(b.id)}>
 <span className={styles.directoryStatus}>{b.status==='active'?'Published':b.status==='pending'?'Pending approval':b.status==='rejected'?'Declined':b.status==='archived'?'Archived':'Suspended'}</span>
 <strong>{b.name}</strong><span>{readable(b.industry)}</span><small>Owner email: {b.owner_email}</small><small>{[b.city,b.region].filter(Boolean).join(', ')||'Location not provided'}</small>
 <span className={styles.directorySummary}>{b.appointment_count} appointments · {b.plan_code} plan</span><span className={styles.directoryOpen}>View business details ↗</span></button>)}</div>
 {!shown.length&&<p>No businesses match this filter.</p>}
 {chosen&&<div className={styles.directoryDetail} aria-live="polite">
  {loading?<p>Loading business details…</p>:error?<div role="alert" className={styles.alert}>{error}<button type="button" className={styles.secondary} onClick={()=>open(chosen)}>Close</button></div>:detail?<>
  <div className={styles.directoryDetailTitle}><div><h2>{detail.business.name}</h2><p>{readable(detail.business.industry)} · {detail.business.status.toUpperCase()} · {detail.business.plan} plan</p></div><button className={styles.secondary} type="button" onClick={()=>{setChosen('');setDetail(null);}}>Close details</button></div>
  <div className={styles.detailColumns}><section><h3>Business information</h3><p><strong>Owner:</strong> {detail.business.ownerEmail}</p><p><strong>Public URL:</strong> <a href={'/'+encodeURIComponent(detail.business.slug)} target="_blank" rel="noopener noreferrer">/{detail.business.slug} ↗</a></p><p><strong>Booking:</strong> <a href={'/book/'+encodeURIComponent(detail.business.slug)} target="_blank" rel="noopener noreferrer">/book/{detail.business.slug} ↗</a></p><p><strong>Business type:</strong> {readable(detail.business.industry)}</p><p><strong>Description:</strong> {detail.business.description||'Not provided'}</p>{detail.business.businessModel&&<p><strong>Business model:</strong> {detail.business.businessModel}</p>}{detail.business.phone&&<p><strong>Phone:</strong> {detail.business.phone}</p>}{displayBusinessAddress(detail.business.address,detail.business.city,detail.business.region)&&<p><strong>Address:</strong> <a href={googleMapsDirections(displayBusinessAddress(detail.business.address,detail.business.city,detail.business.region))} target="_blank" rel="noopener noreferrer">{displayBusinessAddress(detail.business.address,detail.business.city,detail.business.region)} ↗</a></p>}<p><strong>Created:</strong> {detail.business.createdAt.slice(0,10)}</p></section>
  <section><h3>Services ({detail.business.services.length})</h3>{detail.business.services.length?detail.business.services.map(s=><p key={s.id}><strong>{s.name}</strong> · {s.type} · {s.durationValue??s.duration} {s.durationUnit}{s.price!==null?' · '+money(s.price):''}</p>):<p>No services entered yet.</p>}
  <h3 className={styles.detailSubheading}>Team ({detail.business.team.length})</h3>{detail.business.team.length?detail.business.team.map((t,i)=><p key={i}>{t.name} · {t.role}</p>):<p>No team members entered yet.</p>}</section></div>
  <div className={styles.detailMetrics}><div><b>{detail.history.totalAppointments}</b><span>Total appointments</span></div><div><b>{detail.history.uniqueClients}</b><span>Unique customer emails</span></div><div><b>{detail.business.services.length}</b><span>Services</span></div></div>
  <h3>Client history</h3>{detail.history.clients.length?<div className={styles.detailTableWrap}><table className={styles.detailTable}><thead><tr><th>Client</th><th>Email</th><th>Recent visits</th><th>Most recent appointment</th></tr></thead><tbody>{detail.history.clients.map((c,i)=><tr key={i}><td>{c.name||'Not specified'}</td><td>{c.email||'Not provided'}</td><td>{c.visits}</td><td>{c.lastDate}</td></tr>)}</tbody></table></div>:<p>No client bookings recorded.</p>}
  <h3 className={styles.detailSubheading}>Appointment history</h3><p>Showing up to {detail.historyLimit} most recent appointment records. Quoted prices do not indicate payment.</p>
  {detail.history.appointments.length?<div className={styles.detailTableWrap}><table className={styles.detailTable}><thead><tr><th>Date / time</th><th>Customer</th><th>Service</th><th>Status</th><th>Quoted price</th></tr></thead><tbody>{detail.history.appointments.map(a=><tr key={a.id}><td>{a.date} {time(a.start)}</td><td>{a.customerName||'Customer'}<small>{a.customerEmail}</small></td><td>{a.services.join(', ')||'Service not specified'}</td><td>{a.status}</td><td>{money(a.quotedPrice)}</td></tr>)}</tbody></table></div>:<p>No appointments recorded for this business.</p>}
  {!!detail.termEnrollments?.length&&<><h3 className={styles.detailSubheading}>Long-term service enrollments</h3><div className={styles.detailTableWrap}><table className={styles.detailTable}><thead><tr><th>Customer</th><th>Service</th><th>Term</th><th>Dates</th><th>Status</th></tr></thead><tbody>{detail.termEnrollments.map(e=><tr key={e.id}><td>{e.client_name}</td><td>{e.service_name}</td><td>{e.duration_value} {e.duration_unit}</td><td>{e.starts_on} – {e.ends_on}</td><td>{e.status}</td></tr>)}</tbody></table></div></>}
  </>:null}</div>}
 </section>;
}
