import type {MembershipSummary} from './verify-registration';
export default function RegistrationLookupResult({membership,result}:{membership:MembershipSummary|null;result:{date:string;status:string;service?:string;serviceType?:string}|null}){
 return <div role="status" className="sf-registration-lookup-result">
  {membership?<div className="sf-registration-membership-summary"><strong>Membership type: {membership.type}</strong><span>Membership package: {membership.name}</span><span>Membership status: {membership.status.replaceAll('_',' ')}</span><strong>Sessions left: {membership.sessionsLeft}</strong></div>:result&&<p>No membership assigned · 0 sessions left.</p>}
  {result?<div className="sf-registration-appointment-summary"><strong>Latest appointment: {result.status}</strong><p>Service: {result.service||'Session'}</p><p>Service type: {result.serviceType||'Not specified'}</p><p>Appointment date: {result.date}</p></div>:<p>{membership?'No recent appointment found. Your membership information is shown above.':'No membership or appointment found. Check your membership ID or contact the business.'}</p>}
 </div>;
}
