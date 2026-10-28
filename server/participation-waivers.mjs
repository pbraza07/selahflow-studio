import {CATEGORY_WAIVER_VERSION,WAIVER_CATEGORIES,waiverContentPayload} from './waiver-category-templates.mjs';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {isStaging} from './staging-safety.mjs';
import {requiresWaiver,waiverDocument,validateWaiverSignature,acceptedWaiverVersions} from './waiver-content.mjs';
export function waiverDocumentHash(document){return createHash('sha256').update(document.version===CATEGORY_WAIVER_VERSION?waiverContentPayload(document):JSON.stringify(document)).digest('hex');}
export function publicWaiverDocument(config,primary,background){const document=waiverDocument(config,primary,background);return {...document,hash:waiverDocumentHash(document)};}
/** Run inside the business/customer identity transaction. Never trust a client signed flag. */
export async function ensureParticipationWaiver(db,{businessId,memberNumber,config,services,input,primary,background,audit={}}){
 if(!requiresWaiver(services))return null;
 const identity=(await db.query('SELECT id,first_name,last_name,date_of_birth::text AS dob FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2 FOR UPDATE',[businessId,memberNumber])).rows[0];
 if(!identity)throw Error('Verify your client identity before signing the waiver.');
 const document=waiverDocument(config,primary,background);
 assertWaiverLegalReview(config,document.version);
 const prior=(await db.query('SELECT id FROM participation_waivers WHERE business_id=$1 AND customer_id=$2 AND document_version=ANY($3::text[]) AND ($4::text IS NULL OR document_hash=$4 AND document->>\'category\'=$5) AND deleted_at IS NULL ORDER BY signed_at DESC LIMIT 1',[businessId,identity.id,acceptedWaiverVersions(config),document.version===CATEGORY_WAIVER_VERSION?waiverDocumentHash(document):null,document.category||null])).rows[0];
 if(prior)return prior.id;
 const participantName=[identity.first_name,identity.last_name].join(' ');
 const signed=validateWaiverSignature(input,{dateOfBirth:identity.dob,participantName,version:document.version});
 // The text/version comes from the server. The exact display palette is retained.
 const hash=waiverDocumentHash(document);
 if(input.documentHash!==hash)throw Error('The waiver has changed. Refresh the booking page and read it before signing.');
 const row=(await db.query('INSERT INTO participation_waivers(business_id,customer_id,member_number,participant_name,date_of_birth,signer_name,signer_role,signed_date,document_version,document_hash,document,request_ip,user_agent,media_consent,media_statement) VALUES($1,$2,$3,$4,$5::date,$6,$7,$8::date,$9,$10,$11::jsonb,$12::inet,$13,$14,$15) RETURNING id',[businessId,identity.id,memberNumber,participantName,identity.dob,signed.signerName,signed.signerRole,signed.signedDate,document.version,hash,JSON.stringify(document),isIP(String(audit.ip||''))?audit.ip:null,String(audit.userAgent||'').slice(0,512),document.mediaReleaseIncluded===true||input.mediaConsent===true,document.mediaRelease||null])).rows[0];
 return row.id;
}
/** Rechecked under the schedule lock, so enabling a waiver cannot race a booking. */
export async function assertBookingWaiver(db,{owner,config,serviceIds,memberNumber}){
 const current=serviceIds.map(id=>(config.services||[]).find(s=>s.id===id)).filter(Boolean);
 if(!requiresWaiver(current))return;
 const document=waiverDocument(config),version=document.version;
 assertWaiverLegalReview(config,version);
 const signed=(await db.query('SELECT w.id FROM participation_waivers w JOIN businesses b ON b.id=w.business_id JOIN customer_booking_ids c ON c.id=w.customer_id AND c.business_id=b.id WHERE b.owner_id=$1 AND c.member_number=$2 AND w.document_version=ANY($3::text[]) AND ($4::text IS NULL OR w.document_hash=$4 AND w.document->>\'category\'=$5) AND w.deleted_at IS NULL',[owner,memberNumber,acceptedWaiverVersions(config),version===CATEGORY_WAIVER_VERSION?waiverDocumentHash(document):null,document.category||null])).rows[0];
 if(!signed)throw Error('A signed participation waiver is required. Refresh and complete the waiver before booking.');
}

/** Production consent must be backed by a business-specific review, never a default. */
export function assertWaiverLegalReview(config,version,env=process.env){
 if(version===CATEGORY_WAIVER_VERSION){
  const review=config.categoryWaiver?.review;
  if(!review||review.hash!==waiverDocumentHash(waiverDocument(config))||typeof review.reference!=='string'||!review.reference.trim()||review.reference.length>200||!validReviewDate(review.reviewedAt))throw Error('Complete legal review of this exact category waiver before accepting signatures.');
  return;
 }
 if(env.NODE_ENV!=='production'||isStaging(env))return;
 const review=config.waiverLegalReview;
 if(review?.version!==version||!review.reference?.trim()||!Number.isFinite(Date.parse(review.reviewedAt||'')))throw Error('This business must complete legal review of the current waiver before accepting signatures. Contact the business.');
}

function validReviewDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&value<=new Date().toISOString().slice(0,10);}
export function validateCategoryWaiverSettings(config){
 const options=config.categoryWaiver;if(options==null)return;
 if(typeof options!=='object'||Array.isArray(options)||typeof options.enabled!=='boolean'||!Object.hasOwn(WAIVER_CATEGORIES,options.category))throw Error('Choose a valid waiver category.');
 for(const value of [options.additionalTerms||'',...Object.values(options.serviceTerms||{})])if(typeof value!=='string'||value.length>4000)throw Error('Waiver terms must contain at most 4,000 characters per field.');
 if(options.serviceTerms&&(typeof options.serviceTerms!=='object'||Array.isArray(options.serviceTerms)))throw Error('Invalid service waiver terms.');
 if(options.enabled)assertWaiverLegalReview(config,CATEGORY_WAIVER_VERSION);
}
