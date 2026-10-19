import {readFile,readdir} from 'node:fs/promises';
import {getPool} from '../server/database.mjs';
import {ensurePlatformAdministrator} from '../server/platform-administrator.mjs';
const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;
if(!email||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<6)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 6 characters) before startup.');
const pool=getPool();const client=await pool.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(81371001)');
 await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  if((await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file])).rowCount)continue;
  await client.query(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);
  if(file==='045_remove_legacy_crawford.sql')console.log('Verified legacy Crawford removal in this database.');
 }
 await ensurePlatformAdministrator(client,{email,password});
 await client.query('DELETE FROM sessions WHERE expires_at<=now()');
 await client.query("DELETE FROM login_attempts WHERE window_start<now()-interval '1 day'");
 await client.query("DELETE FROM public_limits WHERE window_start<now()-interval '1 day'");
 await client.query('COMMIT');console.log('Database migrations and owner account are ready.');
}catch(e){await client.query('ROLLBACK');console.error('Database initialization failed. Check database and administrator environment settings.');throw e;}finally{client.release();await pool.end();}
