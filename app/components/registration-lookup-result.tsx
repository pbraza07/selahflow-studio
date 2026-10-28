import type {MembershipSummary} from './verify-registration';
export default function RegistrationLookupResult({membership,result}:{membership:MembershipSummary|null;result:{date:string;status:string;service?:string;serviceType?:string}|null}){
 return <div role="status" className="sf-registration-lookup-result">
  {membership?<div className="sf-registration-membership-summary"><strong>Membership type: {membership.type}</strong><span>Membership package: {membership.name}</span><span>Membership status: {membership.status.replaceAll('_',' ')}</span><strong>Sessions left: {membership.sessionsLeft}</strong></div>:result&&<p>No membership is assigned. Your booking details are shown below.</p>}
  {result?<div className="sf-registration-appointment-summary"><strong>Latest booking: {result.status}</strong><p>Service: {result.service||'Service'}</p><p>Service type: {result.serviceType||'Not specified'}</p><p>Booking date: {result.date}</p></div>:<p>{membership?'No recent booking found. Your membership information is shown above.':'No membership or booking found. Check your client ID or contact the business.'}</p>}
 </div>;
}
