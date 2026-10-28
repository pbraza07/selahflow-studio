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
