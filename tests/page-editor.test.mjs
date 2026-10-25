import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('owner page editor lives only in Branding and exposes supported content controls',async()=>{
 const dashboard=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 const editor=await readFile(new URL('../app/components/visual-page-editor.tsx',import.meta.url),'utf8');
 const booking=await readFile(new URL('../app/book/page.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(dashboard,/Edit public pages|\['Page editor',ClipboardList\]|view==='Page editor'/);
 assert.match(dashboard,/view==='Branding'&&<OwnerBranding/);
 const branding=await readFile(new URL('../app/components/owner-branding.tsx',import.meta.url),'utf8');assert.match(branding,/visited.includes\('pages'\)&&<>/);assert.match(branding,/<VisualPageEditor/);
 assert.match(editor,/contentEditable/);
 assert.match(editor,/Save changes/);
 assert.match(editor,/PAGE COLORS/);
 assert.match(editor,/bookingHeaderNote/);
 assert.doesNotMatch(dashboard,/data-sf-settings-group="booking-page"/,'Page editor owns wording controls after Booking page content Settings removal');
 assert.match(dashboard,/id:'questions',title:'Questions'/,'Settings exposes the single question manager');
 assert.match(booking,/config\.bookingHeaderNote/);
});
