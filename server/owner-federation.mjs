import {randomBytes,createHash} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {tokenHash} from './security.mjs';
import {PLAN_CATALOG} from './plan-entitlements.mjs';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:10000});
export const FEDERATION_PREFIX='sf_auth_';
export function googleSignInConfig(env=process.env){
 // Reuse an already registered callback when using the existing web OAuth client.
 // Identity requests use only openid/email/profile, never Gmail or offline scopes.
 const dedicated=!!(env.GOOGLE_SIGNIN_CLIENT_ID&&env.GOOGLE_SIGNIN_CLIENT_SECRET);
 return {clientId:dedicated?env.GOOGLE_SIGNIN_CLIENT_ID:env.GMAIL_CLIENT_ID,
  clientSecret:dedicated?env.GOOGLE_SIGNIN_CLIENT_SECRET:env.GMAIL_CLIENT_SECRET,
  callback:'/api/platform/gmail/callback'};
}
export function googleSignInReady(env=process.env){const c=googleSignInConfig(env);return !!(c.clientId&&c.clientSecret);}
export function identityCookie(name,value,maxAge=600,env=process.env){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${env.NODE_ENV==='production'?'; Secure':''}`;}
export function readIdentityCookie(req,name){const value=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';return /^[a-f0-9]{64}$/.test(value)?value:'';}
export async function startGoogleFederation(db,{origin,mode='signup',planCode='free'},env=process.env){
 if(!googleSignInReady(env))throw Error('Google sign-in is not configured. Continue with email.');
 if(!['signup','login'].includes(mode)||!Object.hasOwn(PLAN_CATALOG,planCode))throw Error('Choose a valid signup package.');
 const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('Invalid application origin.');
 const config=googleSignInConfig(env),state=FEDERATION_PREFIX+randomBytes(32).toString('hex'),binding=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url'),redirect=base.origin+config.callback;
 await db.query('DELETE FROM owner_federation_states WHERE expires_at<=now()');
 await db.query('DELETE FROM owner_signup_identities WHERE expires_at<=now()');
 await db.query('INSERT INTO owner_federation_states(state_hash,binding_hash,verifier,nonce_hash,redirect_uri,mode,plan_code) VALUES($1,$2,$3,$4,$5,$6,$7)',[tokenHash(state),tokenHash(binding),verifier,tokenHash(nonce),redirect,mode,planCode]);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:redirect,response_type:'code',scope:'openid email profile',prompt:'select_account',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return {authorizationUrl:url.href,binding};
}
export async function verifyGoogleIdentity(token,{clientId,nonceHash,keys=googleKeys}){
 if(typeof token!=='string'||token.length>20000)throw Error('Google identity could not be verified.');
 const {payload:p}=await jwtVerify(token,keys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,maxTokenAge:'10 minutes',clockTolerance:30,requiredClaims:['sub','exp','iat','nonce','email','email_verified']});
 if(p.email_verified!==true||typeof p.nonce!=='string'||tokenHash(p.nonce)!==nonceHash||
    p.azp!==undefined&&p.azp!==clientId||typeof p.sub!=='string'||!p.sub||p.sub.length>255||
    typeof p.email!=='string'||p.email.length>254||!/^\S+@\S+\.\S+$/.test(p.email))throw Error('Google identity could not be verified.');
 return {provider:'google',subject:p.sub,email:p.email.trim().toLowerCase(),displayName:typeof p.name==='string'?p.name.slice(0,120):''};
}
export async function completeGoogleFederation(db,{state,binding,code},env=process.env,{fetcher=fetch,keys=googleKeys}={}){
 if(typeof state!=='string'||!/^sf_auth_[a-f0-9]{64}$/.test(state)||!binding||typeof code!=='string'||!code||code.length>4096)throw Error('Google sign-in expired. Please try again.');
 const saved=(await db.query('DELETE FROM owner_federation_states WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>now() RETURNING *',[tokenHash(state),tokenHash(binding)])).rows[0];
 if(!saved)throw Error('Google sign-in expired. Please try again.');
 const config=googleSignInConfig(env);
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:saved.redirect_uri,grant_type:'authorization_code',code_verifier:saved.verifier}).toString(),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Google sign-in could not be completed.');
 const token=await response.json();const identity=await verifyGoogleIdentity(token.id_token,{clientId:config.clientId,nonceHash:saved.nonce_hash,keys});
 return {...identity,mode:saved.mode,planCode:saved.plan_code};
}
export async function signupIdentity(db,req){
 const proof=readIdentityCookie(req,'selahflow_signup_identity');if(!proof)return null;
 return (await db.query('SELECT provider,subject,email,display_name,plan_code FROM owner_signup_identities WHERE token_hash=$1 AND expires_at>now()',[tokenHash(proof)])).rows[0]||null;
}
