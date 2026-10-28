import {randomUUID} from 'node:crypto';
import {validPlaceId,googleOwnerMutation} from './google-business-connection.mjs';
const serverKey=env=>env.GOOGLE_MAPS_API_KEY||env.GOOGLE_PLACES_API_KEY;
export function publicPlacesWidget(business,env=process.env){
 const key=String(env.GOOGLE_PLACES_UI_KIT_BROWSER_KEY||'').trim();
 if(!key||key===env.GOOGLE_MAPS_API_KEY||key===env.GOOGLE_PLACES_API_KEY||!validPlaceId(business.google_place_id)||business.google_show_reviews===false&&business.google_show_photos===false)return null;
 return {key,placeId:business.google_place_id,showReviews:business.google_show_reviews!==false,showPhotos:business.google_show_photos!==false};
}
async function googleJson(url,options,env,fetcher){
 if(!serverKey(env))throw Error('Google Places server key is not configured.');
 const r=await fetcher(url,{...options,headers:{'Content-Type':'application/json','X-Goog-Api-Key':serverKey(env),'X-Goog-FieldMask':options.mask},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Google listing lookup is unavailable. Check Places API (New), billing and key restrictions.');return r.json();
}
const listing=p=>({placeId:p.id,name:String(p.displayName?.text||'Google listing').slice(0,200),address:String(p.formattedAddress||'Service-area business; confirm its name and service area.').slice(0,400),mapsUrl:'https://www.google.com/maps/search/?api=1&query=Google+business&query_place_id='+encodeURIComponent(p.id)});
export async function searchGoogleListings(db,{businessId,query},env=process.env,fetcher=fetch){
 const b=(await db.query("SELECT id,name,city,region FROM businesses WHERE id=$1 AND status='active'",[businessId])).rows[0];if(!b)throw Error('Choose an active business.');
 const text=String(query||[b.name,b.city,b.region].filter(Boolean).join(', ')).trim();if(text.length<2||text.length>200)throw Error('Enter a business name and city, up to 200 characters.');
 const result=await googleJson('https://places.googleapis.com/v1/places:searchText',{method:'POST',mask:'places.id,places.displayName,places.formattedAddress',body:JSON.stringify({textQuery:text,pageSize:10,includePureServiceAreaBusinesses:true})},env,fetcher);
 return (result.places||[]).filter(p=>validPlaceId(p.id)).map(listing);
}
export async function savePlatformGoogleListing(db,{actor,businessId,placeId,showReviews,showPhotos},env=process.env,fetcher=fetch){
 if(typeof showReviews!=='boolean'||typeof showPhotos!=='boolean'||placeId!==''&&!validPlaceId(placeId))throw Error('Choose a Google listing and display options.');
 const b=(await db.query("SELECT id,owner_id FROM businesses WHERE id=$1 AND status='active'",[businessId])).rows[0];if(!b)throw Error('Choose an active business.');
 if(placeId){const result=await googleJson('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{method:'GET',mask:'id'},env,fetcher);if(result.id!==placeId)throw Error('Google could not verify the selected listing.');}
 return googleOwnerMutation(db,b.owner_id,async(c,owned)=>{
  if(owned.id!==businessId)throw Error('Choose an active business.');
  await c.query('INSERT INTO business_google_profiles(business_id,place_id,show_reviews,show_photos) VALUES($1,$2,$3,$4) ON CONFLICT(business_id) DO UPDATE SET place_id=EXCLUDED.place_id,show_reviews=EXCLUDED.show_reviews,show_photos=EXCLUDED.show_photos,updated_at=now()',[businessId,placeId,showReviews,showPhotos]);
  await c.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.owner_id,new Date().toISOString(),'google_listing_admin',JSON.stringify({actor,businessId,placeId,showReviews,showPhotos})]);return {ok:true};
 });
}
