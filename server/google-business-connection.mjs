import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {tokenHash} from './security.mjs';
export const GOOGLE_BUSINESS_SCOPE='https://www.googleapis.com/auth/business.manage';
const keyOf=env=>env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY||env.GMAIL_TOKEN_ENCRYPTION_KEY||'';
export const googleBusinessConfigured=(env=process.env)=>!!(env.GOOGLE_BUSINESS_CLIENT_ID&&env.GOOGLE_BUSINESS_CLIENT_SECRET&&/^[a-f0-9]{64}$/i.test(keyOf(env)));
export const validPlaceId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,255}$/.test(value);
export function googleBusinessSeal(value,business,purpose,env=process.env){
 if(!googleBusinessConfigured(env))throw Error('Google Business connection is not configured.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyOf(env),'hex'),iv);cipher.setAAD(Buffer.from('selahflow:google-business:'+business+':'+purpose));
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.');
}
export function googleBusinessOpen(value,business,purpose,env=process.env){
 if(!googleBusinessConfigured(env))throw Error('Google Business connection is not configured.');
 const [iv,tag,data]=String(value).split('.').map(s=>Buffer.from(s,'base64url')),cipher=createDecipheriv('aes-256-gcm',Buffer.from(keyOf(env),'hex'),iv);
 cipher.setAAD(Buffer.from('selahflow:google-business:'+business+':'+purpose));cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
export async function ownedGoogleBusiness(db,owner){
 const row=(await db.query("SELECT b.id,b.slug,b.name,b.city,b.region,g.place_id,g.show_reviews,g.show_photos,g.connection_status,g.account_email,g.location_name FROM businesses b LEFT JOIN business_google_profiles g ON g.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!row)throw Error('FORBIDDEN');return row;
}
export async function googleBusinessStatus(db,owner,env=process.env){
 const b=await ownedGoogleBusiness(db,owner);return {configured:googleBusinessConfigured(env),placesConfigured:!!(env.GOOGLE_MAPS_API_KEY||env.GOOGLE_PLACES_API_KEY),connected:b.connection_status==='connected',needsReconnect:b.connection_status==='needs_reconnect',accountEmail:b.account_email||'',placeId:b.place_id||'',showReviews:b.show_reviews!==false,showPhotos:b.show_photos!==false};
}
export async function googleOwnerMutation(db,owner,action){
 const c=db.connect?await db.connect():db;
 try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",['selahflow:google-business:'+owner]);const b=await ownedGoogleBusiness(c,owner);const result=await action(c,b);await c.query('COMMIT');return result;}
 catch(e){await c.query('ROLLBACK');throw e;}finally{if(c!==db)c.release();}
}
async function googleJson(url,options={},fetcher=fetch){
 const r=await fetcher(url,{...options,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error(r.status===401?'GOOGLE_RECONNECT':'Google Business access unavailable. Check API approval and permissions.');return r.json();
}
export async function beginGoogleBusiness(db,{owner,session,origin},env=process.env){
 if(!googleBusinessConfigured(env))throw Error('Google Business connection is not configured.');
 const base=new URL(origin);if(base.protocol!=='https:'&&base.hostname!=='localhost')throw Error('Secure origin required.');
 if(!/^[a-f0-9]{64}$/.test(session||''))throw Error('AUTH_REQUIRED');
 return googleOwnerMutation(db,owner,async(c,b)=>{
 const state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url'),redirect=base.origin+'/api/business/google/callback';
 await c.query('DELETE FROM business_google_oauth_states WHERE owner_id=$1 OR expires_at<=now()',[owner]);
 await c.query('INSERT INTO business_google_oauth_states(state_hash,business_id,owner_id,session_hash,encrypted_verifier,redirect_uri) VALUES($1,$2,$3,$4,$5,$6)',[tokenHash(state),b.id,owner,tokenHash(session),googleBusinessSeal(verifier,b.id,'verifier',env),redirect]);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_BUSINESS_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'openid email '+GOOGLE_BUSINESS_SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return {authorizationUrl:url.toString()};
 });
}
export async function completeGoogleBusiness(db,{owner,session,state,code},env=process.env,fetcher=fetch){
 if(!/^[a-f0-9]{64}$/.test(state||'')||typeof code!=='string'||!code||code.length>4096||!/^[a-f0-9]{64}$/.test(session||''))throw Error('Invalid authorization.');
 return googleOwnerMutation(db,owner,async(c,b)=>{
 const saved=(await c.query('DELETE FROM business_google_oauth_states WHERE state_hash=$1 AND owner_id=$2 AND business_id=$3 AND session_hash=$4 AND expires_at>now() RETURNING *',[tokenHash(state),owner,b.id,tokenHash(session)])).rows[0];if(!saved)throw Error('Invalid authorization.');
 const t=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_BUSINESS_CLIENT_ID,client_secret:env.GOOGLE_BUSINESS_CLIENT_SECRET,redirect_uri:saved.redirect_uri,grant_type:'authorization_code',code_verifier:googleBusinessOpen(saved.encrypted_verifier,b.id,'verifier',env)}).toString()},fetcher);
 if(!t.access_token||!t.refresh_token||!String(t.scope||'').split(' ').includes(GOOGLE_BUSINESS_SCOPE))throw Error('Approve Business Profile and offline access.');
 const p=await googleJson('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+t.access_token}},fetcher);
 if(p.email_verified!==true||typeof p.email!=='string'||p.email.length>254)throw Error('Verified Google account required.');
 await c.query("INSERT INTO business_google_profiles(business_id,encrypted_refresh_token,account_email,connection_status) VALUES($1,$2,$3,'connected') ON CONFLICT(business_id) DO UPDATE SET encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,account_email=EXCLUDED.account_email,connection_status='connected',location_name='',updated_at=now()",[b.id,googleBusinessSeal(t.refresh_token,b.id,'refresh',env),p.email]);return {slug:b.slug};
 });
}
async function accessToken(c,b,env,fetcher){
 const g=(await c.query("SELECT encrypted_refresh_token FROM business_google_profiles WHERE business_id=$1 AND connection_status='connected'",[b.id])).rows[0];if(!g?.encrypted_refresh_token)throw Error('Connect your Google account first.');
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_BUSINESS_CLIENT_ID,client_secret:env.GOOGLE_BUSINESS_CLIENT_SECRET,refresh_token:googleBusinessOpen(g.encrypted_refresh_token,b.id,'refresh',env),grant_type:'refresh_token'}).toString(),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('GOOGLE_RECONNECT');const t=await r.json();if(!t.access_token)throw Error('GOOGLE_RECONNECT');return t.access_token;
}
async function locationsForToken(token,fetcher){
 const headers={Authorization:'Bearer '+token},items=[];let next='';
 // Bound the interactive picker; do not silently auto-select similarly named businesses.
 for(let aPage=0;aPage<3;aPage++){
 const u=new URL('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');u.searchParams.set('pageSize','20');if(next)u.searchParams.set('pageToken',next);
 const accounts=await googleJson(u.toString(),{headers},fetcher);
 for(const a of (accounts.accounts||[]).slice(0,20)){
 if(!/^accounts\/[A-Za-z0-9_-]+$/.test(a.name||''))continue;let page='';
 for(let n=0;n<5;n++){
 const url=new URL('https://mybusinessbusinessinformation.googleapis.com/v1/'+a.name+'/locations');url.search=new URLSearchParams({readMask:'name,title,storefrontAddress,metadata',pageSize:'100',...(page?{pageToken:page}:{})}).toString();
 const data=await googleJson(url.toString(),{headers},fetcher);
 for(const l of data.locations||[])if(/^locations\/[A-Za-z0-9_-]+$/.test(l.name||'')&&validPlaceId(l.metadata?.placeId))items.push({key:a.name+'/'+l.name,title:String(l.title||'Business').slice(0,200),address:[...(l.storefrontAddress?.addressLines||[]),l.storefrontAddress?.locality,l.storefrontAddress?.administrativeArea].filter(Boolean).join(', ').slice(0,400),placeId:l.metadata.placeId});
 page=data.nextPageToken||'';if(!page)break;
 } }
 next=accounts.nextPageToken||'';if(!next)break;
 }return items;
}
export async function googleBusinessLocations(db,owner,env=process.env,fetcher=fetch){
 return googleOwnerMutation(db,owner,async(c,b)=>({locations:await locationsForToken(await accessToken(c,b,env,fetcher),fetcher)}));
}
export async function selectGoogleLocation(db,owner,key,env=process.env,fetcher=fetch){
 if(typeof key!=='string'||key.length>250)throw Error('Choose a Google business location.');
 return googleOwnerMutation(db,owner,async(c,b)=>{
 const items=await locationsForToken(await accessToken(c,b,env,fetcher),fetcher),chosen=items.find(x=>x.key===key);if(!chosen)throw Error('Choose a location managed by your connected Google account.');
 await c.query('UPDATE business_google_profiles SET place_id=$1,location_name=$2,updated_at=now() WHERE business_id=$3',[chosen.placeId,key,b.id]);return {ok:true};
 });
}
export async function saveGoogleDisplay(db,owner,{placeId,showReviews,showPhotos}){
 if((placeId!==''&&!validPlaceId(placeId))||typeof showReviews!=='boolean'||typeof showPhotos!=='boolean')throw Error('Choose a valid Google Place ID and display options.');
 return googleOwnerMutation(db,owner,async(c,b)=>{await c.query('INSERT INTO business_google_profiles(business_id,place_id,show_reviews,show_photos) VALUES($1,$2,$3,$4) ON CONFLICT(business_id) DO UPDATE SET place_id=EXCLUDED.place_id,show_reviews=EXCLUDED.show_reviews,show_photos=EXCLUDED.show_photos,updated_at=now()',[b.id,placeId,showReviews,showPhotos]);return {ok:true};});
}
export async function disconnectGoogleBusiness(db,owner){
 // Remove only this app's business connection. Never revoke the platform Gmail grant.
 return googleOwnerMutation(db,owner,async(c,b)=>{await c.query('DELETE FROM business_google_oauth_states WHERE business_id=$1',[b.id]);await c.query("INSERT INTO business_google_profiles(business_id,show_reviews,show_photos) VALUES($1,false,false) ON CONFLICT(business_id) DO UPDATE SET place_id='',show_reviews=false,show_photos=false,encrypted_refresh_token=NULL,account_email='',location_name='',connection_status='disconnected',updated_at=now()",[b.id]);return {ok:true};});
}
