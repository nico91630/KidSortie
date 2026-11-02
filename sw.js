const CACHE='kidsorties-shell-v5';
const SHELL=['./index.html','./manifest.webmanifest','./icons/kidsorties.svg','./icons/kidsorties-logo.svg','./event-core.mjs'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(name=>name.startsWith('kidsorties-shell-')&&name!==CACHE).map(name=>caches.delete(name)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(url.pathname.includes('/data/')){
  const canonical=new Request(url.origin+url.pathname);
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(canonical,copy)).catch(()=>{}));}
   return response;
  }).catch(async()=>await caches.match(canonical)||new Response('Données temporairement indisponibles',{status:503})));
  return;
 }
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./index.html',copy)).catch(()=>{}));}
   return response;
  }).catch(()=>caches.match('./index.html')));
  return;
 }
 event.respondWith(fetch(request).catch(()=>caches.match(request)));
});