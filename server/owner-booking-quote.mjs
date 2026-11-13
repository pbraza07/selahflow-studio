import {membershipAllows} from './membership-eligibility.mjs';
import {membershipBookingActive} from './membership-weekly.mjs';

/** Preview only: saving rechecks coverage and available credits transactionally. */
export function ownerBookingQuote({services=[],session=null,membership=null,date,past=false,applyMembership=true,loaded=false}){
 const originalPrice=services.reduce((total,service)=>total+Number(service.price||0),0);
 const allowed=services.length>0&&(session?session.membershipCreditAllowed!==false:services.every(service=>service.membershipCreditAllowed!==false));
 const eligible=loaded&&!!membership&&allowed&&membershipAllows(membership.creditEligibility,{serviceIds:services.map(service=>service.id),sessionId:session?.id,seriesId:session?.seriesId});
 const covered=!!(eligible&&applyMembership&&(past?membership.pastCreditAvailable:membershipBookingActive(membership.bookingEligibility,date)));
 return {originalPrice,price:covered?0:originalPrice,covered,remaining:membership?.sessionsLeft??null,
  message:covered?'Covered by membership · No separate service payment due':!loaded?'':!membership?'No membership found for this client.':!eligible?'This membership does not cover the selected service or session.':!applyMembership?'Membership credits will not be used for this visit.':'No usable membership credits for this visit. Review membership status or record without a deduction.'};
}
