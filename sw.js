/* Carte Pêche Bretagne — service worker (hors ligne) */
const APP='cp-app-v4', TILES='cp-tiles';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
const TILE_HOSTS=/(^|\.)(basemaps\.cartocdn\.com|arcgisonline\.com|tiles\.emodnet-bathymetry\.eu|openseamap\.org|ows\.emodnet-bathymetry\.eu|ows\.emodnet-seabedhabitats\.eu|services\.data\.shom\.fr)$/;

self.addEventListener('install',e=>{e.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('cp-app-')&&k!==APP).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  /* application : réseau d'abord (mises à jour), cache si hors ligne */
  if(u.origin===self.location.origin){
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(APP).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
    return;
  }
  /* images de carte : cache d'abord */
  const isTile=TILE_HOSTS.test(u.hostname)&&!/request=GetFeatureInfo/i.test(u.search);
  if(isTile){
    e.respondWith((async()=>{
      const c=await caches.open(TILES);
      const hit=await c.match(r.url);if(hit)return hit;
      let res;
      try{res=await fetch(r.url,{mode:'cors',credentials:'omit'})}catch(_){
        try{res=await fetch(r.url,{mode:'no-cors',credentials:'omit'})}catch(err){return new Response('',{status:504})}}
      if(res&&(res.ok||res.type==='opaque'))c.put(r.url,res.clone()).catch(()=>{});
      return res;
    })());
  }
  /* le reste (météo, sondages) : réseau direct */
});
