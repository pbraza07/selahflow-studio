import {readFile} from 'node:fs/promises';
import ts from 'typescript';
export async function socialIconModule(){
 let source=ts.transpileModule(await readFile(new URL('../../app/components/social-platform-icon.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 source=source.replace(/from ['"]([^'"]+)['"]/g,(_,name)=>'from '+JSON.stringify(name.startsWith('.')?new URL('../../server/social-platform-logos.mjs',import.meta.url).href:import.meta.resolve(name)));
 const moduleUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');return {moduleUrl,Icon:(await import(moduleUrl)).default};
}
