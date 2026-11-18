'use client';
import {useState} from 'react';
import {saveExcelBlob} from '../../lib/download-excel';
export default function ExcelDownload({href,children,className='outline'}:{href:string;children:React.ReactNode;className?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){setBusy(true);setError('');try{
  const response=await fetch(href,{cache:'no-store'});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'Export failed. Please retry.');}
  if(!response.headers.get('content-type')?.includes('spreadsheetml'))throw Error('Please sign in again before exporting.');
  const blob=await response.blob();if(!blob.size)throw Error('Export returned no file. Please retry.');
  const filename=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'SelahFlow-export.xlsx';
  saveExcelBlob(blob,filename);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <span><button type="button" className={className} disabled={busy} onClick={()=>void download()}>{busy?'Preparing Excel…':children}</button>{error&&<span role="alert">{error}</span>}</span>;
}
