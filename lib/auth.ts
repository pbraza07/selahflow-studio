import {supportOwner} from '../server/platform-support.mjs';
import {getPool} from '../server/database.mjs';
import {sessionToken,tokenHash} from '../server/security.mjs';
export async function requireOwner(req:Request,options:{allowPasswordChange?:boolean}={}):Promise<string>{
 const token=sessionToken(req);
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw new Error('AUTH_REQUIRED');
 const result=await getPool().query('SELECT users.id,users.must_change_password FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=$1 AND sessions.expires_at>now()',[tokenHash(token)]);
 if(!result.rows[0])throw new Error('AUTH_REQUIRED');
 if(result.rows[0].must_change_password===true&&!options.allowPasswordChange)throw new Error('PASSWORD_CHANGE_REQUIRED');
 return supportOwner(getPool(),req,{id:result.rows[0].id,hash:tokenHash(token)});
}
