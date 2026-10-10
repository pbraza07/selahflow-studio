import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {hashPassword,verifyPassword} from '../server/security.mjs';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('business owners have one-way passwords, not visible plaintext secrets',()=>{
 const plain='temporary-password-not-to-reuse-9348';
 const encoded=hashPassword(plain);
 assert.ok(encoded.startsWith('scrypt:'));
 assert.equal(encoded.includes(plain),false);
 assert.equal(verifyPassword(plain,encoded),true);
 assert.equal(verifyPassword('wrong',encoded),false);
 assert.notEqual(hashPassword(plain),encoded);
});
test('password rotation migration flags owners without altering existing accounts or appointments',async()=>{
 const db=new PGlite();
 try{
  for(const migration of ['001_initial.sql','003_platform_foundation.sql','004_business_customization.sql',
   '005_business_approval_terms.sql','014_platform_business_management.sql','015_platform_owner_password_reset.sql'])
   await db.exec(await read('migrations/'+migration));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner1','one@example.com','x'),('admin1','admin@example.com','x')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('b1','owner1','owner-one','Owner One')");
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('a1','owner1','2026-10-12','coach',540,60,'{}','Confirmed')");
  assert.equal((await db.query("SELECT must_change_password FROM users WHERE id='owner1'")).rows[0].must_change_password,false);
  await db.query("UPDATE users SET must_change_password=TRUE WHERE id='owner1'");
  assert.equal((await db.query("SELECT must_change_password FROM users WHERE id='owner1'")).rows[0].must_change_password,true);
  await db.query("INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES('audit1','b1','admin1','reset_password','{}'::jsonb,'{\"sessions_revoked\":true}'::jsonb)");
  assert.equal((await db.query("SELECT action FROM platform_business_audit WHERE id='audit1'")).rows[0].action,'reset_password');
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM appointments WHERE owner='owner1'")).rows[0].count,1);
  await db.query("UPDATE users SET must_change_password=FALSE WHERE id='owner1'");
  assert.equal((await db.query("SELECT must_change_password FROM users WHERE id='owner1'")).rows[0].must_change_password,false);
 }finally{await db.close();}
});
test('platform admins can reset a business owner account but not platform admin credentials, and sessions are revoked',async()=>{
 const route=await read('app/api/platform/businesses/manage/route.ts');
 assert.match(route,/getPlatformRole\(pool,actor\)/);
 assert.match(route,/if\(!role\)throw Error\('FORBIDDEN'\)/);
 assert.match(route,/payload.confirmName!==before.name/);
 assert.match(route,/randomBytes\(24\)/);
 assert.match(route,/hashPassword\(tempPassword\)/);
 assert.match(route,/must_change_password=TRUE/);
 assert.match(route,/DELETE FROM sessions WHERE user_id=\$1/);
 assert.match(route,/INSERT INTO platform_business_audit/);
 assert.match(route,/Administrator accounts must change their own passwords/);
 assert.match(route,/payload\.expectedEmail!==target\.email/);
 assert.doesNotMatch(route,/SELECT [^;\n]*password_hash AS password/);
 assert.doesNotMatch(route,/return Response\.json\(\{[^}]*password_hash/);
});
test('password-change requirement locks private APIs and redirects sign-in without blocking password rotation',async()=>{
 const [auth,login,studio,password,required,ui]=await Promise.all([
  'lib/auth.ts','app/api/auth/login/route.ts','app/studio/[slug]/page.tsx',
  'app/api/account/password/route.ts','app/account/require-password-change/page.tsx',
  'app/components/required-password-change.tsx'
 ].map(read));
 assert.match(auth,/if\(result\.rows\[0\]\.must_change_password===true&&!options\.allowPasswordChange\)/);
 assert.match(login,/user\.must_change_password===true\?'\/account\/require-password-change'/);
 assert.match(studio,/redirect\('\/account\/require-password-change'\)/);
 assert.match(password,/requireOwner\(req,\{allowPasswordChange:true\}\)/);
 assert.match(password,/must_change_password=FALSE/);
 assert.match(required,/must_change_password/);
 assert.match(ui,/Set my private password/);
});
test('admin directory lists each email and one-time credential only after an explicitly confirmed reset',async()=>{
 const [directory,manager,overview]=await Promise.all([
  'app/components/platform-business-directory.tsx',
  'app/components/platform-business-manager.tsx',
  'app/api/platform/overview/route.ts'
 ].map(read));
 assert.match(overview,/owner_email/);
 assert.match(directory,/Owner email: \{b\.owner_email\}/);
 assert.match(manager,/Reset password/);
 assert.match(manager,/Reset owner password/);
 assert.match(manager,/resetConfirmation!==resetting\.name/);
 assert.match(manager,/temporaryPassword/);
 assert.match(manager,/revealCredential/);
 assert.doesNotMatch(manager,/password_hash/i);
});
