import {getPool} from '../server/database.mjs';
import {snapshotFromEnvironment,importBusinessSnapshot} from '../server/staging-business-snapshot.mjs';
const input=snapshotFromEnvironment();
if(input){const pool=getPool();try{const summary=await importBusinessSnapshot(pool,input.snapshot,input.digest);console.log('Staging business snapshot ready:',JSON.stringify(summary));}catch(error){console.error('Staging snapshot import stopped and rolled back.',{code:error.code||'IMPORT_GUARD',constraint:error.constraint||null});process.exitCode=1;}finally{await pool.end();}}
