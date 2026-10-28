'use client';
import {useEffect,useRef,useState} from 'react';
export type PlacesWidgetConfig={key:string;placeId:string;showReviews:boolean;showPhotos:boolean};
type MapsWindow=Window&{google?:{maps?:{importLibrary:(name:string)=>Promise<unknown>}}};
type DetailsElement=HTMLElement&{place?:{googleMapsLinks?:{reviewsURI?:string}}};
export function safeReviewsLink(value:unknown){try{if(typeof value!=='string')return '';const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='google.com'||u.hostname.endsWith('.google.com'))?u.toString():'';}catch{return '';}}
let library:Promise<void>|null=null;
function loadPlaces(key:string){
 if(library)return library;
 library=new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Google UI Kit did not load.')),12000);
  const ready=async()=>{try{const maps=(window as MapsWindow).google?.maps;if(!maps?.importLibrary)throw Error('Google UI Kit unavailable.');await maps.importLibrary('places');await Promise.all(['gmp-place-details','gmp-place-details-compact'].map(t=>customElements.whenDefined(t)));clearTimeout(timer);resolve();}catch(e){clearTimeout(timer);reject(e);}};
  if((window as MapsWindow).google?.maps?.importLibrary){void ready();return;}
  const script=document.createElement('script');script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,v:'weekly',libraries:'places'});script.async=true;script.onload=()=>void ready();script.onerror=()=>{clearTimeout(timer);reject(Error('Google UI Kit unavailable.'));};document.head.append(script);
 });
 return library;
}
export default function GooglePlacesWidget({config,summary=false}:{config:PlacesWidgetConfig;summary?:boolean}){
 const root=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false),[reviewsLink,setReviewsLink]=useState('');
 const mapsLink='https://www.google.com/maps/search/?api=1&query=Google+business&query_place_id='+encodeURIComponent(config.placeId);
 useEffect(()=>{
  const container=root.current;setReviewsLink('');if(!container)return;let stopped=false,started=false;
  const load=async()=>{if(started)return;started=true;setFailed(false);try{await loadPlaces(config.key);if(stopped)return;const widget=document.createElement(summary?'gmp-place-details-compact':'gmp-place-details');widget.setAttribute('aria-label','Google business reviews and photos');if(summary)widget.setAttribute('orientation','vertical');
   const request=document.createElement('gmp-place-details-place-request');request.setAttribute('place',config.placeId);widget.append(request);
   const content=['gmp-place-name',...(config.showPhotos?['gmp-place-media']:[]),...(config.showReviews?['gmp-place-rating',...(!summary?['gmp-place-reviews']:[])]:[]),'gmp-place-attribution'];for(const tag of content){const element=document.createElement(tag);if(tag==='gmp-place-media'&&!summary)element.setAttribute('lightbox-preferred','');widget.append(element);}
   widget.addEventListener('gmp-load',()=>{if(!stopped&&config.showReviews)setReviewsLink(safeReviewsLink((widget as DetailsElement).place?.googleMapsLinks?.reviewsURI));});
   widget.addEventListener('gmp-error',()=>{if(!stopped){container.replaceChildren();setFailed(true);}});container.replaceChildren(widget);
  }catch{if(!stopped)setFailed(true);}};
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void load();}},{rootMargin:'100px'});observer.observe(container);return()=>{stopped=true;observer.disconnect();container.replaceChildren();};
 },[config.key,config.placeId,config.showPhotos,config.showReviews,summary]);
 return <div className="sf-google-ui-kit"><div ref={root}/>{!summary&&config.showReviews&&<div className="sf-google-reviews-footer"><a href={reviewsLink||mapsLink} target="_blank" rel="noopener noreferrer">View all Google reviews ↗</a><p>See the complete review list on Google Maps.</p></div>}{failed&&<p>Google content is temporarily unavailable. <a href={'https://www.google.com/maps/search/?api=1&query=Google+business&query_place_id='+encodeURIComponent(config.placeId)} target="_blank" rel="noopener noreferrer">View on Google Maps</a></p>}</div>;
}
