import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const overrides=JSON.parse(readFileSync(new URL('scripts/translation-overrides.json',root),'utf8'));
for(const language of ['es','pt']){
 const file=new URL(`public/i18n/${language}.json`,root),catalog=JSON.parse(readFileSync(file,'utf8'));
 for(const [key,entry] of Object.entries(overrides))catalog[key]=entry[language];
 writeFileSync(file,JSON.stringify(Object.fromEntries(Object.entries(catalog).sort(([a],[b])=>a<b?-1:a>b?1:0)),null,1)+'\n');
}
