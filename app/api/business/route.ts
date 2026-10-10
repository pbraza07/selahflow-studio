import {getPool} from '../../../server/database.mjs';
import {requireOwner} from '../../../lib/auth';
import {validOrigin} from '../../../server/security.mjs';
import {PLANS} from '../../../lib/plans';
import {bookableTeamLimit} from '../../../server/team-seat-policy.mjs';
import {themeIsValid} from '../../../server/themes.mjs';
import {googleListingUrl} from '../../../server/membership-payments.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
export async function GET(req:Request){
 try{
  const owner=await requireOwner(req);
  const row=(await getPool().query('SELECT b.id,b.slug,b.name,b.industry,b.description,b.city,b.region,b.status,b.is_listed,b.listing_requested,b.brand_primary,b.brand_background,b.business_model,b.google_listing_url,EXISTS(SELECT 1 FROM business_logos l WHERE l.business_id=b.id) AS has_logo,s.plan_code,s.status AS subscription_status,s.ai_addon,(SELECT COUNT(*)::int FROM business_team_seat_requests extra WHERE extra.business_id=b.id AND extra.status=\'approved\') AS approved_extra_team_seats,st.data AS studio_settings FROM businesses b JOIN business_subscriptions s ON s.business_id=b.id LEFT JOIN settings st ON st.owner=b.owner_id WHERE b.owner_id=$1',[owner])).rows[0];
  return Response.json({business:row?{...row,studio_settings:undefined,theme:(()=>{try{return JSON.parse(row.studio_settings||'{}').theme||null;}catch{return null;}})(),address:(()=>{try{return JSON.parse(row.studio_settings||'{}').address||'';}catch{return '';}})(),teamLimit:bookableTeamLimit(row.plan_code,row.subscription_status,row.approved_extra_team_seats),baseTeamLimit:PLANS[row.plan_code as keyof typeof PLANS]?.bookableStaff??1,approvedExtraTeamSeats:row.approved_extra_team_seats}:null},{headers:noStore});
 }catch(e){return Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':'Unavailable.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:503});}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});
 try{
  const owner=await requireOwner(req),b=await req.json();
  const name=String(b.name||'').trim(),description=String(b.description||'').trim(),city=String(b.city||'').trim(),region=String(b.region||'').trim();
  const brandPrimary=b.brandPrimary===undefined?null:String(b.brandPrimary),brandBackground=b.brandBackground===undefined?null:String(b.brandBackground),businessModel=b.businessModel===undefined?null:String(b.businessModel).trim();
  const address=b.address===undefined?null:String(b.address).trim();
  const googleLink=b.googleListingUrl===undefined?null:googleListingUrl(b.googleListingUrl);
  const requestedTheme=b.theme===undefined?null:b.theme;
  if(requestedTheme!==null&&!themeIsValid(requestedTheme))return Response.json({error:'Choose valid theme colors and fonts.'},{status:400});
  if(name.length<2||name.length>100||description.length>600||city.length>80||region.length>80||(businessModel!==null&&businessModel.length>2000)||(brandPrimary!==null&&!/^#[0-9a-fA-F]{6}$/.test(brandPrimary))||(brandBackground!==null&&!/^#[0-9a-fA-F]{6}$/.test(brandBackground))||(address!==null&&(address.length>350||/[<>\u0000-\u001f]/.test(address)))||typeof b.requestListing!=='boolean')
   return Response.json({error:'Check business profile information.'},{status:400});
  const pool=getPool(),client=await pool.connect();
  try{
   await client.query('BEGIN');
   const record=(await client.query('SELECT id,status FROM businesses WHERE owner_id=$1 FOR UPDATE',[owner])).rows[0];
   if(!record){await client.query('ROLLBACK');return Response.json({error:'Business not found.'},{status:404});}if(record.status!=='active'){await client.query('ROLLBACK');return Response.json({error:'Business awaiting platform approval.'},{status:403});}
   const settingsRow=(await client.query('SELECT data FROM settings WHERE owner=$1 FOR UPDATE',[owner])).rows[0];
   const settings=settingsRow?JSON.parse(settingsRow.data):null;
   if(b.requestListing&&(!settings?.services?.length||!settings?.staff?.length))
    {await client.query('ROLLBACK');return Response.json({error:'Add at least one service and team member before requesting a listing.'},{status:400});}
   await client.query('UPDATE businesses SET name=$1,description=$2,city=$3,region=$4,listing_requested=FALSE,is_listed=TRUE,brand_primary=COALESCE($7,brand_primary),brand_background=COALESCE($8,brand_background),business_model=COALESCE($9,business_model),google_listing_url=COALESCE($10,google_listing_url),updated_at=now() WHERE owner_id=$6',[name,description,city,region,b.requestListing,owner,brandPrimary,brandBackground,businessModel,googleLink]);
   if(settings){settings.name=name;if(requestedTheme!==null)settings.theme=requestedTheme;if(address!==null)settings.address=address;await client.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(settings),owner]);}
   await client.query('COMMIT');
   return Response.json({ok:true,listingPending:!!b.requestListing},{headers:noStore});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }catch(e){return Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':'Unable to save the business profile.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:503});}
}
