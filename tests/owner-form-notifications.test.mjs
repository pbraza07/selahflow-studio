import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {queueOwnerFormNotification,processOwnerFormNotifications} from '../server/owner-form-notifications.mjs';
import {notificationMessage} from '../server/notification-delivery.mjs';
test('direct form outbox filters private answers, deduplicates, honors disabled delivery and never retries ambiguous sends',async()=>{
 const pg=new PGlite();try{
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.invalid','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('business','owner','test','Test','active'); INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('visit','owner','2030-01-01',600,30,'coach','Confirmed','{}')");
 const config={bookingNotifyEmail:true,bookingQuestionNotifications:{firstName:true,lastName:false,email:false,phone:false,dateOfBirth:false,memberNumber:false}};
 await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 const input={businessId:'business',sourceId:'visit',form:'booking',values:{name:'Allowed Hidden',email:'secret@example.invalid'}};
 await queueOwnerFormNotification(pg,input);await queueOwnerFormNotification(pg,input);
 const rows=(await pg.query('SELECT * FROM owner_form_notifications')).rows;assert.equal(rows.length,1);assert.match(rows[0].message.text,/Allowed/);assert.doesNotMatch(rows[0].message.text,/Hidden|secret/);
 let sent=0;await processOwnerFormNotifications(pg,{send:async()=>{sent++;throw Error('uncertain');}});await processOwnerFormNotifications(pg,{send:async()=>{sent++;return {status:'submitted'};}});assert.equal(sent,1);assert.equal((await pg.query('SELECT status FROM owner_form_notifications')).rows[0].status,'unknown');
 await pg.exec("UPDATE owner_form_notifications SET status='queued'");await pg.query('UPDATE settings SET data=$1',[JSON.stringify({...config,bookingNotifyEmail:false})]);
 await processOwnerFormNotifications(pg,{send:async()=>{sent++;return {status:'submitted'};}});assert.equal(sent,1);assert.equal((await pg.query('SELECT status FROM owner_form_notifications')).rows[0].status,'superseded');
 }finally{await pg.close();}
});
test('approval SMS and email both exclude fields whose Notify flag is off',()=>{
 const message=notificationMessage({businessName:'Test',request:{details:{customerName:'Secret Person',customerEmail:'private@example.invalid',services:[]},date:'2030-01-01',start_minute:600,duration:30},link:'https://example.invalid/review',config:{bookingQuestionNotifications:{firstName:false,lastName:false,email:false,phone:false}}});
 assert.doesNotMatch(message.text+message.sms,/Secret|Person|private/);
});
