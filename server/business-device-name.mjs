/** Business-scoped presentation strings for push notifications and installed apps. */
const clean=value=>String(value||'').replace(/[<>\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
export function businessDeviceName(name){
 const business=clean(name).slice(0,58);
 return business?'SelahFlow - '+business:'SelahFlow';
}
export function businessManifest(slug,name,theme,audience='owner'){
 const s=String(slug||'').trim();
 if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(s))throw Error('Invalid business slug');
 const isPublic=audience==='public';
 const label=isPublic?(clean(name).slice(0,100)||'Business'):businessDeviceName(name);
 const launch=(isPublic?'/':'/studio/')+s;
 const colors=theme?.colors||{};
 const hex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 return {
  id:launch,
  name:label,
  short_name:label.slice(0,46),
  description:(isPublic?'Services and bookings for ':'Booking management and notifications for ')+clean(name).slice(0,100)+' powered by SelahFlow.',
  start_url:launch,
  scope:'/',
  display:'standalone',
  background_color:hex(colors.page,'#F7F4EC'),
  theme_color:hex(colors.header,'#123F3A'),
  icons:[{src:'/brand/app-icon.png?v=1.3.99',sizes:'512x512',type:'image/png',purpose:'any'}]
 };
}
