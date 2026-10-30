// A public-only projection: never query client media, notes, credentials or login emails.
export async function businessTeamShowcase(pool,businessId,config={}){
 const roster=Array.isArray(config.staff)?config.staff:[];
 const rows=(await pool.query("SELECT a.id,a.public_slug,a.staff_id,a.profile,m.id AS portrait_id FROM team_accounts a JOIN businesses b ON b.id=a.business_id JOIN team_media m ON m.account_id=a.id AND m.kind='portrait' AND m.appointment_id IS NULL WHERE a.business_id=$1 AND a.active=true AND b.status='active'",[businessId])).rows;
 return roster.filter(staff=>staff&&staff.bookingVisible!==false).flatMap(staff=>{
  const account=rows.find(row=>row.staff_id===staff.id);if(!account?.portrait_id)return [];
  const profile=account.profile&&typeof account.profile==='object'?account.profile:{};
  return [{id:account.id,publicSlug:account.public_slug,name:String(profile.name||staff.name||'Team member').slice(0,100),description:typeof profile.description==='string'?profile.description.trim().slice(0,2000):'',portraitId:account.portrait_id}];
 });
}
