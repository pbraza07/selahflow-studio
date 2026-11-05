import {validPlaceId} from './google-business-connection.mjs';

/** Only a saved exact listing may become an email review destination. */
export function businessGoogleReviewUrl({placeId,listingUrl}={}){
 if(validPlaceId(placeId))return 'https://search.google.com/local/writereview?placeid='+encodeURIComponent(placeId);
 try{
  const url=new URL(listingUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
  if(['google.com','www.google.com','maps.google.com','search.google.com','www.google.co.uk','www.google.com.br'].includes(url.hostname)){
   if(!/^\/(?:maps(?:\/|$)|local\/writereview(?:\/|$))/.test(url.pathname))return '';
   const id=url.searchParams.get('query_place_id')||url.searchParams.get('place_id')||url.searchParams.get('placeid');
   if(validPlaceId(id))return businessGoogleReviewUrl({placeId:id});
  }
  // Google's owner-provided short review link also identifies an exact listing.
  if(url.hostname==='g.page'&&/^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname))return url.origin+url.pathname;
 }catch{}
 return '';
}
export function safeEmailReviewUrl(value){
 // Do not follow arbitrary redirects or send client information to another host.
 const resolved=businessGoogleReviewUrl({listingUrl:value});
 return resolved||'';
}
