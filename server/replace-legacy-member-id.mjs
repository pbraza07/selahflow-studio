import {issueMemberId} from './member-id-policy.mjs';
/** Caller owns the owner-scoped transaction. Historical bookings and money stay unchanged. */
export async function replaceLegacyMemberId(db,{owner,businessId,client}){
 if(!(await db.query("SELECT id FROM businesses WHERE id=$1 AND owner_id=$2",[businessId,owner])).rows.length)throw Error('Business workspace unavailable.');
 const old=client.memberNumber;
 if(!old||/^[A-Z]{2}[0-9]{6}$/.test(old))throw Error('This client already has an eight-character ID.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(client.dateOfBirth||''))throw Error('Enter the client date of birth before replacing this legacy ID.');
 const saved=(await db.query('SELECT identity_key=member_identity_key($3,$4::date) AS matches FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,old,client.name,client.dateOfBirth])).rows[0];
 if(!saved?.matches)throw Error('This registration identity changed. Refresh and check its name and birth date.');
 const number=await issueMemberId(db,{businessId,name:client.name,dateOfBirth:client.dateOfBirth,replaceLegacy:true});
 await db.query('UPDATE business_client_profiles SET member_number=$1,updated_at=now() WHERE owner=$2 AND member_number=$3 AND deleted_at IS NULL',[number,owner,old]);
 await db.query('UPDATE customer_booking_ids SET member_number=$1 WHERE business_id=$2 AND member_number=$3',[number,businessId,old]);
 await db.query('UPDATE customer_memberships SET member_number=$1 WHERE business_id=$2 AND member_number=$3',[number,businessId,old]);
 await db.query("UPDATE booking_receipt_emails m SET message=jsonb_set(m.message,'{text}',to_jsonb(replace(m.message->>'text',$3,$4))) FROM booking_requests r WHERE m.booking_key=r.id AND m.business_id=$1 AND r.business_id=$1 AND r.status='pending' AND r.details::jsonb->>'memberNumber'=$2 AND m.status IN ('queued','failed','not_configured') AND m.message ? 'text'",[businessId,old,'Membership ID: '+old,'Membership ID: '+number]);
 // Unreviewed requests follow the current registration. Approved/cancelled
 // records and previously rendered receipt snapshots remain historical.
 for(const table of ['booking_requests','membership_requests'])await db.query(`UPDATE ${table} SET details=jsonb_set(details::jsonb,'{memberNumber}',to_jsonb($1::text))${table==='booking_requests'?'::text':''} WHERE business_id=$2 AND status='pending' AND details::jsonb->>'memberNumber'=$3`,[number,businessId,old]);
 // Update only active booking references, retaining the former ID for audit.
 await db.query("UPDATE appointments SET data=(data::jsonb||jsonb_build_object('memberNumber',$1::text,'previousMemberNumber',$2::text))::text WHERE owner=$3 AND status NOT IN ('Completed','Cancelled','No-show') AND data::jsonb->>'memberNumber'=$2",[number,old,owner]);
 // Signed documents and completed history remain exact historical evidence.
 await db.query('INSERT INTO member_id_history_aliases(business_id,previous_number,current_number) VALUES($1,$2,$3) ON CONFLICT(business_id,previous_number) DO UPDATE SET current_number=excluded.current_number',[businessId,old,number]);
 await db.query('DELETE FROM business_member_ids WHERE business_id=$1 AND member_number=$2',[businessId,old]);
 await db.query('DELETE FROM legacy_business_member_numbers WHERE business_id=$1 AND member_number=$2',[businessId,old]);
 return {oldMemberNumber:old,memberNumber:number};
}
