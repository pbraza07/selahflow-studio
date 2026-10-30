export const teamSlugBase=(business,name)=>(business+'-'+name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,170).replace(/-+$/,'')||'team-member';
/** Caller owns a transaction; disabled accounts and aliases keep their URLs reserved. */
export async function ensureTeamPublicSlug(db,accountId){
 let a=(await db.query('SELECT a.id,a.business_id,a.staff_id,a.profile,a.public_slug,b.slug,s.data FROM team_accounts a JOIN businesses b ON b.id=a.business_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE a.id=$1',[accountId])).rows[0];
 if(!a)throw Error('Team account unavailable.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['selahflow:team-public-slugs']);
 a=(await db.query('SELECT a.id,a.business_id,a.staff_id,a.profile,a.public_slug,b.slug,s.data FROM team_accounts a JOIN businesses b ON b.id=a.business_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE a.id=$1 FOR UPDATE OF a',[accountId])).rows[0];
 const config=typeof a.data==='string'?JSON.parse(a.data):a.data||{},name=a.profile?.name||config.staff?.find(s=>s.id===a.staff_id)?.name||'Team member',base=teamSlugBase(a.slug,name);
 let candidate=base,n=1;
 while((await db.query('SELECT 1 FROM team_accounts WHERE public_slug=$1 AND id<>$2 UNION ALL SELECT 1 FROM team_profile_aliases WHERE slug=$1 AND account_id<>$2',[candidate,accountId])).rows.length)candidate=base+'-'+(++n);
 if(a.public_slug&&a.public_slug!==candidate)await db.query('INSERT INTO team_profile_aliases(slug,account_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.public_slug,accountId]);
 await db.query('UPDATE team_accounts SET public_slug=$1 WHERE id=$2',[candidate,accountId]);return candidate;
}
