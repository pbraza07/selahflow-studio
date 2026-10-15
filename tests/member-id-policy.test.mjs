import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {issueMemberId} from '../server/member-id-policy.mjs';
test('all policies allocate unique permanent IDs per business and guard cross-table duplicates',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','a@example.com','hash'),('u2','b@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active');");
  const issue=async(name,businessId='b1',requested='')=>{await pg.exec('BEGIN');try{const id=await issueMemberId(pg,{businessId,name,dateOfBirth:'2013-08-14',requested});await pg.exec('COMMIT');return id;}catch(e){await pg.exec('ROLLBACK');throw e;}};
  assert.equal(await issue('Caleb Alves'),'CA0814');
  assert.equal(await issue('Carlos Adams'),'CA0001');
  assert.equal(await issue('Carlos Adams'),'CA0001','returning client keeps ID');
  assert.equal(await issue('Carlos Adams','b2'),'CA0814','other business may reuse ID');
  await assert.rejects(issue('Other Client','b1','CA0814'),/does not belong/);
  await pg.exec("UPDATE businesses SET member_id_policy='initials_sequence' WHERE id='b1'");
  assert.equal(await issue('Carla Anderson'),'CA0002');
  assert.equal(await issue('Caleb Alves'),'CA0814','policy change preserves existing ID');
  await pg.exec("UPDATE businesses SET member_id_policy='random' WHERE id='b1'");
  assert.match(await issue('New Person'),/^[A-Z]{2}[0-9]{4}$/);
  await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('b1','Caleb','Alves','c@example.com','2013-08-14','CA0814')");
  await assert.rejects(pg.exec("INSERT INTO business_client_profiles(id,owner,name,email,phone,member_number,date_of_birth) VALUES('bad','u1','Different Client','d@example.com','','CA0814','2010-01-01')"),/already belongs/);
  await pg.exec("INSERT INTO business_client_profiles(id,owner,name,email,phone,member_number,date_of_birth) VALUES('good','u1','Caleb Alves','c@example.com','','CA0814','2013-08-14')");
  await pg.exec("DELETE FROM customer_booking_ids WHERE business_id='b1'; DELETE FROM business_client_profiles WHERE id='good'");
  await pg.exec("UPDATE businesses SET member_id_policy='initials_birthdate' WHERE id='b1'");
  assert.notEqual(await issue('Cameron Allen'),'CA0814','deleted identity reservation cannot be reassigned');
  const rows=(await pg.query("SELECT member_number FROM business_member_ids WHERE business_id='b1'")).rows;
  assert.equal(new Set(rows.map(r=>r.member_number)).size,rows.length);
 }finally{await pg.close();}
});
