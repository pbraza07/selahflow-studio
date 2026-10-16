import {requireOwner} from './auth';
import {getPool} from '../server/database.mjs';
import {getPlatformRole} from '../server/platform-roles.mjs';
export async function requireGmailAdmin(req:Request){
 const actor=await requireOwner(req);
 if(await getPlatformRole(getPool(),actor)!=='primary')throw Error('FORBIDDEN');
 return actor;
}
