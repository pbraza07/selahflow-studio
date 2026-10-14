import {validateMembershipBadge} from './membership-badges.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function requireMembershipGroup(client,businessId,value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||!uuid.test(value))throw Error('Choose a valid membership type.');
 if(!(await client.query('SELECT id FROM membership_groups WHERE business_id=$1 AND id=$2',[businessId,value])).rows[0])throw Error('Choose a membership type for this business.');
 return value;
}
// Caller owns a transaction and the business membership-offers advisory lock.
export async function changeMembershipGroup(client,businessId,input){
 if(input.action==='saveGroup'){
  const badge=validateMembershipBadge(input.badge);
  const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
  if(name.length<2||name.length>80)throw Error('Enter a membership type name between 2 and 80 characters.');
  const groups=(await client.query('SELECT id,name FROM membership_groups WHERE business_id=$1 FOR UPDATE',[businessId])).rows;
  if(groups.some(g=>g.id!==input.id&&g.name.toLowerCase()===name.toLowerCase()))throw Error('Choose a unique membership type name.');
  if(input.id){
   const id=await requireMembershipGroup(client,businessId,input.id);
   await client.query('UPDATE membership_groups SET name=$1,badge=CASE WHEN $5 THEN $4::jsonb ELSE badge END WHERE business_id=$2 AND id=$3',[name,businessId,id,badge?JSON.stringify(badge):null,input.badge!==undefined]);
   return {id};
  }
  if(groups.length>=30)throw Error('This business allows up to 30 membership types.');
  const id=crypto.randomUUID();
  await client.query('INSERT INTO membership_groups(id,business_id,name,display_order,badge) SELECT $1,$2,$3,COALESCE(MAX(display_order),-1)+1,$4::jsonb FROM membership_groups WHERE business_id=$2',[id,businessId,name,badge?JSON.stringify(badge):null]);
  return {id};
 }
 if(input.action==='removeGroup'){
  const id=await requireMembershipGroup(client,businessId,input.id);
  if(!id)throw Error('Choose a membership type.');
  // Keep every package, member, payment and session; only remove its grouping.
  await client.query('UPDATE membership_plans SET group_id=NULL WHERE business_id=$1 AND group_id=$2',[businessId,id]);
  await client.query('DELETE FROM membership_groups WHERE business_id=$1 AND id=$2',[businessId,id]);
  return {ok:true};
 }
 if(input.action==='reorderGroups'){
  if(!Array.isArray(input.ids)||input.ids.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(input.ids).size!==input.ids.length)throw Error('Invalid membership type order.');
  const groups=(await client.query('SELECT id FROM membership_groups WHERE business_id=$1 FOR UPDATE',[businessId])).rows;
  if(groups.length!==input.ids.length||groups.some(g=>!input.ids.includes(g.id)))throw Error('Membership types changed. Refresh and try again.');
  for(let i=0;i<input.ids.length;i++)await client.query('UPDATE membership_groups SET display_order=$1 WHERE business_id=$2 AND id=$3',[i,businessId,input.ids[i]]);
  return {ok:true};
 }
 throw Error('Invalid membership type action.');
}
export function membershipTabs(plans,groups=[]){
 if(!groups.length)return [];
 const tabs=[{id:'all',name:'All memberships'},...groups.filter(g=>plans.some(p=>p.groupId===g.id))];
 if(plans.some(p=>!p.groupId))tabs.push({id:'ungrouped',name:'Other memberships'});
 return tabs.length>1?tabs:[];
}
export function plansForMembershipTab(plans,tab){return tab==='all'?plans:plans.filter(p=>tab==='ungrouped'?!p.groupId:p.groupId===tab);}
