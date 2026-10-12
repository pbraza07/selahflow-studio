import {inflateRawSync} from 'node:zlib';
const decode=s=>String(s||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function entries(buf){
 const out=new Map();let i=0;
 while(i+30<=buf.length&&buf.readUInt32LE(i)===0x04034b50){
  const method=buf.readUInt16LE(i+8),flags=buf.readUInt16LE(i+6),packed=buf.readUInt32LE(i+18),size=buf.readUInt32LE(i+22),n=buf.readUInt16LE(i+26),e=buf.readUInt16LE(i+28);
  if(flags&8)throw Error('Unsupported Excel ZIP layout.');
  const name=buf.subarray(i+30,i+30+n).toString('utf8'),start=i+30+n+e,end=start+packed;
  if(end>buf.length||size>10_000_000)throw Error('Spreadsheet is too large.');
  if(name==='xl/sharedStrings.xml'||name==='xl/worksheets/sheet1.xml'){
   const value=method===0?buf.subarray(start,end):method===8?inflateRawSync(buf.subarray(start,end),{maxOutputLength:10_000_001}):null;
   if(!value)throw Error('Unsupported spreadsheet compression.');
   out.set(name,value.toString('utf8'));
  }
  i=end;
 }
 return out;
}
const cellText=(xml)=>[...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
function colIndex(ref){let n=0;for(const ch of ref.match(/^[A-Z]+/i)?.[0]||'')n=n*26+ch.toUpperCase().charCodeAt(0)-64;return n-1;}
export function readClientSpreadsheet(buffer,filename){
 let rows=[];
 if(/\.csv$/i.test(filename)){
  const content=buffer.toString('utf8').replace(/^\uFEFF/,'');let row=[],field='',quoted=false;
  for(let i=0;i<content.length;i++){const c=content[i];if(c==='"'&&quoted&&content[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&content[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}
  if(field||row.length){row.push(field);rows.push(row);}
 }else if(/\.xlsx$/i.test(filename)){
  const parts=entries(buffer),sheet=parts.get('xl/worksheets/sheet1.xml');if(!sheet)throw Error('No first worksheet found.');
  const shared=[...(parts.get('xl/sharedStrings.xml')||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>cellText(m[1]));
  for(const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
   const values=[];
   for(const cell of row[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const ref=/\br="([^"]+)"/.exec(cell[1])?.[1]||'',index=colIndex(ref);if(index<0||index>255)continue;
    const type=/\bt="([^"]+)"/.exec(cell[1])?.[1];
    const value=type==='inlineStr'?cellText(cell[2]||''):decode(/<v>([\s\S]*?)<\/v>/.exec(cell[2]||'')?.[1]||'');
    values[index]=type==='s'?shared[Number(value)]||'':value;
   }
   rows.push(values.map(x=>String(x??'')));
  }
 }else throw Error('Upload an .xlsx or .csv spreadsheet.');
 const start=rows.findIndex(r=>r.filter(v=>String(v||'').trim()).length>=2);
 if(start<0)throw Error('Spreadsheet needs a header row and client records.');
 const headers=rows[start].map(x=>String(x||'').trim().slice(0,100));
 if(headers.length>100||new Set(headers.filter(Boolean).map(h=>h.toLowerCase())).size!==headers.filter(Boolean).length)throw Error('Spreadsheet has duplicate or too many column headers.');
 const data=rows.slice(start+1).filter(r=>r.some(v=>String(v||'').trim()));
 if(data.length>2000)throw Error('Import up to 2,000 clients at a time.');
 return {headers,records:data.map(row=>Object.fromEntries(headers.map((h,i)=>[h,String(row[i]??'').slice(0,2000)]).filter(([h])=>h)))};
}
