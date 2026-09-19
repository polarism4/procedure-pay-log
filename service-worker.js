const CACHE='procedure-pay-log-v10';
const ASSETS=['./','./index.html','./config.js','./data.js','./cloud.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('procedure-pay-log-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 // Never cache auth, Supabase requests, external resources, or non-GET writes.
 if(e.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(p=>new URL(p,self.location).pathname===url.pathname))return;
 e.respondWith(fetch(e.request).then(resp=>{
   if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
   return resp;
 }).catch(()=>caches.match(e.request)));
});
