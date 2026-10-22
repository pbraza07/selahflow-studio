import {sessionsForDate} from './session-scheduling.mjs';
/** Hidden members remain owner records; never create anonymous dropdown options. */
export function publicTeamMembers(config={}){
 return (config.staff||[]).filter(s=>s.bookingVisible!==false).map(s=>({id:s.id,name:config.hideTeamNames?'Session team':s.name,role:config.hideTeamNames?'Assigned professional':s.role,initials:config.hideTeamNames?'ST':s.initials,services:s.services}));
}
export function clientTeamName(config,staffId){
 const member=(config.staff||[]).find(s=>s.id===staffId);
 return config.hideTeamNames||member?.bookingVisible===false?'Session team':member?.name||'Team member';
}
export function sessionTeamDefaults(config,session){
 const base=(config.bookableSessions||[]).find(s=>s.id===(session.seriesId||session.id));
 const ids=session.defaultTeamIds??base?.defaultTeamIds??[];
 return [...new Set([session.staff,...ids])].filter(id=>(config.staff||[]).some(s=>s.id===id));
}
export function sessionAutoAssigns(config,session){
 const base=(config.bookableSessions||[]).find(s=>s.id===(session.seriesId||session.id));
 return (session.autoAssignStaff??base?.autoAssignStaff)===true||(config.staff||[]).some(s=>s.id===session.staff&&s.bookingVisible===false);
}
export function publicSessionTeam(config,session){
 const visible=!config.hideTeamNames&&!(config.staff||[]).some(s=>s.id===session.staff&&s.bookingVisible===false);
 return {staff:session.staff,staffName:visible?clientTeamName(config,session.staff):'',staffVisible:visible,autoAssignStaff:sessionAutoAssigns(config,session)};
}
/** A multi-service visit uses a default only when every service agrees. */
export function configuredServiceDefault(config,ids){
 if(!Array.isArray(ids)||!ids.length)return null;
 const services=ids.map(id=>(config.services||[]).find(s=>s.id===id));
 const host=services[0]?.defaultStaffId;
 if(!host||services.some(s=>!s||s.defaultStaffId!==host))return null;
 return host;
}
export function defaultServiceStaff(config,ids){
 const host=configuredServiceDefault(config,ids);
 return host&&(config.staff||[]).some(s=>s.id===host&&ids.every(id=>s.services?.includes(id)))?host:null;
}
/** Resolve the business's actual occurrence before trusting a public host ID. */
export function publicBookingStaff(config,input){
 const member=(config.staff||[]).find(s=>s.id===input.staff);
 if(input.sessionId){
  const session=sessionsForDate(config,input.date).find(s=>s.id===input.sessionId);
  if(!session||input.services?.length!==1||input.services[0]!==session.service||(input.start!==undefined&&input.start!==session.start))throw Error('Choose the configured session date, service and time.');
  if(input.staff&&input.staff!==session.staff)throw Error('This session uses its assigned team member. Choose another session to change the team.');
  return session.staff;
 }
 const serviceHost=defaultServiceStaff(config,input.services);
 if(serviceHost){if(input.staff&&input.staff!==serviceHost)throw Error('These services use their default team member. Choose a scheduled session to use another host.');return serviceHost;}
 if(member?.bookingVisible===false)throw Error('This team member is not available for client selection. Choose a scheduled session.');
 return input.staff;
}
export function validateTeamBookingPolicy(config){
 for(const member of config.staff||[])if(member.bookingVisible!==undefined&&typeof member.bookingVisible!=='boolean')throw Error('Team booking visibility must be a checkbox value.');
 for(const service of config.services||[])if(service.defaultStaffId!==undefined&&service.defaultStaffId!==''&&(typeof service.defaultStaffId!=='string'||!(config.staff||[]).some(s=>s.id===service.defaultStaffId&&s.services?.includes(service.id))))throw Error('Choose a qualified team member from this business for the service default.');
 for(const session of [...(config.bookableSessions||[]),...(config.sessionOverrides||[])]){
  if(session.autoAssignStaff!==undefined&&typeof session.autoAssignStaff!=='boolean')throw Error('Session automatic team assignment must be a checkbox value.');
  if(session.defaultTeamIds!==undefined&&(!Array.isArray(session.defaultTeamIds)||session.defaultTeamIds.length>100||new Set(session.defaultTeamIds).size!==session.defaultTeamIds.length||session.defaultTeamIds.some(id=>!(config.staff||[]).some(s=>s.id===id))))throw Error('Choose this business’s team members for default session tracking.');
 }
}

/** Preserve the actual private host/team snapshot rather than reinterpreting old bookings after settings edits. */
export function bookingHostHistory(rows){
 const records=new Map();
 for(const row of rows){
  let data={};try{data=typeof row.data==='string'?JSON.parse(row.data):row.data||{};}catch{}
  const key=[row.date,data.sessionId||row.id,row.start].join('|');
  const ids=Array.isArray(data.hostTeamIds)?data.hostTeamIds.filter(id=>typeof id==='string'):[row.staff];
  const old=records.get(key);
  if(old){old.bookings++;old.staffIds=[...new Set([...old.staffIds,...ids])];}
  else records.set(key,{id:key,date:row.date,start:row.start,sessionId:data.sessionId||null,services:data.services||[],staffIds:[...new Set(ids)],bookings:1});
 }
 return [...records.values()];
}
