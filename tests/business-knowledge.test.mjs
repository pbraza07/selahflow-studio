import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {buildBusinessKnowledge,answerBusinessQuestion,loadBusinessKnowledge} from '../server/business-knowledge.mjs';
const now=new Date('2026-10-23T16:00:00Z');
const business={id:'b1',name:'Arcila Test',slug:'arcila-test',industry:'sports',description:'Birthday parties and indoor soccer',business_model:'Training and outdoor camps',city:'Ocala',region:'Florida'};
const config={name:'Arcila Test',tagline:'Confident young athletes',phone:'555-123-4567',address:'100 Test Way',open:9,close:18,policy:'Cancel 24 hours before your session.',bookingDescription:'Bring indoor shoes and a water bottle.',pageContent:{membershipIntro:'Family savings for youth athletes',privateUnsupportedKey:'TOP_SECRET'},waiverLegalReview:{version:'participation-2',reference:'TEST-REVIEW',reviewedAt:'2026-10-23'},services:[{id:'soccer',name:'Indoor soccer',description:'For children ages 6 to 12. Small group drills.',category:'Soccer',price:35,duration:60,requiresWaiver:true,requiresApproval:true,maxSlots:12},{id:'camp',name:'Outdoor camp',description:'Bring sunscreen. Outdoor training for ages 8–15.',price:70,duration:120}],staff:[{id:'visible',name:'Public Coach',role:'Coach',services:['soccer']},{id:'private',name:'SECRET_HIDDEN_COACH',bookingVisible:false,phone:'SECRET_STAFF_PHONE',services:['soccer']}],bookingCustomFields:[{id:'position',label:'Player position',type:'select',options:['Goalkeeper','Midfielder'],required:false,forms:['booking']}],bookingNotifyOwnerEmail:'SECRET_NOTIFY',internalNotes:'SECRET_NOTES',bookableSessions:[{id:'session1',date:'2026-10-23',start:600,service:'soccer',staff:'private',capacity:12,defaultTeamIds:['private'],repeat:{frequency:'weekly',every:1,until:'2026-11-30'}}]};
const plans=[{name:'Youth monthly',description:'Monthly coaching',price_cents:12000,interval_unit:'month',interval_count:1,sessions_included:4,credit_eligibility:{mode:'selected',serviceIds:['soccer'],sessionIds:[]}}];
test('business answers use actual descriptions, full price catalog, page copy, questions, schedules, membership coverage and waiver clauses',()=>{
 const k=buildBusinessKnowledge(business,config,plans,now);
 for(const [q,expected] of [['What ages can join indoor soccer?',/ages 6 to 12/],['What are your prices?',/\$35\.00[\s\S]*\$70\.00/],['What should I bring?',/indoor shoes and a water bottle/],['What membership credits do I get?',/Included sessions: 4[\s\S]*Indoor soccer/],['Hours and location?',/100 Test Way[\s\S]*9:00 AM/],['What is the media release?',/Media release/],['What player positions can I choose?',/Goalkeeper[\s\S]*Midfielder/],['Upcoming session schedule',/2026-10-23[\s\S]*10:00 AM/]]){
  const a=answerBusinessQuestion(k,q);assert.match(a.answer,expected,q);assert.ok(a.sources.length,q);assert.ok(a.sources.every(s=>s.href.includes('arcila-test')));
 }
 const payload=JSON.stringify(k);for(const value of ['SECRET_HIDDEN_COACH','SECRET_STAFF_PHONE','SECRET_NOTIFY','SECRET_NOTES','TOP_SECRET','defaultTeamIds'])assert.ok(!payload.includes(value),value);
 assert.match(answerBusinessQuestion(k,'What is the weather forecast in Tokyo?').answer,/couldn’t find a published answer/);
 const changed=structuredClone(config);changed.services[0].price=42;changed.bookingDescription='Bring blue shoes.';
 const fresh=buildBusinessKnowledge(business,changed,plans,now);assert.match(answerBusinessQuestion(fresh,'Indoor soccer cost').answer,/\$42\.00/);assert.ok(!JSON.stringify(fresh).includes('water bottle'));
});
test('team anonymity, reviewed waiver versions and text-only content are respected',()=>{
 const privateConfig={...config,hideTeamNames:true,waiverLegalReview:undefined,bookingDescription:'<script>EVIL_SCRIPT()</script><b>Bring a hat</b>'};
 const k=buildBusinessKnowledge(business,privateConfig,plans,now),raw=JSON.stringify(k);
 assert.ok(!raw.includes('Public Coach'));assert.ok(!raw.includes('SECRET_HIDDEN_COACH'));assert.ok(!raw.includes('EVIL_SCRIPT'));assert.ok(!raw.includes('<b>'));
 assert.ok(!k.documents.some(d=>d.title==='Media release'));assert.ok(raw.includes('Bring a hat'));
});
async function fixture(){
 const db=new PGlite();await db.exec(`CREATE TABLE businesses(id text,owner_id text,slug text,name text,industry text,description text,business_model text,city text,region text,status text);CREATE TABLE settings(owner text,data text);CREATE TABLE membership_plans(business_id text,name text,description text,price_cents int,interval_unit text,interval_count int,sessions_included int,credit_eligibility jsonb,active boolean,display_order int,created_at timestamptz);INSERT INTO businesses VALUES('b1','u1','arcila-test','Arcila Test','sports','','','','','active'),('b2','u2','other-test','Other Business','sports','','','','','active'),('b3','u3','archived-test','Archived','sports','','','','','archived');`);
 await db.query('INSERT INTO settings VALUES($1,$2),($3,$4)',['u1',JSON.stringify(config),'u2',JSON.stringify({...config,name:'Other Business',services:[{id:'private-service',name:'OTHER_TENANT_SERVICE',price:999,duration:30}]})]);
 await db.query("INSERT INTO membership_plans VALUES('b1','Youth monthly','Monthly coaching',12000,'month',1,4,'{}',true,0,now()),('b2','OTHER_TENANT_PLAN','Other',500,'month',1,1,'{}',true,0,now()),('b1','INACTIVE_PLAN','Old',500,'month',1,1,'{}',false,0,now())");return db;
}
test('knowledge queries isolate tenants, exclude archived/inactive records and pick up saved edits immediately',async()=>{
 const db=await fixture();try{const k=await loadBusinessKnowledge(db,'arcila-test',now),raw=JSON.stringify(k);assert.ok(!raw.includes('OTHER_TENANT'));assert.ok(!raw.includes('INACTIVE_PLAN'));assert.equal(await loadBusinessKnowledge(db,'archived-test',now),null);assert.equal(await loadBusinessKnowledge(db,"arcila-test' OR true--",now),null);const next={...config,policy:'Updated cancellation notice: 48 hours.'};await db.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(next),'u1']);assert.match(JSON.stringify(await loadBusinessKnowledge(db,'arcila-test',now)),/48 hours/);}finally{await db.close();}
});
test('actual assistant API enforces origin, body limits, active slug scope and no-store without persisting conversations',async(t)=>{
 const db=await fixture();globalThis.__knowledgePool=db;t.after(async()=>{delete globalThis.__knowledgePool;await db.close();});
 let source=ts.transpileModule(await readFile(new URL('../app/api/public/assistant/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__knowledgePool;').replaceAll("'../../../../server/security.mjs'",JSON.stringify(new URL('../server/security.mjs',import.meta.url).href)).replaceAll("'../../../../server/business-knowledge.mjs'",JSON.stringify(new URL('../server/business-knowledge.mjs',import.meta.url).href));
 const {POST}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const appOrigin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.com').origin;
 const req=(body,origin=appOrigin)=>new Request(appOrigin+'/api/public/assistant',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
 const r=await POST(req({slug:'arcila-test',message:'Indoor soccer price'}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();assert.match(data.answer,/\$35\.00/);assert.ok(!JSON.stringify(data).includes('SECRET_'));
 assert.equal((await POST(req({slug:'arcila-test',message:'Hi'},'https://evil.test'))).status,403);
 assert.equal((await POST(req({slug:'archived-test',message:'Hi'}))).status,404);
 assert.equal((await POST(req({slug:'arcila-test',message:'x'.repeat(1001)}))).status,400);
 assert.equal((await POST(req('x'.repeat(5001)))).status,400);
});
