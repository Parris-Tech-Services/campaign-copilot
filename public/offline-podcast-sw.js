const BASE=new URL('./',self.location.href);
const SLUG=BASE.pathname.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'root';
const SHELL_CACHE='podcast-shell-'+SLUG+'-v1';
const AUDIO_PREFIX='podcast-audio-'+SLUG+'-';

self.addEventListener('install',event=>event.waitUntil(
  caches.open(SHELL_CACHE)
    .then(async cache=>{try{const r=await fetch(BASE.href,{cache:'reload'});if(r.ok)await cache.put(BASE.href,r)}catch{}})
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_URLS'||!Array.isArray(event.data.urls))return;
  event.waitUntil(caches.open(SHELL_CACHE).then(async cache=>{
    for(const raw of event.data.urls){
      try{const u=new URL(raw);if(u.origin!==self.location.origin||!u.pathname.startsWith(BASE.pathname))continue;const r=await fetch(u.href,{cache:'reload'});if(r.ok)await cache.put(u.href,r)}catch{}
    }
  }));
});

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  if(request.destination==='audio'){
    event.respondWith((async()=>{
      const keys=await caches.keys();
      for(const key of keys.filter(k=>k.startsWith(AUDIO_PREFIX))){
        const hit=await (await caches.open(key)).match(request,{ignoreVary:true});if(hit)return hit;
      }
      return fetch(request);
    })());
    return;
  }
  const u=new URL(request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(BASE.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(r=>{if(r.ok)caches.open(SHELL_CACHE).then(c=>c.put(BASE.href,r.clone())).catch(()=>{});return r}).catch(()=>caches.open(SHELL_CACHE).then(c=>c.match(BASE.href))));
    return;
  }
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(r=>{if(r.ok)caches.open(SHELL_CACHE).then(c=>c.put(request,r.clone())).catch(()=>{});return r})));
});
