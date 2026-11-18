/** Flatten business records into separate, stable columns, including nested details.
 * Callers supply only authorized business records, never credential/provider tables. */
const privateKey=key=>/password|secret|token|authorization|cookie|credential|private.?key|checkout.?url|signature.?data|image.?data/i.test(key);
const label=key=>key.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
export function flattenExportRecord(record,prefix='',out=Object.create(null)){
 for(const [key,value] of Object.entries(record||{})){
  if(privateKey(key)||['image','photo','avatar','editToken'].includes(key))continue;
  const path=prefix?prefix+' / '+label(key):label(key);
  if(value instanceof Date)out[path]=value.toISOString();
  else if(Array.isArray(value)){
   if(value.some(v=>v&&typeof v==='object'))value.forEach((v,i)=>flattenExportRecord(typeof v==='object'&&v!==null?v:{Value:v},path+' '+(i+1),out));
   else out[path]=value.map(v=>v??'').join(', ');
  }else if(value&&typeof value==='object')flattenExportRecord(value,path,out);
  else out[path]=typeof value==='boolean'?(value?'Yes':'No'):value??'';
 }
 return out;
}
export function recordsSheet(name,records,columns=[]){
 const data=(records||[]).map(r=>flattenExportRecord(r));
 const headers=[...new Set([...columns,...data.flatMap(r=>Object.keys(r))])];
 if(!headers.length)headers.push('Record');
 return {name,title:name+' — '+data.length+' records',rows:[headers,...data.map(r=>headers.map(k=>r[k]??''))],widths:headers.map(h=>Math.min(45,Math.max(18,h.length+2)))};
}
/** Append details without changing the established leading summary columns. */
export function appendRecordColumns(sheet,records){
 const extra=recordsSheet(sheet.name,records);
 const indexes=extra.rows[0].map((h,i)=>sheet.rows[0].includes(h)?-1:i).filter(i=>i>=0);
 sheet.rows[0].push(...indexes.map(i=>extra.rows[0][i]));
 sheet.rows.slice(1).forEach((row,i)=>row.push(...indexes.map(j=>extra.rows[i+1][j])));
 sheet.widths.push(...indexes.map(i=>extra.widths[i]));
 return sheet;
}
