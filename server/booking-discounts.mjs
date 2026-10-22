import {couponTotal} from './business-coupons.mjs';
/** A booking keeps its accepted discount and cent-exact service lines through approval/payment. */
export async function bookingDiscount(db,{businessId,services,code='',membershipCovered=false}){
 const lines=services.map(s=>({id:s.id,name:s.name,type:'service',price:Number(s.price),qty:1}));
 const amounts=lines.map(s=>Math.round(s.price*100)),subtotal=amounts.reduce((n,v)=>n+v,0);
 if(amounts.some(v=>!Number.isSafeInteger(v)||v<0)||subtotal>100000000)throw Error('Invalid service prices.');
 const normalized=String(code||'').trim().toUpperCase();
 if(!normalized||membershipCovered)return {price:membershipCovered?0:subtotal/100,paymentLines:lines,coupon:null};
 if(!/^[A-Z0-9_-]{3,40}$/.test(normalized))throw Error('Enter an active coupon for this business.');
 const c=(await db.query('SELECT id,code,description,kind,value FROM business_coupons WHERE business_id=$1 AND code=$2 AND active=true AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE',[businessId,normalized])).rows[0];
 if(!c)throw Error('Enter an active coupon for this business.');
 const total=couponTotal(c,subtotal);
 // Cumulative rounding distributes every cent, including fixed discounts across multiple services.
 let base=0,allocated=0;
 const paymentLines=lines.map((line,i)=>{base+=amounts[i];const target=subtotal?Math.round(total*base/subtotal):0;const price=(target-allocated)/100;allocated=target;return {...line,price};});
 return {price:total/100,paymentLines,coupon:{...c,originalCents:subtotal,totalCents:total,discountCents:subtotal-total}};
}
