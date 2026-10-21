import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pg_stat_statements} from '@electric-sql/pglite/contrib/pg_stat_statements';
const [sqlPath,dbPath,evidencePath]=process.argv.slice(2);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sql=await fs.readFile(sqlPath,'utf8');
const db=await PGlite.create(dbPath,{extensions:{pg_stat_statements}});
const tables=[];
let stage='schema',cursor=0;
try {
  const cleaned=sql.replace(/^\\(?:un)?restrict [^\n]*\n/gm,'');
  const matcher=/^COPY ("public"\."[^"]+") (\([^\n]+\)) FROM stdin;\n([\s\S]*?)^\\\.\n/gm;
  for(const match of cleaned.matchAll(matcher)) {
    stage='schema before '+match[1];
    await db.exec(cleaned.slice(cursor,match.index));
    stage='data '+match[1];
    await db.query(`COPY ${match[1]} ${match[2]} FROM '/dev/blob'`,[],{blob:new Blob([match[3]])});
    tables.push({table:match[1],columns:match[2],data:match[3]});
    cursor=match.index+match[0].length;
  }
  stage='post-data constraints';
  await db.exec(cleaned.slice(cursor));
  const evidence=[];
  for (const t of tables) {
    stage='verify '+t.table;
    const out=await db.query(`COPY ${t.table} ${t.columns} TO '/dev/blob'`);
    const restored=out.blob ? await out.blob.text() : '';
    const normalize=x=>x.split('\n').filter(Boolean).sort().join('\n');
    const sourceHash=hash(normalize(t.data)),restoredHash=hash(normalize(restored));
    if(sourceHash!==restoredHash) throw new Error('COPY content hash mismatch');
    const count=Number((await db.query(`SELECT count(*) AS count FROM ${t.table}`)).rows[0].count);
    if(count!==t.data.split('\n').filter(Boolean).length) throw new Error('Row count mismatch');
    evidence.push({table:t.table,count,sourceHash,restoredHash});
  }
  const constraints=(await db.query("SELECT contype,count(*)::int AS count FROM pg_constraint WHERE connamespace='public'::regnamespace GROUP BY contype ORDER BY contype")).rows;
  const result={verifiedAt:new Date().toISOString(),engine:(await db.query('SELECT version()')).rows[0].version,sqlHash:hash(sql),tables:evidence,constraints,scope:'Local isolated logical restore; source ownership and ACLs omitted by pg_restore. No app workers run. Not a Render PITR test.'};
  await fs.writeFile(evidencePath,JSON.stringify(result,null,2),{mode:0o600});
  console.log(JSON.stringify({success:true,tables:evidence.length,rows:evidence.reduce((a,t)=>a+t.count,0),constraints,evidenceHash:hash(JSON.stringify(result,null,2))}));
} catch(e) {console.error(JSON.stringify({success:false,stage,code:e.code,message:e.message}));process.exitCode=1;}
finally {await db.close();}
