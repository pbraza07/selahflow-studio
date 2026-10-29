import {teamIdentity} from './team-portal.mjs';
import {getPool} from './database.mjs';
import {tokenHash,sessionToken} from './security.mjs';
/** Every subscription belongs to one approved business and one selected reviewer. */
export async function pushContext(req){
 const pool=getPool();
 if(new URL(req.url).pathname==='/api/team/push'){try{const a=await teamIdentity(pool,req);return {pool,businessId:a.business_id,businessSlug:a.slug,businessName:a.business_name,ownerId:a.owner_id,reviewer:'team-account:'+a.id,settings:JSON.parse(a.config),workspacePath:'/team/workspace'};}catch{throw Error('ACCESS_DENIED');}}
 const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(bearer){
  if(!/^[0-9a-f]{64}$/.test(bearer))throw Error('ACCESS_DENIED');
  const found=(await pool.query("SELECT b.id AS business_id,b.slug AS business_slug,b.name AS business_name,b.owner_id,l.staff_id AS reviewer,s.data FROM booking_review_links l JOIN businesses b ON b.id=l.business_id JOIN settings s ON s.owner=b.owner_id WHERE l.token_hash=$1 AND l.expires_at>now() AND b.status='active'",[tokenHash(bearer)])).rows[0];
  if(!found)throw Error('ACCESS_DENIED');
  const cfg=JSON.parse(found.data||'{}');
  if(cfg.bookingApprovalEnabled!==true||cfg.bookingApprovalReviewer!==found.reviewer||!cfg.staff?.some(x=>x.id===found.reviewer))throw Error('ACCESS_DENIED');
  return {pool,businessId:found.business_id,businessSlug:found.business_slug,businessName:found.business_name,ownerId:found.owner_id,reviewer:found.reviewer,settings:cfg};
 }
 let ownerId;
 try{
   const token=sessionToken(req);
   if(!token||!/^[0-9a-f]{64}$/.test(token))throw Error('ACCESS_DENIED');
   const row=(await pool.query("SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",[tokenHash(token)])).rows[0];
   if(!row)throw Error('ACCESS_DENIED');
   ownerId=row.id;
 }catch{throw Error('ACCESS_DENIED');}
 const found=(await pool.query("SELECT b.id AS business_id,b.slug AS business_slug,b.name AS business_name,b.owner_id,s.data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[ownerId])).rows[0];
 if(!found)throw Error('ACCESS_DENIED');
 return {pool,businessId:found.business_id,businessSlug:found.business_slug,businessName:found.business_name,ownerId,reviewer:'owner',settings:JSON.parse(found.data||'{}')};
}
