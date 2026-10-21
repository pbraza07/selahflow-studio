'use client';
import OwnerHistory from './owner-history';
import SortableTable from './sortable-table';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,CheckCircle2,ChevronRight,Download,Upload,RefreshCw,Search,Users,UserPlus,Pencil,Trash2,RotateCcw,ArchiveRestore} from 'lucide-react';
import ClientEditor,{type ClientDetails} from './client-editor';
import MembershipBadge,{type MembershipBadgeDesign} from './membership-badge';
import {membershipDisplayStatus} from '../../server/member-badge-state.mjs';
import {timeLabel} from '../../lib/defaults';
import {registrationFieldCatalog,filterRegistrationClients} from '../../server/client-registration-filters.mjs';
import {displayAnswer,dateOnly} from '../../server/client-registration-fields.mjs';

type Answer={id:string;label:string;value:string|boolean;type?:string};
type MembershipDetails={registeredAt?:string|null;paidThrough?:string|null;lastPaidAt?:string|null;interval?:string;priceCents?:number;sessionsIncluded?:number;sessionsUsed?:number};
type FormField={id:string;label:string;type:string;options?:string[]};
type Visit={
 id:string;date:string;time:number;duration:number;serviceNames:string[];serviceTypes:string[];
 staff:string;status:string;attended:boolean;sessionType:string;quotedPrice:number;
 answers?:Answer[];originalAnswers?:Answer[];customerName?:string;customerEmail?:string;customerPhone?:string;customerMemberNumber?:string;dateOfBirth?:string;firstName?:string;lastName?:string;
 originalSubmission?:{customerName:string;customerEmail:string;customerPhone:string;customAnswers?:Record<string,string|boolean>}|null;submittedAt?:string|null;policyAccepted?:boolean;policyAcceptedAt?:string|null;
};
type Client={
 membershipBadge?:MembershipBadgeDesign|null;memberNumber?:string;membershipName?:string;membershipStatus?:string;membershipAnswers?:Answer[];membershipDetails?:MembershipDetails;membershipRegistration?:{name:string;firstName:string;lastName:string;email:string;phone:string;dateOfBirth:string;memberNumber:string};dateOfBirth?:string;
 id:string;name:string;email:string;phone:string;bookedSessions:number;attendedSessions:number;
 attendanceDays:string[];serviceTypes:string[];serviceNames:string[];latestDate:string;history:Visit[];notes?:string;importColumns?:Record<string,string|boolean>;registrationAnswers?:Record<string,string|boolean>;registrationFieldLabels?:Record<string,string>;managed?:boolean;firstBooking?:Visit|null;latestBookingAnswers?:Answer[];
};
const humanDate=(date:string)=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-US',
 {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const money=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount||0);

export default function OwnerClientDirectory({onBook,onAddMembership}:{onBook:()=>void;onAddMembership:(client:{name:string;email:string;phone:string})=>void}){
 const importInput=useRef<HTMLInputElement>(null);
 const [importing,setImporting]=useState(false),[importMessage,setImportMessage]=useState('');
 const [clients,setClients]=useState<Client[]>([]),[selectedId,setSelectedId]=useState<string|null>(null);
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [formFields,setFormFields]=useState<FormField[]>([]);
 const [registrationConfig,setRegistrationConfig]=useState<any>({});
 const [membershipLevel,setMembershipLevel]=useState(''),[filterField,setFilterField]=useState(''),[filterValue,setFilterValue]=useState('');
 const [attendedOnly,setAttendedOnly]=useState(false);
 const [profileTab,setProfileTab]=useState('History');
 const [archived,setArchived]=useState<{id:string;name:string;email:string;phone:string}[]>([]);
 const [editing,setEditing]=useState<Client|'new'|null>(null),[saving,setSaving]=useState(false),[editError,setEditError]=useState('');
 const [removedSelection,setRemovedSelection]=useState<string[]>([]);
 const [showRemoved,setShowRemoved]=useState(false),[actionBusy,setActionBusy]=useState(''),[actionError,setActionError]=useState('');
 const [removing,setRemoving]=useState<Client|null>(null);
 const reload=useCallback(async()=>{
  setBusy(true);
  try{
   const r=await fetch('/api/studio/clients',{cache:'no-store'});
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Client records are unavailable.');
   setClients(result.clients||[]);setArchived(result.archived||[]);setFormFields(result.formFields||[]);setRegistrationConfig(result.registrationConfig||{});setError('');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{void reload();const changed=()=>void reload();window.addEventListener('selahflow:booking-reviewed',changed);window.addEventListener('selahflow:memberships-updated',changed);
  return ()=>{window.removeEventListener('selahflow:booking-reviewed',changed);window.removeEventListener('selahflow:memberships-updated',changed);};},[reload]);
 const registrationFields=useMemo(()=>registrationFieldCatalog(clients,formFields) as {key:string;label:string;type:string;options:string[]}[],[clients,formFields]);
 const membershipLevels=useMemo(()=>[...new Set(clients.map(c=>c.membershipName).filter((name):name is string=>!!name))].sort((a,b)=>a.localeCompare(b)),[clients]);
 const chosenField=registrationFields.find(field=>field.key===filterField);
 const filtered=useMemo(()=>filterRegistrationClients(clients,{search,membershipLevel,fieldKey:filterField,fieldValue:filterValue}) as Client[],[clients,search,membershipLevel,filterField,filterValue]);
 const resetFilters=()=>{setSearch('');setMembershipLevel('');setFilterField('');setFilterValue('');};
 const selected=clients.find(c=>c.id===selectedId);
 const visited=selected?selected.history.filter(v=>!attendedOnly||v.attended):[];
 const totalAttended=clients.reduce((n,c)=>n+c.attendedSessions,0);
 const totalDays=clients.reduce((n,c)=>n+c.attendanceDays.length,0);
 const exported=(id?:string)=>'/api/studio/clients?export=xlsx'+(id?'&clientId='+encodeURIComponent(id):'');
 async function postClient(action:string,body:Record<string,unknown>={}){
  const response=await fetch('/api/studio/clients',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,...body}),cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Unable to save this client.');
  return data as {ok:boolean;clientId:string};
 }
 async function saveClient(details:ClientDetails){
  if(!editing)return;
  setSaving(true);setEditError('');
  try{
   const created=editing==='new';
   const result=await postClient(created?'create':'update',{...(created?{}:{clientId:editing.id}),...details});
   setEditing(null);
   if(!created&&selectedId===editing.id)setSelectedId(result.clientId);
   await reload();
  }catch(error){setEditError((error as Error).message);}finally{setSaving(false);}
 }
 async function removeClient(client:Client){
  setActionError('');setRemoving(client);
 }
 async function replaceLegacyId(client:Client){
  if(!window.confirm('Replace this legacy registration ID with a new eight-character ID? Current registration and membership will use the new ID. Historical bookings, payments and attendance remain unchanged; the former ID remains in historical references.'))return;
  setActionBusy(client.id);setActionError('');
  try{await postClient('replaceLegacyId',{clientId:client.id,oldMemberNumber:client.memberNumber});await reload();}
  catch(error){setActionError((error as Error).message);}finally{setActionBusy('');}
 }
 async function confirmRemoveClient(){
  const client=removing;
  if(!client)return;
  setActionBusy(client.id);setActionError('');
  try{
   await postClient('delete',{clientId:client.id,confirmPhrase:'DELETE CLIENT'});
   setSelectedId(null);setRemoving(null);await reload();
  }catch(error){setActionError((error as Error).message);}finally{setActionBusy('');}
 }
 async function restoreClient(id:string){
  setActionBusy(id);setActionError('');
  try{await postClient('restore',{clientId:id});await reload();}
  catch(error){setActionError((error as Error).message);}finally{setActionBusy('');}
 }
 async function deleteRemoved(){
  if(!removedSelection.length)return;
  const phrase=window.prompt('Delete '+removedSelection.length+' removed client profiles? Their registration, bookings, membership, payment and email records will be permanently deleted. Type DELETE REMOVED CLIENTS to confirm:');
  if(phrase!=='DELETE REMOVED CLIENTS')return;
  setActionBusy('delete-removed');setActionError('');
  try{await postClient('deleteArchived',{clientIds:removedSelection,confirmPhrase:phrase});setRemovedSelection([]);await reload();}
  catch(error){setActionError((error as Error).message);}finally{setActionBusy('');}
 }
 async function importSpreadsheet(file:File){
  setImporting(true);setImportMessage('');setActionError('');
  try{
   const form=new FormData();form.append('file',file);
   const response=await fetch('/api/studio/clients/import',{method:'POST',body:form});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Import failed.');
   setImportMessage('Imported '+result.created+' new clients; matched '+result.updated+' existing profiles. All '+result.columns.length+' spreadsheet columns were preserved.');
   await reload();
  }catch(e){setActionError((e as Error).message);}finally{setImporting(false);if(importInput.current)importInput.current.value='';}
 }
 const beginEdit=(client:Client|'new')=>{setEditing(client);setEditError('');};

 return <section className="sf-clients-page">
  <header className="sf-clients-heading">
   <div><div className="sf-clients-eyebrow">CUSTOMER RELATIONSHIPS</div><h2>Client directory & attendance</h2>
    <p>Explore session and service history for customers who have booked with this business. Attendance is counted only after check-in or completion.</p></div>
   <div className="sf-clients-actions">
    <input ref={importInput} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{display:'none'}} aria-label="Choose Excel or CSV client spreadsheet" onChange={e=>{const file=e.target.files?.[0];if(file)void importSpreadsheet(file);}}/>
    <button type="button" className="outline" disabled={importing} onClick={()=>importInput.current?.click()}><Upload size={17}/> {importing?'Importing…':'Import clients from Excel'}</button>
    <button type="button" className="primary" onClick={()=>beginEdit('new')}><UserPlus size={17}/> Add client</button>
    <button type="button" className="outline" onClick={()=>void reload()} disabled={busy}><RefreshCw size={16}/> Refresh</button>
    <a className="primary sf-clients-export" href={exported()}><Download size={16}/> Export all to Excel</a>
   </div>
  </header>
  <div className="sf-clients-stats" aria-label="Client directory totals">
   <div><Users size={19}/><small>Clients in directory</small><strong>{clients.length}</strong></div>
   <div><CheckCircle2 size={19}/><small>Sessions attended</small><strong>{totalAttended}</strong></div>
   <div><CalendarDays size={19}/><small>Client attendance days</small><strong>{totalDays}</strong></div>
  </div>
  {error&&<p role="alert" className="alert">{error}</p>}
  {actionError&&<p role="alert" className="alert">{actionError}</p>}
  {importMessage&&<p role="status" className="notice">{importMessage}</p>}
  {busy&&<p role="status" className="muted">Loading client attendance and services…</p>}
  {selected?<>
   <div className="sf-client-detail-nav">
    <button type="button" className="outline" onClick={()=>{setSelectedId(null);setAttendedOnly(false);}}><ArrowLeft size={17}/> Back to clients</button>
    <div className="sf-client-management-buttons">
     <button type="button" className="outline" onClick={()=>beginEdit(selected)}><Pencil size={16}/> Edit client</button><button type="button" className="outline" onClick={()=>onAddMembership({name:selected.name,email:selected.email,phone:selected.phone})}>Add membership</button>
     <a className="primary sf-clients-export" href={exported(selected.id)}><Download size={16}/> Export this client to Excel</a>
     <button type="button" className="outline sf-client-remove" disabled={!!actionBusy} onClick={()=>void removeClient(selected)}><Trash2 size={16}/> Delete permanently</button>
     {selected.memberNumber&&!/^[A-Z]{2}[0-9]{6}$/.test(selected.memberNumber)&&<button type="button" className="outline" disabled={!!actionBusy} onClick={()=>void replaceLegacyId(selected)}>Replace legacy ID with eight characters</button>}
    </div>
   </div>
   <div className="sf-client-profile-tabs" role="group" aria-label="Client profile sections">{['History','Details','Membership','Sessions'].map(tab=><button type="button" key={tab} className={profileTab===tab?'primary':'outline'} aria-pressed={profileTab===tab} onClick={()=>setProfileTab(tab)}>{tab}</button>)}</div>
   <article className="sf-client-profile">
    <div className="sf-client-profile-heading"><span className="sf-client-avatar" aria-hidden="true">{selected.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</span>
     <div><h3 style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>{selected.name}<MembershipBadge memberNumber={selected.memberNumber} membershipName={selected.membershipName} membershipStatus={selected.membershipStatus} sessionsIncluded={selected.membershipDetails?.sessionsIncluded} sessionsUsed={selected.membershipDetails?.sessionsUsed} badge={selected.membershipBadge}/></h3><p>{selected.email||'No email recorded'}{selected.phone?' · '+selected.phone:''}</p>
      <span className="sf-client-profile-note">Service history and attendance for this business only</span></div>
    </div>
    <section hidden={profileTab!=='Details'} className="sf-client-first-booking sf-client-registration-overview">
     <div className="sf-client-history-heading"><h3>Client information & registration</h3><small>Current client record, including original registration details when available</small></div>
     <div className="sf-client-first-details">
      <div><small>Full name</small><b>{selected.name}</b></div>
      <div><small>First name</small><b>{selected.name.trim().split(/\s+/)[0]||'Not available'}</b></div>
      <div><small>Last name</small><b>{selected.name.trim().split(/\s+/).slice(1).join(' ')||'Not available'}</b></div>
      <div><small>Birth date</small><b>{dateOnly(selected.dateOfBirth||selected.firstBooking?.dateOfBirth)?humanDate(dateOnly(selected.dateOfBirth||selected.firstBooking?.dateOfBirth)):'Not recorded'}</b></div>
      <div><small>Email address</small><b>{selected.email||'Not provided'}</b></div>
      <div><small>Phone number</small><b>{selected.phone||'Not provided'}</b></div>
      <div><small>Unique membership ID</small><b>{selected.memberNumber||'Not assigned'}</b></div>
      <div><small>Membership level</small><b>{selected.membershipName||'No membership package'}</b></div>
      <div><small>Membership status</small><b>{membershipDisplayStatus({status:selected.membershipStatus,sessionsIncluded:selected.membershipDetails?.sessionsIncluded,sessionsUsed:selected.membershipDetails?.sessionsUsed}).replaceAll('_',' ')}</b></div>
     </div>
    </section>
    {selected.membershipName&&<section hidden={profileTab!=='Membership'} className="sf-client-first-booking sf-client-membership-registration">
     <div className="sf-client-history-heading"><h3>Membership registration</h3><small>Membership enrollment and the answers submitted when registering</small></div>
     <div className="sf-client-first-details">
      <div><small>Registered full name</small><b>{selected.membershipRegistration?.name||selected.name}</b></div>
      <div><small>Registered first name</small><b>{selected.membershipRegistration?.firstName||'Not available'}</b></div>
      <div><small>Registered last name</small><b>{selected.membershipRegistration?.lastName||'Not available'}</b></div>
      <div><small>Registered email</small><b>{selected.membershipRegistration?.email||'Not provided'}</b></div>
      <div><small>Registered phone</small><b>{selected.membershipRegistration?.phone||'Not provided'}</b></div>
      <div><small>Registered birth date</small><b>{selected.membershipRegistration?.dateOfBirth?humanDate(selected.membershipRegistration.dateOfBirth):'Not recorded'}</b></div>
      <div><small>Membership package</small><b>{selected.membershipName}</b></div>
      <div><small>Membership ID</small><b>{selected.memberNumber||'Not assigned'}</b></div>
      <div><small>Enrollment status</small><b>{selected.membershipStatus?.replaceAll('_',' ')||'Not available'}</b></div>
      <div><small>Registered on</small><b>{selected.membershipDetails?.registeredAt?new Date(selected.membershipDetails.registeredAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'Not available'}</b></div>
      <div><small>Membership billing frequency</small><b>{selected.membershipDetails?.interval||'Not available'}</b></div>
      <div><small>Membership price</small><b>{selected.membershipDetails?.priceCents!==undefined?money(selected.membershipDetails.priceCents/100):'Not available'}</b></div>
      <div><small>Sessions included</small><b>{selected.membershipDetails?.sessionsIncluded??'Not available'}</b></div>
      <div><small>Sessions used</small><b>{selected.membershipDetails?.sessionsUsed??'Not available'}</b></div>
      <div><small>Last payment confirmed</small><b>{selected.membershipDetails?.lastPaidAt?new Date(selected.membershipDetails.lastPaidAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'Not yet recorded'}</b></div>
      <div><small>Paid through</small><b>{selected.membershipDetails?.paidThrough?humanDate(selected.membershipDetails.paidThrough):'Not yet recorded'}</b></div>
     </div>
     <h4>Original membership form questions and answers</h4>
     {!!selected.membershipAnswers?.length?
      <div className="sf-client-original-answers">{selected.membershipAnswers.map(answer=><div key={answer.id}><small>{answer.label}</small><b>{displayAnswer(answer.value)}</b></div>)}</div>:
      <p className="muted">No additional membership form answers were saved for this registration.</p>}
    </section>}
    {selected.firstBooking&&<section hidden={profileTab!=='Details'} className="sf-client-first-booking">
     <div className="sf-client-history-heading"><h3>First booking information</h3><small>Copied from the original customer booking request</small></div>
     <div className="sf-client-first-details">
      <div><small>Customer name</small><b>{selected.firstBooking.originalSubmission?.customerName||selected.firstBooking.customerName||selected.name}</b></div>
      <div><small>First name as booked</small><b>{selected.firstBooking.firstName||selected.firstBooking.customerName?.trim().split(/\s+/)[0]||'Not recorded'}</b></div>
      <div><small>Last name as booked</small><b>{selected.firstBooking.lastName||selected.firstBooking.customerName?.trim().split(/\s+/).slice(1).join(' ')||'Not recorded'}</b></div>
      <div><small>Date of birth provided</small><b>{dateOnly(selected.firstBooking.dateOfBirth||selected.dateOfBirth)?humanDate(dateOnly(selected.firstBooking.dateOfBirth||selected.dateOfBirth)):'Not recorded'}</b></div>
      <div><small>Membership ID provided</small><b>{selected.firstBooking.customerMemberNumber||selected.memberNumber||'Not recorded'}</b></div>
      <div><small>Email provided</small><b>{selected.firstBooking.originalSubmission?.customerEmail||selected.firstBooking.customerEmail||selected.email}</b></div>
      <div><small>Phone provided</small><b>{selected.firstBooking.originalSubmission?.customerPhone||selected.firstBooking.customerPhone||'Not provided'}</b></div>
      <div><small>Activity date & time</small><b>{humanDate(selected.firstBooking.date)} · {timeLabel(selected.firstBooking.time)} Eastern</b></div>
      <div><small>Service(s)</small><b>{selected.firstBooking.serviceNames.join(', ')||'Not specified'}</b></div>
      <div><small>Service type(s)</small><b>{selected.firstBooking.serviceTypes.join(', ')||'Not specified'}</b></div>
      <div><small>Staff / team</small><b>{selected.firstBooking.staff||'Not specified'}</b></div>
      <div><small>Requested booking status</small><b>{selected.firstBooking.status}</b></div>
      <div><small>Price quoted</small><b>{money(selected.firstBooking.quotedPrice)}</b></div>
      <div><small>Request received</small><b>{selected.firstBooking.submittedAt?new Date(selected.firstBooking.submittedAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'Not available'}</b></div>
      <div><small>Booking policy consent</small><b>{selected.firstBooking.policyAccepted?'Accepted':'Not recorded'}</b></div>
     </div>
     {!!(selected.firstBooking.originalAnswers?.length||selected.firstBooking.answers?.length)&&<div className="sf-client-original-answers"><h4>Initial booking questions and answers</h4>
      {(selected.firstBooking.originalAnswers?.length?selected.firstBooking.originalAnswers:selected.firstBooking.answers||[]).map(answer=><div key={answer.id}><small>{answer.label}</small><b>{displayAnswer(answer.value)}</b></div>)}
     </div>}
    </section>}
    <div hidden={profileTab!=='Sessions'} className="sf-client-metrics">
     <div><small>Sessions booked</small><strong>{selected.bookedSessions}</strong></div>
     <div><small>Sessions attended</small><strong>{selected.attendedSessions}</strong></div>
     <div><small>Days attended</small><strong>{selected.attendanceDays.length}</strong></div>
     <div><small>Service types used</small><strong>{selected.serviceTypes.length}</strong></div>
    </div>
    <div hidden={profileTab!=='Sessions'} className="sf-client-service-panel"><h4>Service types utilized</h4><div className="sf-client-tags">{selected.serviceTypes.length?selected.serviceTypes.map(type=><span key={type}>{type}</span>):<small>No current service type recorded</small>}</div>
     <h4>Services utilized</h4><div className="sf-client-tags">{selected.serviceNames.length?selected.serviceNames.map(name=><span key={name}>{name}</span>):<small>No services recorded</small>}</div>
    </div>
    {!!selected.history?.length&&<section hidden={profileTab!=='Details'} className="sf-client-first-booking sf-client-last-answers">
     <div className="sf-client-history-heading"><h3>Latest booking registration</h3><small>Latest recorded booking information and submitted answers</small></div>
     <div className="sf-client-first-details">
      <div><small>Customer name</small><b>{selected.history[0].customerName||selected.name}</b></div>
      <div><small>Email address</small><b>{selected.history[0].customerEmail||selected.email||'Not provided'}</b></div>
      <div><small>Phone number</small><b>{selected.history[0].customerPhone||selected.phone||'Not provided'}</b></div>
      <div><small>Date of birth</small><b>{dateOnly(selected.history[0].dateOfBirth||selected.dateOfBirth)?humanDate(dateOnly(selected.history[0].dateOfBirth||selected.dateOfBirth)):'Not recorded'}</b></div>
      <div><small>Membership ID</small><b>{selected.history[0].customerMemberNumber||selected.memberNumber||'Not assigned'}</b></div>
      <div><small>Booking date and time</small><b>{humanDate(selected.history[0].date)} · {timeLabel(selected.history[0].time)} Eastern</b></div>
      <div><small>Service(s)</small><b>{selected.history[0].serviceNames.join(', ')||'Not specified'}</b></div>
      <div><small>Team member</small><b>{selected.history[0].staff||'Not specified'}</b></div>
      <div><small>Booking status</small><b>{selected.history[0].status}</b></div>
      <div><small>Policy consent</small><b>{selected.history[0].policyAccepted?'Accepted':'Not recorded'}</b></div>
     </div>
     {!!selected.history[0].answers?.length&&<><h4>Booking form questions and answers</h4>
      <div className="sf-client-original-answers">{selected.history[0].answers.map(answer=><div key={answer.id}><small>{answer.label}</small><b>{displayAnswer(answer.value)}</b></div>)}</div></>}
    </section>}
    {selected.importColumns&&Object.keys(selected.importColumns).length>0&&selected.notes!=='Membership registration'&&<section hidden={profileTab!=='Details'} className="sf-client-first-booking"><h4>{selected.notes==='First online booking'?'Saved legacy booking fields':'Imported spreadsheet fields'}</h4><div className="sf-client-first-details">{Object.entries(selected.importColumns).map(([heading,value])=><div key={heading}><small>{heading}</small><b>{displayAnswer(value)}</b></div>)}</div></section>}
    {selected.notes&&<div hidden={profileTab!=='Details'} className="sf-client-private-notes"><h4>Private business notes</h4><p>{selected.notes}</p></div>}
    <div hidden={profileTab!=='Sessions'} className="sf-client-attendance"><h4>Days attended <span>({selected.attendanceDays.length})</span></h4>
     {selected.attendanceDays.length?<div className="sf-client-day-tags">{selected.attendanceDays.map(day=><time dateTime={day} key={day}>{humanDate(day)}</time>)}</div>:<p>Attendance is recorded when an appointment is marked <strong>Checked in</strong> or <strong>Completed</strong>.</p>}
    </div>
   </article>
   {profileTab==='Membership'&&!selected.membershipName&&<p className="notice">No membership package is recorded for this client.</p>}
   {profileTab==='History'&&(selected.memberNumber||selected.email?<OwnerHistory key={selected.id} memberNumber={selected.memberNumber||''} clientEmail={selected.email} clientName={selected.name} compact/>:<p className="notice">This client has no stable membership ID or email for linking history. Use the business History tab to search retained records.</p>)}
   <section hidden={profileTab!=='Sessions'} className="sf-client-history">
    <div className="sf-client-history-heading"><div><h3>Service & session history</h3><p>Each booking, its services and attendance status.</p></div>
     <label className="sf-client-history-filter"><input type="checkbox" checked={attendedOnly} onChange={e=>setAttendedOnly(e.target.checked)}/> Attended only</label>
    </div>
    {visited.length?<div className="sf-client-history-scroll"><SortableTable className="sf-client-history-table">
     <thead><tr><th>Activity date / time</th><th>Service used</th><th>Service type</th><th>Session</th><th>Team</th><th>Status</th><th>Quote</th></tr></thead>
     <tbody>{visited.map(v=><tr key={v.id}>
      <td><b>{humanDate(v.date)}</b><small>{timeLabel(v.time)} Eastern</small></td>
      <td>{v.serviceNames.join(', ')||'Unspecified'}{!!v.answers?.length&&<details className="sf-client-visit-answers"><summary>Booking answers ({v.answers.length})</summary>
       {v.answers.map(a=><div key={a.id}><strong>{a.label}:</strong> {displayAnswer(a.value)}</div>)}
      </details>}{!!v.originalAnswers?.length&&<details className="sf-client-visit-answers"><summary>Original registration answers ({v.originalAnswers.length})</summary>
       {v.originalAnswers.map(a=><div key={a.id}><strong>{a.label}:</strong> {displayAnswer(a.value)}</div>)}
      </details>}</td><td>{v.serviceTypes.join(', ')||'Not categorized'}</td>
      <td>{v.sessionType}</td><td>{v.staff||'—'}</td>
      <td><span className={'sf-client-visit-status '+(v.attended?'attended':v.status==='No-show'||v.status==='Cancelled'?'missed':'scheduled')}>{v.status}{v.attended?' · Attended':''}</span></td>
      <td>{money(v.quotedPrice)}</td>
     </tr>)}</tbody></SortableTable></div>:<p className="sf-client-empty">No {attendedOnly?'attended':'recorded'} sessions to show.</p>}
   </section>
  </>:<>
   <div className="sf-clients-search"><label><Search size={18}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, contact, service or service type…" aria-label="Search clients"/></label><small>{filtered.length} of {clients.length} clients</small></div>
   <div className="sf-clients-registration-filters" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:12,alignItems:'end',margin:'16px 0',padding:16,border:'1px solid #d9e2dc',borderRadius:14}}>
    <label>Membership level
     <select aria-label="Filter by membership level" value={membershipLevel} onChange={e=>setMembershipLevel(e.target.value)}>
      <option value="">All membership levels</option>
      {membershipLevels.map(level=><option key={level} value={level}>{level}</option>)}
      <option value="__no_active__">No active membership / ID only</option>
     </select>
    </label>
    <label>Registration field
     <select aria-label="Select registration field to filter" value={filterField} onChange={e=>{setFilterField(e.target.value);setFilterValue('');}}>
      <option value="">All registration fields</option>
      {registrationFields.map(field=><option key={field.key} value={field.key}>{field.label}</option>)}
     </select>
    </label>
    {chosenField&&<label>{chosenField.label}
     {chosenField.type==='select'||chosenField.type==='checkbox'?
      <select aria-label={'Filter by '+chosenField.label} value={filterValue} onChange={e=>setFilterValue(e.target.value)}>
       <option value="">Any answer</option>
       {(chosenField.type==='checkbox'?['Yes','No']:chosenField.options).map(value=><option key={value} value={value}>{value}</option>)}
      </select>:
      <input aria-label={'Filter by '+chosenField.label} type={chosenField.type==='date'?'date':'search'} value={filterValue} placeholder={'Find '+chosenField.label.toLowerCase()} onChange={e=>setFilterValue(e.target.value)}/>
     }
    </label>}
    {(search||membershipLevel||filterField||filterValue)&&<button type="button" className="outline" onClick={resetFilters}>Clear all filters</button>}
   </div>
   <p className="muted" role="status">{filtered.length} matching {filtered.length===1?'client':'clients'} · Filters apply together</p>
   {filtered.length?<div className="sf-client-directory-grid">{filtered.map(c=><article className="sf-client-summary" key={c.id}>
    <div className="sf-client-summary-top"><span className="sf-client-avatar" aria-hidden="true">{c.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</span><div><h3 style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>{c.name}<MembershipBadge memberNumber={c.memberNumber} membershipName={c.membershipName} membershipStatus={c.membershipStatus} sessionsIncluded={c.membershipDetails?.sessionsIncluded} sessionsUsed={c.membershipDetails?.sessionsUsed} badge={c.membershipBadge}/></h3><p>{c.email||c.phone||'Contact not provided'}</p></div></div>
    <div className="sf-client-summary-metrics"><span><b>{c.bookedSessions}</b> sessions booked</span><span><b>{c.attendedSessions}</b> attended</span><span><b>{c.attendanceDays.length}</b> attendance days</span></div>
    {!!c.latestBookingAnswers?.length&&<p className="sf-client-booking-answer-preview">{c.latestBookingAnswers.length} booking question{c.latestBookingAnswers.length===1?'':'s'} answered · See full details</p>}
    <div className="sf-client-summary-types"><small>Service types</small><strong>{c.serviceTypes.join(' · ')||'Not categorized'}</strong></div>
    <p className="sf-client-last-visit"><CalendarDays size={14}/> Latest appointment: {humanDate(c.latestDate)}</p>
    <div className="sf-client-summary-actions"><button type="button" className="primary" onClick={()=>{setSelectedId(c.id);setProfileTab('History');setAttendedOnly(false);}}><ChevronRight size={16}/> View history</button>
     <button type="button" className="outline" aria-label={'Edit '+c.name} onClick={()=>beginEdit(c)}><Pencil size={15}/> Edit</button>
     <a className="outline sf-clients-export" href={exported(c.id)} aria-label={'Export '+c.name+' to Excel'}><Download size={15}/> Excel</a>
     <button type="button" className="outline sf-client-remove" aria-label={'Delete '+c.name} disabled={!!actionBusy} onClick={()=>void removeClient(c)}><Trash2 size={15}/> Delete</button></div>
   </article>)}</div>:<div className="sf-client-empty"><Users size={26}/><h3>{clients.length?'No matching clients':'No client bookings yet'}</h3><p>{clients.length?'Try searching for another name or service.':'Client profiles and attendance will appear here as customers book and appointments are marked attended.'}</p><button type="button" className="primary" onClick={onBook}>Create appointment</button></div>}
  </>}
  <div className="sf-client-removed-section">
   <button type="button" className="outline sf-client-removed-toggle" aria-expanded={showRemoved} onClick={()=>setShowRemoved(v=>!v)}>
    <ArchiveRestore size={16}/>{showRemoved?'Hide removed clients':'Removed clients ('+archived.length+')'}
   </button>
   {showRemoved&&<div className="sf-client-removed-list">
    <p className="muted">Previously archived clients can be restored or permanently deleted along with their linked records.</p>
    {archived.length?<div className="sf-client-removed-toolbar"><label><input type="checkbox" checked={archived.every(c=>removedSelection.includes(c.id))} onChange={e=>setRemovedSelection(e.target.checked?archived.map(c=>c.id):[])}/> Select all</label><button type="button" className="outline sf-client-remove" disabled={!removedSelection.length||!!actionBusy} onClick={()=>void deleteRemoved()}><Trash2 size={16}/> Delete selected ({removedSelection.length})</button></div>:null}
    {archived.length?archived.map(c=><div key={c.id} className="sf-client-removed-row"><label><input type="checkbox" aria-label={'Select '+c.name} checked={removedSelection.includes(c.id)} onChange={e=>setRemovedSelection(prev=>e.target.checked?[...prev,c.id]:prev.filter(id=>id!==c.id))}/></label><div><b>{c.name}</b><small>{c.email||c.phone||'No contact details'}</small></div>
     <button type="button" className="outline" disabled={!!actionBusy} onClick={()=>void restoreClient(c.id)}><RotateCcw size={15}/> Restore</button>
    </div>):<p className="muted">No removed clients.</p>}
   </div>}
  </div>
  {editing&&<ClientEditor config={registrationConfig} client={editing==='new'?null:{name:editing.name,email:editing.email,phone:editing.phone,notes:editing.notes||'',memberNumber:editing.memberNumber||'',dateOfBirth:editing.dateOfBirth||'',registrationAnswers:editing.registrationAnswers||{}}}
   onClose={()=>{if(!saving)setEditing(null);}} onSave={saveClient} busy={saving} error={editError}/>}
  {removing&&<div className="sf-client-editor-backdrop" role="presentation"><section className="sf-client-editor" role="dialog" aria-modal="true" aria-labelledby="remove-client-title"><header><div className="sf-client-editor-heading"><Trash2 size={20}/><div><small>CLIENT DIRECTORY</small><h2 id="remove-client-title">Remove {removing.name}?</h2></div></div></header><p className="sf-client-editor-note">Permanently delete this client’s registration, membership, bookings, attendance, and saved payment and email records from this business. This cannot be undone. Provider records at Stripe and emails already delivered are not erased. Required accounting records and signed waivers are retained separately. Their ID is released immediately and can be reused when they or another client register again.</p>{actionError&&<p role="alert" className="alert">{actionError}</p>}<footer><button type="button" className="outline" disabled={!!actionBusy} onClick={()=>setRemoving(null)}>Keep client</button><button type="button" className="primary" disabled={!!actionBusy} onClick={()=>void confirmRemoveClient()}><Trash2 size={16}/>{actionBusy?'Removing…':'Delete permanently'}</button></footer></section></div>}
 </section>;
}
