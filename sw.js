/* TAÏF Marchand · service worker (27/10/2026)
   - Page de l'app : TOUJOURS la dernière version quand il y a internet ;
     la copie du téléphone seulement sans internet (ou si le réseau ne répond pas en 7 s).
   - Données Supabase : internet d'abord, sinon la dernière copie (mode hors connexion).
   - Images, icônes, bibliothèques : copie du téléphone, mise à jour en arrière-plan.
   Plus besoin de changer le numéro de CACHE à chaque mise à jour de index.html. */
const CACHE='taif-v7',DATA='taif-data';
const ASSETS=['./','index.html','manifest.json','icon-192.png','icon-512.png','icon-512-maskable.png','apple-touch-icon.png','favicon-32.png'];

// Une réponse arrivée après une redirection ne peut pas servir à ouvrir une page : on la « nettoie ».
const propre=res=>res&&res.redirected?res.blob().then(b=>new Response(b,{status:res.status,statusText:res.statusText,headers:res.headers})):Promise.resolve(res);

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ASSETS.map(u=>
    fetch(u,{cache:'reload'}).then(res=>res.ok?propre(res).then(p=>c.put(u,p)):null).catch(()=>null)
  ))));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==DATA).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

function reseau(url,ms){
  return new Promise((ok,ko)=>{
    const t=setTimeout(()=>ko(new Error('lent')),ms);
    fetch(url,{cache:'no-store',credentials:'same-origin'}).then(r=>{clearTimeout(t);ok(r)},err=>{clearTimeout(t);ko(err)});
  });
}

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);

  // Données Supabase : internet d'abord, sinon la dernière copie
  if(u.hostname.endsWith('supabase.co')){
    if(!u.pathname.startsWith('/rest/v1/'))return;
    const key=r.url+(r.url.includes('?')?'&':'?')+'_k='+encodeURIComponent(r.headers.get('accept')||'');
    e.respondWith(fetch(r).then(res=>{
      if(res.ok){const cp=res.clone();caches.open(DATA).then(c=>c.put(key,cp));}
      return res;
    }).catch(()=>caches.open(DATA).then(c=>c.match(key)).then(m=>m||Response.error())));
    return;
  }

  // Page de l'app : la dernière version d'internet, sinon la copie du téléphone
  if(r.mode==='navigate'){
    e.respondWith(reseau(r.url,7000).then(res=>{
      if(res.ok){const cp=res.clone();propre(cp).then(p=>caches.open(CACHE).then(c=>c.put('./',p)));}
      return propre(res);
    }).catch(()=>caches.match(r,{ignoreSearch:true})
      .then(m=>m||caches.match('./'))
      .then(m=>m||caches.match('index.html'))
      .then(m=>m||Response.error())));
    return;
  }

  // Le reste : la copie du téléphone tout de suite, mise à jour en arrière-plan
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{
    const net=fetch(r).then(res=>{
      if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));}
      return res;
    }).catch(()=>m||Response.error());
    return m||net;
  }));
});

// Toucher une notification : ouvre l'app sur le bon écran
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const ecran=(e.notification.data||{}).ecran;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    const c=cs[0];
    if(c){if(ecran)c.postMessage({ecran});return c.focus();}
    return self.clients.openWindow('./');
  }));
});
