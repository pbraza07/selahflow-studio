import {businessPath,bookingPath,dashboardPath} from './route-slugs.mjs';
import {workspaceGroups,workspaceLabels} from './workspace-navigation.mjs';
import {publicSocialLinks,SOCIAL_PLATFORMS} from './business-social-links.mjs';
const external=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
/** @param {{slug:string,accounts?:any[],staff?:any[],socialLinks?:Record<string,string>,googleListingUrl?:string,address?:string,settingsAreas?:{id:string,title:string}[]}} input */
export function importantBusinessLinks({slug,accounts=[],staff=[],socialLinks={},googleListingUrl='',address='',settingsAreas=[]}){
 const home=businessPath(slug),book=bookingPath(slug),owner=dashboardPath(slug);
 const groups=[{title:'Customer pages',links:[{label:'Business homepage',path:home},{label:'Book a service',path:book},{label:'Memberships',path:'/membership/'+encodeURIComponent(slug)},{label:'Booking & membership status',path:book+'?view=status#registration-status'},{label:'Client booking help',path:'/customers#visit-help'}]},
 {title:'Business owner · sign-in required',links:[{label:'Business owner sign in',path:'/login'},...workspaceGroups.flatMap(g=>g.items).map(section=>({label:workspaceLabels[section],path:owner+'?section='+encodeURIComponent(section)})),...settingsAreas.map(a=>({label:'Settings · '+a.title,path:owner+'?section=Settings&settings='+encodeURIComponent(a.id)}))]},
 {title:'Team members · sign-in required',links:[{label:'Team member sign in',path:'/team/login'},{label:'Team member workspace',path:'/team/workspace'}]}];
 const team=accounts.filter(a=>a.active&&staff.some(s=>s.id===a.staff_id&&s.bookingVisible!==false)).map(a=>({label:staff.find(s=>s.id===a.staff_id).name+' · Public profile & booking',path:'/team/'+encodeURIComponent(a.id)}));
 if(team.length)groups.push({title:'Your team’s public pages',links:team});
 const social=publicSocialLinks(socialLinks),links=SOCIAL_PLATFORMS.filter(([id])=>social[id]).map(([id,label])=>({label,path:social[id]}));
 const google=external(googleListingUrl);if(google)links.push({label:'Google business listing',path:google});
 if(address&&!/^Add your /i.test(address)){const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');url.searchParams.set('destination',address);links.push({label:'Business directions',path:url.href});}
 if(links.length)groups.push({title:'Saved business links',links});return groups;
}
