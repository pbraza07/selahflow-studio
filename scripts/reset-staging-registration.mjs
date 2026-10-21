// Historical reset is no longer executed during application startup.
import {getPool} from '../server/database.mjs';
import {resetStagingRegistration} from '../server/staging-registration-reset.mjs';
if(process.env.STAGING_REGISTRATION_RESET_TARGET){
 const pool=getPool();try{
  const result=await resetStagingRegistration(pool,JSON.parse(process.env.STAGING_REGISTRATION_RESET_TARGET));
  console.log('Staging registration reset verified:',JSON.stringify(result));
 }finally{await pool.end();}
}
