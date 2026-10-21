import {getPool} from '../server/database.mjs';
import {repairClientIntegrity} from '../server/client-integrity-maintenance.mjs';
// Supply a privately reviewed exact target. No defaults and no name-based scan.
if(!process.env.CLIENT_DELETION_TARGET)throw Error('CLIENT_DELETION_TARGET and verified authorization required.');
const pool=getPool();
try{console.log('Client deletion:',JSON.stringify(await repairClientIntegrity(pool,JSON.parse(process.env.CLIENT_DELETION_TARGET))));}finally{await pool.end();}
