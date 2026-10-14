import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {changeMembershipGroup,requireMembershipGroup,membershipTabs,plansForMembershipTab} from '../server/membership-groups.mjs';
test('membership tabs preserve package ordering, ungrouped plans and an all-memberships view',()=>{
 const groups=[{id:'youth',name:'Youth'},{id:'adults',name:'Adults'},{id:'empty',name:'Hidden until used'}];
 const plans=[{id:'gold',groupId:'youth'},{id:'single',groupId:null},{id:'silver',groupId:'youth'},{id:'monthly',groupId:'adults'}];
 assert.deepEqual(membershipTabs(plans,groups).map(g=>g.id),['all','youth','adults','ungrouped']);
 assert.deepEqual(plansForMembershipTab(plans,'youth').map(p=>p.id),['gold','silver']);
 assert.deepEqual(plansForMembershipTab(plans,'ungrouped').map(p=>p.id),['single']);
 assert.deepEqual(plansForMembershipTab(plans,'all'),plans);
 assert.deepEqual(membershipTabs([{id:'old',groupId:null}],[]),[]);
 assert.deepEqual(membershipTabs([],groups),[]);
 assert.deepEqual(plansForMembershipTab(plans,'missing'),[]);
});
test('membership group lifecycle is business-scoped and preserves existing member credits and financial history',async()=>{
 const db=new PGlite();try{
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  await db.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','club-one','Club One','active'),('b2','u2','club-two','Club Two','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Gold','month',10000,8),('p2','b2','Other business','month',9000,6); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,sessions_included,sessions_used,member_number,stripe_account_id) VALUES('m1','b1','p1','Test Member','member@example.com','active',10000,16,3,'TM0101','manual'); INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('history1','b1','m1','payment1','payment_confirmed',8,10000);");
  const before=(await db.query('SELECT * FROM customer_memberships WHERE id=$1',['m1'])).rows[0];
  const beforeLedger=(await db.query('SELECT * FROM membership_session_ledger')).rows;
  async function action(business,input){await db.exec('BEGIN');try{const result=await changeMembershipGroup(db,business,input);await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
  const youth=await action('b1',{action:'saveGroup',name:' Youth   training '});
  const adults=await action('b1',{action:'saveGroup',name:'Adult training'});
  const other=await action('b2',{action:'saveGroup',name:'Youth training'});
  assert.equal((await db.query('SELECT name FROM membership_groups WHERE id=$1',[youth.id])).rows[0].name,'Youth training');
  await assert.rejects(action('b1',{action:'saveGroup',name:'YOUTH TRAINING'}),/unique/);
  await assert.rejects(action('b1',{action:'saveGroup',name:'x'}),/between/);
  await assert.rejects(action('b1',{action:'saveGroup',id:other.id,name:'Wrong owner'}),/this business/);
  await assert.rejects(requireMembershipGroup(db,'b1',other.id),/this business/);
  await assert.rejects(db.query('UPDATE membership_plans SET group_id=$1 WHERE id=$2',[other.id,'p1']),/foreign key/i);
  await db.query('UPDATE membership_plans SET group_id=$1 WHERE id=$2',[await requireMembershipGroup(db,'b1',youth.id),'p1']);
  await action('b1',{action:'saveGroup',id:youth.id,name:'Junior training'});
  assert.equal((await db.query('SELECT group_id FROM membership_plans WHERE id=$1',['p1'])).rows[0].group_id,youth.id);
  await action('b1',{action:'reorderGroups',ids:[adults.id,youth.id]});
  assert.deepEqual((await db.query("SELECT id FROM membership_groups WHERE business_id='b1' ORDER BY display_order")).rows.map(g=>g.id),[adults.id,youth.id]);
  await assert.rejects(action('b1',{action:'reorderGroups',ids:[adults.id,other.id]}),/changed/);
  await assert.rejects(action('b1',{action:'reorderGroups',ids:[adults.id,adults.id]}),/Invalid/);
  await assert.rejects(action('b1',{action:'removeGroup',id:other.id}),/this business/);
  await action('b1',{action:'removeGroup',id:youth.id});
  const plan=(await db.query('SELECT * FROM membership_plans WHERE id=$1',['p1'])).rows[0];
  assert.equal(plan.group_id,null);assert.equal(plan.active,true);assert.equal(plan.price_cents,10000);assert.equal(plan.sessions_included,8);
  assert.deepEqual((await db.query('SELECT * FROM customer_memberships WHERE id=$1',['m1'])).rows[0],before);
  assert.deepEqual((await db.query('SELECT * FROM membership_session_ledger')).rows,beforeLedger);
  assert.equal((await db.query('SELECT name FROM membership_groups WHERE business_id=$1',['b2'])).rows[0].name,'Youth training');
  assert.equal(await requireMembershipGroup(db,'b1',''),null);
  await assert.rejects(requireMembershipGroup(db,'b1','bogus'),/valid/);
 }finally{await db.close();}
});
test('membership plan and assignment forms are modal-only; tab selection clears hidden packages',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const owner=await read('app/components/owner-memberships.tsx'),modal=await read('app/components/membership-modal.tsx'),publicPage=await read('app/membership/[slug]/page.tsx');
 assert.match(owner,/modal==='plan'&&<MembershipModal/);assert.match(owner,/modal==='assign'&&<MembershipModal/);assert.match(owner,/modal==='groups'&&<MembershipModal/);
 assert.equal(owner.indexOf('<form onSubmit={save}>')>owner.indexOf("modal==='plan'"),true);
 assert.equal(owner.indexOf('<form onSubmit={assignMember}')>owner.indexOf("modal==='assign'"),true);
 assert.match(modal,/<dialog/);assert.match(modal,/dialog.showModal\(\)/);assert.match(modal,/aria-labelledby={titleId}/);assert.match(modal,/if\(!busy\)onClose\(\)/);
 assert.match(publicPage,/role="tablist"/);assert.match(publicPage,/role="tab"/);assert.match(publicPage,/ArrowRight/);assert.match(publicPage,/setPlanId\(''\)/);
 const api=await read('app/api/studio/memberships/route.ts');assert.match(api,/requireOwner\(req\)/);assert.match(api,/changeMembershipGroup\(client,business.id,input\)/);assert.match(api,/requireMembershipGroup\(client,business.id,input.groupId\)/);
 const pub=await read('app/api/public/memberships/route.ts');assert.match(pub,/g.business_id=\$1 AND EXISTS/);assert.match(pub,/p.active=true/);
});
