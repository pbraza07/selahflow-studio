import {randomBytes} from 'node:crypto';
import {completeGoogleFederation,readIdentityCookie,identityCookie} from './owner-federation.mjs';
import {cookie,tokenHash,trustedOrigin} from './security.mjs';
import {getPlatformRole} from './platform-roles.mjs';
import {dashboardPath} from './route-slugs.mjs';
export async function googleOwnerCallback(pool,req,env=process.env,options={}){
 const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}),origin=trustedOrigin(req);
 headers.append('Set-Cookie',identityCookie('selahflow_oauth_binding','',0,env));
 let target='/signup?identity=failed';
 try{
  const q=new URL(req.url).searchParams;
  const identity=await completeGoogleFederation(pool,{state:q.get('state'),binding:readIdentityCookie(req,'selahflow_oauth_binding'),code:q.has('error')?null:q.get('code')},env,options);
  const user=(await pool.query('SELECT u.id,u.must_change_password FROM owner_federated_identities i JOIN users u ON u.id=i.user_id WHERE i.provider=$1 AND i.subject=$2',[identity.provider,identity.subject])).rows[0];
  if(user){
   const session=randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[tokenHash(session),user.id]);
   const business=(await pool.query('SELECT slug,status FROM businesses WHERE owner_id=$1 LIMIT 1',[user.id])).rows[0],role=await getPlatformRole(pool,user.id);
   target=user.must_change_password?'/account/require-password-change':role?'/admin/platform':business?(business.status==='active'?dashboardPath(business.slug):'/registration-status'):'/';
   headers.append('Set-Cookie',cookie(session));headers.append('Set-Cookie',identityCookie('selahflow_signup_identity','',0,env));
  }else if((await pool.query('SELECT id FROM users WHERE email=$1',[identity.email])).rows.length){
   // Matching email alone must never attach a provider to an existing account.
   target='/login?identity=existing-email';
  }else{
   const proof=randomBytes(32).toString('hex');await pool.query('INSERT INTO owner_signup_identities(token_hash,provider,subject,email,display_name,plan_code) VALUES($1,$2,$3,$4,$5,$6)',[tokenHash(proof),identity.provider,identity.subject,identity.email,identity.displayName,identity.planCode]);
   headers.append('Set-Cookie',identityCookie('selahflow_signup_identity',proof,1800,env));target='/signup?plan='+identity.planCode+'&identity=verified';
  }
 }catch{}
 headers.set('Location',origin+target);return new Response(null,{status:303,headers});
}
