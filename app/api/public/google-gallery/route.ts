import {googlePublicAllowed} from '../../../../server/google-public-limit.mjs';
import {getPool} from '../../../../server/database.mjs';
import {googleGalleryForBusiness} from '../../../../server/google-business-gallery.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request){
 const slug=new URL(req.url).searchParams.get('slug')||'';
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))return Response.json({photos:[],link:''},{headers});
 try{
  if(!await googlePublicAllowed(getPool(),req,slug))return new Response(null,{status:429,headers:{'Cache-Control':'no-store'}});
  const row=(await getPool().query("SELECT b.name,b.slug,b.google_listing_url,b.city,b.region,g.place_id AS google_place_id,g.show_reviews AS google_show_reviews,g.show_photos AS google_show_photos FROM businesses b LEFT JOIN business_google_profiles g ON g.business_id=b.id WHERE b.slug=$1 AND b.status='active'",[slug])).rows[0];
  if(!row)return Response.json({photos:[],link:''},{headers});
  const data=await googleGalleryForBusiness({...row,google_reviews_summary:new URL(req.url).searchParams.get('summary')==='1'});
  return Response.json({...data,photos:data.photos.map(({index,attributions,sourceUrl}:{index:number;sourceUrl:string;attributions:{name:string;url:string}[]})=>({index,attributions,sourceUrl}))},{headers});
 }catch{return Response.json({photos:[],link:''},{headers});}
}
