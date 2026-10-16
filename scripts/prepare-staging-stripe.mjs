import {getPool} from '../server/database.mjs';
import {prepareStagingStripeAccounts} from '../server/business-stripe-setup.mjs';
if(process.env.STAGING_PREPARE_STRIPE==='true'){
 const pool=getPool();try{console.log('Staging Stripe account setup:',JSON.stringify(await prepareStagingStripeAccounts(pool)));}finally{await pool.end();}
}
