/** Configurable owner/staff booking review cards. Everything is scoped to the
 * authenticated business and the booking approval inbox (never the public API).
 */
import {bookedSessionCount,selectedSession} from './session-scheduling.mjs';

export const APPROVAL_STANDARD_FIELDS=Object.freeze([
  'services','team','customerEmail','customerPhone','quotedPrice','receivedAt'
]);
export const DEFAULT_APPROVAL_FIELDS=Object.freeze([...APPROVAL_STANDARD_FIELDS]);

export function approvalFieldsForBusiness(settings={}) {
 const configured=settings.bookingApprovalVisibleFields;
 if(Array.isArray(configured))return configured;
 return [...DEFAULT_APPROVAL_FIELDS,...(settings.bookingCustomFields||[]).map(f=>f.id)];
}
export function validateApprovalVisibleFields(settings={}) {
 const selection=settings.bookingApprovalVisibleFields;
 if(selection===undefined)return true;
 if(!Array.isArray(selection)||selection.length>40||
    !selection.every(x=>typeof x==='string')||
    new Set(selection).size!==selection.length)throw Error('Check the approval card field selection.');
 const allowed=new Set([...APPROVAL_STANDARD_FIELDS,...(settings.bookingCustomFields||[]).map(x=>x.id)]);
 if(!selection.every(id=>allowed.has(id)))throw Error('Only existing booking fields may appear on approval cards.');
 return true;
}
/** Totals represent confirmed appointments, not merely pending approval requests.
 * Pending requests are intentionally excluded from reserved seats.
 */
export function sessionReviewSummary(settings,request,confirmedAppointments=[],pendingRequests=[]) {
 const details=request.details||{};
 const services=(settings.services||[]).filter(s=>(details.serviceIds||[]).includes(s.id));
 const selected=selectedSession(settings,request.date,request.staff_id,services,request.start_minute);
 if(!selected || (details.sessionId && details.sessionId!==selected.id))return null;
 const booked=bookedSessionCount(confirmedAppointments,selected.id);
 const waiting=pendingRequests.filter(r=>{
  const d=r.details||{};
  return r.status==='pending' && r.date===selected.date && r.staff_id===selected.staff &&
   (d.sessionId===selected.id ||
    (!d.sessionId && r.start_minute===selected.start &&
     Array.isArray(d.serviceIds)&&d.serviceIds.length===1&&d.serviceIds[0]===selected.service));
 }).length;
 return {id:selected.id,booked,capacity:selected.capacity,remaining:selected.manuallyFull===true?0:Math.max(0,selected.capacity-booked),waiting};
}
/** Palette only for service types configured by this business; never a
 * hard-coded industry legend such as Hair, Barber, Color.
 */
export const SERVICE_TYPE_COLORS=Object.freeze([
 '#227353','#426aa4','#906a37','#865c98','#bb673e','#428c92','#9b4c69','#647b39'
]);
export function businessServiceTypes(services=[]) {
 if(!Array.isArray(services))return [];
 const seen=new Set();
 return services.filter(s=>{
  const name=typeof s?.category==='string'?s.category.trim():'';
  if(!name||seen.has(name.toLocaleLowerCase()))return false;
  seen.add(name.toLocaleLowerCase());return true;
 }).map((s,i)=>({name:s.category.trim(),color:SERVICE_TYPE_COLORS[i%SERVICE_TYPE_COLORS.length]}));
}
