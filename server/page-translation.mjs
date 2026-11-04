// Only bundled interface copy is translated. No page content leaves the browser.
export const LANGUAGE_STORAGE_KEY='selahflow:language';
export const languages=[
 {code:'en',tag:'en-US',name:'English',flag:'us'},
 {code:'es',tag:'es-ES',name:'Español',flag:'es'},
 {code:'pt',tag:'pt-BR',name:'Português',flag:'br'},
];
export const validLanguage=value=>languages.some(language=>language.code===value)?value:'en';
export const normalizeCopy=text=>text.replace(/\s+/g,' ').trim();
const escapePattern=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function createCopyTranslator(catalog={}){
 const templates=Object.entries(catalog).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>{
  const slots=[];let offset=0,pattern='';
  for(const match of key.matchAll(/\{(\d+)\}/g)){pattern+=escapePattern(key.slice(offset,match.index))+'(.+?)';slots.push(match[1]);offset=match.index+match[0].length;}
  return {pattern:new RegExp('^'+pattern+escapePattern(key.slice(offset))+'$'),slots,value};
 });
 const translate=text=>{
  const key=normalizeCopy(text);if(!key)return text;
  let result=Object.hasOwn(catalog,key)?catalog[key]:undefined;
  if(result===undefined){for(const template of templates){const match=key.match(template.pattern);if(match){const values=Object.fromEntries(template.slots.map((slot,i)=>[slot,match[i+1]]));result=template.value.replace(/\{(\d+)\}/g,(_,slot)=>values[slot]??`{${slot}}`);break;}}}
  // React may compose a label, punctuation and counters in a single text node.
  if(result===undefined){const match=key.match(/^(.*?)([:：] | · | \| | → | ↗ | \*|…|:|\.)$/);if(match&&Object.hasOwn(catalog,match[1]))result=catalog[match[1]]+match[2];}
  if(result===undefined&&/\d/.test(key)&&/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b/.test(key)){
   const months={Jan:'January',Feb:'February',Mar:'March',Apr:'April',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December'};
   result=key.replace(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,word=>Object.hasOwn(catalog,word)?catalog[word]:(catalog[months[word]]||word));
  }
  if(typeof result!=='string')return text;
  return (text.match(/^\s*/)?.[0]||'')+result+(text.match(/\s*$/)?.[0]||'');
 };
 return translate;
}

const EXCLUDED='script,style,noscript,code,pre,textarea,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-no-translate]';
const ATTRIBUTES=['placeholder','title','aria-label','alt'];
// Never wrap, replace or remove React-owned nodes. Updating Text.data preserves
// reconciliation, event handlers, form values, option values and focus.
export function createPageTranslator(root,environment={}){
 const doc=root.ownerDocument||root;
 const win=environment.window||doc.defaultView;
 const originals=new WeakMap();let translate=text=>text,disposed=false,frame=null;
 const nativeDialogs={};
 for(const name of ['alert','confirm','prompt']){const original=win[name];if(typeof original==='function'){
  const wrapped=function(message,...args){return original.call(win,typeof message==='string'?translate(message):message,...args);};
  nativeDialogs[name]={original,wrapped};win[name]=wrapped;
 }}
 const pending=new Set();
 function excluded(element){return !element||!!element.closest(EXCLUDED);}
 function write(node,key,current,assign){
  let entries=originals.get(node);if(!entries){entries=new Map();originals.set(node,entries);}
  const previous=entries.get(key);
  const source=previous&&current===previous.output?previous.source:current;
  const output=translate(source);entries.set(key,{source,output});
  if(current!==output)assign(output);
 }
 function visit(node){
  if(node.nodeType===3){const parent=node.parentElement;if(excluded(parent))return;
   // An option without an explicit value derives its submitted value from text.
   if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))return;
   write(node,'text',node.data,value=>{node.data=value;});return;
  }
  if(node.nodeType!==1&&node!==root)return;
  if(node.nodeType===1){if(excluded(node))return;
   for(const attr of ATTRIBUTES){const current=node.getAttribute(attr);if(current!==null)write(node,attr,current,value=>node.setAttribute(attr,value));}
   // Input values (including submit/button), URLs, IDs and data attributes stay canonical.
  }
  for(const child of node.childNodes)visit(child);
 }
 function flush(){frame=null;if(disposed)return;const nodes=[...pending];pending.clear();
  for(const node of nodes)if(node===root||root.contains(node))visit(node);
 }
 function schedule(node){pending.add(node);if(frame===null)frame=win.requestAnimationFrame(flush);}
 const observer=new win.MutationObserver(records=>{
  for(const record of records){if(record.type==='childList'){for(const node of record.addedNodes)schedule(node);}else schedule(record.target);}
 });
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES});
 return {
  setCatalog(catalog){translate=createCopyTranslator(catalog);visit(root);},
  dispose(){disposed=true;observer.disconnect();if(frame!==null)win.cancelAnimationFrame(frame);pending.clear();for(const [name,{original,wrapped}] of Object.entries(nativeDialogs))if(win[name]===wrapped)win[name]=original;},
 };
}
