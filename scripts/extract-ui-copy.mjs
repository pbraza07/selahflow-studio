import ts from 'typescript';
import fs from 'node:fs';import path from 'node:path';
const strings=new Set(),templates=new Set();
const clean=s=>s.replace(/\s+/g,' ').trim();
function add(s,force=false){s=clean(s);if(!s||s.length>4000||!/[A-Za-z]{2}/.test(s))return;
if(!force&&(!/^[A-Z]/.test(s)||/^(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |DROP |WITH |BEGIN|COMMIT|ROLLBACK|GRANT |COMMENT |NOT |AND |OR |ON |JOIN |AUTH_|https?:)/.test(s)||/[{}<>]|\$\d|=>|\\[swdb]|\bFROM\b|\bWHERE\b|#[a-fA-F0-9]{6}/.test(s)))return;
if(!force&&/^[\w-]+$/.test(s)&&s===s.toUpperCase())return;
strings.add(s);}
function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(f.name!=='i18n')walk(p);}else if(/\.(tsx|ts|mjs)$/.test(p)){const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(ts.isJsxText(n))add(n.text,true);else if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){if(n.parent&&ts.isJsxAttribute(n.parent)&&!['title','placeholder','aria-label','alt'].includes(n.parent.name.text))return;add(n.text);}else if(ts.isTemplateExpression(n)){const parts=[n.head.text,...n.templateSpans.map(s=>s.literal.text)];if(parts.some(s=>/[a-z]{2}/i.test(s))&&parts.every(s=>!/[<>={}]|\$\d|\bSELECT\b|\bFROM\b|\bWHERE\b/.test(s))){parts.forEach(s=>add(s));const full=clean(parts.map((s,i)=>s+(i<parts.length-1?`{${i}}`:'')).join(''));if(/[a-zA-Z]{2,} /.test(full)&&full.length<2000){templates.add(full);}}}ts.forEachChild(n,visit)}visit(sf)}}}
for(const d of ['app','lib','server'])walk(d);
// Runtime data, JSX separators and HTML entities use rendered text.
for(const s of [...strings]){const plain=s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');if(plain!==s){strings.delete(s);strings.add(plain);}}
fs.writeFileSync(process.argv[2]||'/tmp/selahflow-ui-copy.json',JSON.stringify([...strings].sort(),null,2));
fs.writeFileSync(process.argv[3]||'/tmp/selahflow-ui-templates.json',JSON.stringify([...templates].sort(),null,2));
console.log({strings:strings.size,templates:templates.size});
