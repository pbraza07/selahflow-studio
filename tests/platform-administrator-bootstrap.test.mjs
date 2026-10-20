import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {ensurePlatformAdministrator} from '../server/platform-administrator.mjs';
import {verifyPassword} from '../server/security.mjs';
async function database(){
 const db=new PGlite();
 for(const file of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql'])await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 return db;
}
test('startup after Crawford removal preserves administrator credentials and every remaining tenant',async()=>{
 const db=await database();
 try{
  await db.exec("INSERT INTO users(id,email,password_hash) VALUES('admin','pbraza@gmail.com','existing-hash'),('other','other@example.com','other-hash'); INSERT INTO platform_admins(user_id,role) VALUES('admin','primary'); INSERT INTO businesses(id,owner_id,slug,name) VALUES('legacy','admin','crawford','SalonFlow Studio'),('other','other','other-studio','Other studio'); DELETE FROM businesses WHERE id='legacy'");
  for(let i=0;i<2;i++)await ensurePlatformAdministrator(db,{email:'pbraza@gmail.com',password:'not-used-existing-password'});
  assert.deepEqual((await db.query('SELECT id,owner_id,slug,name FROM businesses')).rows,[{id:'other',owner_id:'other',slug:'other-studio',name:'Other studio'}]);
  assert.deepEqual((await db.query("SELECT email,password_hash FROM users WHERE id='admin'")).rows,[{email:'pbraza@gmail.com',password_hash:'existing-hash'}]);
  assert.deepEqual((await db.query('SELECT user_id,role FROM platform_admins')).rows,[{user_id:'admin',role:'primary'}]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM business_memberships')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM business_subscriptions')).rows[0].n,0);
 }finally{await db.close();}
});
test('empty installation creates only an administrator account, without a default business',async()=>{
 const db=await database();
 try{
  const admin=await ensurePlatformAdministrator(db,{email:'pbraza@gmail.com',password:'fresh-install-password'});
  const user=(await db.query('SELECT * FROM users WHERE id=$1',[admin.id])).rows[0];
  assert.equal(verifyPassword('fresh-install-password',user.password_hash),true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n,0);
  assert.equal((await db.query('SELECT role FROM platform_admins WHERE user_id=$1',[admin.id])).rows[0].role,'primary');
 }finally{await db.close();}
});
