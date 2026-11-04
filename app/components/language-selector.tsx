'use client';
import {useEffect,useRef,useState} from 'react';
import {APP_VERSION} from '../../lib/app-version';
import {createPageTranslator,LANGUAGE_STORAGE_KEY,languages,validLanguage} from '../../server/page-translation.mjs';

type Language='en'|'es'|'pt';
type Translator=ReturnType<typeof createPageTranslator>;
const cache=new Map<Language,Record<string,string>>();
export default function LanguageSelector(){
 const [language,setLanguage]=useState<Language>('en');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const translator=useRef<Translator|null>(null);
 useEffect(()=>{
  translator.current=createPageTranslator(document.documentElement);
  try{setLanguage(validLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)) as Language);}catch{}
  setReady(true);
  const storage=(event:StorageEvent)=>{if(event.key===LANGUAGE_STORAGE_KEY)setLanguage(validLanguage(event.newValue) as Language);};
  window.addEventListener('storage',storage);
  return()=>{translator.current?.dispose();translator.current=null;window.removeEventListener('storage',storage);};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  let cancelled=false;const controller=new AbortController();
  async function apply(){
   setError(false);setBusy(language!=='en');
   try{
    let catalog=cache.get(language)||{};
    if(language!=='en'&&!cache.has(language)){
     const response=await fetch(`/i18n/${language}.json?v=${APP_VERSION}`,{signal:controller.signal,credentials:'same-origin'});
     if(!response.ok)throw Error('Language unavailable');
     catalog=await response.json();if(!catalog||Array.isArray(catalog)||typeof catalog!=='object'||!Object.values(catalog).every(value=>typeof value==='string'))throw Error('Invalid language');
     cache.set(language,catalog);
    }
    if(cancelled)return;
    translator.current?.setCatalog(catalog);
    document.documentElement.lang=languages.find(item=>item.code===language)!.tag;
    try{localStorage.setItem(LANGUAGE_STORAGE_KEY,language);}catch{}
   }catch{if(!cancelled)setError(true);}finally{if(!cancelled)setBusy(false);}
  }
  void apply();return()=>{cancelled=true;controller.abort();};
 },[language,ready,attempt]);
 return <div className="sf-languages" translate="no" aria-label="Language / Idioma">
  <div className="sf-language-buttons" role="group" aria-label="Language / Idioma" aria-busy={busy}>
   {languages.map(item=><button key={item.code} type="button" className="sf-language-button" lang={item.tag} aria-label={item.name} title={item.name} aria-pressed={language===item.code&&!error} onClick={()=>{setLanguage(item.code as Language);if(error)setAttempt(value=>value+1);}}><img src={`/flags/${item.flag}.svg`} width="25" height="17" alt=""/><span translate="no">{item.name}</span></button>)}
  </div>
  <span className="sf-language-status" role="status">{busy?'Loading… / Cargando… / Carregando…':error?'Unable to load. Select a language to retry. / Inténtalo de nuevo. / Tente novamente.':''}</span>
 </div>;
}
