import {createHash,randomUUID} from 'node:crypto';
import {COMMISSION_TERMS} from './first-customer-commissions.mjs';
import {validateServiceAcceptance,SERVICE_AGREEMENT_VERSION} from './business-service-terms.mjs';
export async function recordServiceAcceptance(db,{businessId,owner,input,planCode,ipHash=''}){
 const snapshot=validateServiceAcceptance(input,planCode),digest=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 await db.query('INSERT INTO business_service_agreements(id,business_id,owner_id,version,plan_code,signature_name,snapshot,digest,ip_hash) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',[randomUUID(),businessId,owner,SERVICE_AGREEMENT_VERSION,planCode,snapshot.signatureName,JSON.stringify(snapshot),digest,ipHash]);
 // Consent is recorded without turning either administrator-controlled condition on.
 await db.query('INSERT INTO business_commission_policies(business_id,terms_version,accepted_by,accepted_at) VALUES($1,$2,$3,now()) ON CONFLICT(business_id) DO UPDATE SET terms_version=$2,accepted_by=$3,accepted_at=now(),updated_at=now()',[businessId,COMMISSION_TERMS,owner]);
 return snapshot;
}
