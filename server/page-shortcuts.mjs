import {isReservedBusinessSlug} from './route-slugs.mjs';
export const safeBusinessSlug=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(value)&&!isReservedBusinessSlug(value)?value:null;
export function businessSlugFromPath(pathname=''){
 const parts=pathname.split('/').filter(Boolean);
 if(parts.length===1)return safeBusinessSlug(parts[0]);
 if(parts.length===2&&['book','membership','payment','studio'].includes(parts[0])&&!(parts[0]==='studio'&&parts[1]==='owner'))return safeBusinessSlug(parts[1]);
 return null;
}
export function pageShortcuts(slug,profileId){
 const business=safeBusinessSlug(slug),links=[];
 if(business)links.push({label:'Business home',href:'/'+business},{label:'Book a service',href:'/book/'+business},{label:'Memberships',href:'/membership/'+business});
 if(typeof profileId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(profileId))links.push({label:'Team member page',href:'/team/'+encodeURIComponent(profileId)});
 links.push({label:'Team workspace',href:'/team/workspace'},{label:'Team sign in',href:'/team/login'+(business?'?business='+business:'')},{label:'Owner dashboard',href:'/studio/owner'},{label:'Business owner sign in',href:'/login'},{label:'Find a business',href:'/discover'},{label:'SelahFlow home',href:'/'});
 return links;
}

export function shortcutBackFallback(pathname,slug){const business=safeBusinessSlug(slug),home=business?'/'+business:null;return home&&pathname!==home?home:'/discover';}
