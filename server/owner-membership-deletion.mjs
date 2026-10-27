import {expireClientCheckouts} from './client-checkout-expiry.mjs';
import {retainDeletedClientFinancials} from './client-financial-retention.mjs';

/** Membership-only removal; existing bookings and their client IDs are retained.
 * The caller owns the transaction and authenticated business context. */
export async function deleteOwnerMembership(db,{owner,businessId,id,api=undefined}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const member=(await db.query("SELECT m.* FROM customer_memberships m JOIN businesses b ON b.id=m.business_id WHERE m.business_id=$1 AND m.id=$2 AND b.owner_id=$3 AND b.status='active' FOR UPDATE OF m",[businessId,id,owner])).rows[0];
 if(!member)throw Error('Member not found in this business.');
 if(member.stripe_subscription_id&&!['canceled','expired'].includes(member.status))throw Error('Cancel the active Stripe subscription before deleting this membership.');
 await db.query('LOCK TABLE membership_payment_emails,membership_payment_invitations IN SHARE ROW EXCLUSIVE MODE');
 for(const table of ['membership_payment_emails','membership_payment_invitations'])if((await db.query(`SELECT 1 FROM ${table} WHERE business_id=$1 AND membership_id=$2 AND status='processing'`,[businessId,id])).rows.length)throw Error('A membership email is being sent. Retry deleting after delivery finishes.');
 await expireClientCheckouts(db,{businessId,members:[member]},api);
 const specs=[];
 for(const table of ['membership_session_ledger','stripe_payment_receipts'])specs.push({table,rows:(await db.query(`SELECT * FROM ${table} WHERE business_id=$1 AND membership_id=$2`,[businessId,id])).rows});
 const retainedFinancialRecords=await retainDeletedClientFinancials(db,{businessId,specs});
 await db.query("UPDATE first_customer_commissions SET source_id=NULL WHERE business_id=$1 AND kind='membership' AND source_id=$2",[businessId,id]);
 await db.query('UPDATE stripe_payment_receipts SET membership_id=NULL WHERE business_id=$1 AND membership_id=$2',[businessId,id]);
 await db.query('UPDATE membership_requests SET membership_id=NULL WHERE business_id=$1 AND membership_id=$2',[businessId,id]);
 await db.query('DELETE FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2',[businessId,id]);
 await db.query("UPDATE business_client_profiles SET deleted_at=now(),name='Deleted client',email='',phone='',notes='',import_columns='{}'::jsonb,updated_at=now() WHERE owner=$1 AND deleted_at IS NULL AND (member_number=$2 OR source_key=$3)",[owner,member.member_number,'membership-'+id]);
 await db.query('INSERT INTO deleted_client_records(business_id,source_table,record_digest) VALUES($1,$2,md5($3)) ON CONFLICT DO NOTHING',[businessId,'customer_memberships',id]);
 await db.query('DELETE FROM customer_memberships WHERE business_id=$1 AND id=$2',[businessId,id]);
 return {ok:true,deleted:member.customer_name,retainedFinancialRecords};
}
