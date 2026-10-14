import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('owner page editor is reachable from every dashboard page and exposes supported content controls',async()=>{
 const dashboard=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 const editor=await readFile(new URL('../app/components/page-editor-settings.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/Edit this page/);
 assert.match(dashboard,/id:'page-editor'/);
 assert.match(dashboard,/data-sf-settings-group="page-editor"/);
 assert.match(editor,/PageContentSettings/);
 assert.match(editor,/OwnerThemeEditor/);
 assert.match(editor,/Colors, fonts and page appearance/);
});
