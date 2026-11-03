import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
test('membership counters display zero, queued historical requests and confirmed provider submissions without claiming delivery',()=>{
 const source=ts.transpileModule(readFileSync(new URL('../app/components/membership-payment-request-count.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports={};new Function('require','exports',source)(require,exports);
 const html=summary=>renderToStaticMarkup(React.createElement(exports.default,{summary}));
 assert.match(html(),/Payment requests: <strong>0<\/strong>/);assert.match(html(),/Emails submitted: <strong>0<\/strong>/);
 assert.match(html({request_count:3,submitted_count:1}),/Payment requests: <strong>3<\/strong>/);assert.match(html({request_count:3,submitted_count:1}),/Emails submitted: <strong>1<\/strong>/);assert.match(html(),/does not confirm inbox delivery/);assert.match(html(),/Automatic email retries do not increase/);
});
