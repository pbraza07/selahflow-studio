/** Standards-compliant OOXML workbook writer, no CDN or external service. */
const esc=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const h=value=>/^#[\da-f]{6}$/i.test(value||'')?value.slice(1).toUpperCase():null;
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const letter=n=>{let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
const asText=v=>{const s=String(v??'');return /^[\s]*[=+@]/.test(s)?"'"+s:s;};
function makeSheet(sheet){
 const rows=sheet.rows||[],last=letter(rows.reduce((n,r)=>Math.max(n,r.length),1)-1);
 const columns=(sheet.widths||[]).map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+Math.min(65,Math.max(10,w||18))+'" customWidth="1"/>').join('');
 const body=['<row r="1" ht="31" customHeight="1"><c r="A1" t="inlineStr" s="1"><is><t>'+esc(sheet.title||sheet.name)+'</t></is></c></row>','<row r="2" ht="12" customHeight="1"/>'];
 for(let ri=0;ri<rows.length;ri++){
  const cells=rows[ri].map((value,ci)=>{
   const addr=letter(ci)+(ri+3);
   if(ri>0 && typeof value==='number' && Number.isFinite(value)){
    return '<c r="'+addr+'" s="'+(sheet.name==='Service History'&&ci===9?'3':'0')+'"><v>'+value+'</v></c>';
   }
   return '<c r="'+addr+'" t="inlineStr" s="'+(ri===0?'2':'0')+'"><is><t xml:space="preserve">'+esc(asText(value))+'</t></is></c>';
  }).join('');
  body.push('<row r="'+(ri+3)+'"'+(ri===0?' ht="26" customHeight="1"':'')+'>'+cells+'</row>');
 }
 const end=Math.max(3,rows.length+2);
 if(rows.length>1048574||rows.some(r=>r.length>16384))throw Error('Excel worksheet size exceeded. Export a smaller period.');
 return xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+last+end+'"/>'+
  '<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
  '<sheetFormatPr defaultRowHeight="18"/><cols>'+columns+'</cols><sheetData>'+body.join('')+'</sheetData>'+
  '<autoFilter ref="A3:'+last+Math.max(3,end)+'"/><mergeCells count="1"><mergeCell ref="A1:'+last+'1"/></mergeCells>'+
  '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>');
}
function makeStyles(colors){
 const title=h(colors.button)||'123F3A',text='203B36';
 const rgb=title.match(/../g).map(v=>parseInt(v,16));
 const heading=rgb[0]*0.299+rgb[1]*0.587+rgb[2]*0.114>155?'FF203B36':'FFFFFFFF';
 const border=h(colors.border)||'D9E4DA';
 return xml('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>'+
  '<fonts count="3"><font><sz val="10"/><name val="Aptos"/><color rgb="FF'+text+'"/></font>'+
  '<font><b/><sz val="16"/><name val="Aptos Display"/><color rgb="'+heading+'"/></font>'+
  '<font><b/><sz val="10"/><name val="Aptos"/><color rgb="'+heading+'"/></font></fonts>'+
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
  '<fill><patternFill patternType="solid"><fgColor rgb="FF'+title+'"/><bgColor indexed="64"/></patternFill></fill></fills>'+
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'+
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FF'+border+'"/></bottom><diagonal/></border></borders>'+
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
  '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'+
  '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'+
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'+
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
}
const table=Array.from({length:256},(_,k)=>{let c=k;for(let j=0;j<8;j++)c=c&1?(0xedb88320^(c>>>1)):c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function zip(entries){
 const localParts=[],directory=[];let position=0;
 const alloc=n=>{const b=new Uint8Array(n),v=new DataView(b.buffer);b.writeUInt16LE=(x,i)=>v.setUint16(i,x,true);b.writeUInt32LE=(x,i)=>v.setUint32(i,x,true);return b;};
 const encode=s=>new TextEncoder().encode(s);
 for(const [path,value] of entries){
  const name=encode(path),data=encode(value),crc=crc32(data),head=alloc(30);
  head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0,8);
  head.writeUInt16LE(0,10);head.writeUInt16LE(33,12);
  head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);
  head.writeUInt16LE(name.length,26);head.writeUInt16LE(0,28);
  localParts.push(head,name,data);
  const central=alloc(46);central.writeUInt32LE(0x02014b50,0);
  central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);
  central.writeUInt16LE(0,10);central.writeUInt16LE(0,12);central.writeUInt16LE(33,14);
  central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);
  central.writeUInt16LE(name.length,28);central.writeUInt32LE(position,42);
  directory.push(central,name);position+=head.length+name.length+data.length;
 }
 const size=directory.reduce((n,b)=>n+b.length,0),end=alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);
 end.writeUInt16LE(entries.length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(position,16);
 const parts=[...localParts,...directory,end],out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.length;}
 return typeof Buffer==='undefined'?out:Buffer.from(out);
}
export function createClientXlsx(sheets,colors={}){
 if(!Array.isArray(sheets)||sheets.length<1||sheets.length>64)throw Error('Export requires 1–64 sheets.');
 const names=sheets.map(s=>String(s.name||'Sheet').replace(/[\[\]*:/?\\]/g,' ').slice(0,31));
 if(new Set(names).size!==names.length)throw Error('Duplicate sheet names.');
 const types=xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
  sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
 const root=xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 const book=xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+
  names.map((name,i)=>'<sheet name="'+esc(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
 const relations=xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
  '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 return zip([['[Content_Types].xml',types],['_rels/.rels',root],['xl/workbook.xml',book],
  ['xl/_rels/workbook.xml.rels',relations],['xl/styles.xml',makeStyles(colors)],
  ...sheets.map((sheet,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',makeSheet(sheet)])]);
}
