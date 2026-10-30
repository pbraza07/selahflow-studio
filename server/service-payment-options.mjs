/** Unset legacy services retain both payment choices. No button records a payment. */
export function servicePaymentOptions(services=[]){
 return {online:services.every(s=>s.paymentOptions!=='onsite'),onsite:services.every(s=>s.paymentOptions!=='online')};
}
export function bookingServicePaymentOptions(config={},data={}){
 if(data.paymentPolicy==='onsite_only')return {online:false,onsite:true};
 const ids=Array.isArray(data.serviceIds)?data.serviceIds:[];
 const services=(config.services||[]).filter(s=>ids.includes(s.id)||!ids.length&&(data.services||[]).includes(s.name));
 return servicePaymentOptions(services);
}
export function validateServicePaymentOptions(config){
 if((config.services||[]).some(s=>s.paymentOptions!==undefined&&!['online','onsite','both'].includes(s.paymentOptions)))throw Error('Choose Make payment, Pay onsite, or both for each service.');
}
