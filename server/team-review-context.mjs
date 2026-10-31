import {teamIdentity} from './team-portal.mjs';
import {tokenHash} from './security.mjs';
// Reviewer rights come from current business settings, never a client-supplied staff ID.
export async function teamReviewContext(pool,req){
 const authorization=req.headers.get('authorization');let link,cfg;
 if(authorization!==null){
  const token=authorization.replace(/^Bearer\s+/i,'');
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('ACCESS_DENIED');
  link=(await pool.query("SELECT l.business_id,l.staff_id,b.owner_id,s.data AS settings_data,b.name AS business_name FROM booking_review_links l JOIN businesses b ON b.id=l.business_id JOIN settings s ON s.owner=b.owner_id WHERE l.token_hash=$1 AND l.expires_at>now() AND b.status='active'",[tokenHash(token)])).rows[0];
  if(!link)throw Error('ACCESS_DENIED');cfg=JSON.parse(link.settings_data||'{}');
 }else{
  const account=await teamIdentity(pool,req);cfg=JSON.parse(account.config);
  link={business_id:account.business_id,staff_id:account.staff_id,owner_id:account.owner_id,business_name:account.business_name};
 }
 const canReview=cfg.bookingApprovalEnabled===true&&cfg.bookingApprovalReviewer===link.staff_id&&cfg.staff?.some(s=>s.id===link.staff_id)===true;
 if(authorization!==null&&!canReview)throw Error('ACCESS_DENIED');
 return {pool,link,cfg,canReview};
}
