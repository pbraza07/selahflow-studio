import {paymentConfigured} from './membership-payments.mjs';

export const HELCIM_ACTIVATION_NOTICE='Helcim payment collection is not enabled in SelahFlow yet. Platform partner setup, commission support and checkout/billing integration must be completed and verified before activation. Saving this choice does not connect an account or change existing payments.';

async function ownedBusiness(db,owner){
 const b=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
 if(!b)throw Error('FORBIDDEN');
 return b;
}
export async function paymentProviderSettings(db,owner){
 const b=await ownedBusiness(db,owner);
 const p=(await db.query('SELECT preferred_provider,helcim_requested_at FROM business_payment_preferences WHERE business_id=$1',[b.id])).rows[0];
 const stripe=(await db.query("SELECT charges_enabled,onboarding_complete FROM merchant_accounts WHERE business_id=$1 AND provider='stripe'",[b.id])).rows[0];
 return {preferredProvider:p?.preferred_provider||'stripe',activeProvider:paymentConfigured()&&stripe?.charges_enabled===true&&stripe?.onboarding_complete===true?'stripe':null,
  helcim:{available:false,status:p?.preferred_provider==='helcim'?'activation_requested':'not_connected',requestedAt:p?.helcim_requested_at||null,notice:HELCIM_ACTIVATION_NOTICE}};
}
export async function savePaymentProviderPreference(pool,owner,input){
 if(!input||Object.keys(input).some(k=>k!=='provider')||!['stripe','helcim'].includes(input.provider))throw Error('Choose Stripe or Helcim. This endpoint only saves a setup preference.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['payment-provider:'+owner]);
  const b=await ownedBusiness(db,owner);
  await db.query(`INSERT INTO business_payment_preferences(business_id,preferred_provider,helcim_requested_at,updated_by)
   VALUES($1,$2,CASE WHEN $2='helcim' THEN now() ELSE NULL END,$3)
   ON CONFLICT(business_id) DO UPDATE SET preferred_provider=EXCLUDED.preferred_provider,
   helcim_requested_at=CASE WHEN EXCLUDED.preferred_provider='helcim' THEN COALESCE(business_payment_preferences.helcim_requested_at,now()) ELSE NULL END,
   updated_by=EXCLUDED.updated_by,updated_at=now()`,[b.id,input.provider,owner]);
  const result=await paymentProviderSettings(db,owner);
  await db.query('COMMIT');return result;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
