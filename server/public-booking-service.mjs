/** Project only booked service names and public catalog categories. */
export function publicBookingServiceSummary(value,config={}){
 let data={};try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data=parsed;}catch{}
 const clean=(v,n=150)=>typeof v==='string'?v.trim().slice(0,n):'';
 const catalog=Array.isArray(config.services)?config.services:[];
 const ids=Array.isArray(data.serviceIds)?data.serviceIds.filter(v=>typeof v==='string').slice(0,10):[];
 const names=Array.isArray(data.services)?data.services.map(v=>clean(v)).filter(Boolean).slice(0,10):[];
 const items=catalog.filter(s=>ids.includes(s.id)||names.includes(s.name));
 if(!names.length)names.push(...items.map(s=>clean(s.name)).filter(Boolean).slice(0,10));
 const types=[...new Set(items.map(s=>clean(s.category,80)).filter(Boolean))];
 return {service:[...new Set(names)].join(', ')||'Session',serviceType:types.join(', ')||(data.sessionId?'Group session':'Individual appointment')};
}
