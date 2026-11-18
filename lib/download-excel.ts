import {createClientXlsx} from '../server/client-xlsx.mjs';
import {recordsSheet} from '../server/export-records.mjs';
export function saveExcelBlob(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function downloadExcel(name:string,records:Record<string,any>[],columns:string[]=[]){
 const data=createClientXlsx([recordsSheet(name,records,columns)]);
 saveExcelBlob(new Blob([new Uint8Array(data)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'SelahFlow-'+name.replace(/[^a-z0-9-]/gi,'-')+'.xlsx');
}
