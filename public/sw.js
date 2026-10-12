/* SelahFlow v1.3.11 Web Push: no remote scripts or offline caching of customer records. */
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()||{};}catch{data={title:'SelahFlow',body:'You have a new booking request.'};}
 const title=String(data.title||'SelahFlow · New booking').slice(0,110);
 const body=String(data.body||'Open SelahFlow to review this appointment.').slice(0,240);
 const raw=String(data.url||'');
 const target=new URL(raw,self.location.origin);
 const safe=target.origin===self.location.origin&&(/^(\/studio\/[^/]+|\/booking\/respond\/[0-9a-f]{64}|\/customer\/booking)/.test(target.pathname));
 const url=safe?target.pathname+target.search+target.hash:'/';
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'/brand/app-icon.svg',badge:'/brand/app-icon.svg',
  tag:String(data.tag||'selah-booking').slice(0,140),renotify:true,
  data:{url},requireInteraction:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL(event.notification.data?.url||'/',self.location.origin);
  if(target.origin!==self.location.origin)return;
  const matches=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of matches){
   if(client.url.startsWith(target.origin)&&'focus' in client){
    if('navigate' in client)await client.navigate(target.href);
    return client.focus();
   }
  }
  if(clients.openWindow)return clients.openWindow(target.href);
 })());
});
