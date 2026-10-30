import {createHash,randomBytes} from 'node:crypto';
import {tokenHash} from './security.mjs';
const validId=x=>typeof x==='string'&&/^[-a-f0-9]{36}$/i.test(x);
/** Only the actual owner session can delegate collection, never a support impersonation. */
export async function authorizeNativePayment(db,{owner,sessionHash,bookingId,challenge,state}){
 if(!validId(bookingId)||!/^[A-Za-z0-9_-]{43}$/.test(challenge||'')||!/^[A-Za-z0-9_-]{32,100}$/.test(state||''))throw Error('Invalid phone authorization.');
 const row=(await db.query("SELECT b.id FROM businesses b JOIN sessions s ON s.user_id=b.owner_id AND s.token_hash=$2 AND s.expires_at>now() JOIN users u ON u.id=s.user_id AND u.must_change_password=false JOIN appointments a ON a.owner=b.owner_id AND a.id=$3 WHERE b.owner_id=$1 AND b.status='active' AND a.status<>'Cancelled'",[owner,sessionHash,bookingId])).rows[0];
 if(!row)throw Error('Sign in as this business owner to connect the phone.');
 const code=randomBytes(32).toString('hex');
 await db.query("DELETE FROM native_payment_authorizations WHERE expires_at<now()-interval '1 day' AND (grant_expires_at IS NULL OR grant_expires_at<now())");
 await db.query('INSERT INTO native_payment_authorizations(code_hash,challenge,state,session_hash,business_id,booking_id) VALUES($1,$2,$3,$4,$5,$6)',[tokenHash(code),challenge,state,sessionHash,row.id,bookingId]);
 return {code,state};
}
export async function exchangeNativePayment(db,{code,verifier,state}){
 if(!/^[a-f0-9]{64}$/.test(code||'')||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier||'')||!/^[A-Za-z0-9_-]{32,100}$/.test(state||''))throw Error('Invalid phone authorization.');
 const challenge=createHash('sha256').update(verifier).digest('base64url'),grant=randomBytes(32).toString('hex');
 const r=await db.query("UPDATE native_payment_authorizations n SET consumed_at=now(),grant_hash=$4,grant_expires_at=LEAST(now()+interval '1 hour',s.expires_at) FROM sessions s JOIN users u ON u.id=s.user_id AND u.must_change_password=false,businesses b WHERE n.code_hash=$1 AND n.challenge=$2 AND n.state=$3 AND n.expires_at>now() AND n.consumed_at IS NULL AND s.token_hash=n.session_hash AND s.expires_at>now() AND b.id=n.business_id AND b.owner_id=s.user_id AND b.status='active' RETURNING n.booking_id,n.grant_expires_at",[tokenHash(code),challenge,state,tokenHash(grant)]);
 if(!r.rows[0])throw Error('Phone authorization expired or already used. Open the appointment again.');
 return {token:grant,bookingId:r.rows[0].booking_id,expiresAt:r.rows[0].grant_expires_at};
}
export async function requireNativePayment(db,token){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('AUTH_REQUIRED');
 const r=(await db.query("SELECT n.business_id,n.booking_id,b.owner_id,b.slug,b.name FROM native_payment_authorizations n JOIN businesses b ON b.id=n.business_id AND b.status='active' JOIN sessions s ON s.token_hash=n.session_hash AND s.user_id=b.owner_id AND s.expires_at>now() JOIN users u ON u.id=s.user_id AND u.must_change_password=false WHERE n.grant_hash=$1 AND n.consumed_at IS NOT NULL AND n.grant_expires_at>now()",[tokenHash(token)])).rows[0];
 if(!r)throw Error('AUTH_REQUIRED');return r;
}
