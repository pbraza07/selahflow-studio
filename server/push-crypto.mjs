/** RFC 8291 Web Push aes128gcm encryption + VAPID ES256 using Node built-ins.
 * Independent of paid email/SMS providers and npm dependencies.
 */
import {createECDH,createPrivateKey,createSign,createCipheriv,hkdfSync,randomBytes,createPublicKey,sign} from 'node:crypto';
import {isStaging} from './staging-safety.mjs';
const b64=b=>Buffer.from(b).toString('base64url');
const from=s=>Buffer.from(s,'base64url');
export function pushConfiguration(env=process.env){
 if(isStaging(env)&&env.STAGING_PUSH_ENABLED!=='true')return {configured:false,reason:'staging_disabled'};
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)return {configured:false,reason:'missing_keys'};
 try{
  const subject=new URL(env.VAPID_SUBJECT);
  if(!['mailto:','https:'].includes(subject.protocol)||subject.username||subject.password||(subject.protocol==='mailto:'&&!subject.pathname.includes('@')))throw Error();
  const pub=from(env.VAPID_PUBLIC_KEY),priv=from(env.VAPID_PRIVATE_KEY);
  if(pub.length!==65||pub[0]!==4||priv.length!==32)throw Error();
  const ec=createECDH('prime256v1');ec.setPrivateKey(priv);
  if(!ec.getPublicKey().equals(pub))throw Error();
  return {configured:true,reason:'ready'};
 }catch{return {configured:false,reason:'invalid_keys'};}
}
export function configured(env=process.env){return pushConfiguration(env).configured;}
export function vapidKeys(env=process.env){
 if(!configured(env))throw new Error('Web Push VAPID environment is not configured.');
 const pub=from(env.VAPID_PUBLIC_KEY),priv=from(env.VAPID_PRIVATE_KEY);
 if(pub.length!==65||pub[0]!==4||priv.length!==32)throw new Error('Invalid VAPID key format');
 const jwk={kty:'EC',crv:'P-256',x:b64(pub.subarray(1,33)),y:b64(pub.subarray(33,65)),d:b64(priv)};
 const privateKey=createPrivateKey({key:jwk,format:'jwk'});
 return {publicKey:env.VAPID_PUBLIC_KEY,privateKey,subject:env.VAPID_SUBJECT};
}
export function allowedPushEndpoint(endpoint){
 try{
  if(typeof endpoint!=='string'||endpoint.length>2048)return false;
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
  const host=url.hostname.toLowerCase();
  return host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com')||host==='push.notification.google.com';
 }catch{return false;}
}
export function validPushSubscription(s){
 if(!s||typeof s!=='object'||!allowedPushEndpoint(s.endpoint))return false;
 const keys=s.keys;if(!keys||typeof keys!=='object'||typeof keys.p256dh!=='string'||typeof keys.auth!=='string')return false;
 try{const key=from(keys.p256dh),auth=from(keys.auth);return key.length===65&&key[0]===4&&auth.length>=16&&auth.length<=32&&keys.p256dh.length<=130&&keys.auth.length<=64;}catch{return false;}
}
export function encryptPushPayload(subscription,payload){
 if(!validPushSubscription(subscription))throw new Error('Invalid Web Push subscription');
 const clientPublic=from(subscription.keys.p256dh),authentication=from(subscription.keys.auth);
 const ephemeral=createECDH('prime256v1');const ephemeralPublic=ephemeral.generateKeys(),secret=ephemeral.computeSecret(clientPublic);
 const keyInfo=Buffer.concat([Buffer.from('WebPush: info\0'),clientPublic,ephemeralPublic]);
 const ikm=Buffer.from(hkdfSync('sha256',secret,authentication,keyInfo,32));
 const salt=randomBytes(16);
 const contentKey=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const text=Buffer.from(JSON.stringify(payload),'utf8');
 if(text.length>3500)throw new Error('Web Push payload too large');
 const cipher=createCipheriv('aes-128-gcm',contentKey,nonce);
 const encrypted=Buffer.concat([cipher.update(Buffer.concat([text,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
 const size=Buffer.alloc(4);size.writeUInt32BE(4096,0);
 return Buffer.concat([salt,size,Buffer.from([ephemeralPublic.length]),ephemeralPublic,encrypted]);
}
export function vapidJwt(endpoint,env=process.env,now=Math.floor(Date.now()/1000)){
 const {privateKey,subject}=vapidKeys(env),aud=new URL(endpoint).origin;
 const header=b64(JSON.stringify({typ:'JWT',alg:'ES256'}));
 const claims=b64(JSON.stringify({aud,exp:now+3600,sub:subject}));
 const body=header+'.'+claims;
 const signature=sign('sha256',Buffer.from(body),{key:privateKey,dsaEncoding:'ieee-p1363'});
 return body+'.'+b64(signature);
}
export async function sendWebPush(subscription,payload,env=process.env,fetcher=fetch){
 if(!configured(env))return {status:'not_configured'};
 if(!validPushSubscription(subscription))return {status:'invalid_subscription'};
 try{
  const content=encryptPushPayload(subscription,payload);
  const jwt=vapidJwt(subscription.endpoint,env);
  const response=await fetcher(subscription.endpoint,{method:'POST',headers:{
    'TTL':'1800','Urgency':'high','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',
    'Authorization':'vapid t='+jwt+', k='+env.VAPID_PUBLIC_KEY,
    'Content-Length':String(content.length)
   },body:content,signal:AbortSignal.timeout(6500)});
  if(response.status===404||response.status===410)return {status:'gone'};
  return response.ok?{status:'submitted'}:{status:'failed',httpStatus:response.status};
 }catch{return {status:'failed'};}
}
