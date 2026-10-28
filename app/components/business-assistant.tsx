'use client';
import {useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,Sparkles,X} from 'lucide-react';
import styles from './business-assistant.module.css';
import ClientGuideHelp from './client-guide-help';
import {publicClientGuide,clientGuideIntent} from '../../server/client-guides.mjs';
import AssistantAnswer,{type AnswerSection} from './assistant-answer';
import {assistantStatusRequest,assistantStatusUrl,assistantStatusPrompt,assistantStatusSections} from '../../server/assistant-status.mjs';
type StatusMode='membership'|'booking'|'both';
type Source={title:string;href:string};
type Message={from:'you'|'bot';text:string;sections?:AnswerSection[];sources?:Source[];links?:{label:string;href:string}[]};
export default function BusinessAssistant({slug,name,open:controlled,onOpenChange,onHandoff,hidden=false}:{slug:string;name?:string;open?:boolean;hidden?:boolean;onOpenChange?:(open:boolean)=>void;onHandoff?:(message:string)=>Promise<boolean>}){
 const [localOpen,setLocalOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false);
 const [statusMode,setStatusMode]=useState<StatusMode|null>(null);
 const list=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),generation=useRef(0);
 const open=controlled??localOpen,guide=publicClientGuide(slug);
 const toggle=(value:boolean)=>{setLocalOpen(value);onOpenChange?.(value);};
 useEffect(()=>{generation.current++;request.current?.abort();setMessages([]);setQuery('');setStatusMode(null);setBusy(false);return()=>request.current?.abort();},[slug]);
 useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight,behavior:'smooth'});},[messages,busy]);
 async function send(value=query,knowledgeOnly=false){
  const message=value.trim();if(!message||busy||message.length>1000)return;
  const lookup=knowledgeOnly?null:assistantStatusRequest(message,statusMode);
  const version=generation.current;setMessages(old=>[...old,{from:'you',text:lookup?.id?'Unique ID provided for status check':message}]);setQuery('');
  if(knowledgeOnly||!lookup&&clientGuideIntent(message))setStatusMode(null);
  if(lookup&&!lookup.id){setStatusMode(lookup.mode as StatusMode);setMessages(old=>[...old,{from:'bot',text:assistantStatusPrompt(lookup.mode,lookup.invalid)}]);return;}
  setBusy(true);
  request.current=new AbortController();const timer=setTimeout(()=>request.current?.abort(),15000);
  try{
   if(lookup?.id){
    setStatusMode(lookup.mode as StatusMode);
    const response=await fetch(assistantStatusUrl(slug),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration_latest_status',memberNumber:lookup.id}),signal:request.current.signal,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Status is temporarily unavailable.');
    if(version===generation.current){setMessages(old=>[...old,{from:'bot',text:'Status checked now. Expand a section for details. For changes, contact the business.',sections:assistantStatusSections(data,lookup.mode)}]);setStatusMode(null);}return;
   }
   if(onHandoff&&/\b(human|person|owner)\b/i.test(message)&&/\b(help|speak|talk|contact|need)\b/i.test(message)){
    const ok=await onHandoff(message);if(version===generation.current)setMessages(old=>[...old,{from:'bot',text:ok?'Your request was saved in the owner’s handoff inbox. No email or text has been sent.':'The request could not be saved. Please contact the business directly.'}]);return;
   }
   const response=await fetch('/api/public/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,message}),signal:request.current.signal,cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Business information is unavailable.');
   if(version===generation.current)setMessages(old=>[...old,{from:'bot',text:data.sections?.length?'Select a subsection to view its details.':data.answer,sections:data.sections,sources:data.sources,links:data.links}]);
  }catch(e){if(version===generation.current)setMessages(old=>[...old,{from:'bot',text:(e as Error).name==='AbortError'?'The request took too long. Please try again or contact the business.':(e as Error).message}]);}
  finally{clearTimeout(timer);if(version===generation.current)setBusy(false);}
 }
 return <div className={styles.root} hidden={hidden} inert={hidden}>
  {!open&&<ClientGuideHelp slug={slug}/>}
  <button type="button" className={styles.launcher} onClick={()=>toggle(!open)} aria-label={open?'Close business assistant':'Open business assistant'} aria-expanded={open} aria-controls="sf-business-assistant">{open?<X/>:<MessageCircle/>}</button>
  {open&&<section id="sf-business-assistant" className={styles.panel} aria-label={'Business assistant for '+(name||'this business')}>
   <header className={styles.header}><Sparkles size={21} aria-hidden="true"/><div><b>SelahFlow assistant</b><small>{name||'Business information'} · Business information &amp; status</small></div><button type="button" onClick={()=>toggle(false)} aria-label="Close assistant"><X size={19}/></button></header>
   <div ref={list} className={styles.messages} role="log" aria-live="polite" aria-relevant="additions text">
    <div className={styles.bot}>Ask me about {name||'this business'}: services, prices, ages and activities, schedules, memberships, location, policies, waivers or registration questions. Business answers use its current published information. To check membership or latest booking status, provide only your unique client ID.</div>
    {messages.map((m,i)=><article key={i} className={m.from==='you'?styles.you:styles.bot}><div className={styles.text}>{m.text}</div>{!!m.sections?.length&&<AssistantAnswer sections={m.sections}/>}{!m.sections?.length&&!!m.sources?.length&&<details><summary>Published sources ({m.sources.length})</summary><ul>{m.sources.map((s,n)=><li key={n}><a href={s.href}>{s.title}</a></li>)}</ul></details>}{!!m.links?.length&&<nav aria-label="Business information links">{m.links.map(link=><a key={link.href} href={link.href}>{link.label}</a>)}</nav>}</article>)}
    {busy&&<p role="status">{statusMode?'Checking status…':'Checking this business’s published information…'}</p>}
   </div>
   <div className={styles.quick}>{guide&&<a href={guide.href} target="_blank" rel="noopener noreferrer">Booking instructions (PDF)</a>}{['Membership status','Booking status','Services and prices','Memberships and credits','Upcoming session schedule','Hours and location','Waiver and media release','Contact a human'].map(value=><button type="button" key={value} disabled={busy} onClick={()=>void send(value,!['Membership status','Booking status'].includes(value))}>{value}</button>)}</div>
   {statusMode&&<div id="sf-status-hint" className={styles.lookup} role="status"><span>Only your unique ID is needed.</span><button type="button" disabled={busy} onClick={()=>{setStatusMode(null);setQuery('');}}>Cancel status lookup</button></div>}
   <form className={styles.form} onSubmit={e=>{e.preventDefault();void send();}}><label className={styles.srOnly} htmlFor="sf-assistant-question">{statusMode?'Unique client ID':'Message assistant'}</label><input id="sf-assistant-question" aria-describedby={statusMode?'sf-status-hint':undefined} value={query} maxLength={statusMode?8:1000} onChange={e=>setQuery(statusMode?e.target.value.toUpperCase():e.target.value)} placeholder={statusMode?'Unique ID · e.g. AB031513':'Ask about this business or enter your unique ID…'} autoComplete="off"/><button type="submit" aria-label="Send message" disabled={busy||!query.trim()}><Send size={19}/></button></form>
  </section>}
 </div>;
}
