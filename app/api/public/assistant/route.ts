import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {loadBusinessKnowledge,answerBusinessQuestion,validKnowledgeSlug} from '../../../../server/business-knowledge.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const raw=await req.text();if(raw.length>5000)return Response.json({error:'Keep your question under 1,000 characters.'},{status:400,headers});
  let body;try{body=JSON.parse(raw);}catch{return Response.json({error:'Enter a valid business question.'},{status:400,headers});}
  if(!body||typeof body!=='object')return Response.json({error:'Enter a valid business question.'},{status:400,headers});
  if(!validKnowledgeSlug(body.slug)||typeof body.message!=='string'||!body.message.trim()||body.message.length>1000)return Response.json({error:'Choose a business and enter a question under 1,000 characters.'},{status:400,headers});
  const knowledge=await loadBusinessKnowledge(getPool(),body.slug);
  if(!knowledge)return Response.json({error:'Business not found.'},{status:404,headers});
  return Response.json(answerBusinessQuestion(knowledge,body.message),{headers});
 }catch{return Response.json({error:'Business information is temporarily unavailable. Please try again or contact the business.'},{status:503,headers});}
}
