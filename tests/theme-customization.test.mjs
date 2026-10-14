import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PALETTES,COLOR_ROLES,FONTS,DEFAULT_THEME,themeIsValid,resolveTheme,themeStyles,contrast,accessibleText} from '../server/themes.mjs';
const src=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v1.3.5 ships 20 named accessible palettes, 19 roles and 12 fonts',()=>{
 assert.equal(PALETTES.length,20);assert.equal(new Set(PALETTES.map(p=>p.name)).size,20);
 assert.equal(COLOR_ROLES.length,19);assert.equal(FONTS.length,12);
 for(const preset of PALETTES){const t={palette:preset.id,bodyFont:'dm',headingFont:'manrope',colors:{...preset.colors}};
  assert.equal(themeIsValid(t),true,preset.name);
  const vars=themeStyles(t);
  for(const color of Object.values(t.colors))assert.match(color,/^#[0-9a-f]{6}$/i);
  for(const id of ['header','hero','page','surface','card','policy','footer','button','buttonHover','secondaryButton','selected','step','input']){
   const key='--sf-on-'+id.replace(/[A-Z]/g,x=>'-'+x.toLowerCase());
   assert.ok(contrast(t.colors[id],vars[key])>=4.5,preset.name+' / '+id);
  }
 }
});
test('custom colors and font IDs are validated server-side',()=>{
 assert.equal(themeIsValid(DEFAULT_THEME),true);
 const bad=structuredClone(DEFAULT_THEME);bad.colors.button='red;color:white;';assert.equal(themeIsValid(bad),false);
 bad.colors.button='#aabbcc';bad.headingFont='url(javascript:alert(1))';assert.equal(themeIsValid(bad),false);
 bad.headingFont='playfair';bad.colors.evil='#FFFFFF';assert.equal(themeIsValid(bad),false);
 const custom=structuredClone(DEFAULT_THEME);custom.palette='custom';custom.colors.header='#FFFFFF';custom.colors.button='#FFFFFF';assert.equal(themeIsValid(custom),true);
 const vars=themeStyles(custom);assert.ok(contrast('#FFFFFF',vars['--sf-on-button'])>=4.5);
 assert.equal(resolveTheme(null,'#123456','#EEEEEE').colors.page,'#EEEEEE');
 assert.equal(accessibleText('#000000'),'#FFFFFF');
});
test('each owner saves theme through authenticated business settings and customer pages read it',async()=>{
 const api=await src('app/api/business/route.ts');
 assert.match(api,/requireOwner\(req\)/);assert.match(api,/themeIsValid\(requestedTheme\)/);assert.match(api,/settings.theme=requestedTheme/);
 const publicApi=await src('lib/studio-handler.ts');assert.match(publicApi,/theme:config.theme\|\|null/);
 const publicPage=await src('app/book/page.tsx');assert.match(publicPage,/themeStyles\(config.theme/);
 const businessPage=await src('app/[slug]/page.tsx');assert.match(businessPage,/themeStyles\(config.theme/);
 const workspace=await src('app/studio/owner-dashboard.tsx');assert.match(workspace,/themeStyles\(savedTheme/);
});
test('owner theme editor does not expose text-color controls',async()=>{
 const editor=await src('app/components/owner-theme-editor.tsx');
 assert.match(editor,/title:'Borders & accents'/);
 assert.doesNotMatch(editor,/title:'Typography & details'/);
 assert.doesNotMatch(editor,/roles:\['heading','text','muted','link'/);
 assert.match(editor,/Text colors are fixed to white on dark surfaces/);
 const css=await src('app/globals.css');
 assert.match(css,/\.sf-member-number-booking\{background:#000!important;color:#fff!important\}/);
 assert.match(css,/\.sf-member-number-booking :is\(label,p,strong,small,span,em,\[role=status\]\)\{color:#fff!important\}/);
});
