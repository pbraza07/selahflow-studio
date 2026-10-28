// Industry-aware waiver template definitions. These are drafting aids, not legal advice.
// Activation must require business-specific legal review and a new document version.
export const WAIVER_CATEGORIES=Object.freeze({
 sports_fitness:{label:'Sports & Fitness',risks:['physical exertion','contact with other participants','falls','equipment use','outdoor conditions'],guardian:true},
 beauty_wellness:{label:'Beauty & Wellness',risks:['allergic reactions','skin sensitivity','treatment discomfort','product interactions'],guardian:true},
 events_entertainment:{label:'Events & Entertainment',risks:['crowds','equipment','venue conditions','physical activities'],guardian:true},
 education_tutoring:{label:'Education & Tutoring',risks:['supervised activities','off-site activities when expressly included','pickup authorization'],guardian:true},
 professional_services:{label:'Home & Professional Services',risks:['property access','service limitations','site conditions'],guardian:false},
 general:{label:'General Services',risks:['service-specific hazards identified by the provider'],guardian:false}
});
export function normalizeWaiverCategory(value){
 return Object.hasOwn(WAIVER_CATEGORIES,value)?value:'general';
}
export function waiverTemplateForCategory(category,{businessName='Business',serviceName='the selected service'}={}){
 const id=normalizeWaiverCategory(category),definition=WAIVER_CATEGORIES[id];
 const business=String(businessName).trim()||'Business',service=String(serviceName).trim()||'the selected service';
 return {category:id,label:definition.label,requiresLegalReview:true,
  title:`${definition.label} — Service Consent and Risk Acknowledgment`,
  sections:[
   {key:'scope',heading:'Service and scope',text:`I understand that ${business} will provide ${service}. This document applies only to the service and activities expressly described here.`},
   {key:'risks',heading:'Risks and precautions',text:`Potential considerations include ${definition.risks.join(', ')}. I have had the opportunity to ask questions and will follow applicable safety instructions.`},
   {key:'limitations',heading:'Rights and limitations',text:'Nothing in this document waives rights or remedies that cannot legally be waived. Any release or limitation of liability must be separately drafted and reviewed for the applicable jurisdiction.'},
   {key:'consent',heading:'Informed consent',text:'I have read the service description, understand the information provided, and voluntarily consent to the described service.'},
   ...(definition.guardian?[{key:'guardian',heading:'Parent or guardian',text:'Where a participant is a minor, an authorized parent or legal guardian must review and sign as required by applicable law.'}]:[])
  ],
  mediaConsentDefault:false
 };
}

export const CATEGORY_WAIVER_VERSION='category-1';
export function suggestedWaiverCategory(industry=''){
 if(['fitness','yoga','sports-coaching','dance','martial-arts','swimming'].includes(industry))return 'sports_fitness';
 if(['barber','hair','nails','lashes','brows','makeup','skin-care','spa','massage','wellness','tattoo','piercing','tanning','waxing'].includes(industry))return 'beauty_wellness';
 if(['tutoring','music-lessons','art-lessons','language-lessons','test-prep','career-coaching'].includes(industry))return 'education_tutoring';
 if(['photography','videography','event-planning','wedding-services','florist','catering','personal-chef','rentals'].includes(industry))return 'events_entertainment';
 if(['cleaning','housekeeping','landscaping','handyman','plumbing','electrical','hvac','painting','pest-control','pool-service','home-organizing','moving','auto-detailing','auto-repair','car-wash','mobile-mechanic','bike-repair','accounting','tax-preparation','financial-planning','legal','notary','insurance','real-estate','property-management','consulting','it-support','cybersecurity','marketing','web-design','graphic-design','virtual-assistant','translation','travel-planning'].includes(industry))return 'professional_services';
 return 'general';
}
export function categoryWaiverContent(config={}){
 const options=config.categoryWaiver||{};
 const services=(config.services||[]).filter(s=>s.requiresWaiver===true).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const template=waiverTemplateForCategory(options.category,{businessName:config.name,serviceName:services.map(s=>s.name).join(', ')||'the services listed below'});
 return {version:CATEGORY_WAIVER_VERSION,category:template.category,businessName:String(config.name||'Business').trim(),title:template.title,
  serviceIds:services.map(s=>s.id),sections:[...template.sections.map(s=>[s.heading,s.text]),
   ...services.map(s=>['Service: '+s.name,[s.description,options.serviceTerms?.[s.id]].filter(Boolean).join('\n')||'Scope: '+s.name]),
   ...(options.additionalTerms?.trim()?[['Business-specific terms',options.additionalTerms.trim()]]:[]),
   ['Electronic signature','My typed full name is my electronic signature. This consent applies only to the listed services at this business. A parent or legal guardian must sign for a participant under 18. Changes to this document require new consent.']],
  mediaReleaseIncluded:false,
  mediaRelease:'Optional media permission: I permit this business to use photographs or recordings of the participant in its publicity, website and social media. Declining does not affect service eligibility. I may withdraw permission for future use by contacting the business. For a minor, this permission is given by a parent or legal guardian.'};
}
export function waiverContentPayload(document){
 const {colors,hash,...content}=document;
 return JSON.stringify(content);
}
