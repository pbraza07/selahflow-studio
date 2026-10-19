import {randomUUID} from 'node:crypto';
import {hashPassword} from './security.mjs';
import {PRIMARY_PLATFORM_EMAIL} from './platform-roles.mjs';

// Administrator identity survives removal of the legacy business.
export async function ensurePlatformAdministrator(client,{email,password}){
 const existing=(await client.query("SELECT users.id,users.email,users.password_hash FROM businesses JOIN users ON users.id=businesses.owner_id WHERE businesses.slug='crawford' LIMIT 1")).rows[0]||(await client.query("SELECT users.id,users.email,users.password_hash FROM platform_admins p JOIN users ON users.id=p.user_id ORDER BY CASE WHEN p.role='primary' THEN 0 ELSE 1 END,users.created_at,users.id LIMIT 1")).rows[0]||(await client.query('SELECT id,email,password_hash FROM users ORDER BY created_at,id LIMIT 1')).rows[0];
 if(!existing){await client.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[randomUUID(),email,hashPassword(password)]);}
 else if(existing.email!==email){console.warn('ADMIN_EMAIL differs from original owner. Preserving original credentials and owner identity.');}
 const admin=existing?{id:existing.id}:(await client.query('SELECT id FROM users WHERE email=$1',[email])).rows[0];
 if(!admin)throw Error('Platform admin could not be identified.');
 if(email===PRIMARY_PLATFORM_EMAIL&&(!existing||existing.email===PRIMARY_PLATFORM_EMAIL))await client.query("INSERT INTO platform_admins(user_id,role) VALUES($1,'primary') ON CONFLICT(user_id) DO UPDATE SET role='primary'",[admin.id]);
 return admin;
}
