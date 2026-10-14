
export const COLOR_ROLES=[['page','Page background'],['header','Top header'],['hero','Welcome section'],['surface','Booking panel'],['card','Service cards'],['policy','Policy notice'],['footer','Footer'],['button','Main buttons'],['buttonHover','Button hover'],['secondaryButton','Secondary buttons'],['selected','Selected items'],['step','Booking steps'],['input','Form fields'],['border','Borders'],['heading','Headings'],['text','Body text'],['muted','Secondary text'],['link','Links'],['accent','Accent details']];
export const FONTS=[['dm','DM Sans',"'DM Sans',Arial,sans-serif"],['manrope','Manrope',"'Manrope',Arial,sans-serif"],['inter','Inter',"'Inter',Arial,sans-serif"],['poppins','Poppins',"'Poppins',Arial,sans-serif"],['montserrat','Montserrat',"'Montserrat',Arial,sans-serif"],['lato','Lato',"'Lato',Arial,sans-serif"],['nunito','Nunito',"'Nunito',Arial,sans-serif"],['roboto','Roboto',"'Roboto',Arial,sans-serif"],['playfair','Playfair Display',"'Playfair Display',Georgia,serif"],['merriweather','Merriweather',"'Merriweather',Georgia,serif"],['georgia','Georgia',"Georgia,serif"],['system','System UI',"system-ui,sans-serif"]];
const BASE=[
 ['Pause & Flow','#123F3A','#F7F4EC','#FFFFFF','#C6A66A','#203B36','#557168','#E8F0E6','#B5C7B7'],
 ['Midnight Gold','#142339','#F8F6EF','#FFFFFF','#C09B54','#192B41','#657180','#EEF0F3','#A8B4C0'],
 ['Sage & Linen','#3B5A49','#F3F0E7','#FFFFFF','#B28B62','#284438','#617568','#E5EBDF','#B7C5B8'],
 ['Rosewood Cream','#673846','#FFF8F3','#FFFFFF','#D19F89','#482831','#856F76','#F7E9E9','#D2B7BE'],
 ['Ocean Breeze','#145B72','#F0F9FB','#FFFFFF','#E9AD78','#123A4A','#507580','#DFEEF3','#B0D0D8'],
 ['Lavender Mist','#4B416E','#F8F6FD','#FFFFFF','#BEA3DA','#393150','#6F6882','#EFEAF8','#C9C0E1'],
 ['Terracotta Sun','#8B4634','#FFF7EE','#FFFFFF','#D6A45E','#55362D','#84675E','#F8E6D5','#DFBAA3'],
 ['Forest & Moss','#214E35','#F3F5ED','#FFFFFF','#A5B378','#234331','#647665','#E4ECD9','#AFBF9B'],
 ['Noir Copper','#212325','#F7F5F1','#FFFFFF','#B47C57','#252628','#656361','#EBE5DC','#BEB2A7'],
 ['Blue Porcelain','#244F82','#F3F8FC','#FFFFFF','#99B9D6','#233F60','#65778B','#E6EFF7','#B9CADB'],
 ['Coral & Sand','#9D4B4F','#FFF8F2','#FFFFFF','#EFAD8B','#653A3D','#947471','#F9E7DE','#E4B9AA'],
 ['Cocoa Latte','#59433C','#FCF7F1','#FFFFFF','#C6A07C','#40332F','#84716A','#F1E8DD','#C8B4A6'],
 ['Emerald Pearl','#006B56','#F3FBF7','#FFFFFF','#B2C8AF','#184D42','#5F8178','#E0F2E9','#B1D3C5'],
 ['Slate & Ice','#394E63','#F4F8FA','#FFFFFF','#95BCD2','#293D4C','#70818D','#E8F0F5','#BBCDD9'],
 ['Plum Champagne','#65385A','#FBF5F7','#FFFFFF','#CAA6A1','#513148','#826F7D','#F2E6EC','#D4BDCC'],
 ['Olive Ivory','#535F37','#FBFAF2','#FFFFFF','#C6B77C','#38452C','#737961','#EFF0DF','#C9CCAC'],
 ['Sunset Peach','#924D41','#FFF7F2','#FFFFFF','#EDB190','#63392F','#8C7169','#F9E8DF','#E6C2B1'],
 ['Royal Teal','#075A60','#F0F8F7','#FFFFFF','#E4C58A','#14474B','#638180','#E1F0ED','#B0D0CD'],
 ['Graphite Lime','#32383A','#F8F9F3','#FFFFFF','#BACB72','#303C39','#66766D','#EDF2DF','#CBD7BB'],
 ['Indigo Pearl','#393E79','#F7F7FC','#FFFFFF','#A1ADD5','#353C62','#71768B','#EAEAF6','#C7CBE4']
];
export const PALETTES=BASE.map(([name,dark,page,surface,accent,text,muted,soft,border],i)=>({id:'palette-'+String(i+1).padStart(2,'0'),name,colors:{page,header:dark,hero:page,surface,card:surface,policy:soft,footer:dark,button:dark,buttonHover:accent,secondaryButton:soft,selected:soft,step:soft,input:surface,border,heading:text,text,muted,link:dark,accent}}));
export const DEFAULT_THEME={palette:PALETTES[0].id,bodyFont:'dm',headingFont:'manrope',colors:{...PALETTES[0].colors}};
export const EDITABLE_COLOR_ROLES=COLOR_ROLES.filter(([id])=>!['heading','text','muted','link'].includes(id));
const HEX=/^#[0-9a-fA-F]{6}$/,ROLES=COLOR_ROLES.map(([id])=>id),FONT_IDS=FONTS.map(([id])=>id);
export function themeIsValid(t){return !!t&&typeof t==='object'&&!Array.isArray(t)&&(t.palette==='custom'||PALETTES.some(p=>p.id===t.palette))&&FONT_IDS.includes(t.bodyFont)&&FONT_IDS.includes(t.headingFont)&&!!t.colors&&typeof t.colors==='object'&&!Array.isArray(t.colors)&&Object.keys(t.colors).length===ROLES.length&&Object.keys(t.colors).every(k=>ROLES.includes(k))&&ROLES.every(k=>typeof t.colors[k]==='string'&&HEX.test(t.colors[k]));}
export function resolveTheme(input,primary='#123F3A',background='#F7F4EC'){
 if(themeIsValid(input))return {...input,colors:automaticTextColors(input.colors)};
 const colors={...PALETTES[0].colors};
 if(HEX.test(primary)){colors.header=primary;colors.button=primary;colors.link=primary;}
 if(HEX.test(background)){colors.page=background;colors.hero=background;}
 return {palette:'custom',bodyFont:'dm',headingFont:'manrope',colors:automaticTextColors(colors)};
}
// Legacy text keys remain readable for stored theme compatibility, but are no
// longer configurable. Every renderer and save derives them from backgrounds.
function automaticTextColors(colors){return {...colors,heading:accessibleText(colors.hero),text:accessibleText(colors.page),muted:accessibleText(colors.page),link:accessibleText(colors.page)};}
function lum(h){const a=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
export function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function accessibleText(bg,pref='#183330'){if(contrast(bg,'#FFFFFF')>contrast(bg,'#000000'))return '#FFFFFF';if(HEX.test(pref)&&contrast(bg,pref)>=4.5)return pref;return '#000000';}
export function themeStyles(raw,primary,background){
 const t=resolveTheme(raw,primary,background),c=t.colors,out={};
 for(const [id] of COLOR_ROLES)out['--sf-'+id.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=c[id];
 for(const id of ['header','hero','page','surface','card','policy','footer','button','buttonHover','secondaryButton','selected','step','input']){
  out['--sf-on-'+id.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=accessibleText(c[id],c.text);
 }
 out['--sf-heading-on-page']=accessibleText(c.page,c.heading);out['--sf-heading-on-hero']=accessibleText(c.hero,c.heading);out['--sf-heading-on-surface']=accessibleText(c.surface,c.heading);out['--sf-link-on-surface']=accessibleText(c.surface,c.link);out['--sf-heading-readable']=accessibleText(c.hero,c.heading);out['--sf-text-readable']=accessibleText(c.page,c.text);
 out['--sf-muted-readable']=accessibleText(c.page,c.muted);out['--sf-link-readable']=accessibleText(c.page,c.link);
 out['--sf-body-font']=FONTS.find(f=>f[0]===t.bodyFont)?.[2]||FONTS[0][2];
 out['--sf-heading-font']=FONTS.find(f=>f[0]===t.headingFont)?.[2]||FONTS[1][2];
 return out;
}
