import {getPool} from '../server/database.mjs';
import {verifyStagingClientEmails} from '../server/staging-email-verification.mjs';
if(process.env.STAGING_CLIENT_EMAIL_VERIFY_TARGET){
 const pool=getPool();try{
  console.log('Staging client email verification:',JSON.stringify(await verifyStagingClientEmails(pool,JSON.parse(process.env.STAGING_CLIENT_EMAIL_VERIFY_TARGET))));
 }finally{await pool.end();}
}
