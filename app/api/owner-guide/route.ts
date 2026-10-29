import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Generic help only: no business, customer or account data is included.
export async function GET(){
 const staging=process.env.APP_ENV==='staging';
 const file=staging?'selahflow-business-owner-guide-staging.pdf':'selahflow-business-owner-guide.pdf';
 const bytes=await readFile(join(process.cwd(),'public','guides',file));
 return new Response(new Uint8Array(bytes),{headers:{
  'Content-Type':'application/pdf',
  'Content-Disposition':'inline; filename="SelahFlow_Business_Owner_Guide.pdf"',
  'Cache-Control':'no-cache',
  'X-Content-Type-Options':'nosniff'
 }});
}
