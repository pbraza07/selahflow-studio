import {randomUUID} from 'node:crypto';
import {getPlatformRole} from './platform-roles.mjs';
import {sessionToken,tokenHash,validOrigin,trustedOrigin} from './security.mjs';

export async function supportActor(pool,req){
 const token=sessionToken(req);
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('AUTH_REQUIRED');
 const hash=tokenHash(token);
 const actor=(await pool.query('SELECT u.id,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash])).rows[0];
 if(!actor)throw Error('AUTH_REQUIRED');
 if(actor.must_change_password)throw Error('PASSWORD_CHANGE_REQUIRED');
 return {id:actor.id,hash};
}
export async function supportSelection(pool,actor){
 const row=(await pool.query("SELECT b.id,b.owner_id,b.slug,b.name,b.status FROM platform_support_sessions p JOIN businesses b ON b.id=p.business_id WHERE p.session_hash=$1 AND p.actor_id=$2",[actor.hash,actor.id])).rows[0];
 if(!row)return null;
 if(!await getPlatformRole(pool,actor.id)||row.status!=='active')throw Error('AUTH_REQUIRED');
 return row;
}
export async function auditSupport(pool,actor,business,action,method='',path=''){
 await pool.query('INSERT INTO platform_support_audit(id,actor_id,business_id,action,method,path) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actor.id,business,action,method,path]);
}
export async function startSupport(pool,actor,businessId){
 if(!await getPlatformRole(pool,actor.id))throw Error('FORBIDDEN');
 const b=(await pool.query("SELECT id,slug,name FROM businesses WHERE id=$1 AND status='active' FOR SHARE",[businessId])).rows[0];
 if(!b)throw Error('Business unavailable. Activate or restore it before opening support.');
 const old=(await pool.query('SELECT business_id FROM platform_support_sessions WHERE session_hash=$1',[actor.hash])).rows[0];
 if(old)await auditSupport(pool,actor,old.business_id,'end');
 await pool.query("INSERT INTO platform_support_sessions(session_hash,actor_id,business_id,expires_at) VALUES($1,$2,$3,'infinity'::timestamptz) ON CONFLICT(session_hash) DO UPDATE SET actor_id=excluded.actor_id,business_id=excluded.business_id,expires_at=excluded.expires_at",[actor.hash,actor.id,b.id]);
 await auditSupport(pool,actor,b.id,'start');
 return b;
}
export async function endSupport(pool,actor){
 const old=(await pool.query('DELETE FROM platform_support_sessions WHERE session_hash=$1 AND actor_id=$2 RETURNING business_id',[actor.hash,actor.id])).rows[0];
 if(old)await auditSupport(pool,actor,old.business_id,'end');
}
// Platform and account endpoints always retain the administrator's own identity.
export function isSupportWorkspacePath(path){
 return path==='/api/studio'||path.startsWith('/api/studio/')||path==='/api/business'||path==='/api/business/theme'||path==='/api/business/google'||path==='/api/business/google/callback'||path==='/api/branding/logo'||path==='/api/addresses';
}
export async function supportOwner(pool,req,actor){
 if(!isSupportWorkspacePath(new URL(req.url).pathname))return actor.id;
 const b=await supportSelection(pool,actor);
 if(!b){
  // After exit, an old support tab must never act against the admin's own business.
  const ref=req.headers.get('referer');
  if(ref){let url;try{url=new URL(ref);}catch{throw Error('AUTH_REQUIRED');}
   if(/^\/studio\/[^/]+$/.test(url.pathname)){const owned=(await pool.query('SELECT slug FROM businesses WHERE owner_id=$1',[actor.id])).rows[0];if(url.origin!==trustedOrigin(req)||url.pathname!=='/studio/'+owned?.slug)throw Error('AUTH_REQUIRED');}
  }
  return actor.id;
 }
 // Reject old tabs after business switching, and prevent cross-origin write requests.
 let referer;try{referer=new URL(req.headers.get('referer')||'');}catch{throw Error('AUTH_REQUIRED');}
 const path=new URL(req.url).pathname;
 const waiverRead=req.method==='GET'&&/^\/api\/studio\/waivers\/[^/]+$/.test(path)&&referer.pathname==='/studio/waiver/'+path.split('/').at(-1);
 if(referer.origin!==trustedOrigin(req)||(referer.pathname!=='/studio/'+b.slug&&!waiverRead))throw Error('AUTH_REQUIRED');
 if(!['GET','HEAD'].includes(req.method)&&!validOrigin(req))throw Error('AUTH_REQUIRED');
 // Account/OAuth and push device ownership remain outside support impersonation.
 if(new URL(req.url).pathname.startsWith('/api/business/google'))throw Error('Owner Google connection requires the business owner.');
 await auditSupport(pool,actor,b.id,'request',req.method,new URL(req.url).pathname);
 return b.owner_id;
}
