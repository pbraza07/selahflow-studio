/** Opt-in same-service, same-start sharing; all other staff collisions stay exclusive. */
export function serviceSlotCapacity(service){const n=service?.maxSlots??1;return Number.isInteger(n)&&n>=1&&n<=20?n:1;}
export function sharedService(services){return services.length===1&&services[0].shareTeamSlots===true&&serviceSlotCapacity(services[0])>1?services[0]:null;}
const dataOf=a=>{try{return typeof a.data==='string'?JSON.parse(a.data):a.data||{};}catch{return {};}};
export function sharesServiceTime(appointment,services,start,duration){
 const service=sharedService(services),data=dataOf(appointment);
 if(!service||data.sessionId||Number(appointment.start)!==start||Number(appointment.duration)!==duration)return false;
 const ids=Array.isArray(data.serviceIds)?data.serviceIds:[];
 const names=Array.isArray(data.services)?data.services:[];
 return ids.length?ids.length===1&&ids[0]===service.id:names.length===1&&names[0]===service.name;
}
export function serviceRemaining(existing,service,start,duration){
 const count=existing.filter(a=>{
  const data=dataOf(a);if(['Cancelled','No-show'].includes(a.status)||data.sessionId)return false;
  if(!(start<Number(a.start)+Number(a.duration)&&Number(a.start)<start+duration))return false;
  const ids=Array.isArray(data.serviceIds)?data.serviceIds:[],names=Array.isArray(data.services)?data.services:[];
  return ids.includes(service.id)||names.includes(service.name);
 }).length;
 return Math.max(0,serviceSlotCapacity(service)-count);
}
