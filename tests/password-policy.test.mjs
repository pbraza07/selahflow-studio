import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validNewPassword} from '../server/platform-roles.mjs';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('six-character minimum: five rejected, six accepted, maximum 128',()=>{
 assert.equal(validNewPassword('12345'),false);
 assert.equal(validNewPassword('123456'),true);
 assert.equal(validNewPassword('abcdef'),true);
 assert.equal(validNewPassword('a'.repeat(128)),true);
 assert.equal(validNewPassword('a'.repeat(129)),false);
 assert.equal(validNewPassword(''),false);
 assert.equal(validNewPassword(null),false);
});
test('business signup, owner change and administrator API share server validation',async()=>{
 for(const path of ['app/api/auth/signup/route.ts','app/api/account/password/route.ts','app/api/platform/admins/route.ts']){
  const text=await read(path);
  assert.match(text,/validNewPassword\(/,path);
 }
 assert.match(await read('scripts/migrate.mjs'),/password\.length<6/);
 assert.match(await read('app/api/auth/login/route.ts'),/password\.length<6/);
});
test('all password input forms use six-character minimum',async()=>{
 for(const path of ['app/signup/page.tsx','app/components/owner-password.tsx','app/components/platform-admin-manager.tsx','app/login/page.tsx','app/components/required-password-change.tsx']){
  assert.match(await read(path),/minLength=\{6\}/,path);
 }
 assert.match(await read('app/components/owner-password.tsx'),/newPassword\.length<6/);
 const required=await read('app/components/required-password-change.tsx');
 assert.match(required,/next\.length<6/);
 assert.doesNotMatch(required,/minLength=\{12\}|length<12|at least 12 characters/);
});
