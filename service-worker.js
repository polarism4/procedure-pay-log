const CACHE='procedure-pay-log-v11-1';
const ASSETS=['./','./index.html','./config.js','./data.js','./cloud.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('procedure-pay-log-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(p=>new URL(p,self.location).pathname===url.pathname))return;
 e.respondWith(fetch(e.request).then(resp=>{
   if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
   return resp;
 }).catch(()=>caches.match(e.request)));
});
