/** Shared client/server membership coverage rules. Missing rules preserve existing plans. */
/** @param {any} eligibility @param {any} context */
export function membershipAllows(eligibility,{serviceIds=[],sessionId=null,seriesId=null}={}){
 if(!eligibility||eligibility.mode==='all')return true;
 if(eligibility.mode!=='selected')return false;
 const services=Array.isArray(eligibility.serviceIds)?eligibility.serviceIds:[];
 const sessions=Array.isArray(eligibility.sessionIds)?eligibility.sessionIds:[];
 const series=seriesId||String(sessionId||'').replace(/__\d{8}$/,'');
 return !!sessionId&&(sessions.includes(sessionId)||sessions.includes(series))||serviceIds.length>0&&serviceIds.every(id=>services.includes(id));
}
export function validateMembershipEligibility(input,config={}){
 if(input===undefined)return null;
 if(!input||!['all','selected'].includes(input.mode))throw Error('Choose valid membership credit eligibility.');
 if(input.mode==='all')return {mode:'all',serviceIds:[],sessionIds:[]};
 const list=(value,available)=>{
  if(!Array.isArray(value)||value.length>200||value.some(id=>typeof id!=='string'||!available.includes(id)))throw Error('Choose services and sessions from this business. Refresh if the catalog changed.');
  return [...new Set(value)];
 };
 const serviceIds=list(input.serviceIds,(config.services||[]).map(s=>s.id));
 const sessionIds=list(input.sessionIds,(config.bookableSessions||[]).map(s=>s.id));
 if(!serviceIds.length&&!sessionIds.length)throw Error('Choose at least one service or session for membership credits.');
 return {mode:'selected',serviceIds,sessionIds};
}
export function membershipEligibilitySummary(eligibility,config={}){
 if(!eligibility||eligibility.mode==='all')return 'Credits: all services and sessions that accept membership credits.';
 const names=[...(eligibility.serviceIds||[]).map(id=>(config.services||[]).find(s=>s.id===id)?.name||'Removed service'),...(eligibility.sessionIds||[]).map(id=>{const s=(config.bookableSessions||[]).find(s=>s.id===id);return s?((config.services||[]).find(v=>v.id===s.service)?.name||'Session')+' · '+s.date+(s.repeat?' (recurring series)':''):'Removed session';})];
 return 'Credits valid for: '+names.join('; ')+'. Other bookings are charged separately.';
}
