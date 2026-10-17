import pg from 'pg';
import {assertStagingDatabase,isStaging} from './staging-safety.mjs';
// Next builds instrumentation and route handlers into separate module graphs.
// A module-local singleton creates multiple pools in the same Node process.
const poolKey=Symbol.for('selahflow.postgres.pool');
export function getPool(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
 assertStagingDatabase();
 if(!globalThis[poolKey])globalThis[poolKey]=new pg.Pool({connectionString:process.env.DATABASE_URL,max:isStaging()?2:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,...(process.env.DATABASE_SSL==='true'?{ssl:{rejectUnauthorized:true}}:{})});
 return globalThis[poolKey];
}
export function postgresSQL(sql){let index=0;let out=sql.replaceAll('?',()=>`$${++index}`);if(out.startsWith('INSERT OR IGNORE INTO'))out=out.replace('INSERT OR IGNORE INTO','INSERT INTO')+' ON CONFLICT DO NOTHING';return out;}
export function statement(sql,values=[]){return {sql:postgresSQL(sql),values};}
export async function executeBatch(pool,statements){const client=await pool.connect();try{await client.query('BEGIN');const result=[];for(const s of statements)result.push(await client.query(s.sql,s.values));await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
