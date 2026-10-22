
/** The catalog checkbox controls approval; notification routing cannot override it. */
export function requiresBookingApproval(services=[]){return services.some(service=>service.requiresApproval!==false);}
export function approvalSettings(config){
 const enabled=config?.bookingApprovalEnabled===true;
 const reviewer=config?.bookingApprovalReviewer||'owner';
 const staffIds=Array.isArray(config?.staff)?config.staff.map(x=>x.id):[];
 return {enabled,reviewer:reviewer==='owner'||staffIds.includes(reviewer)?reviewer:'owner'};
}
export function bookingRequestDetail({services,staff,date,start,duration,buffer,name,email,phone,price,reviewer}){
 return {serviceIds:services.map(s=>s.id),services:services.map(s=>s.name),staffId:staff,date,start,duration,buffer,
  customerName:name.trim(),customerEmail:email.trim(),customerPhone:phone.slice(0,40),
  quotedPrice:price,reviewer,created:new Date().toISOString()};
}
