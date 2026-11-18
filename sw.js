// 更新程式後請把 V 的版本號 +1，使用者下次開啟才會換新快取
const V='esp-toolbox-v6';
const ASSETS=['./','index.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','css/app.css',
'js/app.js','js/registry.js','js/core/ui.js','js/core/ble.js','js/tools/lights.js','js/tools/adata.js','js/core/link.js','js/tools/mailbox.js','js/tools/usbplug.js','js/tools/irhub.js','js/tools/keyboard.js','js/tools/legacy.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return; // IRDB 等外部請求不攔截
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
