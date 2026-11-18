import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {recordsSheet} from '../server/export-records.mjs';
import {clientWorkbookSheets} from '../server/client-history.mjs';
import {createClientXlsx} from '../server/client-xlsx.mjs';
import {businessExportSheets} from '../server/business-export.mjs';

test('columns include union of nested fields, zeros, false, Unicode and repeated details without credentials',()=>{
 const sheet=recordsSheet('Sales',[{id:'001',amount:0,active:false,lines:[{name:'João',qty:2},{name:'Mat',qty:1}],accessToken:'secret'},
  {id:'002',custom:{Parent:'Ana'},password_hash:'hidden'}]);
 assert.equal(new Set(sheet.rows[0]).size,sheet.rows[0].length);
 const row=Object.fromEntries(sheet.rows[0].map((h,i)=>[h,sheet.rows[1][i]]));
 assert.equal(row.Id,'001');assert.equal(row.Amount,0);assert.equal(row.Active,'No');
 assert.equal(row['Lines 1 / Name'],'João');assert.equal(row['Lines 2 / Qty'],1);
 assert.ok(sheet.rows[0].includes('Custom / Parent'));
 assert.doesNotMatch(JSON.stringify(sheet),/secret|hidden|password/i);
});

test('client export retains profile, imported, membership and separate custom-answer columns',()=>{
 const c={id:'membership-00000000-0000-0000-0000-000000000001',name:'Member only',email:'test@example.test',phone:'0123',memberNumber:'AB1001',dateOfBirth:'2000-01-02',bookedSessions:0,attendedSessions:0,attendanceDays:[],serviceTypes:[],history:[],notes:'Notes',registrationAnswers:{q:false},registrationFieldLabels:{q:'Consent'},membershipAnswers:[{id:'p',label:'Parent',value:'Ana'}],membershipDetails:{sessionsUsed:0,sessionsIncluded:8},importColumns:{School:'West'},editToken:'omit'};
 const sheet=clientWorkbookSheets([c])[0],record=Object.fromEntries(sheet.rows[0].map((h,i)=>[h,sheet.rows[1][i]]));
 assert.equal(record['Member Number'],'AB1001');assert.equal(record['Registration Answers / Consent [q]'],'No');
 assert.equal(record['Membership Answers / Parent [p]'],'Ana');assert.equal(record['Import Columns / School'],'West');
 assert.equal(record['Membership Details / Sessions Used'],0);assert.equal(record.Notes,'Notes');
 assert.equal(new Set(sheet.rows[0]).size,sheet.rows[0].length);assert.doesNotMatch(JSON.stringify(sheet),/omit|editToken/);
});

test('Excel has visible text on white sheets even with a dark business theme; valid ZIP dates and XML ordering',()=>{
 const file=createClientXlsx([recordsSheet('Test',[{name:'=formula',amount:0}])],{text:'#ffffff',button:'#ffffff'});
 const xml=file.toString();
 assert.equal(file.readUInt16LE(12),33);
 assert.ok(xml.includes('FF203B36'));assert.doesNotMatch(xml,/<f>/);
 assert.ok(xml.includes('&apos;=formula'));
 assert.ok(xml.indexOf('<autoFilter')<xml.indexOf('<mergeCells'));
 const empty=createClientXlsx([recordsSheet('Empty',[])]).toString();assert.match(empty,/0 records/);assert.match(empty,/A3:A3/);
});

test('business export executes against current schema, includes over 200 records and isolates business data',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await db.exec("INSERT INTO users(id,email,password_hash) VALUES('export-owner','export@example.test','x'),('other-owner','other@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('export-business','export-owner','export-test','Export Test','active'),('other-business','other-owner','other-test','Other Test','active'); INSERT INTO business_products(business_id,name,price_cents,tax_code) SELECT 'export-business','Product '||n,1000,'test' FROM generate_series(1,205) n; INSERT INTO business_products(business_id,name,price_cents,tax_code) VALUES('other-business','OTHER BUSINESS PRIVATE',1000,'test');");
 const sheets=await businessExportSheets(db,'export-owner',{id:'export-business'},{services:[{id:'s',name:'Training',price:0}],staff:[{id:'t',name:'Coach',password:'never-export'}]});
 assert.equal(sheets.find(s=>s.name==='Products').rows.length,206);
 assert.doesNotMatch(JSON.stringify(sheets),/OTHER BUSINESS PRIVATE|never-export/);
 assert.ok(sheets.some(s=>s.name==='Memberships and packages'));assert.ok(sheets.some(s=>s.name==='Waivers'));
 const workbook=createClientXlsx(sheets,{text:'#ffffff'});assert.ok(workbook.length>1000);
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['export-owner',JSON.stringify({theme:{colors:{text:'#ffffff'}}})]);
 const memberId='11111111-1111-4111-8111-111111111111';
 await db.exec("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES('plan','export-business','Monthly','month',1000)");
 await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,stripe_account_id,member_number) VALUES($1,'export-business','plan',1000,'Membership Only','member@example.test','acct_test','MO010100')",[memberId]);
 const routeUrl=new URL('../app/api/studio/clients/route.ts',import.meta.url),nativeRequire=createRequire(routeUrl),exports={};
 const compiled=ts.transpileModule(await readFile(routeUrl,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','exports',compiled)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>db}:path.endsWith('/lib/auth')?{requireOwner:async req=>{const owner=req.headers.get('x-test-owner');if(!owner)throw Error('AUTH_REQUIRED');return owner;}}:nativeRequire(path),exports);
 const request=(query,owner='export-owner')=>new Request('https://example.test/api/studio/clients?export=xlsx'+query,{headers:owner?{'x-test-owner':owner}:{}});
 assert.equal((await exports.GET(request('',''))).status,401);
 assert.equal((await exports.GET(request('&clientId=22222222-2222-4222-8222-222222222222'))).status,404);
 for(const query of ['&clientId=membership-'+memberId,'&scope=business']){
  const response=await exports.GET(request(query));assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/spreadsheetml/);assert.match(response.headers.get('cache-control'),/private, no-store/);
  const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.includes(Buffer.from('Membership Only')));
  assert.ok(!bytes.includes(Buffer.from('OTHER BUSINESS PRIVATE')));
 }
});
