import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),exp={};
const compiled=ts.transpileModule(await readFile(new URL('../../app/components/share-business-page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',compiled)(require,exp);
export const SharePage=exp.default;
