import {validPlaceId} from './google-business-connection.mjs';
import {googleListingUrl} from './membership-payments.mjs';
const letters=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function validGalleryMatch(requested,display){
 const a=letters(requested),b=letters(display);
 if(!a||!b)return false;
 return a===b || (a.length>=9&&b.length>=9&&(a.includes(b)||b.includes(a)));
}
export function validPhotoResource(value){
 return typeof value==='string'&&/^places\/[A-Za-z0-9_-]{8,}\/photos\/[A-Za-z0-9_-]{8,}$/.test(value);
}
export async function googleGalleryForBusiness(business,env=process.env,fetcher=fetch){
 if(business.google_show_reviews===false&&business.google_show_photos===false)return {link:'',photos:[],reviews:[],enabled:false};
 const selected=validPlaceId(business.google_place_id);
 const link=selected?'https://www.google.com/maps/search/?api=1&query=Google+business&query_place_id='+encodeURIComponent(business.google_place_id):googleListingUrl(business.google_listing_url||'');
 if(!link)return {link:'',photos:[],enabled:false};
 const key=env.GOOGLE_MAPS_API_KEY||env.GOOGLE_PLACES_API_KEY;
 if(!key)return {link,photos:[],enabled:false};
 const businessName=String(business.name||'').trim();
 if(!businessName)return {link,photos:[],enabled:true};
 const query=[businessName,business.city,business.region].filter(Boolean).join(', ').slice(0,230);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
 try{
  // Search the business's exact display name and city; do not silently show
  // another business's photos when a Maps link has an ambiguous short URL.
  const r=await fetcher(selected?'https://places.googleapis.com/v1/places/'+encodeURIComponent(business.google_place_id):'https://places.googleapis.com/v1/places:searchText',{
   method:selected?'GET':'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,
    'X-Goog-FieldMask':selected?'id,displayName,googleMapsUri,photos'+(business.google_show_reviews!==false?',rating,userRatingCount,googleMapsLinks.reviewsUri'+(business.google_reviews_summary?'':',reviews'):''):'places.id,places.displayName,places.googleMapsUri,places.photos,places.formattedAddress'},
   ...(selected?{}:{body:JSON.stringify({textQuery:query,pageSize:4})}),cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error('Google Places lookup unavailable');
  const data=await r.json();
  const match=selected?(data.id===business.google_place_id?data:null):(data.places||[]).find(p=>validGalleryMatch(businessName,p.displayName?.text));
  if(!match)return {link,photos:[],enabled:true};
  const photos=(business.google_show_photos===false?[]:match.photos||[]).filter(p=>validPhotoResource(p.name)).slice(0,10)
   .map((p,i)=>({index:i,resource:p.name,sourceUrl:safeGoogleLink(p.googleMapsUri)||link,attributions:(p.authorAttributions||[]).filter(a=>a?.displayName).map(a=>({
    name:String(a.displayName).slice(0,100),avatar:approvedGooglePhotoUri(a.photoUri)||'',
    url:safeGoogleLink(a.uri)
   }))}));
  const reviews=selected&&business.google_show_reviews!==false&&!business.google_reviews_summary?(match.reviews||[]).slice(0,5).map(r=>({author:String(r.authorAttribution?.displayName||'Google reviewer').slice(0,150),authorUrl:safeGoogleLink(r.authorAttribution?.uri),authorPhoto:approvedGooglePhotoUri(r.authorAttribution?.photoUri)||'',rating:Number.isFinite(r.rating)?Math.max(0,Math.min(5,r.rating)):0,text:String(r.originalText?.text||r.text?.text||''),language:String(r.originalText?.languageCode||r.text?.languageCode||''),time:String(r.relativePublishTimeDescription||''),url:safeGoogleLink(r.googleMapsUri)||link})):[];
  return {link:safeGoogleLink(match.googleMapsUri)||link,reviewsLink:selected&&business.google_show_reviews!==false?safeGoogleLink(match.googleMapsLinks?.reviewsUri)||safeGoogleLink(match.googleMapsUri)||link:'',photos,reviews,rating:selected&&business.google_show_reviews!==false&&Number.isFinite(match.rating)?match.rating:null,reviewCount:selected&&business.google_show_reviews!==false&&Number.isInteger(match.userRatingCount)?match.userRatingCount:null,enabled:true,placeName:match.displayName?.text||businessName};
 }finally{clearTimeout(timeout);}
}
export function approvedGooglePhotoUri(value){
 try{const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'))?u.toString():null;
 }catch{return null;}
}

export function safeGoogleLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='google.com'||u.hostname.endsWith('.google.com')||u.hostname==='maps.app.goo.gl')?u.toString():'';}catch{return '';}}
