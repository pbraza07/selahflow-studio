import {stripeApi} from './membership-payments.mjs';
export function couponTotal(coupon,cents){if(!coupon)return cents;const discount=coupon.kind==='percent'?Math.round(cents*coupon.value/100):coupon.value;return Math.max(0,cents-discount);}
export async function checkoutCoupon(db,businessId,code,cents,account,api=stripeApi){
 if(!String(code||'').trim())return null;
 const coupon=(await db.query('SELECT * FROM business_coupons WHERE business_id=$1 AND code=$2 AND active=true AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE',[businessId,String(code).trim().toUpperCase()])).rows[0];
 if(!coupon)throw Error('Enter an active coupon for this business.');
 if(!coupon.stripe_coupon_id||coupon.stripe_account_id!==account){const result=await api('coupons',{account,idempotencyKey:'coupon-'+coupon.id,params:{duration:coupon.duration,name:coupon.code,...(coupon.kind==='percent'?{percent_off:coupon.value}:{amount_off:coupon.value,currency:'usd'})}});if(!result.id)throw Error('Coupon could not synchronize with Stripe.');coupon.stripe_coupon_id=result.id;await db.query('UPDATE business_coupons SET stripe_coupon_id=$1,stripe_account_id=$2 WHERE id=$3 AND business_id=$4',[result.id,account,coupon.id,businessId]);}
 return {...coupon,total:couponTotal(coupon,cents)};
}
