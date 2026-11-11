import {getPool} from './database.mjs';
import {refreshGmailAuthorization,gmailStatus,selectedEmailProvider} from './gmail-delivery.mjs';

/** Safe heartbeat for an independent alert channel. No mailbox, tokens or message contents. */
export async function checkGmailConnection(pool=getPool(),{env=process.env,fetcher=fetch,force=false}={}){
 if(selectedEmailProvider(env)!=='gmail')return {state:'inactive',reason:'different_provider'};
 await refreshGmailAuthorization(pool,env,fetcher,{force});
 const status=await gmailStatus(pool,env);
 const monitor=status.monitor;
 return {state:!status.sender?'inactive':!status.setupComplete?'configuration_error':monitor.state,
  reason:!status.sender?'not_connected':undefined,checkedAt:monitor.lastCheckedAt,
  lastSuccessAt:monitor.lastSuccessAt,nextCheckAt:monitor.nextCheckAt,
  failures:monitor.failures,incidentId:monitor.incidentId,incidentStartedAt:monitor.incidentStartedAt};
}

let started=false,busy=false,lastLog=0,lastState='';
export function startGmailConnectionMonitor(){
 if(started)return;started=true;
 const tick=async()=>{
  if(busy)return;busy=true;
  try{
   const result=await checkGmailConnection();
   const key=JSON.stringify([result.state,result.incidentId]);
   if(key!==lastState||Date.now()-lastLog>=300000){
    console.log('SelahFlow Gmail health:',JSON.stringify(result));
    lastState=key;lastLog=Date.now();
   }
  }catch{
   // Never log provider responses, database errors or credentials.
   if(lastState!=='monitor_unavailable'||Date.now()-lastLog>=300000){
    console.warn('SelahFlow Gmail health:',JSON.stringify({state:'monitor_unavailable'}));
    lastState='monitor_unavailable';lastLog=Date.now();
   }
  }finally{busy=false;}
 };
 setInterval(tick,60000).unref();void tick();
}
