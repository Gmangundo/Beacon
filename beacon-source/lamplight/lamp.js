const L = window.LAMP;
const sb = supabase.createClient(L.url, L.key);
const g = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SH = ['▲','◆','●','■'], CL = ['a','b','c','d'];
let off = 0; // difference between the server clock and this device's clock
async function syncClock(){ const t = Date.now(); const {data} = await sb.rpc('server_time'); if (data) off = new Date(data).getTime() - (t + Date.now()) / 2; }
const now = () => Date.now() + off;
document.title = L.name;
const LOGO = `<svg class="logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M24 4 L24 12" stroke="url(#bg)" stroke-width="3" stroke-linecap="round"/>
<path d="M12 10 L17 15M36 10 L31 15" stroke="url(#bg)" stroke-width="3" stroke-linecap="round"/>
<circle cx="24" cy="24" r="9" fill="url(#bg)"/>
<path d="M9 44 L16 20 H32 L39 44 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
<defs><linearGradient id="bg" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#FFC94A"/><stop offset="1" stop-color="#FF7A1A"/></linearGradient></defs></svg>`;
function wordmark(){return `<div class="brand">${LOGO}<span>${L.name}</span></div>`}
function confettiBurst(n){n=n||60;const host=document.createElement('div');host.className='confetti';document.body.appendChild(host);
 const cols=['#FF7A1A','#FFC94A','#5B5FEF','#12B886','#FF5D5D'];
 for(let i=0;i<n;i++){const s=document.createElement('i');s.style.left=Math.random()*100+'vw';s.style.background=cols[i%cols.length];
  s.style.animationDuration=(1.6+Math.random()*1.2)+'s';s.style.animationDelay=(Math.random()*0.3)+'s';s.style.transform=`rotate(${Math.random()*360}deg)`;host.appendChild(s)}
 setTimeout(()=>host.remove(),3200)}
function fadeSwap(el,html,cb){el.style.opacity=0;el.style.transform='translateY(4px)';setTimeout(()=>{el.innerHTML=html;el.style.transition='opacity .18s ease, transform .18s ease';el.style.opacity=1;el.style.transform='translateY(0)';if(cb)cb()},60)}
const ICONS={
 home:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22v-10h6v10"/></svg>',
 studies:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
 settings:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
 join:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8l5 4-5 4V8z" fill="currentColor" stroke="none"/></svg>'
};
// Sound: tiny generated tones (no audio files = no extra data use). Muted by default.
let _actx;
function _muted(){return localStorage.beaconMuted!=='0'}
function _beep(freq,dur,type,vol){if(_muted())return;try{_actx=_actx||new(window.AudioContext||window.webkitAudioContext)();const o=_actx.createOscillator(),g=_actx.createGain();o.type=type||'sine';o.frequency.value=freq;g.gain.value=vol||.15;o.connect(g);g.connect(_actx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,_actx.currentTime+dur);o.stop(_actx.currentTime+dur)}catch(e){}}
function sfxCorrect(){_beep(880,.15);setTimeout(()=>_beep(1175,.2),110)}
function sfxWrong(){_beep(220,.3,'sawtooth',.12)}
function sfxReveal(){_beep(660,.12);setTimeout(()=>_beep(880,.15),120)}
function sfxTick(){_beep(523,.08,'square',.05)}
function soundToggleHtml(){return `<button id="muteBtn" class="alt" style="width:auto;min-height:0;padding:8px 12px;position:fixed;top:10px;right:10px;z-index:40;border-radius:999px" aria-label="Toggle sound">${_muted()?'🔇':'🔊'}</button>`}
function wireMuteBtn(){const b=document.getElementById('muteBtn');if(!b)return;b.onclick=()=>{localStorage.beaconMuted=_muted()?'0':'1';b.textContent=_muted()?'🔇':'🔊'}}
// Theme: apply cached theme instantly, then refresh from the shared settings row.
(function(){const cached=localStorage.beaconTheme;if(cached)document.documentElement.dataset.theme=cached})();
async function loadTheme(){try{const{data}=await sb.from('host_settings').select('theme,default_time_seconds,default_points').eq('id','00000000-0000-0000-0000-000000000001').single();
 if(data){document.documentElement.dataset.theme=data.theme;localStorage.beaconTheme=data.theme;window.BEACON_SETTINGS=data}return data}catch(e){return null}}
