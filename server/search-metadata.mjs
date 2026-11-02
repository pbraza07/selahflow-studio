import {isStaging} from './staging-safety.mjs';
export const SEARCH_ORIGIN='https://selahflow.onrender.com';
export const SEARCH_PAGES=[
 ['/', 'SelahFlow | Online Booking & Membership Management', 'Online booking software for service businesses. Manage appointments, class bookings, clients, team schedules and memberships with SelahFlow.'],
 ['/businesses','Booking Software for Small Businesses | SelahFlow','Appointment scheduling, class booking and membership management for service businesses. Explore branded booking pages, team tools and payment integrations.'],
 ['/customers','Find Services & Book Appointments Online | SelahFlow','Find a service business, choose an appointment or class, and check your booking or membership status with SelahFlow.'],
 ['/discover','Find Local Businesses & Book Services | SelahFlow','Explore service businesses by name, service or location. View services, prices and availability, then book directly with the business.'],
 ['/pricing','Booking Software Pricing & Plans | SelahFlow','Compare SelahFlow Free, Professional and Business plans for online booking, appointment scheduling, clients and memberships. Review limits and payment fees.'],
 ['/privacy','Privacy Policy | SelahFlow','How SelahFlow handles account, booking, membership, waiver and payment information, and how to contact us about privacy.'],
 ['/terms/business-services','Business Service Agreement | SelahFlow','Read the SelahFlow business service agreement, package benefits, subscription terms, commission conditions and business responsibilities.'],
];
const RESERVED_SLUGS=new Set(['api','admin','studio','settings','account','business','businesses','pricing','login','signup','registration-status','payment','membership-pay','booking','customer','customers','onsite','team','discover','book','membership','privacy','terms']);
export const validPublicSlug=slug=>typeof slug==='string'&&/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)&&!RESERVED_SLUGS.has(slug);
/** @returns {import('next').Metadata} */
export function publicPageMetadata(path,title,description){
 const page=SEARCH_PAGES.find(p=>p[0]===path),label=title||page?.[1],summary=description||page?.[2];
 if(!label||!summary)throw Error('Public search metadata needs a title and description.');
 const url=SEARCH_ORIGIN+path,image=SEARCH_ORIGIN+'/brand/app-icon.png';
 return {title:label,description:summary,alternates:{canonical:url},...(isStaging()?{robots:{index:false,follow:false}}:{}),
  openGraph:{type:'website',url,siteName:'SelahFlow',title:label,description:summary,locale:'en_US',images:[{url:image,width:512,height:512,alt:'SelahFlow'}]},
  twitter:{card:'summary',title:label,description:summary,images:[image]}};
}
/** Only public business fields belong in search snippets; never use client or registration data. */
export function businessPageMetadata(row){
 const location=[row.city,row.region].filter(Boolean).join(', '),category=String(row.industry||'').replaceAll('-',' ');
 const title=row.name+(location?' in '+location:'')+' | Book Online · SelahFlow';
 const intro=String(row.description||'').replace(/\s+/g,' ').trim().slice(0,220);
 const description=(intro?intro+' ':'')+'Explore '+row.name+(category?' '+category+' services':' services')+(location?' in '+location:'')+', view prices and book online.';
 return publicPageMetadata('/'+encodeURIComponent(row.slug),title,description);
}
export function siteSearchGraph(){return {'@context':'https://schema.org','@graph':[
 {'@type':'Organization','@id':SEARCH_ORIGIN+'/#organization',name:'SelahFlow',alternateName:'Selah Flow',url:SEARCH_ORIGIN,logo:SEARCH_ORIGIN+'/brand/app-icon.png'},
 {'@type':'WebSite','@id':SEARCH_ORIGIN+'/#website',name:'SelahFlow',alternateName:'Selah Flow',url:SEARCH_ORIGIN,publisher:{'@id':SEARCH_ORIGIN+'/#organization'}},
 {'@type':'WebApplication','@id':SEARCH_ORIGIN+'/#application',name:'SelahFlow',url:SEARCH_ORIGIN,applicationCategory:'BusinessApplication',operatingSystem:'Web',publisher:{'@id':SEARCH_ORIGIN+'/#organization'},description:SEARCH_PAGES[0][2],featureList:['Online appointment scheduling','Class and session booking','Client management','Team scheduling','Membership management']}
 ]};}
