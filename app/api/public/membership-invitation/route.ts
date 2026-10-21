import {quoteCoupon} from '../../../../server/business-coupons.mjs';
import {getPool} from '../../../../server/database.mjs';
import {invitationDetails} from '../../../../server/membership-invitations.mjs';
import {startMembershipCheckout} from '../../../../server/membership-checkout.mjs';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const body=await req.json(),pool=getPool(),m=await invitationDetails(pool,body.token);
 if(body.action==='quoteCoupon')return Response.json(await quoteCoupon(pool,m.business_id,body.couponCode,Number(m.price_cents)),{headers});
 if(body.action==='details')return Response.json({business:m.business_name,name:m.customer_name,memberNumber:m.member_number,plan:m.plan_name,description:m.description,sessions:m.plan_sessions,priceCents:m.price_cents,interval:m.interval_unit,intervalCount:m.interval_count},{headers});
 if(body.action!=='checkout'||body.accepted!==true)throw Error('Accept recurring billing and membership terms before payment.');
 const parts=String(m.customer_name).trim().split(/\s+/),firstName=parts.shift()||'',lastName=parts.join(' ');
 return Response.json(await startMembershipCheckout(pool,{requestId:m.id,slug:m.slug,planId:m.plan_id,firstName,lastName,name:m.customer_name,email:m.customer_email,phone:m.customer_phone,dateOfBirth:m.date_of_birth?new Date(m.date_of_birth).toISOString().slice(0,10):null,memberNumber:m.member_number,customAnswers:m.registration_answers,termsAccepted:true,recurringAccepted:true,couponCode:body.couponCode},trustedOrigin(req)),{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}
