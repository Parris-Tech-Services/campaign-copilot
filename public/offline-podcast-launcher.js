(() => {
  const script = document.currentScript;
  if (!script) return;
  const bank = script.dataset.bank || (script.dataset.topics || '').split(',')[0] || 'dnd';
  const buttonLabel = script.dataset.launcherLabel || '🎧 Podcasts';
  const differentLabel = script.dataset.label || '🎧 Listen to a different podcast';
  const base = new URL('./', script.src);
  const dataUrl = new URL('podcasts/' + bank + '.json', base).href;
  const slug = base.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
  const AUDIO_CACHE = 'podcast-audio-' + slug + '-' + bank + '-v1';
  const STORAGE_KEY = 'offline-podcast-' + slug + '-' + bank + '-v1';
  const RECENT_LIMIT = 6;

  const style=document.createElement('style');
  style.textContent=`
  #offline-podcast-launcher{position:fixed;left:14px;bottom:max(14px,env(safe-area-inset-bottom));z-index:2147483000;border:1px solid #555;border-radius:999px;background:#181818;color:#fff;padding:11px 16px;font:700 14px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.38);cursor:pointer}
  #offline-podcast-panel{position:fixed;left:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:2147483001;width:min(560px,calc(100vw - 20px));box-sizing:border-box;border:1px solid #555;border-radius:16px;background:#171717;color:#fff;padding:13px;box-shadow:0 20px 55px rgba(0,0,0,.58);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  #offline-podcast-panel[hidden]{display:none!important}.offline-podcast-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.offline-podcast-title{margin:4px 0 0;font-size:16px;line-height:1.3}.offline-podcast-meta{margin:5px 0 0;color:#bbb;font-size:12px;line-height:1.4}.offline-podcast-close{width:38px;height:38px;flex:0 0 38px;border:1px solid #555;border-radius:50%;background:#282828;color:#fff;font-size:22px;cursor:pointer}.offline-podcast-frame{display:block;width:100%;height:152px;border:0;border-radius:12px;background:#080808;margin-top:10px}.offline-podcast-audio{display:block;width:100%;margin-top:10px}.offline-podcast-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.offline-podcast-actions button,.offline-podcast-actions a{border-radius:10px;padding:9px 12px;font:700 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer}.offline-podcast-different{border:0;background:#5b4bc4;color:#fff}.offline-podcast-offline{border:0;background:#315c42;color:#fff}.offline-podcast-offline:disabled{opacity:.65}.offline-podcast-link{display:inline-flex;align-items:center;border:1px solid #555;background:#282828;color:#fff}.offline-podcast-note{margin:9px 0 0;color:#aaa;font-size:11px}@media(max-width:640px){#offline-podcast-panel{left:5px;width:calc(100vw - 10px);padding:11px}.offline-podcast-actions>*{flex:1;text-align:center;justify-content:center}}
  `;
  document.head.appendChild(style);

  let episodes=[],currentIndex=0,recent=[],offlineState='streaming',isOpen=false;
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');if(Number.isInteger(saved.currentIndex))currentIndex=saved.currentIndex;if(Array.isArray(saved.recent))recent=saved.recent.slice(0,RECENT_LIMIT)}catch{}
  const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({currentIndex,recent:recent.slice(0,RECENT_LIMIT)}))}catch{}};

  const launcher=document.createElement('button');
  launcher.id='offline-podcast-launcher';launcher.type='button';launcher.textContent=buttonLabel;launcher.setAttribute('aria-label','Open podcasts');launcher.setAttribute('aria-expanded','false');document.body.appendChild(launcher);
  const panel=document.createElement('aside');
  panel.id='offline-podcast-panel';panel.hidden=true;panel.setAttribute('aria-label','Independent podcast player');
  panel.innerHTML=`<div class="offline-podcast-head"><div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#aaa">Independent offline podcasts</div><h2 class="offline-podcast-title"></h2><p class="offline-podcast-meta"></p></div><button class="offline-podcast-close" type="button" aria-label="Close podcast player">×</button></div><div class="offline-podcast-media"></div><div class="offline-podcast-actions"><button class="offline-podcast-different" type="button"></button><span class="offline-podcast-offline-slot"></span><a class="offline-podcast-link" target="_blank" rel="noopener noreferrer">Open in Spotify ↗</a></div><p class="offline-podcast-note"></p>`;
  document.body.appendChild(panel);
  const title=panel.querySelector('.offline-podcast-title'),meta=panel.querySelector('.offline-podcast-meta'),media=panel.querySelector('.offline-podcast-media'),offlineSlot=panel.querySelector('.offline-podcast-offline-slot'),note=panel.querySelector('.offline-podcast-note'),link=panel.querySelector('.offline-podcast-link'),close=panel.querySelector('.offline-podcast-close'),different=panel.querySelector('.offline-podcast-different');
  different.textContent=differentLabel;

  async function refreshOffline(){
    const e=episodes[currentIndex];if(!e?.audio||!('caches'in window)){offlineState='streaming';if(isOpen)renderControls();return}
    try{const c=await caches.open(AUDIO_CACHE);offlineState=await c.match(e.audio,{ignoreVary:true})?'saved':'downloadable'}catch{offlineState='downloadable'}
    if(isOpen)renderControls();
  }
  function renderControls(){
    const e=episodes[currentIndex];
    if(!e?.audio){offlineSlot.innerHTML='';return}
    offlineSlot.innerHTML=`<button class="offline-podcast-offline" type="button" ${offlineState==='downloading'?'disabled':''}>${offlineState==='saved'?'✓ Offline saved · tap to remove':offlineState==='downloading'?'Downloading…':offlineState==='failed'?'Retry offline download':'⬇ Download offline'}</button>`;
    offlineSlot.querySelector('button').addEventListener('click',toggleOffline);
  }
  async function toggleOffline(){
    const e=episodes[currentIndex];if(!e?.audio||!('caches'in window))return;
    offlineState='downloading';renderControls();
    try{
      const c=await caches.open(AUDIO_CACHE),existing=await c.match(e.audio,{ignoreVary:true});
      if(existing){await c.delete(e.audio,{ignoreVary:true});offlineState='downloadable';renderControls();return}
      let response;try{response=await fetch(e.audio,{cache:'no-store'})}catch{response=await fetch(e.audio,{mode:'no-cors',cache:'no-store'})}
      if(!response||(response.type!=='opaque'&&!response.ok))throw new Error('Download failed');
      await c.put(e.audio,response.clone());offlineState='saved';
    }catch(err){console.error(err);offlineState='failed'}
    renderControls();
  }
  function render(){
    const e=episodes[currentIndex];if(!e)return;
    title.textContent=e.title;meta.textContent=[e.show,...(e.tags||[])].filter(Boolean).join(' · ');
    if(e.audio){media.innerHTML='<audio class="offline-podcast-audio" controls preload="metadata"></audio>';media.querySelector('audio').src=e.audio;note.textContent='Verified publisher audio can be saved locally for offline listening.'}
    else{media.innerHTML='<iframe class="offline-podcast-frame" title="Spotify podcast episode" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';media.querySelector('iframe').src='https://open.spotify.com/embed/episode/'+encodeURIComponent(e.id)+'?theme=0';note.textContent='Streaming only: no verified direct publisher audio source is stored yet.'}
    link.href='https://open.spotify.com/episode/'+encodeURIComponent(e.id);renderControls();refreshOffline();
  }
  function chooseDifferent(){
    const excluded=new Set([currentIndex,...recent]);let candidates=episodes.map((_,i)=>i).filter(i=>!excluded.has(i));if(!candidates.length)candidates=episodes.map((_,i)=>i).filter(i=>i!==currentIndex);if(!candidates.length)candidates=[0];
    const previous=currentIndex;currentIndex=candidates[Math.floor(Math.random()*candidates.length)];if(previous!==currentIndex)recent=[previous,...recent.filter(i=>i!==previous)].slice(0,RECENT_LIMIT);save();offlineState='streaming';render();
  }
  launcher.addEventListener('click',()=>{isOpen=true;panel.hidden=false;launcher.hidden=true;launcher.setAttribute('aria-expanded','true');render()});
  close.addEventListener('click',()=>{isOpen=false;panel.hidden=true;launcher.hidden=false;launcher.setAttribute('aria-expanded','false')});
  different.addEventListener('click',chooseDifferent);

  fetch(dataUrl).then(r=>{if(!r.ok)throw new Error('Podcast bank '+r.status);return r.json()}).then(data=>{
    episodes=Array.isArray(data)?data:[];if(!episodes.length){launcher.hidden=true;return}if(currentIndex<0||currentIndex>=episodes.length)currentIndex=0;
  }).catch(err=>{console.error(err);launcher.hidden=true});

  if('serviceWorker'in navigator){
    navigator.serviceWorker.register(new URL('offline-podcast-sw.js',base),{scope:base.pathname}).then(async()=>{
      await navigator.serviceWorker.ready;
      const cacheCurrent=()=>{
        if(!navigator.serviceWorker.controller)return;
        const urls=[location.href,...performance.getEntriesByType('resource').map(e=>e.name)].filter(u=>{try{const x=new URL(u);return x.origin===location.origin&&x.pathname.startsWith(base.pathname)}catch{return false}});
        navigator.serviceWorker.controller.postMessage({type:'CACHE_URLS',urls:[...new Set(urls)]});
      };
      if(navigator.serviceWorker.controller)cacheCurrent();else navigator.serviceWorker.addEventListener('controllerchange',cacheCurrent,{once:true});
    }).catch(()=>{});
  }
})();