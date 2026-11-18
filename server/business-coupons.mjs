import {stripeApi} from './membership-payments.mjs';
export function couponTotal(coupon,cents){if(!coupon)return cents;const discount=coupon.kind==='percent'?Math.round(cents*coupon.value/100):coupon.value;return Math.max(0,cents-discount);}
export async function checkoutCoupon(db,businessId,code,cents,account,api=stripeApi){
 if(!String(code||'').trim())return null;
 const coupon=(await db.query('SELECT * FROM business_coupons WHERE business_id=$1 AND code=$2 AND active=true AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE',[businessId,String(code).trim().toUpperCase()])).rows[0];
 if(!coupon)throw Error('Enter an active coupon for this business.');
 if(!coupon.stripe_coupon_id||coupon.stripe_account_id!==account){const result=await api('coupons',{account,idempotencyKey:['coupon',coupon.id,coupon.code,coupon.kind,coupon.value,coupon.duration].join('-'),params:{duration:coupon.duration,name:coupon.code,...(coupon.kind==='percent'?{percent_off:coupon.value}:{amount_off:coupon.value,currency:'usd'})}});if(!result.id)throw Error('Coupon could not synchronize with Stripe.');coupon.stripe_coupon_id=result.id;await db.query('UPDATE business_coupons SET stripe_coupon_id=$1,stripe_account_id=$2 WHERE id=$3 AND business_id=$4',[result.id,account,coupon.id,businessId]);}
 return {...coupon,total:couponTotal(coupon,cents)};
}

export async function quoteCoupon(db,businessId,code,cents){const c=(await db.query("SELECT description,kind,value,duration FROM business_coupons WHERE business_id=$1 AND code=$2 AND active=true AND (expires_at IS NULL OR expires_at>now())",[businessId,String(code||'').trim().toUpperCase()])).rows[0];if(!c)throw Error('Enter an active coupon for this business.');return {description:c.description,duration:c.duration,originalCents:cents,totalCents:couponTotal(c,cents)};}

export async function assignOwnerCoupon(db,businessId,memberId,code){
 const coupon=(await db.query('SELECT id,code,kind,value,duration,description FROM business_coupons WHERE business_id=$1 AND code=$2 AND active AND (expires_at IS NULL OR expires_at>now()) FOR SHARE',[businessId,String(code).trim().toUpperCase()])).rows[0];
 if(!coupon)throw Error('Choose an active coupon for this business.');
 const saved=await db.query("UPDATE customer_memberships SET applied_coupon=NULL,owner_coupon=$3::jsonb || jsonb_build_object('originalCents',price_cents,'discountCents',CASE WHEN $4='percent' THEN ROUND(price_cents::numeric*$5/100)::int ELSE LEAST(price_cents,$5) END) WHERE business_id=$1 AND id=$2 AND status='pending_payment' AND stripe_checkout_session_id IS NULL AND stripe_signup_fingerprint IS NULL RETURNING id",[businessId,memberId,JSON.stringify(coupon),coupon.kind,coupon.value]);
 if(!saved.rows.length)throw Error('This membership already started checkout. Its payment terms cannot be changed.');
 return coupon;
}
export async function checkoutOwnerCoupon(coupon,member,account,api){
 const stripe=await api('coupons',{account,idempotencyKey:'owner-offer-'+member.id,params:{name:coupon.code,duration:coupon.duration,...(coupon.kind==='percent'?{percent_off:coupon.value}:{amount_off:coupon.value,currency:'usd'})}});
 if(!stripe.id)throw Error('Discount unavailable. Please retry payment.');
 return {...coupon,stripe_coupon_id:stripe.id,total:couponTotal(coupon,Number(member.price_cents))};
}
