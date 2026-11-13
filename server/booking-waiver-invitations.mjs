import {randomBytes,randomUUID} from 'node:crypto';
import {tokenHash} from './security.mjs';
import {maskDestination,validEmail} from './notification-delivery.mjs';
import {publicWaiverDocument,ensureParticipationWaiver} from './participation-waivers.mjs';
import {waiverMinor} from './waiver-content.mjs';
import {issueMemberId} from './member-id-policy.mjs';
import {ensureMemberBookingIdentity} from './shared-member-identity.mjs';
const object=value=>typeof value==='string'?JSON.parse(value):value||{};
const normalized=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const clean=value=>String(value||'').replace(/[<>\r\n]/g,' ').slice(0,300);

/** Called in the booking transaction: delivery starts only after commit. */
export async function queueBookingWaiver(db,{owner,appointmentId,data,origin}){
 const business=(await db.query("SELECT id,slug,name FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
 if(!business)throw Error('Business unavailable.');
 const email=String(data.email||'').trim();if(!validEmail(email))throw Error('Enter a valid client email for the waiver request.');
 const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');
 const token=randomBytes(32).toString('hex');
 const inserted=await db.query("INSERT INTO booking_waiver_invitations(token_hash,business_id,appointment_id,destination,participant_name,member_number) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(appointment_id) DO NOTHING RETURNING token_hash",[tokenHash(token),business.id,appointmentId,email,data.name,data.memberNumber||null]);
 if(!inserted.rows.length)return;
 const url=host.origin+'/waiver/'+encodeURIComponent(business.slug)+'#token='+token;
 const message={subject:'Please sign your participation waiver — '+clean(business.name),text:`Hello ${clean(data.name)},\n\n${clean(business.name)} has recorded your past appointment. Your booking is saved, but a required participation waiver is still pending.\n\nReview and sign securely: ${url}\n\nA parent or legal guardian must sign for participants under 18. Your signature will use the date you actually sign; it will not be backdated to the appointment. This private link expires in 30 days. Please do not forward it.\n\nIf any details are incorrect, contact the business.`,actions:[{label:'Review and sign waiver',url}]};
 await db.query("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES($1,'waiver_request',$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING",[appointmentId,business.id,email,maskDestination(email,'email'),JSON.stringify(message)]);
}

async function invitation(db,slug,token){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('This waiver link is invalid or expired. Contact the business for help.');
 const row=(await db.query("SELECT i.*,b.owner_id,b.name AS business_name,b.brand_primary,b.brand_background,s.data AS settings,a.data AS appointment_data,a.status AS appointment_status,a.date FROM booking_waiver_invitations i JOIN businesses b ON b.id=i.business_id JOIN appointments a ON a.id=i.appointment_id AND a.owner=b.owner_id JOIN settings s ON s.owner=b.owner_id WHERE i.token_hash=$1 AND b.slug=$2 AND b.status='active' AND i.expires_at>now() FOR UPDATE OF i,a",[tokenHash(token),slug])).rows[0];
 if(!row||row.appointment_status==='Cancelled')throw Error('This waiver link is invalid or expired. Contact the business for help.');
 row.data=object(row.appointment_data);row.config=object(row.settings);
 if(normalized(row.participant_name)!==normalized(row.data.name)||!row.completed_at&&String(row.member_number||'')!==String(row.data.memberNumber||'')||normalized(row.destination)!==normalized(row.data.email))throw Error('The booking contact changed. Contact the business for a new waiver link.');
 return row;
}
async function identityFor(db,row){
 const data=row.data;
 if(!data.memberNumber)return null;
 const identity=(await db.query('SELECT first_name,last_name,date_of_birth::text AS dob,member_number FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2',[row.business_id,data.memberNumber])).rows[0];
 if(!identity||normalized(identity.first_name+' '+identity.last_name)!==normalized(data.name))throw Error('Ask the business to verify the participant identity before signing.');
 return identity;
}
export async function previewBookingWaiver(db,{slug,token}){
 const row=await invitation(db,slug,token);
 if(row.completed_at)return {signed:true,business:row.business_name};
 const identity=await identityFor(db,row),parts=String(row.data.name||'').trim().split(/\s+/);
 return {signed:false,business:row.business_name,date:row.date,participantName:row.data.name,firstName:identity?.first_name||parts[0]||'',lastName:identity?.last_name||parts.slice(1).join(' '),identityExists:!!identity,identityNeedsUpdate:!!identity&&!identity.dob,document:publicWaiverDocument(row.config,row.brand_primary,row.brand_background)};
}
export async function signBookingWaiver(db,{slug,token,dateOfBirth,firstName,lastName,signature},audit={}){
 const row=await invitation(db,slug,token);
 if(row.completed_at)return {ok:true,signed:true};
 let identity=await identityFor(db,row);
 waiverMinor(dateOfBirth);
 if(identity&&identity.dob!==dateOfBirth)throw Error('The participant birth date does not match the client record. Contact the business if it needs correcting.');
 let memberNumber=identity?.member_number;
 if(!identity){
  firstName=String(firstName||'').trim();lastName=String(lastName||'').trim();
  if(!firstName||!lastName||firstName.length>50||lastName.length>50||normalized(firstName+' '+lastName)!==normalized(row.data.name))throw Error('The participant name must match the saved booking. Contact the business for corrections.');
  memberNumber=await issueMemberId(db,{businessId:row.business_id,name:firstName+' '+lastName,firstName,lastName,dateOfBirth});
  await ensureMemberBookingIdentity(db,{businessId:row.business_id,ownerId:row.owner_id,firstName,lastName,email:row.destination,dateOfBirth,phone:row.data.phone||'',memberNumber,source:'Owner booking waiver'});
 }
 const waiverId=await ensureParticipationWaiver(db,{businessId:row.business_id,memberNumber,config:row.config,services:[{requiresWaiver:true}],input:signature,primary:row.brand_primary,background:row.brand_background,audit});
 const signedAt=new Date().toISOString();
 await db.query('UPDATE booking_waiver_invitations SET completed_at=now(),waiver_id=$1 WHERE token_hash=$2',[waiverId,tokenHash(token)]);
 await db.query('UPDATE appointments SET data=$1 WHERE id=$2 AND owner=$3',[JSON.stringify({...row.data,memberNumber,waiverFollowup:{...row.data.waiverFollowup,status:'signed',signedAt,waiverId}}),row.appointment_id,row.owner_id]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'booking_waiver_signed',$4)",[randomUUID(),row.owner_id,signedAt,JSON.stringify({appointment:row.appointment_id,waiverId,signedAt})]);
 return {ok:true,signed:true};
}
