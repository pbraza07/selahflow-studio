import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PGlite} from '@electric-sql/pglite';
import {validateMembershipBadge,resolveMembershipBadge,MEMBERSHIP_BADGE_ICONS} from '../server/membership-badges.mjs';
import {changeMembershipGroup} from '../server/membership-groups.mjs';
import {loadOwnerMemberRoster,decorateOwnerAppointments} from '../server/owner-appointment-members.mjs';
const typeBadge={label:'Youth Club',color:'#123f3a',icon:'shield',shape:'pill'};
const planBadge={label:'VIP',color:'#000000',icon:'crown',shape:'rounded'};
test('editable badge settings validate all styles and inherit type defaults without allowing HTML or CSS injection',()=>{
 assert.equal(validateMembershipBadge(null),null);
 assert.deepEqual(validateMembershipBadge(typeBadge),{...typeBadge,color:'#123F3A'});
 for(const [icon] of MEMBERSHIP_BADGE_ICONS)assert.equal(validateMembershipBadge({...typeBadge,icon}).icon,icon);
 for(const bad of [{...typeBadge,color:'red;background:url(x)'},{...typeBadge,icon:'url(x)'},{...typeBadge,shape:'square'},{...typeBadge,label:'<script>'},{...typeBadge,label:'a'.repeat(61)},{...typeBadge,css:'position:fixed'},'badge',[]])assert.throws(()=>validateMembershipBadge(bad),/badge|color|settings/);
 assert.deepEqual(resolveMembershipBadge(planBadge,typeBadge),planBadge);
 assert.deepEqual(resolveMembershipBadge(null,typeBadge),validateMembershipBadge(typeBadge));
 assert.equal(resolveMembershipBadge(null,null),null);
 assert.deepEqual(resolveMembershipBadge({bad:'legacy'},typeBadge),validateMembershipBadge(typeBadge));
});
test('actual rendered badge uses saved styles, pure white on black, explicit payment/credit status and restored renewal without changing ID',async()=>{
 const require=createRequire(import.meta.url);
 let source=await readFile(new URL('../app/components/membership-badge.tsx',import.meta.url),'utf8');
 for(const name of ['member-badge-state','membership-badges','themes'])source=source.replace('../../server/'+name+'.mjs',new URL('../server/'+name+'.mjs',import.meta.url).href);
 let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const pkg of ['react/jsx-runtime','lucide-react'])compiled=compiled.replace(JSON.stringify(pkg),JSON.stringify(pathToFileURL(require.resolve(pkg)).href)).replace("'"+pkg+"'",JSON.stringify(pathToFileURL(require.resolve(pkg)).href));
 const {default:Badge}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const render=props=>renderToStaticMarkup(React.createElement(Badge,{memberNumber:'AB0101',membershipName:'Gold plan',membershipStatus:'active',sessionsIncluded:2,sessionsUsed:1,badge:planBadge,...props}));
 const active=render({});assert.match(active,/VIP · AB0101/);assert.match(active,/background:#000000/);assert.match(active,/color:#FFFFFF/);assert.match(active,/border-radius:8px/);assert.match(active,/lucide-crown/);
 for(const [props,status] of [[{sessionsUsed:2},'Sessions exhausted'],[{membershipStatus:'pending_payment'},'Payment pending'],[{membershipStatus:'expired'},'Expired']]){const html=render(props);assert.match(html,/VIP · AB0101/);assert.match(html,/background:#000000/);assert.match(html,new RegExp(status));}
 const pending=render({membershipName:'Group Academy',membershipStatus:'pending_payment',sessionsIncluded:0,sessionsUsed:0,badge:null});assert.match(pending,/Group Academy · AB0101/);assert.match(pending,/Payment pending/);assert.match(pending,/background:#44aff5/);
 const changed=render({membershipName:'Private Elite',membershipStatus:'pending_payment',sessionsIncluded:0,sessionsUsed:0,badge:null});assert.match(changed,/Private Elite · AB0101/);assert.match(changed,/background:#ef4335/);assert.match(changed,/Payment pending/);
 const regular=render({membershipName:null,badge:null});assert.match(regular,/ID AB0101/);assert.match(regular,/background:#f1f2f4/);
 assert.match(render({sessionsIncluded:4,sessionsUsed:2}),/VIP · AB0101/);
 assert.match(render({badge:null}),/Gold plan · AB0101/);
});
test('type badge edits propagate to owner roster while plan overrides, tenant isolation and membership records remain intact',async()=>{
 const db=new PGlite();try{
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  await db.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','club-one','Club One','active'),('b2','u2','club-two','Club Two','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Gold','month',10000,8); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,sessions_included,sessions_used,member_number,stripe_account_id) VALUES('m1','b1','p1','Test Member','member@example.com','active',10000,16,3,'TM0101','manual'); INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('history1','b1','m1','payment1','payment_confirmed',8,10000);");
  const before=(await db.query('SELECT * FROM customer_memberships')).rows,ledger=(await db.query('SELECT * FROM membership_session_ledger')).rows;
  const group=await changeMembershipGroup(db,'b1',{action:'saveGroup',name:'Youth training',badge:typeBadge});
  await db.query('UPDATE membership_plans SET group_id=$1 WHERE id=$2',[group.id,'p1']);
  const roster=()=>loadOwnerMemberRoster(db,'u1');
  assert.deepEqual((await roster())[0].membership_badge,validateMembershipBadge(typeBadge));
  await changeMembershipGroup(db,'b1',{action:'saveGroup',id:group.id,name:'Juniors',badge:{...typeBadge,label:'Junior Club'}});
  assert.equal((await roster())[0].membership_badge.label,'Junior Club');
  await db.query('UPDATE membership_plans SET badge=$1::jsonb WHERE id=$2',[JSON.stringify(validateMembershipBadge(planBadge)),'p1']);
  const visit=decorateOwnerAppointments([{memberNumber:'TM0101'}],await roster())[0];
  assert.deepEqual(visit.membershipBadge,planBadge);assert.equal(visit.membershipSessionsRemaining,13);
  assert.deepEqual(await loadOwnerMemberRoster(db,'u2'),[]);
  await assert.rejects(changeMembershipGroup(db,'b2',{action:'saveGroup',id:group.id,name:'Wrong business',badge:planBadge}),/this business/);
  await db.query('UPDATE membership_plans SET badge=NULL WHERE id=$1',['p1']);
  assert.equal((await roster())[0].membership_badge.label,'Junior Club');
  await changeMembershipGroup(db,'b1',{action:'saveGroup',id:group.id,name:'Juniors'});
  assert.equal((await roster())[0].membership_badge.label,'Junior Club','older clients preserve stored badge');
  await changeMembershipGroup(db,'b1',{action:'saveGroup',id:group.id,name:'Juniors',badge:null});
  assert.equal((await roster())[0].membership_badge,null);
  assert.deepEqual((await db.query('SELECT * FROM customer_memberships')).rows,before);
  assert.deepEqual((await db.query('SELECT * FROM membership_session_ledger')).rows,ledger);
 }finally{await db.close();}
});
