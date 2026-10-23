const CACHE='taif-v4',DATA='taif-data';
const ASSETS=['./','index.html','manifest.json','icon-192.png','icon-512.png','icon-512-maskable.png','apple-touch-icon.png','favicon-32.png','confidentialite.html','conditions.html','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];
// Une réponse arrivée après une redirection ne peut pas servir à ouvrir une page : on la « nettoie ».
const propre=res=>res&&res.redirected?res.blob().then(b=>new Response(b,{status:res.status,statusText:res.statusText,headers:res.headers})):Promise.resolve(res);
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ASSETS.map(u=>fetch(u,{cache:'reload'}).then(res=>{if(res.ok)return propre(res).then(p=>c.put(u,p));}).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==DATA).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname.endsWith('supabase.co')){
    if(!u.pathname.startsWith('/rest/v1/'))return;
    const key=r.url+(r.url.includes('?')?'&':'?')+'_k='+encodeURIComponent(r.headers.get('accept')||'');
    e.respondWith(fetch(r).then(res=>{
      if(res.ok){const cp=res.clone();caches.open(DATA).then(c=>c.put(key,cp));}
      return res;
    }).catch(()=>caches.open(DATA).then(c=>c.match(key)).then(m=>m||Response.error())));
    return;
  }
  if(r.mode==='navigate'){
    // Page de l'appli : internet d'abord, sinon la copie gardée dans le téléphone (jamais d'écran « pas de connexion »)
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();propre(cp).then(p=>caches.open(CACHE).then(c=>c.put(r,p)));}return res;})
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./')).then(m=>m||caches.match('index.html')).then(propre)));
    return;
  }
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{
    const net=fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));}return res;}).catch(()=>m);
    return m||net;
  }));
});
self.addEventListener("notificationclick",e=>{e.notification.close();const ecran=(e.notification.data||{}).ecran;e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){c.focus();c.postMessage({ecran});return}return clients.openWindow("./")}))});
