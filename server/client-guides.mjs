/** Published, business-specific client guides. Never infer a guide from another tenant. */
const guides=new Map([
 ['arcillatrng',Object.freeze({title:'Arcila Training client guide (PDF)',href:'/guides/arcila-training-client-guide.pdf',updatedAt:'2026-10-28',pages:20})]
]);
export function publicClientGuide(slug){return typeof slug==='string'?guides.get(slug)||null:null;}
export function clientGuideIntent(message){
 const value=typeof message==='string'?message.toLowerCase().replace(/[-_]/g,' '):'';
 return /\b(instructions?|tutorials?|walkthrough|pdf|manual|guides?|step by step)\b/.test(value)
  ||!/^how (many|much|long)\b/.test(value.trim())&&/\bhow\b.*\b(book|booking|pay|payment|join|sign up|signup|register|registration|membership|status|autofill|auto populate|id)\b/.test(value)
  ||/\bhelp\b.*\b(book|booking|pay|payment|membership|register|registration|sign up)\b/.test(value);
}
