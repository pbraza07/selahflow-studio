import {googlePublicAllowed} from '../../../../../server/google-public-limit.mjs';
import {getPool} from '../../../../../server/database.mjs';
import {googleGalleryForBusiness,approvedGooglePhotoUri} from '../../../../../server/google-business-gallery.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const params=new URL(req.url).searchParams,slug=params.get('slug')||'',idx=Number(params.get('index'));
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)||!Number.isInteger(idx)||idx<0||idx>=10)return new Response(null,{status:404});
 const key=process.env.GOOGLE_MAPS_API_KEY||process.env.GOOGLE_PLACES_API_KEY;
 if(!key)return new Response(null,{status:404});
 try{
  if(!await googlePublicAllowed(getPool(),req,slug))return new Response(null,{status:429,headers:{'Cache-Control':'no-store'}});
  const row=(await getPool().query("SELECT b.name,b.google_listing_url,b.city,b.region,g.place_id AS google_place_id,g.show_reviews AS google_show_reviews,g.show_photos AS google_show_photos FROM businesses b LEFT JOIN business_google_profiles g ON g.business_id=b.id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];
  if(!row)return new Response(null,{status:404});
  const gallery=await googleGalleryForBusiness({...row,google_show_reviews:false}),photo=gallery.photos.find((p:{index:number;resource:string})=>p.index===idx);
  if(!photo?.resource)return new Response(null,{status:404});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const url='https://places.googleapis.com/v1/'+photo.resource+'/media?maxWidthPx=1400&maxHeightPx=900&skipHttpRedirect=true';
   const r=await fetch(url,{headers:{'X-Goog-Api-Key':key},cache:'no-store',signal:controller.signal});
   if(!r.ok)return new Response(null,{status:502});
   const json=await r.json(),location=approvedGooglePhotoUri(json.photoUri);
   if(!location)return new Response(null,{status:502});
   return new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }finally{clearTimeout(timeout);}
 }catch{return new Response(null,{status:503});}
}
