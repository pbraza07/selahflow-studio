import {randomBytes,createCipheriv,createDecipheriv,createHash,randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {tokenHash} from './security.mjs';
export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.send';
export const selectedEmailProvider=(env=process.env)=>env.EMAIL_PROVIDER||(env.RESEND_API_KEY?'resend':'gmail');
export function gmailConfigured(env=process.env){return !!(env.GMAIL_CLIENT_ID&&env.GMAIL_CLIENT_SECRET&&/^[a-f0-9]{64}$/i.test(env.GMAIL_TOKEN_ENCRYPTION_KEY||''));}
const emailValid=x=>typeof x==='string'&&x.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x);
export function sealGmail(value,purpose,env=process.env){
 if(!gmailConfigured(env))throw Error('Gmail server setup is incomplete.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(env.GMAIL_TOKEN_ENCRYPTION_KEY,'hex'),iv);
 cipher.setAAD(Buffer.from('selahflow:'+purpose));
 const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');
}
export function openGmail(value,purpose,env=process.env){
 if(!gmailConfigured(env))throw Error('Gmail server setup is incomplete.');
 const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64url'));
 const cipher=createDecipheriv('aes-256-gcm',Buffer.from(env.GMAIL_TOKEN_ENCRYPTION_KEY,'hex'),iv);
 cipher.setAAD(Buffer.from('selahflow:'+purpose));cipher.setAuthTag(tag);
 return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
export async function gmailStatus(db=getPool(),env=process.env){
 const row=(await db.query("SELECT email,status FROM platform_gmail_connection WHERE id='shared'")).rows[0];
 return {setupComplete:gmailConfigured(env),connected:!!(gmailConfigured(env)&&row?.status==='connected'),sender:row?.email||'',needsReconnect:row?.status==='needs_reconnect',missingConfiguration:[!env.GMAIL_CLIENT_ID&&'GMAIL_CLIENT_ID',!env.GMAIL_CLIENT_SECRET&&'GMAIL_CLIENT_SECRET',!/^[a-f0-9]{64}$/i.test(env.GMAIL_TOKEN_ENCRYPTION_KEY||'')&&'GMAIL_TOKEN_ENCRYPTION_KEY'].filter(Boolean)};
}
export async function beginGmailConnection(db,{actor,session,origin},env=process.env){
 if(!gmailConfigured(env))throw Error('Configure the Google OAuth client on the staging server first.');
 const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');
 const redirect=host.origin+'/api/platform/gmail/callback',state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
 await db.query('DELETE FROM platform_gmail_oauth_states WHERE actor_id=$1 OR expires_at<=now()',[actor]);
 await db.query('INSERT INTO platform_gmail_oauth_states(state_hash,actor_id,session_hash,encrypted_verifier,redirect_uri) VALUES($1,$2,$3,$4,$5)',[tokenHash(state),actor,tokenHash(session),sealGmail(verifier,'verifier',env),redirect]);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'openid email '+GMAIL_SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return {authorizationUrl:url.toString()};
}
async function gmailMutation(db,action){
 const client=db.connect?await db.connect():db;
 try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('selahflow:shared-gmail'))");const result=await action(client);await client.query('COMMIT');return result;}
 catch(e){await client.query('ROLLBACK');throw e;}
 finally{if(client!==db)client.release();}
}
export async function completeGmailConnection(db,input,env=process.env,fetcher=fetch){
 return gmailMutation(db,client=>finishGmailConnection(client,input,env,fetcher));
}
async function finishGmailConnection(db,{actor,session,state,code},env,fetcher){
 if(!/^[a-f0-9]{64}$/.test(state||'')||typeof code!=='string'||!code||code.length>4096)throw Error('Gmail authorization expired or invalid.');
 // Consume once, bound to both the authenticated primary admin and browser session.
 const saved=(await db.query('DELETE FROM platform_gmail_oauth_states WHERE state_hash=$1 AND actor_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING *',[tokenHash(state),actor,tokenHash(session)])).rows[0];
 if(!saved)throw Error('Gmail authorization expired or invalid.');
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,redirect_uri:saved.redirect_uri,grant_type:'authorization_code',code_verifier:openGmail(saved.encrypted_verifier,'verifier',env)}).toString(),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Google could not authorize this connection. Try connecting again.');
 const token=await response.json();
 if(!token.access_token||!token.refresh_token||!String(token.scope||'').split(' ').includes(GMAIL_SCOPE))throw Error('Approve Gmail sending access and offline access to connect.');
 const profile=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)});
 if(!profile.ok)throw Error('Google account verification failed.');
 const account=await profile.json();
 if(account.email_verified!==true||!emailValid(account.email))throw Error('A verified Google email account is required.');
 await db.query("INSERT INTO platform_gmail_connection(id,email,encrypted_refresh_token,status,connected_by) VALUES('shared',$1,$2,'connected',$3) ON CONFLICT(id) DO UPDATE SET email=excluded.email,encrypted_refresh_token=excluded.encrypted_refresh_token,status='connected',connected_by=excluded.connected_by,updated_at=now()",[account.email,sealGmail(token.refresh_token,'refresh',env),actor]);
 return {connected:true};
}
export function gmailMime(sender,destination,message){
 if(!emailValid(sender)||!emailValid(destination))throw Error('Invalid email destination.');
 // Encode untrusted headers and body; no client values can introduce MIME headers.
 const subject=String(message.subject||'SelahFlow booking').replace(/[\r\n]/g,' ').slice(0,250);
 const subjectWords=Array.from(subject).reduce((chunks,char)=>{if(Buffer.byteLength(chunks.at(-1)+char)>42)chunks.push(char);else chunks[chunks.length-1]+=char;return chunks;},['']).map(s=>'=?UTF-8?B?'+Buffer.from(s).toString('base64')+'?=').join('\r\n ');
 const body=Buffer.from(String(message.text||'')).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
 const mime=`From: SelahFlow <${sender}>\r\nTo: <${destination}>\r\nSubject: ${subjectWords}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}`;
 return Buffer.from(mime).toString('base64url');
}
export async function sendGmail(destination,message,env=process.env,fetcher=fetch,db=null){
 if(!gmailConfigured(env))return {status:'not_configured',detail:'Gmail OAuth client is not configured'};
 if(!emailValid(destination))return {status:'invalid_destination',detail:'Invalid email destination'};
 db??=getPool();
 const row=(await db.query("SELECT email,encrypted_refresh_token,status FROM platform_gmail_connection WHERE id='shared'")).rows[0];
 if(!row||row.status!=='connected')return {status:'not_configured',detail:'The platform administrator must connect Gmail'};
 let access;
 try{
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:openGmail(row.encrypted_refresh_token,'refresh',env),grant_type:'refresh_token'}).toString(),signal:AbortSignal.timeout(7500)});
  if(!response.ok){
   if([400,401].includes(response.status)){
    await db.query("UPDATE platform_gmail_connection SET status='needs_reconnect',updated_at=now() WHERE id='shared' AND encrypted_refresh_token=$1",[row.encrypted_refresh_token]);
    return {status:'not_configured',detail:'Gmail authorization needs reconnection by the platform administrator'};
   }
   return {status:'failed',detail:'Gmail authorization is temporarily unavailable'};
  }
  access=(await response.json()).access_token;if(!access)throw Error();
 }catch{return {status:'failed',detail:'Gmail authorization is temporarily unavailable'};}
 try{
  const result=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({raw:gmailMime(row.email,destination,message)}),signal:AbortSignal.timeout(7500)});
  if(!result.ok)return {status:message.trackAmbiguous&&result.status>=500?'unknown':'failed',detail:'Gmail rejected email (HTTP '+result.status+')'};
  return {status:'submitted',detail:'Accepted by Gmail'};
 }catch{return {status:message.trackAmbiguous?'unknown':'failed',detail:'Gmail send outcome could not be verified'};}
}
export async function disconnectGmail(db,actor,env=process.env,fetcher=fetch){
 return gmailMutation(db,client=>removeGmailConnection(client,actor,env,fetcher));
}
async function removeGmailConnection(db,actor,env,fetcher){
 const row=(await db.query("DELETE FROM platform_gmail_connection WHERE id='shared' RETURNING encrypted_refresh_token")).rows[0];
 await db.query('DELETE FROM platform_gmail_oauth_states');
 if(row&&gmailConfigured(env))try{await fetcher('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:openGmail(row.encrypted_refresh_token,'refresh',env)}).toString(),signal:AbortSignal.timeout(7500)});}catch{}
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'platform_email_connection',$4)",[randomUUID(),actor,new Date().toISOString(),JSON.stringify({provider:'gmail',action:'disconnected'})]);
 return {ok:true};
}
