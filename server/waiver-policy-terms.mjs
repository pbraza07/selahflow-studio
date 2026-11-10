export const WAIVER_POLICY_TERMS_VERSION='membership-attendance-1';
export function waiverPolicySections(businessName='the business') {
 const name=String(businessName||'the business').trim();
 return [
  ['Recurring membership payments and cancellation',`If I enroll in a recurring membership and separately authorize recurring billing, my membership renews automatically and the authorized payment method is charged the amount and at the frequency disclosed at enrollment until I cancel. I may cancel using the cancellation instructions provided at enrollment or by contacting ${name} through its published contact details. I must cancel before the next scheduled renewal to stop that renewal, subject to the plan terms and applicable law. Not attending sessions does not cancel the membership. One-time session packages do not renew automatically. Signing this waiver alone does not enroll me in a membership or authorize a payment.`],
  ['24-hour notice and missed-session deduction',`If I cannot attend a booked session, I must notify ${name} through its published contact details at least 24 hours before the scheduled start time. If I miss the session without providing that notice, one session will be deducted from the applicable membership or session-package balance. The deduction applies once to that missed appointment. A cancellation reported at least 24 hours in advance does not incur this no-show deduction. Any exception approved by the business or required by applicable law will be honored. Canceling an individual session does not cancel a recurring membership.`]
 ];
}
