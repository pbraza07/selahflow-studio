import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {isStaging} from './staging-safety.mjs';
import {requiresWaiver,waiverDocument,validateWaiverSignature,acceptedWaiverVersions} from './waiver-content.mjs';
export function publicWaiverDocument(config,primary,background){const document=waiverDocument(config,primary,background);return {...document,hash:createHash('sha256').update(JSON.stringify(document)).digest('hex')};}
/** Run inside the business/customer identity transaction. Never trust a client signed flag. */
export async function ensureParticipationWaiver(db,{businessId,memberNumber,config,services,input,primary,background,audit={}}){
 if(!requiresWaiver(services))return null;
 const identity=(await db.query('SELECT id,first_name,last_name,date_of_birth::text AS dob FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2 FOR UPDATE',[businessId,memberNumber])).rows[0];
 if(!identity)throw Error('Verify your client identity before signing the waiver.');
 const document=waiverDocument(config,primary,background);
 assertWaiverLegalReview(config,document.version);
 const prior=(await db.query('SELECT id FROM participation_waivers WHERE business_id=$1 AND customer_id=$2 AND document_version=ANY($3::text[]) AND deleted_at IS NULL ORDER BY signed_at DESC LIMIT 1',[businessId,identity.id,acceptedWaiverVersions(config)])).rows[0];
 if(prior)return prior.id;
 const participantName=[identity.first_name,identity.last_name].join(' ');
 const signed=validateWaiverSignature(input,{dateOfBirth:identity.dob,participantName,version:document.version});
 // The text/version comes from the server. The exact display palette is retained.
 const hash=createHash('sha256').update(JSON.stringify(document)).digest('hex');
 if(input.documentHash!==hash)throw Error('The waiver has changed. Refresh the booking page and read it before signing.');
 const row=(await db.query('INSERT INTO participation_waivers(business_id,customer_id,member_number,participant_name,date_of_birth,signer_name,signer_role,signed_date,document_version,document_hash,document,request_ip,user_agent,media_consent,media_statement) VALUES($1,$2,$3,$4,$5::date,$6,$7,$8::date,$9,$10,$11::jsonb,$12::inet,$13,$14,$15) RETURNING id',[businessId,identity.id,memberNumber,participantName,identity.dob,signed.signerName,signed.signerRole,signed.signedDate,document.version,hash,JSON.stringify(document),isIP(String(audit.ip||''))?audit.ip:null,String(audit.userAgent||'').slice(0,512),document.mediaReleaseIncluded===true||input.mediaConsent===true,document.mediaRelease||null])).rows[0];
 return row.id;
}
/** Rechecked under the schedule lock, so enabling a waiver cannot race a booking. */
export async function assertBookingWaiver(db,{owner,config,serviceIds,memberNumber}){
 const current=serviceIds.map(id=>(config.services||[]).find(s=>s.id===id)).filter(Boolean);
 if(!requiresWaiver(current))return;
 const version=waiverDocument(config).version;
 assertWaiverLegalReview(config,version);
 const signed=(await db.query('SELECT w.id FROM participation_waivers w JOIN businesses b ON b.id=w.business_id JOIN customer_booking_ids c ON c.id=w.customer_id AND c.business_id=b.id WHERE b.owner_id=$1 AND c.member_number=$2 AND w.document_version=ANY($3::text[]) AND w.deleted_at IS NULL',[owner,memberNumber,acceptedWaiverVersions(config)])).rows[0];
 if(!signed)throw Error('A signed participation waiver is required. Refresh and complete the waiver before booking.');
}

/** Production consent must be backed by a business-specific review, never a default. */
export function assertWaiverLegalReview(config,version,env=process.env){
 if(env.NODE_ENV!=='production'||isStaging(env))return;
 const review=config.waiverLegalReview;
 if(review?.version!==version||!review.reference?.trim()||!Number.isFinite(Date.parse(review.reviewedAt||'')))throw Error('This business must complete legal review of the current waiver before accepting signatures. Contact the business.');
}
