import {ACTIVATION_AGREEMENT_VERSIONS} from './business-service-terms.mjs';

/** A public business becomes functional only after its current agreement and required package payment are verified. */
export async function activatePendingBusiness(db,businessId){
 const result=await db.query("UPDATE businesses b SET status='active',is_listed=TRUE,listing_requested=FALSE,updated_at=now() FROM business_subscriptions s WHERE b.id=$1 AND b.status='pending' AND s.business_id=b.id AND ((COALESCE(s.requested_plan_code,'free')='free' AND EXISTS(SELECT 1 FROM business_service_agreements a WHERE a.business_id=b.id AND a.owner_id=b.owner_id AND a.version=ANY($2::text[]) AND a.plan_code='free')) OR (s.requested_plan_code IN ('professional','business') AND s.billing_status='active' AND s.plan_code=s.requested_plan_code AND EXISTS(SELECT 1 FROM business_service_agreements a WHERE a.business_id=b.id AND a.owner_id=b.owner_id AND a.version=ANY($2::text[]) AND a.plan_code=s.requested_plan_code))) RETURNING b.slug",[businessId,ACTIVATION_AGREEMENT_VERSIONS]);
 if(!result.rowCount)throw Error('The signed agreement and required Stripe payment must be verified before approval.');
 return result.rows[0];
}
