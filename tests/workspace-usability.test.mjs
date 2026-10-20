import test from 'node:test';
import assert from 'node:assert/strict';
import {filteredWorkspaceGroups,workspaceGroups,hasUnsavedWorkspaceChanges} from '../server/workspace-navigation.mjs';

test('workspace search finds tools by purpose and preserves every existing destination',()=>{
 const all=workspaceGroups.flatMap(group=>group.items);
 assert.equal(all.length,13);assert.equal(new Set(all).size,13);
 assert.deepEqual(filteredWorkspaceGroups('  PAYMENT  ').flatMap(group=>group.items),['Reports']);
 assert.deepEqual(filteredWorkspaceGroups('booking rules').flatMap(group=>group.items),['Settings']);
 assert.equal(filteredWorkspaceGroups('does not exist').length,0);
 assert.deepEqual(filteredWorkspaceGroups().flatMap(group=>group.items),all);
});
test('draft protection covers settings and public page editor without flagging other workspace views',()=>{
 const config={name:'Business',services:[{id:'one',price:30}]},saved=JSON.stringify(config);
 assert.equal(hasUnsavedWorkspaceChanges('Settings',config,saved),false);
 assert.equal(hasUnsavedWorkspaceChanges('Page editor',{...config,policy:'New policy'},saved),true);
 assert.equal(hasUnsavedWorkspaceChanges('Settings',{...config,services:[{id:'one',price:40}]},saved),true);
 assert.equal(hasUnsavedWorkspaceChanges('Overview',{...config,name:'Changed'},saved),false);
 assert.equal(hasUnsavedWorkspaceChanges('Page editor',JSON.parse(saved),saved),false);
});

test('visual text editor keeps the editable component stable across field selection and saves',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../app/components/visual-page-editor.tsx',import.meta.url),'utf8');
 assert.ok(source.indexOf('function EditableText(')<source.indexOf('export default function VisualPageEditor('));
 assert.ok(source.includes('onBlur={e=>onCommit(id,e.currentTarget.textContent?.trim()'));
 assert.ok(!source.includes('const Edit='));
});
