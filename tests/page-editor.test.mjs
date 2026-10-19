import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('owner page editor is reachable from every dashboard page and exposes supported content controls',async()=>{
 const dashboard=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 const editor=await readFile(new URL('../app/components/visual-page-editor.tsx',import.meta.url),'utf8');
 const booking=await readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/Edit this page/);
 assert.match(dashboard,/\['Page editor',ClipboardList\]/);
 assert.match(dashboard,/view==='Page editor'/);
 assert.match(editor,/contentEditable/);
 assert.match(editor,/Save changes/);
 assert.match(editor,/PAGE COLORS/);
 assert.match(editor,/bookingHeaderNote/);
 assert.doesNotMatch(dashboard,/data-sf-settings-group=\\"booking-page\\"/,'Page editor owns wording controls after Booking page content Settings removal');
 assert.match(dashboard,/Booking & membership questions/,'Settings exposes editable membership questions');
 assert.match(booking,/config\.bookingHeaderNote/);
});
