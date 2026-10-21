import {createHash,randomBytes} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {assertStagingDatabase} from './staging-safety.mjs';
import {hashPassword} from './security.mjs';

// Explicit dependency order; auth, tokens, device subscriptions and provider connections
// are deliberately absent. Importing never invokes notification/payment functions.
export const snapshotTables=['users','businesses','settings','business_memberships','business_subscriptions','business_entitlement_overrides','business_logos','membership_groups','membership_plans','appointments','slots','events','business_client_profiles','business_member_ids','customer_booking_ids','customer_memberships','membership_session_ledger','membership_requests','booking_requests','booking_request_edits','booking_notification_attempts','business_notification_reads','business_team_seat_requests','business_plan_entitlement_audit','platform_business_audit','service_enrollments','marketplace_referrals','ai_usage'];
const ident=s=>'"'+s.replaceAll('"','""')+'"';
export function validateSnapshot(snapshot){
 if(snapshot?.format!=='selahflow-business-snapshot-v1'||!/^[a-f0-9]{40}$/.test(snapshot.sourceCommit)||!Number.isFinite(Date.parse(snapshot.capturedAt)))throw Error('Invalid production snapshot.');
 if(!snapshot.tables||Object.keys(snapshot.tables).length!==snapshotTables.length||snapshotTables.some(t=>!Array.isArray(snapshot.tables[t])))throw Error('Incomplete production snapshot.');
 if(!snapshot.tables.businesses.length||snapshot.tables.businesses.length>1000)throw Error('Invalid business count.');
 for(const t of snapshotTables)for(const r of snapshot.tables[t]){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid snapshot record.');
  if(r.member_number!=null&&!/^[A-Z]{2}[0-9]{4}$/.test(r.member_number))throw Error('Legacy membership IDs cannot be imported. Refresh the source after ID repair.');
  if(t==='users'&&Object.keys(r).some(k=>!['id','email','created_at'].includes(k)))throw Error('Production credentials cannot be imported.');
 }
 return snapshot;
}
export function isolatedSnapshotRow(table,record){
 const row={...record};
 if(table==='business_subscriptions'){row.stripe_customer_id=null;row.stripe_subscription_id=null;}
 if(table==='customer_memberships')for(const key of Object.keys(row))if(key.startsWith('stripe_'))row[key]=key==='stripe_account_id'?'staging_replica_unconnected':null;
 return row;
}
export async function importBusinessSnapshot(pool,snapshot,digest,env=process.env){
 if(env.APP_ENV!=='staging')throw Error('Business snapshot import is restricted to staging.');
 assertStagingDatabase(env);
 if(env.STAGING_NOTIFICATIONS_ENABLED==='true'||env.STAGING_PUSH_ENABLED==='true')throw Error('Disable staging outbound notifications before importing.');
 validateSnapshot(snapshot);
 const actual=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 if(digest!==actual)throw Error('Production snapshot checksum mismatch.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(81371039)');
  const identity=(await db.query('SELECT current_database() AS name,current_user AS role')).rows[0];
  if(identity.name!=='selahflow_staging'||identity.role!=='selahflow_staging_user')throw Error('Wrong import destination.');
  const done=(await db.query('SELECT id,summary FROM staging_snapshot_runs')).rows;
  if(done.length){if(done[0].id!==digest)throw Error('A snapshot was already imported; a new refresh needs a reviewed migration.');await db.query('COMMIT');return {...done[0].summary,alreadyImported:true};}
  const columns=(await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'")).rows;
  const summary={sourceCommit:snapshot.sourceCommit,capturedAt:snapshot.capturedAt,businesses:snapshot.tables.businesses.map(b=>({id:b.id,name:b.name,slug:b.slug,status:b.status})),counts:Object.fromEntries(snapshotTables.map(t=>[t,snapshot.tables[t].length])),aliasedOwnerEmails:0};
  await db.query('INSERT INTO staging_snapshot_runs(id,source_commit,captured_at,summary) VALUES($1,$2,$3,$4)',[digest,snapshot.sourceCommit,snapshot.capturedAt,JSON.stringify(summary)]);
  // A transactional undo snapshot stays only inside the staging database.
  for(const table of snapshotTables){await db.query(`LOCK TABLE ${ident(table)} IN SHARE ROW EXCLUSIVE MODE`);await db.query(`INSERT INTO staging_snapshot_backups(run_id,table_name,records) SELECT $1,$2,COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM ${ident(table)} t`,[digest,table]);}
  const sourceIds=new Set(snapshot.tables.businesses.map(b=>b.id));
  const existing=(await db.query('SELECT id,slug FROM businesses')).rows;
  for(const b of existing){
   if(sourceIds.has(b.id))throw Error('Existing business IDs overlap; refusing to overwrite development data.');
   if(snapshot.tables.businesses.some(s=>s.slug===b.slug)){
    if(b.slug!=='crawford'||existing.length!==1)throw Error('Business slug conflict; import stopped.');
    await db.query("UPDATE businesses SET slug='staging-test-studio' WHERE id=$1",[b.id]);
   }
  }
  for(const table of snapshotTables){
   const metadata=new Map(columns.filter(c=>c.table_name===table).map(c=>[c.column_name,c.data_type]));
   if(!metadata.size)throw Error('Missing destination table.');
   for(const record of snapshot.tables[table]){
    const row=isolatedSnapshotRow(table,record);
    if(table==='users'){
     if((await db.query('SELECT 1 FROM users WHERE id=$1',[row.id])).rowCount)throw Error('Existing user ID conflict.');
     if((await db.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[row.email])).rowCount){row.email=`replica-${row.id}@staging.invalid`;summary.aliasedOwnerEmails++;}
     row.password_hash=hashPassword(randomBytes(48).toString('hex'));row.must_change_password=true;
    }
    const keys=Object.keys(row);
    if(keys.some(k=>!metadata.has(k)))throw Error('Unknown snapshot column.');
    const values=keys.map(k=>row[k]===null?null:metadata.get(k)==='jsonb'?JSON.stringify(row[k]):metadata.get(k)==='bytea'?Buffer.from(String(row[k]).replace(/^\\x/,''),'hex'):row[k]);
    await db.query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})${table==='business_member_ids'?' ON CONFLICT DO NOTHING':''}`,values);
   }
  }
  const beforeCounts=(await db.query('SELECT table_name,jsonb_array_length(records) AS n FROM staging_snapshot_backups WHERE run_id=$1',[digest])).rows;
  for(const table of snapshotTables){
   const generated=table==='business_member_ids'?new Set(['business_client_profiles','customer_booking_ids','customer_memberships'].flatMap(t=>snapshot.tables[t].filter(r=>r.member_number).map(r=>(r.business_id||snapshot.tables.businesses.find(b=>b.owner_id===r.owner)?.id)+'|'+r.member_number)).filter(key=>!snapshot.tables.business_member_ids.some(r=>r.business_id+'|'+r.member_number===key))).size:0;
   const expected=Number(beforeCounts.find(r=>r.table_name===table).n)+snapshot.tables[table].length+generated;
   if(Number((await db.query(`SELECT count(*) AS n FROM ${ident(table)}`)).rows[0].n)!==expected)throw Error('Snapshot table count mismatch.');
  }
  summary.verifiedTables=snapshotTables.length;
  for(const b of snapshot.tables.businesses){
   const source=snapshot.tables.business_memberships.find(m=>m.business_id===b.id&&m.user_id===b.owner_id&&m.role==='owner');
   if(!source)throw Error('Missing source owner membership.');
   for(const [table,col] of [['appointments','owner'],['booking_requests','owner_id'],['business_client_profiles','owner']]){
    const expected=snapshot.tables[table].filter(r=>r[col]===b.owner_id).length;
    const actual=Number((await db.query(`SELECT count(*) AS n FROM ${ident(table)} WHERE ${ident(col)}=$1`,[b.owner_id])).rows[0].n);
    if(expected!==actual)throw Error('Business record count mismatch.');
   }
  }
  await db.query('UPDATE staging_snapshot_runs SET summary=$2 WHERE id=$1',[digest,JSON.stringify(summary)]);
  await db.query('COMMIT');return summary;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export function snapshotFromEnvironment(env=process.env){
 const chunks=[1,2,3,4].map(i=>env['STAGING_IMPORT_SNAPSHOT_'+i]||'');
 if(!chunks.some(Boolean))return null;
 if(chunks.join('').length>2000000)throw Error('Snapshot exceeds import size limit.');
 return {snapshot:JSON.parse(gunzipSync(Buffer.from(chunks.join(''),'base64'),{maxOutputLength:10000000}).toString()),digest:env.STAGING_IMPORT_SNAPSHOT_SHA256};
}
