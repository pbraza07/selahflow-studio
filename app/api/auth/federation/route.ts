import {getPool} from '../../../../server/database.mjs';
import {googleSignInReady,startGoogleFederation,signupIdentity,identityCookie,readIdentityCookie} from '../../../../server/owner-federation.mjs';
import {validOrigin,trustedOrigin,tokenHash} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){try{const identity=await signupIdentity(getPool(),req);return Response.json({google:googleSignInReady(),identity:identity?{email:identity.email,name:identity.display_name,provider:identity.provider}:null},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({google:false,identity:null},{headers:{'Cache-Control':'no-store'}});}}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const raw=await req.text();if(raw.length>1000)return Response.json({error:'Request too large.'},{status:413});const b=JSON.parse(raw),pool=getPool();
  if(b.action==='clear'){const proof=readIdentityCookie(req,'selahflow_signup_identity');if(proof)await pool.query('DELETE FROM owner_signup_identities WHERE token_hash=$1',[tokenHash(proof)]);const h=new Headers({'Cache-Control':'no-store'});h.append('Set-Cookie',identityCookie('selahflow_signup_identity','',0));return Response.json({ok:true},{headers:h});}
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
  const rate=await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['owner-oauth:'+tokenHash(ip)]);
  if(rate.rows[0].count>30)return Response.json({error:'Too many sign-in attempts. Try again later.'},{status:429});
  const previous=readIdentityCookie(req,'selahflow_signup_identity');if(previous)await pool.query('DELETE FROM owner_signup_identities WHERE token_hash=$1',[tokenHash(previous)]);
  const result=await startGoogleFederation(pool,{origin:trustedOrigin(req),mode:b.mode,planCode:b.planCode});
  const headers=new Headers({'Cache-Control':'no-store'});headers.append('Set-Cookie',identityCookie('selahflow_oauth_binding',result.binding));headers.append('Set-Cookie',identityCookie('selahflow_signup_identity','',0));
  return Response.json({authorizationUrl:result.authorizationUrl},{headers});
 }catch{return Response.json({error:'Google sign-in is unavailable. Continue with email or try again.'},{status:400});}
}
