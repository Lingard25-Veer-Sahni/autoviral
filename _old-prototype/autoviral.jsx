/*
  AUTOVIRAL — AI Faceless Video Platform
  Script: Claude AI  ·  Visuals: procedural motion-graphics engine (zero external assets)
  Voiceover: Web Speech (preview) + StreamElements TTS (baked-in export, free, no key)
  Storage: IndexedDB + localStorage on a real domain; in-memory fallback in sandboxed previews
*/

import {useState, useEffect, useRef, useCallback, Component} from "react";

/* ─── PRE-MOUNT CRASH CATCHER ─────────────────────────────────────
   If anything throws before React even mounts (or outside React),
   paint a readable report directly into the DOM so the error is
   never just a blank "pattern" message with no context.           */
if(typeof window!=="undefined"&&!window.__avCrashHook){
  window.__avCrashHook=true;
  const paint=(title,msg,src,line)=>{
    try{
      if(document.getElementById("av-crash"))return;
      const d=document.createElement("div");
      d.id="av-crash";
      d.style.cssText="position:fixed;left:12px;right:12px;bottom:12px;z-index:999999;background:#141400;border:1px solid #FFE600;border-radius:10px;padding:14px 16px;font:12px/1.6 Inter,-apple-system,sans-serif;color:#FFE600;white-space:pre-wrap;word-break:break-word;box-shadow:0 12px 44px rgba(0,0,0,.65)";
      d.textContent="AUTOVIRAL CRASH REPORT — screenshot this\n"+title+": "+msg+(src?"\nat "+src+(line?":"+line:""):"");
      const close=document.createElement("div");
      close.textContent="dismiss";
      close.style.cssText="margin-top:8px;color:#9898a8;cursor:pointer;text-decoration:underline;font-size:11px";
      close.onclick=()=>d.remove();
      d.appendChild(close);
      (document.body||document.documentElement).appendChild(d);
    }catch{}
  };
  window.addEventListener("error",e=>paint("Error",String((e&&(e.message||e.error))||"Unknown"),e&&e.filename,e&&e.lineno));
  window.addEventListener("unhandledrejection",e=>{
    const r=e&&e.reason;
    paint("Async error",String((r&&r.message)||r||"Unknown"),r&&r.stack?String(r.stack).split("\n")[1]:"");
  });
}

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --y:#FFE600;--yl:#FFF38A;
  --k:#07070a;--k1:#0d0d12;--k2:#13131a;--k3:#1b1b24;--k4:#23232e;
  --g:#383848;--g2:#505060;--g3:#707080;--g4:#9898a8;
  --w:#ededf5;--r:#ff4040;--gr:#00e676;--bl:#4d8aff;--or:#ff7a30;
  --ff:'Inter',-apple-system,sans-serif;--fd:'Space Grotesk',sans-serif;--fm:'Inter',-apple-system,sans-serif;
  --ease:cubic-bezier(.22,1,.36,1);
}
/* Space Grotesk is wider than the old condensed face — tighten display type */
[style*="var(--fd)"]{font-weight:700!important;letter-spacing:-0.5px!important;}
body{font-family:var(--ff);background:var(--k);color:var(--w);overflow-x:hidden;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--k2)}
::-webkit-scrollbar-thumb{background:var(--g);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:var(--y)}
input,textarea,select,button{font-family:var(--ff)}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.15}}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes sl{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes popIn{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
.aup{animation:up .28s ease-out}.afi{animation:fi .2s ease-out}
.asp{animation:spin .75s linear infinite}.apl{animation:pulse 1.6s ease-in-out infinite}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;font-family:var(--ff);font-weight:700;font-size:13px;border:none;outline:none;transition:all .18s;white-space:nowrap;user-select:none;line-height:1}
.btn:disabled{opacity:.3;cursor:not-allowed;pointer-events:none}
.by{background:var(--y);color:#000;padding:11px 24px;border-radius:6px}
.by:hover{background:var(--yl);box-shadow:0 0 24px rgba(255,230,0,.45);transform:translateY(-1px)}
.by:active{transform:none;box-shadow:none}
.bo{background:transparent;color:var(--y);border:1.5px solid var(--y);padding:10px 22px;border-radius:6px}
.bo:hover{background:rgba(255,230,0,.08)}
.bg{background:transparent;color:var(--g4);border:1px solid var(--g);padding:9px 16px;border-radius:6px;font-size:12px}
.bg:hover{border-color:var(--y);color:var(--y)}
.bsm{padding:6px 12px;font-size:11px}.blg{padding:14px 32px;font-size:15px}
.bxl{padding:17px 40px;font-size:17px;border-radius:8px}.bic{padding:8px;border-radius:6px;aspect-ratio:1}
.inp{background:var(--k4);border:1.5px solid var(--g);color:var(--w);padding:11px 14px;font-size:13px;width:100%;outline:none;transition:border-color .18s,box-shadow .18s;border-radius:6px}
.inp:focus{border-color:var(--y);box-shadow:0 0 0 3px rgba(255,230,0,.12)}
.inp::placeholder{color:var(--g2)}
textarea.inp{resize:vertical;min-height:80px;line-height:1.65}
select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2370708080'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:32px}
.lbl{display:block;font-size:10px;color:var(--g3);font-family:var(--fm);text-transform:uppercase;letter-spacing:1.4px;margin-bottom:7px;font-weight:500}
.card{background:var(--k2);border:1px solid var(--g);border-radius:10px;padding:20px}
.tg{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-family:var(--ff);padding:4px 12px;border-radius:20px;font-weight:500;letter-spacing:.1px}
.ty{background:rgba(255,230,0,.1);color:var(--y);border:1px solid rgba(255,230,0,.25)}
.tgg{background:rgba(0,230,118,.1);color:var(--gr);border:1px solid rgba(0,230,118,.25)}
.tb{background:rgba(77,138,255,.1);color:var(--bl);border:1px solid rgba(77,138,255,.25)}
.tr{background:rgba(255,64,64,.1);color:var(--r);border:1px solid rgba(255,64,64,.25)}
.pb{height:3px;background:var(--g);border-radius:2px;overflow:hidden}
.pf{height:100%;background:linear-gradient(90deg,var(--y),var(--yl));border-radius:2px;transition:width .5s ease}
.pill{padding:7px 14px;border-radius:20px;border:1.5px solid var(--g);cursor:pointer;font-size:12px;font-weight:600;transition:all .15s;color:var(--g4);background:transparent;white-space:nowrap}
.pill:hover{border-color:var(--g2);color:var(--w)}.pill.on{background:rgba(255,230,0,.1);border-color:var(--y);color:var(--y)}
.tog{width:38px;height:21px;background:var(--g);border-radius:11px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.tog.on{background:var(--y)}.tog::after{content:'';position:absolute;top:3px;left:3px;width:15px;height:15px;background:#fff;border-radius:50%;transition:transform .2s}
.tog.on::after{transform:translateX(17px);background:#000}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.92);backdrop-filter:blur(18px);z-index:900;display:flex;align-items:flex-start;justify-content:center;padding:20px;animation:fi .2s;overflow-y:auto}
.modal{background:var(--k1);border:1px solid var(--g);border-radius:12px;width:100%;box-shadow:0 32px 100px rgba(0,0,0,.8)}
.tw{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.ti{background:var(--k2);border:1px solid var(--g);color:var(--w);padding:11px 15px;border-radius:6px;font-size:12px;max-width:300px;animation:sl .25s ease-out;display:flex;align-items:center;gap:9px;box-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:auto}
.cpick{border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid transparent;transition:border-color .15s;overflow:hidden}
.cpick.on{border-color:var(--y)}
.vbtn{padding:8px 6px;border-radius:6px;border:1.5px solid var(--g);cursor:pointer;transition:all .15s;background:var(--k3);display:flex;flex-direction:column;align-items:center;gap:3px}
.vbtn:hover{border-color:var(--g2)}.vbtn.on{border-color:var(--y);background:rgba(255,230,0,.08)}
.rdot{width:9px;height:9px;border-radius:50%;background:var(--r);animation:pulse 1s ease-in-out infinite;display:inline-block}
.gbg{background-image:linear-gradient(rgba(255,230,0,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,230,0,.018) 1px,transparent 1px);background-size:52px 52px}

/* Image picker modal */
.ig{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ic{position:relative;border-radius:8px;overflow:hidden;cursor:pointer;aspect-ratio:4/3;border:2.5px solid transparent;transition:border-color .15s,transform .15s;background:var(--k3)}
.ic:hover{transform:scale(1.03);border-color:rgba(255,230,0,.5)}
.ic.sel{border-color:var(--y)}
.ic img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.ic .sk{position:absolute;inset:0;background:linear-gradient(90deg,var(--k3) 0%,var(--k4) 50%,var(--k3) 100%);background-size:600px 100%;animation:shimmer 1.4s ease-in-out infinite}
.ic .badge{position:absolute;top:5px;right:5px;width:22px;height:22px;background:var(--y);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;animation:popIn .18s;z-index:3;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.ic .hov{position:absolute;inset:0;background:rgba(255,230,0,.18);opacity:0;transition:opacity .15s;pointer-events:none}
.ic:hover .hov,.ic.sel .hov{opacity:1}
.kstrip{display:flex;gap:7px;padding:10px 20px;overflow-x:auto;border-bottom:1px solid var(--g)}
.kstrip::-webkit-scrollbar{height:3px}.kstrip::-webkit-scrollbar-thumb{background:var(--g)}
.sstrip{display:flex;gap:6px;padding:8px 20px;background:var(--k3);border-bottom:1px solid var(--g);min-height:54px;overflow-x:auto;align-items:center}
.sstrip::-webkit-scrollbar{height:3px}
.sth{position:relative;width:50px;height:37px;border-radius:4px;overflow:hidden;border:2px solid var(--y);flex-shrink:0;cursor:pointer}
.sth img{width:100%;height:100%;object-fit:cover}
.sth .rm{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;font-size:14px}
.sth:hover .rm{opacity:1}
.tb2{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 14px;border:1.5px solid var(--g);border-radius:8px;cursor:pointer;transition:all .15s;background:var(--k3);font-size:11px;font-weight:700;color:var(--g4)}
.tb2:hover{border-color:var(--g2);color:var(--w)}.tb2.on{border-color:var(--y);background:rgba(255,230,0,.08);color:var(--y)}
`;

/* ─── ICONS ──────────────────────────────────────────────────── */
const Ic = ({n,s=16,c="currentColor"}) => {
  const P={
    zap:"M13 2L3 14h9l-1 8 10-12h-9z",play:"M5 3l14 9-14 9V3z",stop:"M6 6h12v12H6z",
    plus:"M12 5v14 M5 12h14",x:"M18 6L6 18 M6 6l12 12",chk:"M20 6L9 17l-5-5",
    dl:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    sparkle:"M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z",
    edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    vol:"M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14 M15.54 8.46a5 5 0 010 7.07",
    mut:"M16.5 7.5l-9 9 M11 5L6 9H2v6h4l5 4V5z",
    copy:"M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2 M16 4h2a2 2 0 012 2v2 M10 2h6a2 2 0 012 2v10a2 2 0 01-2 2h-6a2 2 0 01-2-2V4a2 2 0 012-2z",
    refresh:"M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15",
    slider:"M4 6h16 M8 12h8 M11 18h2",
    film:"M15 10l4.55-2.07A1 1 0 0121 8.86V15.1a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    cal:"M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    link:"M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
    shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    clock:"M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
    user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    out:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
    mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8",
    layers:"M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
    send:"M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
    yt:"M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-1.92 29 29 0 00.46-5.33 29 29 0 00-.46-5.33z M9.75 15.02l5.75-3.27-5.75-3.27v6.54z",
    ig:"M16 3H8a5 5 0 00-5 5v8a5 5 0 005 5h8a5 5 0 005-5V8a5 5 0 00-5-5z M16 11.37a4 4 0 11-7.914 1.173A4 4 0 0116 11.37z M17.5 6.5h.01",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {(P[n]||"").split(" M").filter(Boolean).map((d,i)=><path key={i} d={i===0?d:"M"+d}/>)}
    </svg>
  );
};

/* ─── SAFE SPEECH SHIM — some sandboxed iframes lack the API ─── */
const SYNTH=(typeof window!=="undefined"&&window.speechSynthesis)?window.speechSynthesis:null;
/* Safari/iOS can't record webm — pick the first container this browser supports */
function pickMime(){
  const cands=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4;codecs=h264,aac","video/mp4"];
  try{
    if(typeof MediaRecorder==="undefined")return{mime:"",ext:"webm"};
    for(const m of cands)if(MediaRecorder.isTypeSupported(m))return{mime:m,ext:m.includes("mp4")?"mp4":"webm"};
  }catch{}
  return{mime:"",ext:"webm"};
}
const safeVoices=()=>{try{return SYNTH?SYNTH.getVoices().filter(v=>v.lang&&v.lang.startsWith("en")):[];}catch{return[];}};
/* true when running inside the claude.ai chat preview, where ALL
   external image/video requests are blocked by the platform sandbox */
const SANDBOXED=(()=>{try{
  if(typeof window==="undefined")return false;
  const h=(window.location&&window.location.hostname)||"";
  return window.origin==="null"||h===""||h.includes("claudeusercontent");
}catch{return true;}})();

/* ─── LOGO — charged bolt mark, yellow-majority ──────────────── */
function Logo({s=28}){
  return(
    <span className="logoMark" style={{width:s,height:s}}>
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <defs>
          <linearGradient id="avlg" x1="4" y1="4" x2="44" y2="44">
            <stop offset="0" stopColor="#FFF38A"/>
            <stop offset=".5" stopColor="#FFE600"/>
            <stop offset="1" stopColor="#F5B800"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#avlg)"/>
        <rect x="2" y="2" width="44" height="44" rx="14" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="1.4"/>
        {/* motion streaks */}
        <rect x="6" y="17.2" width="6.2" height="3.6" rx="1.8" fill="#0a0a0a" opacity=".8"/>
        <rect x="4.6" y="24" width="4.6" height="3.6" rx="1.8" fill="#0a0a0a" opacity=".45"/>
        {/* play triangle */}
        <path d="M17.2 10.4 C15.7 9.5 14 10.55 14 12.3 V35.7 C14 37.45 15.7 38.5 17.2 37.6 L37.6 25.8 C39.1 24.95 39.1 23.05 37.6 22.2 Z" fill="#0a0a0a"/>
        {/* negative-space lightning bolt */}
        <path d="M26.2 14.8 L20.4 25 H24.1 L21.8 33.2 L30.2 22.2 H26.3 L29.6 14.8 Z" fill="url(#avlg)"/>
      </svg>
    </span>
  );
}

/* ─── THEMES ─────────────────────────────────────────────────── */
const THEMES={
  fitness:{id:"fitness",label:"Fitness",bg0:"#0e0400",bg1:"#1f0a00",acc:"#FF6B00"},
  finance:{id:"finance",label:"Finance",bg0:"#000e05",bg1:"#001a0a",acc:"#00E676"},
  tech:{id:"tech",label:"Technology",bg0:"#00050e",bg1:"#000a1f",acc:"#4D8AFF"},
  meditation:{id:"meditation",label:"Mindfulness",bg0:"#060010",bg1:"#0f001f",acc:"#9D6FFF"},
  nature:{id:"nature",label:"Nature",bg0:"#000e03",bg1:"#001a06",acc:"#00C853"},
  food:{id:"food",label:"Food",bg0:"#0e0500",bg1:"#1f0900",acc:"#FF7043"},
  travel:{id:"travel",label:"Travel",bg0:"#000e0e",bg1:"#001a1a",acc:"#00BCD4"},
  gaming:{id:"gaming",label:"Gaming",bg0:"#0e0018",bg1:"#180028",acc:"#E040FB"},
  motivation:{id:"motivation",label:"Motivation",bg0:"#0a0a00",bg1:"#1a1500",acc:"#FFE600"},
};
function detectTheme(t){
  t=t.toLowerCase();
  if(/gym|workout|fitness|muscle|lift|weight|exercise|train|sport/.test(t))return THEMES.fitness;
  if(/money|financ|invest|rich|wealth|income|profit|stock|crypto|bitcoin/.test(t))return THEMES.finance;
  if(/tech|ai|code|software|computer|digital|robot|algorithm|app|program/.test(t))return THEMES.tech;
  if(/meditat|calm|breath|mindful|yoga|peace|relax|stress|anxiet|zen/.test(t))return THEMES.meditation;
  if(/nature|forest|ocean|mountain|tree|garden|earth|green|environment/.test(t))return THEMES.nature;
  if(/food|cook|eat|recipe|chef|meal|diet|nutrition|breakfast|lunch/.test(t))return THEMES.food;
  if(/travel|journey|explor|adventur|trip|country|destination|tourist/.test(t))return THEMES.travel;
  if(/game|gaming|esport|play|gamer|stream|twitch|controller|fortnite/.test(t))return THEMES.gaming;
  return THEMES.motivation;
}

/* ─── VOICE PRESETS ──────────────────────────────────────────── */
const VP=[
  {id:"natural",    l:"Natural",    rate:0.92,pitch:1.00,desc:"Default clear"},
  {id:"deep",       l:"Deep",       rate:0.80,pitch:0.58,desc:"Low dramatic"},
  {id:"energetic",  l:"Energetic",  rate:1.20,pitch:1.28,desc:"Fast excited"},
  {id:"newscaster", l:"Newscaster", rate:0.94,pitch:0.88,desc:"Pro broadcast"},
  {id:"storyteller",l:"Storyteller",rate:0.85,pitch:0.96,desc:"Warm narrative"},
  {id:"intense",    l:"Intense",    rate:1.10,pitch:0.75,desc:"Forceful punch"},
  {id:"calm",       l:"Calm",       rate:0.72,pitch:1.06,desc:"Slow peaceful"},
  {id:"hype",       l:"Hype",       rate:1.35,pitch:1.45,desc:"Max energy"},
  {id:"robotic",    l:"Robotic",    rate:0.88,pitch:0.40,desc:"Robot drone"},
  {id:"whisper",    l:"Whisper",    rate:0.78,pitch:1.15,desc:"Hushed close"},
  {id:"narrator",   l:"Narrator",   rate:0.87,pitch:0.82,desc:"Documentary"},
  {id:"upbeat",     l:"Upbeat",     rate:1.25,pitch:1.35,desc:"Cheerful fun"},
];

/* ─── VISUAL ENGINE — procedural motion graphics, zero assets ── */
function hexRgb(h){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(",");}
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
const VSTYLES=[
  {id:"aurora",   l:"Aurora"},
  {id:"particles",l:"Particle Field"},
  {id:"waves",    l:"Waveform"},
  {id:"lines",    l:"Geometric"},
  {id:"orbs",     l:"Bokeh"},
  {id:"grid",     l:"Horizon Grid"},
];
function srnd(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function bgFill(ctx,W,H,theme){
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,theme.bg0);g.addColorStop(1,theme.bg1);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function vignette(ctx,W,H){
  const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.78);
  g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.55)");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function dAurora(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc);
  ctx.globalCompositeOperation="lighter";
  for(let i=0;i<4;i++){
    const sp=.13+srnd(i)*.1;
    const x=W*(.5+.42*Math.sin(t*sp+i*1.7)),y=H*(.5+.4*Math.cos(t*sp*.8+i*2.4));
    const r=Math.max(W,H)*(.32+.14*Math.sin(t*.3+i));
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    if(i%2){g.addColorStop(0,`rgba(${rgb},.17)`);g.addColorStop(1,`rgba(${rgb},0)`);}
    else{g.addColorStop(0,"rgba(255,255,255,.05)");g.addColorStop(1,"rgba(255,255,255,0)");}
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  ctx.globalCompositeOperation="source-over";
  ctx.strokeStyle=`rgba(${rgb},.10)`;ctx.lineWidth=1.5;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    for(let x=0;x<=W;x+=24){
      const y=H*(.25+i*.25)+Math.sin(x*.004+t*(.5+i*.2)+i*9)*H*.06;
      x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
}
function dParticles(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc),N=60,pts=[];
  for(let i=0;i<N;i++){
    const x=((srnd(i)*W+t*(8+srnd(i+99)*22))%(W+40))-20;
    const y=(srnd(i+50)*H+Math.sin(t*.5+i)*14+H)%H;
    pts.push([x,y,1+srnd(i+7)*2.4,.2+.55*srnd(i+13)*(0.5+0.5*Math.sin(t*1.4+i))]);
  }
  ctx.strokeStyle=`rgba(${rgb},.08)`;ctx.lineWidth=1;
  for(let i=0;i<N;i++)for(let j=i+1;j<i+5&&j<N;j++){
    const dx=pts[i][0]-pts[j][0],dy=pts[i][1]-pts[j][1];
    if(dx*dx+dy*dy<14400){ctx.beginPath();ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[j][0],pts[j][1]);ctx.stroke();}
  }
  pts.forEach(([x,y,r,a])=>{
    ctx.fillStyle=`rgba(${rgb},${a})`;
    ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  });
}
function dWaves(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc);
  for(let i=0;i<5;i++){
    const yc=H*(.2+i*.15),amp=H*.05*(1+srnd(i)),a=.07+i*.05;
    const g=ctx.createLinearGradient(0,0,W,0);
    g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.5,`rgba(${rgb},${a})`);g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.strokeStyle=g;ctx.lineWidth=2+i;
    ctx.beginPath();
    for(let x=0;x<=W;x+=14){
      const y=yc+Math.sin(x*.006+t*(0.8+i*.25))*amp+Math.sin(x*.013-t*.6)*amp*.4;
      x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
}
function dLines(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc),cx=W*.5,cy=H*.44,R=Math.min(W,H)*.33;
  for(let k=0;k<3;k++){
    const rot=t*(.08+k*.05)*(k%2?-1:1),r=R*(1-k*.22);
    ctx.strokeStyle=k===0?`rgba(${rgb},.4)`:"rgba(255,255,255,.1)";
    ctx.lineWidth=k===0?1.6:1;
    ctx.beginPath();
    for(let i=0;i<=6;i++){
      const a=rot+i/6*Math.PI*2;
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  const sa=t*.5;
  ctx.strokeStyle=`rgba(${rgb},.5)`;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sa)*R*1.05,cy+Math.sin(sa)*R*1.05);ctx.stroke();
  ctx.fillStyle=`rgba(${rgb},.9)`;ctx.beginPath();ctx.arc(cx+Math.cos(sa)*R*1.05,cy+Math.sin(sa)*R*1.05,3.5,0,7);ctx.fill();
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2;
    ctx.fillStyle=`rgba(255,255,255,${.08+.2*srnd(i)})`;
    ctx.beginPath();ctx.arc(cx+Math.cos(a)*R*1.18,cy+Math.sin(a)*R*1.18,1.4,0,7);ctx.fill();
  }
}
function dOrbs(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc);
  ctx.globalCompositeOperation="lighter";
  for(let i=0;i<9;i++){
    const x=W*((srnd(i)+t*.012*(1+srnd(i+3)))%1),y=H*((srnd(i+20)+.08*Math.sin(t*.4+i)+1)%1);
    const r=(.06+srnd(i+40)*.16)*Math.max(W,H);
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    const col=i%3===0?"255,255,255":rgb;
    g.addColorStop(0,`rgba(${col},${.10+srnd(i+5)*.10})`);g.addColorStop(1,`rgba(${col},0)`);
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
  }
  ctx.globalCompositeOperation="source-over";
}
function dGrid(ctx,W,H,t,theme){
  bgFill(ctx,W,H,theme);
  const rgb=hexRgb(theme.acc),hor=H*.55;
  for(let i=0;i<40;i++){
    const x=srnd(i)*W,y=srnd(i+80)*hor*.9;
    ctx.fillStyle=`rgba(255,255,255,${.1+.3*srnd(i+7)*(0.5+0.5*Math.sin(t*2+i))})`;
    ctx.fillRect(x,y,1.5,1.5);
  }
  const g=ctx.createLinearGradient(0,hor-H*.18,0,hor);
  g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(1,`rgba(${rgb},.25)`);
  ctx.fillStyle=g;ctx.fillRect(0,hor-H*.18,W,H*.18);
  ctx.strokeStyle=`rgba(${rgb},.8)`;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,hor);ctx.lineTo(W,hor);ctx.stroke();
  ctx.strokeStyle=`rgba(${rgb},.18)`;ctx.lineWidth=1;
  for(let i=-10;i<=10;i++){
    ctx.beginPath();ctx.moveTo(W/2+i*W*.06,hor);ctx.lineTo(W/2+i*W*.6,H);ctx.stroke();
  }
  const ph=(t*.25)%1;
  for(let i=0;i<12;i++){
    const q=(i/12+ph)%1,y=hor+Math.pow(q,2.2)*(H-hor);
    ctx.strokeStyle=`rgba(${rgb},${.05+q*.3})`;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }
}
function drawKeyword(ctx,W,H,t,theme,keywords){
  if(!keywords||!keywords.length)return;
  const CY=4.5,idx=Math.floor(t/CY)%keywords.length,p=(t%CY)/CY;
  const a=p<.12?p/.12:p>.85?(1-p)/.15:1;
  const sc=.94+p*.1;
  const w=String(keywords[idx]||"");
  const fs=Math.min(W*.115,H*.12)*(W<H?1.15:1);
  ctx.save();
  ctx.translate(W/2,H*(W<H?.30:.36));ctx.scale(sc,sc);
  ctx.font=`400 ${fs}px 'Bebas Neue',Impact,sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.globalAlpha=Math.max(0,Math.min(1,a))*.92;
  ctx.shadowColor="rgba(0,0,0,.85)";ctx.shadowBlur=18;ctx.shadowOffsetY=2;
  ctx.fillStyle="#fff";
  ctx.fillText(w,0,0);
  ctx.shadowColor=theme.acc;ctx.shadowBlur=22;ctx.shadowOffsetY=0;
  ctx.fillText(w,0,0);
  ctx.shadowBlur=0;
  const tw=ctx.measureText(w).width;
  ctx.fillStyle=theme.acc;
  ctx.fillRect(-tw/2,fs*.62,tw*Math.min(1,p*1.6),3);
  ctx.restore();
  ctx.globalAlpha=1;
}
function drawScene(ctx,W,H,t,styleId,theme,keywords){
  const fn={aurora:dAurora,particles:dParticles,waves:dWaves,lines:dLines,orbs:dOrbs,grid:dGrid}[styleId]||dAurora;
  fn(ctx,W,H,t,theme);
  drawKeyword(ctx,W,H,t,theme,keywords);
  vignette(ctx,W,H);
}
/* live animated style preview tile */
function VStylePick({id,label,active,onClick,theme}){
  const cr=useRef(null);
  useEffect(()=>{
    const cv=cr.current;if(!cv)return;
    const ctx=cv.getContext("2d");let raf;
    const loop=()=>{drawScene(ctx,240,135,Date.now()/1000,id,theme,null);raf=requestAnimationFrame(loop);};
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[id,theme]);
  return(
    <div className={`vpick${active?" on":""}`} onClick={onClick}>
      <canvas ref={cr} width={240} height={135} style={{width:"100%",display:"block"}}/>
      <div className="vplbl">{label}</div>
    </div>
  );
}

/* ─── CAPTION RENDERING ──────────────────────────────────────── */
function renderCaptions(ctx,words,wi,W,H,style,platform){
  if(!words.length||wi<0||wi>=words.length)return;
  ctx.save();
  const po=platform==="portrait";
  const fs=po?Math.round(W*.072):Math.round(W*.042);

  if(style==="tiktok"){
    const PL=3,ls=Math.floor(wi/PL)*PL,lw=words.slice(ls,Math.min(ls+PL,words.length));
    const y=po?H*.77:H*.81;
    ctx.font=`900 ${fs}px Impact,'Arial Black',Arial`;
    const ws=lw.map(w=>ctx.measureText(w).width);
    const tot=ws.reduce((a,b)=>a+b,0)+fs*.32*(lw.length-1);
    let x=(W-tot)/2;
    lw.forEach((w,i)=>{
      const c=ls+i===wi,pH=fs*.28,pW=fs*.24;
      ctx.fillStyle=c?"#FFE600":"rgba(0,0,0,.78)";
      rr(ctx,x-pW/2,y-fs*.78-pH/2,ws[i]+pW,fs+pH,5);ctx.fill();
      ctx.shadowColor=c?"transparent":"rgba(0,0,0,.5)";ctx.shadowBlur=c?0:5;
      ctx.fillStyle=c?"#000":"#fff";ctx.textBaseline="middle";ctx.textAlign="left";
      ctx.fillText(w,x,y-fs*.28);x+=ws[i]+fs*.32;
    });
  }else if(style==="subtitle"){
    const SH=7,st=Math.max(0,wi-3),ch=words.slice(st,Math.min(words.length,st+SH));
    const y=po?H*.87:H*.89,bH=fs*1.9;
    ctx.fillStyle="rgba(0,0,0,.82)";ctx.fillRect(0,y-bH*.65,W,bH);
    ctx.font=`700 ${fs}px 'DM Sans',Arial`;
    const gap=fs*.3,tot=ch.reduce((a,w)=>a+ctx.measureText(w).width+gap,0);
    let x=(W-tot)/2;
    ch.forEach((w,i)=>{
      const c=st+i===wi;
      ctx.font=`${c?800:600} ${c?fs:fs*.88}px 'DM Sans',Arial`;
      ctx.fillStyle=c?"#FFE600":"rgba(255,255,255,.75)";
      ctx.textBaseline="middle";ctx.textAlign="left";
      ctx.fillText(w,x,y+fs*.12);x+=ctx.measureText(w).width+gap;
    });
  }else if(style==="center"){
    const w=(words[wi]||"").toUpperCase(),cfs=fs*1.55;
    ctx.font=`900 ${cfs}px Impact,'Arial Black',Arial`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.shadowColor="rgba(255,230,0,.7)";ctx.shadowBlur=28;
    ctx.fillStyle="#FFE600";ctx.fillText(w,W/2,po?H*.72:H*.78);ctx.shadowBlur=0;
  }else{
    const PL=4,ls=Math.floor(wi/PL)*PL,lw=words.slice(ls,Math.min(ls+PL,words.length));
    const y=po?H*.85:H*.89,gap=fs*1.32;
    ctx.font=`700 ${fs}px 'DM Sans',Arial`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.shadowColor="rgba(0,0,0,.95)";ctx.shadowBlur=10;
    let x=W/2-(lw.length-1)*gap/2;
    lw.forEach((w,i)=>{
      const c=ls+i===wi;
      ctx.fillStyle=c?"#fff":"rgba(255,255,255,.65)";
      ctx.strokeStyle="rgba(0,0,0,.9)";ctx.lineWidth=4;
      ctx.strokeText(w,x,y);ctx.fillText(w,x,y);x+=gap;
    });
  }
  ctx.restore();
}

/* ─── SCRIPT GENERATION ──────────────────────────────────────── */
/* offline script engine — used automatically when the Claude API
   isn't reachable (i.e. running outside the claude.ai chat) */
/* condense a long prompt into a short natural subject for templates,
   so "chest day in the gym exercises" reads as "chest training" */
function shortSubject(topic){
  const stop=new Set("the a an and or of in on for to with how why what best top guide tips about your you exercises exercise day routine workout".split(" "));
  const words=String(topic).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
  let sub=words.slice(0,2).join(" ")||String(topic).toLowerCase().trim();
  if(/chest|pec/.test(topic))sub="chest training";
  else if(/\bgym|workout|lifting|muscle\b/.test(topic)&&words.length)sub=words[0]+" training";
  return sub;
}
/* ── topical knowledge packs — used when no AI key is set, so even
   the offline floor teaches real, on-topic content (not filler) ── */
const KNOW=[
  {k:["chest","pec","bench press","push up","pushup"],lines:[
    "Your chest is two muscles: the *pectoralis major*, the big fan across your chest, and the smaller *pec minor* underneath.",
    "Train it through its real job: pushing things away and bringing your arms across your body.",
    "[pause] Start with a flat *barbell or dumbbell bench press* — your core mass builder. Control the weight down, drive it up.",
    "Then hit the *incline press* at about thirty degrees. That angle bias hammers the *upper chest* most people are missing.",
    "Add *dumbbell flyes* for the stretch. At the bottom you should feel the chest pulled long — that stretch is where growth lives.",
    "Finish with *dips* or *cable crossovers* to squeeze the inner chest and chase the pump.",
    "Rep range: six to twelve for presses, twelve to fifteen for flyes and cables.",
    "[pause] *However*, the secret isn't the exercise list. It's *progressive overload* — adding a little weight or a rep almost every week.",
    "Push close to failure, leaving one or two reps in the tank. That's the line where muscle is built.",
    "Hit chest hard once or twice a week, eat enough protein, and the size follows.",
  ]},
  {k:["back","lat","row","pull up","pullup","deadlift"],lines:[
    "Your back is a stack of muscles: the *lats* for width, the *traps* and *rhomboids* for thickness, plus *spinal erectors* down the middle.",
    "[pause] Width comes from *pulling down* — pull-ups and lat pulldowns. Drive your elbows toward your hips and feel the lats, not the arms.",
    "Thickness comes from *rowing* — barbell rows, dumbbell rows, cable rows. Pull to your stomach and squeeze the shoulder blades together.",
    "The *deadlift* ties it all together, building the entire posterior chain and raw strength.",
    "Mind-muscle connection matters most here — the back is hard to feel, so slow every rep down.",
    "[pause] *However*, don't ego-lift. Yanking heavy weight with your lower back is how people get hurt. Control wins.",
    "Six to ten reps for rows and pulls, and always train back at least as hard as you train chest.",
  ]},
  {k:["leg","squat","quad","hamstring","glute","calf"],lines:[
    "Leg day trains the biggest muscles you own: *quads* in front, *hamstrings* behind, *glutes*, and *calves*.",
    "The *barbell squat* is king — it builds quads, glutes and core all at once. Sit back and down, drive through your heels.",
    "[pause] *Romanian deadlifts* target the hamstrings and glutes. Push your hips back, feel the stretch, stand tall.",
    "Add *leg press* for volume, *lunges* for balance, and *leg curls* to isolate the hamstrings.",
    "Don't skip *calf raises* — full stretch at the bottom, hard squeeze at the top.",
    "[pause] Legs respond to *depth and effort*. Half-reps build half-legs. Go full range, every set.",
  ]},
  {k:["shoulder","delt","overhead press","lateral raise"],lines:[
    "The shoulder is the *deltoid*, and it has three heads: front, side, and rear.",
    "The *overhead press* builds the front and overall mass — press the bar straight up, lock it out overhead.",
    "[pause] *Lateral raises* are the secret to width — raise the dumbbells out to your sides like wings, lead with the elbows.",
    "Most people forget the *rear delts* — face pulls and reverse flyes fix posture and round the shoulder out.",
    "Lateral and rear work loves higher reps: twelve to twenty, controlled, no swinging.",
    "[pause] *However*, round shoulders come from a *balanced* attack on all three heads — not just pressing.",
  ]},
  {k:["arm","bicep","tricep","curl"],lines:[
    "Big arms are mostly *triceps* — they're two-thirds of your upper arm, not the biceps.",
    "Hit triceps with *close-grip presses, dips, and pushdowns* — lock out hard at the bottom.",
    "[pause] For *biceps*, curls are king: barbell curls for mass, incline dumbbell curls for the stretch, hammer curls for the forearm and thickness.",
    "Keep your elbows pinned to your sides — swinging turns a bicep curl into a shoulder swing.",
    "Arms recover fast, so higher reps and a real squeeze at the peak work best.",
    "[pause] *However*, arms grow from your *heavy* pressing and pulling too — direct work is the finisher, not the whole plan.",
  ]},
  {k:["money","save","invest","budget","wealth","finance","rich"],lines:[
    "Building wealth runs on one boring equation: *spend less than you earn, and invest the gap*.",
    "[pause] First, automate it. The day you get paid, money moves to savings *before* you can touch it. Pay yourself first.",
    "Build an *emergency fund* — three to six months of expenses — so a bad month doesn't become bad debt.",
    "Then *invest the rest*, consistently, into low-cost index funds that own the whole market.",
    "The real magic is *compound interest* — your returns start earning their own returns, and time does the heavy lifting.",
    "[pause] *However*, the fastest win isn't picking stocks — it's *killing high-interest debt*. No investment beats a paid-off credit card.",
    "Boring and consistent beats clever and sporadic, every single time.",
  ]},
  {k:["sleep","insomnia","rest"],lines:[
    "Sleep isn't lost time — it's when your brain *cleans itself* and your body rebuilds.",
    "[pause] Lock a *consistent schedule* — same sleep and wake time, even weekends. Your body craves rhythm.",
    "Kill the light an hour before bed. Screens tell your brain it's daytime and *block melatonin*.",
    "Keep the room *cold and dark* — your core temperature has to drop for deep sleep to start.",
    "Cut caffeine after midday — it lingers in your system for up to ten hours.",
    "[pause] *However*, the biggest lever is *morning sunlight* — it sets your internal clock for the whole day.",
  ]},
  {k:["productiv","focus","procrastinat","habit","discipline"],lines:[
    "Focus isn't willpower — it's *engineering your environment* so the right thing is the easy thing.",
    "[pause] Start with *one* task, not ten. Pick the most important thing and do it first, before the world wakes up.",
    "Use *time blocks* — twenty-five minutes locked in, five minutes off. The brain sprints better than it marathons.",
    "Kill the distractions *before* you start: phone in another room, notifications off, tabs closed.",
    "[pause] *However*, motivation is a myth you can't rely on. *Systems* carry you when motivation is gone.",
    "Small wins stack. Show up daily, and discipline stops being hard — it becomes who you are.",
  ]},
];
function knowledgeScript(topic,dur){
  const t=String(topic).toLowerCase();
  const pack=KNOW.find(p=>p.k.some(k=>t.includes(k)));
  if(!pack)return null;
  const wc=Math.floor((dur/60)*130);
  const out=[];let i=0;
  while(out.join(" ").split(/\s+/).length<wc&&i<pack.lines.length*3){out.push(pack.lines[i%pack.lines.length]);i++;}
  return out.join(" ");
}
function genScriptLocal(topic,style,dur){
  const known=knowledgeScript(topic,dur);
  if(known)return known;
  const wc=Math.floor((dur/60)*130);
  const t=shortSubject(topic);
  const T=t.charAt(0).toUpperCase()+t.slice(1);
  const B={
    motivational:[
      `Stop scrolling. The next sixty seconds are about ${t}, and they might change how you operate.`,
      `Most people never master ${t}. Not because it's hard. Because they quit the second it gets uncomfortable.`,
      `${T} doesn't care how you feel today. It rewards what you do today.`,
      `Here's the truth nobody posts about ${t}: the boring reps are the whole game.`,
      `You don't need motivation. You need a standard. Show up for ${t} even when it's ugly.`,
      `Every single person you admire was once terrible at ${t}. They just refused to stay terrible.`,
      `The gap between who you are and who you want to be is closed by ${t}, daily, without applause.`,
      `One year from now you'll wish you started ${t} today. So start today.`,
      `Discipline around ${t} is a vote for the person you're becoming.`,
      `Nobody is coming to save you. But ${t} will, if you let it.`,
      `Small days stack. Miss one, fine. Miss two, you're building a different identity.`,
      `Make ${t} non-negotiable, like brushing your teeth. Watch your life reorganize around it.`,
    ],
    educational:[
      `Here's what most people get completely wrong about ${t}.`,
      `${T} looks complicated from the outside, but it runs on a few simple rules.`,
      `First: the fundamentals of ${t} matter more than the tricks. Master the boring parts.`,
      `Second: progress in ${t} is invisible at first, then sudden. Most people quit in the invisible phase.`,
      `Third: the fastest way to learn ${t} is to teach it. Explain it out loud and your gaps appear instantly.`,
      `A common myth about ${t} is that talent decides everything. Structured practice beats raw talent.`,
      `If you only remember one thing about ${t}, remember this: consistency compounds.`,
      `Start with twenty focused minutes a day on ${t}. That's seven thousand minutes a year.`,
      `The experts in ${t} aren't smarter. They've just made more mistakes, faster, and written down what they learned.`,
      `So here's your move: pick one piece of ${t}, practice it this week, and review what happened.`,
    ],
    facts:[
      `Here are facts about ${t} that sound fake but aren't.`,
      `Most people interact with ${t} every week without realizing how deep it goes.`,
      `The history of ${t} is older than almost anyone guesses, and the early versions looked nothing like today.`,
      `Experts who study ${t} disagree about plenty, but they agree the public underestimates it.`,
      `There's a measurable link between ${t} and how people focus, spend, and decide.`,
      `Some of the biggest breakthroughs in ${t} came from complete accidents.`,
      `In the last decade alone, ${t} has changed more than in the previous fifty years.`,
      `The economics behind ${t} move billions every single year.`,
      `And the strangest part about ${t}? The more you learn, the stranger it gets.`,
      `Follow for more facts that make you the most interesting person in the room.`,
    ],
    story:[
      `Let me tell you a story about ${t}.`,
      `A few years ago, someone ordinary decided ${t} would not stay a someday thing.`,
      `The first attempt failed. Publicly. The kind of failure people screenshot.`,
      `But failure left instructions behind, for anyone humble enough to read them.`,
      `So they rebuilt. Smaller this time. Quieter. Daily.`,
      `Weeks of nothing. Then a flicker. Then a streak. Then momentum that felt like luck but wasn't.`,
      `${T} turned out to be a door, and consistency was the key the whole time.`,
      `A year later, the people who laughed were asking for advice.`,
      `The lesson isn't about ${t} at all. It's that beginnings are supposed to look embarrassing.`,
      `Yours will too. Start anyway.`,
    ],
    news:[
      `Tonight's report: ${t}, and why it matters more than ever.`,
      `Across the board, attention on ${t} has surged, and analysts say this is just the beginning.`,
      `Sources close to the industry report rapid shifts in how ${t} is practiced, funded, and discussed.`,
      `Critics warn of hype. Supporters point to results. Both agree the landscape is moving fast.`,
      `For everyday people, the impact of ${t} shows up in small ways first, then suddenly everywhere.`,
      `Experts recommend learning the basics of ${t} now, before the curve steepens.`,
      `The numbers tell a clear story: engagement with ${t} keeps climbing quarter over quarter.`,
      `What happens next with ${t} depends on choices being made right now.`,
      `We'll keep following this story as it develops.`,
      `For now, one thing is certain: ${t} is no longer optional knowledge.`,
    ],
  };
  const bank=B[style]||B.motivational;
  const out=[];let i=0;
  while(out.join(" ").split(/\s+/).length<wc){out.push(bank[i%bank.length]);i++;if(i>60)break;}
  return out.join(" ");
}
async function genScript(topic,style,dur,onProg){
  try{
    const t=await genScriptAI(topic,style,dur,onProg);
    genScript.engine=llmText.engine||"AI";
    return t;
  }catch(e){
    const known=/chest|pec|back|lat|leg|squat|shoulder|delt|arm|bicep|tricep|money|save|invest|budget|sleep|productiv|focus|habit|discipline/i.test(topic);
    genScript.engine=(e&&e.message==="NO_AI_KEY")
      ?(known?"built-in knowledge pack — add a free Gemini key in Connect for fully custom scripts":"TEMPLATE ONLY — no AI key set. Add a free Gemini key in Connect so scripts are written about YOUR topic")
      :"offline templates (AI unreachable: "+((e&&e.message)||"error")+")";
    genScript.noKey=(e&&e.message==="NO_AI_KEY"&&!known);
    return genScriptLocal(topic,style,dur);
  }
}
async function genScriptAI(topic,style,dur,onProg){
  const wc=Math.floor((dur/60)*130);
  const sg={
    motivational:"High energy, short punchy lines. Make people feel unstoppable.",
    educational:"Teach something genuinely surprising and useful.",
    facts:`Share ${Math.floor(dur/12)} mind-blowing facts people don't know.`,
    story:"Compelling micro-story with narrative arc and insight.",
    news:"Professional broadcast anchor tone. Clear and authoritative.",
  };
  const t=await llmText(`You are scripting a faceless ${dur}-second short video.
TOPIC: "${topic}"
Write the actual INFORMATIVE voiceover a viewer wants to hear about this topic — real substance, specifics, facts, steps or insights. Teach or reveal something.
Do NOT restate, define, or repeat the topic phrase. Never say "${topic}" back as filler. Jump straight into valuable content.
Example: topic "chest day gym exercises" → talk about the pecs (major/minor), incline vs flat pressing, the stretch at the bottom of a fly, progressive overload — NOT "chest day is about training chest."
STYLE: ${sg[style]||sg.motivational}
LENGTH: ~${wc} words. Hook in the first 5 words. Short punchy spoken sentences. Conversational, not listy. End with a strong line.
DELIVERY MARKS: wrap 4-8 of the most powerful words in *asterisks* for vocal stress; put [pause] before dramatic turns (example: "...a hard place. [pause] *However*, hard lives create hard men"). Use sparingly.
Output ONLY the script text — no title, no preamble, no quotes.`,Math.min(4000,400+Math.ceil(wc*1.8)),onProg);
  if(!t)throw new Error("Empty AI response.");
  return t.trim();
}

/* ─── MEDIA ENGINE — real stock footage & photos ─────────────────
   Sources (all free):
   · Pexels    — video clips + photos, free API key (pexels.com/api)
   · Pixabay   — video clips + photos, free API key (pixabay.com/api/docs)
   · Openverse — CC photos, NO key needed
   · Wikimedia — photos, NO key needed
   Everything is blob-fetched so the canvas stays clean and the
   final video can be recorded. Sources that fail are skipped.   */
async function blobFetch(url,ms=15000){
  const ac=new AbortController();const to=setTimeout(()=>ac.abort(),ms);
  try{
    const r=await fetch(url,{signal:ac.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.blob();
  }finally{clearTimeout(to);}
}
/* ╔══════════════════════════════════════════════════════════════╗
   ║  OWNER KEYS — PASTE YOUR API KEYS BETWEEN THE QUOTES BELOW,   ║
   ║  THEN DEPLOY. Every visitor to your site gets working footage ║
   ║  with ZERO setup. Users can still override these in Connect.  ║
   ║  All free:                                                    ║
   ║   pexels    → pexels.com/api                                  ║
   ║   pixabay   → pixabay.com/api/docs                            ║
   ║   googleKey → developers.google.com/custom-search/v1/overview ║
   ║   googleCx  → programmablesearchengine.google.com             ║
   ║  Keys in a static site are visible to visitors — normal for   ║
   ║  free media keys; restrict the Google key to your domain      ║
   ║  (HTTP referrer) in Google Cloud Console.                     ║
   ╚══════════════════════════════════════════════════════════════╝ */
const OWNER_KEYS={
  pexels:"",
  pixabay:"",
  googleKey:"",
  googleCx:"",
  /* OAuth "Web application" Client ID from console.cloud.google.com →
     enables REAL YouTube auto-upload for all users. Enable "YouTube
     Data API v3", add your domain to Authorized JavaScript origins. */
  googleClientId:"",
  /* Google Gemini key — FREE at aistudio.google.com/apikey. This gives
     the standalone app a real AI brain for scripts, titles and
     descriptions (without it, offline templates are used). */
  gemini:"",
};
function getKey(slot,owner){
  const v=String(LS.get(slot)||"").replace(/\s+/g,"");
  return v||String(owner||"").replace(/\s+/g,"");
}
/* per-source diagnostics so "it doesn't work" is never a mystery */
const SRC_STATUS={};
function markSrc(name,ok,info){SRC_STATUS[name]={ok,info:String(info||"")};}
function explainErr(e){
  const m=String((e&&e.message)||e||"");
  if(/Failed to fetch|NetworkError|load failed|abort/i.test(m))return "network blocked (sandbox/CORS/offline)";
  return m||"unknown error";
}
/* ── unified LLM: Claude (inside chat) → Google Gemini (free key,
   works everywhere) → caller's offline fallback. This is what makes
   scripts/descriptions intelligent in the standalone index.html.  */
function stripFence(t){
  let x=String(t||"").trim();
  x=x.replace(/^[a-zA-Z]*\n/,"");          /* leading ```json fence handled below */
  const fence=String.fromCharCode(96,96,96); /* ``` without typing backticks */
  while(x.indexOf(fence)!==-1)x=x.replace(fence,"");
  return x.replace(/^json/i,"").trim();
}
/* ── LOCAL AI (WebLLM) — runs an LLM IN THE BROWSER via WebGPU.
   No server, no Anthropic, no per-request cost. First use downloads
   the model (~1GB, cached after). Requires a WebGPU browser (Chrome/
   Edge 113+, or Safari 18+). Falls back to Gemini/templates if absent. */
let _webllm=null,_webllmLoading=null;
function webllmAvailable(){return typeof navigator!=="undefined"&&!!navigator.gpu;}
async function getWebLLM(onProg){
  if(_webllm)return _webllm;
  if(_webllmLoading)return _webllmLoading;
  if(!webllmAvailable())throw new Error("no-webgpu");
  _webllmLoading=(async()=>{
    const _imp=new Function("u","return import(u)");
    const mod=await _imp("https://esm.run/@mlc-ai/web-llm");
    const model=LS.get("av_localmodel")||"Llama-3.2-3B-Instruct-q4f32_1-MLC";
    const engine=await mod.CreateMLCEngine(model,{initProgressCallback:p=>{onProg&&onProg(p.text||("Loading local AI "+Math.round((p.progress||0)*100)+"%"));}});
    _webllm=engine;return engine;
  })();
  return _webllmLoading;
}
async function llmLocal(prompt,maxTokens,onProg){
  const eng=await getWebLLM(onProg);
  const r=await eng.chat.completions.create({messages:[{role:"user",content:prompt}],max_tokens:maxTokens,temperature:0.9});
  return (r?.choices?.[0]?.message?.content||"").trim();
}
async function llmText(prompt,maxTokens=800,onProg){
  /* 1) LOCAL in-browser model — preferred, fully offline after first load */
  if(getKey("av_use_local","")!=="off"&&webllmAvailable()){
    try{
      const t=await llmLocal(prompt,maxTokens,onProg);
      if(t){llmText.engine="Local AI (in-browser)";return t;}
    }catch(e){ if(String(e.message)!=="no-webgpu"){/* fall through */} }
  }
  /* 2) Claude — only reachable inside the claude.ai preview */
  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
    });
    if(r.ok){
      const d=await r.json();
      const t=(d?.content||[]).map(c=>c.text||"").join("").trim();
      if(t){llmText.engine="Claude";return t;}
    }
  }catch{}
  /* 3) Gemini — free key, works anywhere */
  const gk=getKey("av_gemini_key",OWNER_KEYS.gemini);
  if(gk){
    /* try current free-tier models in order (names change over time) */
    const models=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-flash-latest","gemini-2.0-flash"];
    let lastErr="";
    for(const m of models){
      try{
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{
          method:"POST",
          headers:{"Content-Type":"application/json","x-goog-api-key":gk},
          body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:maxTokens,temperature:0.9}})
        });
        if(r.status===404){lastErr="model "+m+" not found";continue;}   /* try next model */
        if(!r.ok){
          lastErr="Gemini HTTP "+r.status+(r.status===400?" — API key invalid (re-copy from aistudio.google.com/apikey)":r.status===429?" — daily free quota reached, try later":"");
          if(r.status===400||r.status===403)throw new Error(lastErr);   /* key problem: stop */
          continue;
        }
        const d=await r.json();
        const t=(d?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").trim();
        if(t){llmText.engine="Gemini ("+m+")";return t;}
        lastErr="empty response";
      }catch(e){lastErr=e.message;if(/invalid|403/.test(e.message))throw e;}
    }
    throw new Error(lastErr||"Gemini unreachable");
  }
  throw new Error("NO_AI_KEY");
}
const httpHint=(name,st)=>"HTTP "+st+(st===401||st===403
  ?` — key invalid or unauthorized; re-copy it (${name==="Google"?"and check daily quota":"no spaces"})`
  :st===429?" — rate limit, wait a minute":st===400&&name==="Google"?" — engine ID wrong, or Image search not enabled on the engine":"");
async function srcPexels(q,key,plat){
  key=String(key||"").replace(/\s+/g,"");
  if(!key){markSrc("Pexels",false,"no key set");return[];}
  const H={Authorization:key},o=plat==="portrait"?"portrait":"landscape",out=[];
  try{
    const rv=await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=5&orientation=${o}`,{headers:H});
    if(!rv.ok)markSrc("Pexels",false,httpHint("Pexels",rv.status));
    if(rv.ok){const d=await rv.json();(d.videos||[]).forEach(v=>{
      const fs=(v.video_files||[]).filter(f=>f.width&&f.width<=1280).sort((a,b)=>b.width-a.width);
      const f=fs[0]||(v.video_files||[])[0];
      if(f?.link)out.push({kind:"video",src:f.link,thumb:v.image,credit:`Pexels${v.user?.name?" · "+v.user.name:""}`,meta:q,trusted:true});
    });}
  }catch(e){markSrc("Pexels",false,explainErr(e));}
  try{
    const rp=await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=6&orientation=${o}`,{headers:H});
    if(rp.ok){const d=await rp.json();(d.photos||[]).forEach(p=>{
      const u=p.src?.large2x||p.src?.large;
      if(u)out.push({kind:"image",src:u,thumb:p.src?.medium||p.src?.small,fallback:p.src?.medium,credit:`Pexels${p.photographer?" · "+p.photographer:""}`,meta:q+" "+(p.alt||""),trusted:true});
    });}
  }catch(e){markSrc("Pexels",false,explainErr(e));}
  if(out.length)markSrc("Pexels",true,out.length+" results");
  return out;
}
async function srcPixabay(q,key,plat){
  key=encodeURIComponent(String(key||"").replace(/\s+/g,""));
  if(!key){markSrc("Pixabay",false,"no key set");return[];}
  const out=[];
  try{
    const rv=await fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=5&safesearch=true`);
    if(rv.ok){const d=await rv.json();(d.hits||[]).forEach(h=>{
      const f=h.videos?.medium||h.videos?.small;
      if(f?.url)out.push({kind:"video",src:f.url,thumb:h.videos?.tiny?.thumbnail,credit:"Pixabay",meta:q+" "+(h.tags||""),trusted:true});
    });}
  }catch{}
  try{
    const o=plat==="portrait"?"vertical":"horizontal";
    const rp=await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&per_page=8&orientation=${o}&image_type=photo&safesearch=true`);
    if(rp.ok){const d=await rp.json();(d.hits||[]).forEach(h=>{
      const u=h.largeImageURL||h.webformatURL;
      if(u)out.push({kind:"image",src:u,thumb:h.previewURL||h.webformatURL,fallback:h.webformatURL,credit:"Pixabay",meta:q+" "+(h.tags||""),trusted:true});
    });}
  }catch(e){markSrc("Pixabay",false,explainErr(e));}
  markSrc("Pixabay",out.length>0,out.length?out.length+" results":(SRC_STATUS["Pixabay"]&&SRC_STATUS["Pixabay"].info)||"0 results — key may be wrong");
  return out;
}
async function srcOpenverse(q){
  const out=[];
  try{
    const r=await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=8`);
    if(r.ok){const d=await r.json();(d.results||[]).forEach(x=>{
      if(x.url)out.push({kind:"image",src:x.url,thumb:x.thumbnail,fallback:x.thumbnail,credit:`${x.source||"Openverse"}${x.creator?" · "+x.creator:""} (${x.license||"cc"})`,meta:(x.title||"")+" "+(((x.tags||[]).map(t=>t&&t.name).filter(Boolean)).join(" "))});
    });}
  }catch{}
  return out;
}
async function srcWikimedia(q){
  const out=[];
  try{
    const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:`filetype:bitmap ${q}`,gsrnamespace:"6",gsrlimit:"8",prop:"imageinfo",iiprop:"url",iiurlwidth:"1024",format:"json",origin:"*"});
    const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);
    if(r.ok){const d=await r.json();Object.values(d?.query?.pages||{}).forEach(pg=>{
      const ii=pg.imageinfo?.[0];
      if(ii?.thumburl)out.push({kind:"image",src:ii.thumburl,thumb:ii.thumburl,credit:"Wikimedia Commons",meta:pg.title||""});
    });}
  }catch{}
  return out;
}
/* Google Programmable Search (Custom Search JSON API) —
   the legitimate "Google Images" route: free key, 100 searches/day.
   Bing's image API was retired by Microsoft in Aug 2025, and search
   sites can't be scraped from a browser (CORS), so Google CSE is the
   real search-engine option. */
async function srcGoogleCSE(q,key,cx){
  key=String(key||"").replace(/\s+/g,"");cx=String(cx||"").replace(/\s+/g,"");
  if(!key||!cx){markSrc("Google",false,!key&&!cx?"no key set":"missing "+(key?"engine ID (cx)":"API key"));return[];}
  const out=[];
  try{
    const r=await fetch(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&searchType=image&num=10&safe=active`);
    if(!r.ok)markSrc("Google",false,httpHint("Google",r.status));
    if(r.ok){markSrc("Google",true,"");const d=await r.json();(d.items||[]).forEach(it=>{
      if(it.link)out.push({kind:"image",src:it.link,thumb:it.image?.thumbnailLink,fallback:it.image?.thumbnailLink,credit:`Google · ${it.displayLink||""}`,meta:q+" "+(it.title||""),trusted:true});
    });}
  }catch(e){markSrc("Google",false,explainErr(e));}
  if(out.length)markSrc("Google",true,out.length+" results");
  return out;
}
/* ─── REAL AUTO-POSTING ──────────────────────────────────────────
   YouTube: genuine browser-side upload via Google OAuth (token flow,
   no server). Owner sets a Client ID once; users click Authorize.
   Default quota ≈ 6 uploads/day. Works on http(s) origins (your
   domain or localhost) — Google blocks file:// and this sandbox.
   Instagram: Graph API publishing — Meta requires the video at a
   PUBLIC URL (it downloads server-side), so a URL field is provided.
─────────────────────────────────────────────────────────────────── */
let _gsiP=null;
function loadGsi(){
  try{
    if(typeof window!=="undefined"&&window.google&&window.google.accounts&&window.google.accounts.oauth2)return Promise.resolve(true);
  }catch{}
  if(_gsiP)return _gsiP;
  _gsiP=new Promise(res=>{
    try{
      const sc=document.createElement("script");
      sc.src="https://accounts.google.com/gsi/client";
      sc.onload=()=>res(true);sc.onerror=()=>res(false);
      document.head.appendChild(sc);
      setTimeout(()=>res(false),10000);
    }catch{res(false);}
  });
  return _gsiP;
}
function ytToken(){
  try{const t=JSON.parse(LS.get("av_yt_token")||"null");return(t&&t.expiry>Date.now()+60000)?t.token:null;}catch{return null;}
}
async function ytAuthorize(){
  const cid=getKey("av_yt_client",OWNER_KEYS.googleClientId);
  if(!cid)throw new Error("No YouTube Client ID set — add it in Connect");
  const ok=await loadGsi();
  if(!ok)throw new Error("Google sign-in is blocked here — run the app on your domain or localhost");
  return new Promise((res,rej)=>{
    try{
      const tc=window.google.accounts.oauth2.initTokenClient({
        client_id:cid,
        scope:"https://www.googleapis.com/auth/youtube.upload",
        callback:r=>{
          if(r&&r.access_token){
            LS.set("av_yt_token",JSON.stringify({token:r.access_token,expiry:Date.now()+((r.expires_in||3500)*1000)}));
            res(r.access_token);
          }else rej(new Error((r&&r.error)||"Authorization cancelled"));
        },
      });
      tc.requestAccessToken();
    }catch(e){rej(e);}
  });
}
async function ytUpload(blob,meta,onProg){
  let token=ytToken();
  if(!token)token=await ytAuthorize();
  onProg&&onProg("Starting YouTube upload");
  const init=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Upload-Content-Length":String(blob.size),"X-Upload-Content-Type":blob.type||"video/webm"},
    body:JSON.stringify({
      snippet:{title:String(meta.title||"Autoviral video").slice(0,100),description:String(meta.description||""),tags:(meta.tags||[]).map(t=>String(t).replace(/^#/,"")).slice(0,15),categoryId:"22"},
      status:{privacyStatus:meta.privacy||"public",selfDeclaredMadeForKids:false}
    })
  });
  if(init.status===401){LS.del("av_yt_token");throw new Error("YouTube session expired — try again to re-authorize");}
  if(!init.ok)throw new Error("YouTube rejected the upload (HTTP "+init.status+(init.status===403?" — quota used or API not enabled":"")+")");
  const loc=init.headers.get("Location")||init.headers.get("location");
  if(!loc)throw new Error("YouTube didn't return an upload URL");
  onProg&&onProg("Uploading "+(blob.size/1024/1024).toFixed(1)+" MB to YouTube");
  const up=await fetch(loc,{method:"PUT",headers:{"Content-Type":blob.type||"video/webm"},body:blob});
  if(!up.ok)throw new Error("YouTube upload failed (HTTP "+up.status+")");
  const v=await up.json();
  return v&&v.id?v:Promise.reject(new Error("Upload finished but no video ID returned"));
}
async function igPublish({igUserId,accessToken,videoUrl,caption},onProg){
  if(!igUserId||!accessToken)throw new Error("Instagram User ID + access token required (Connect screen)");
  if(!videoUrl)throw new Error("Instagram needs a PUBLIC video URL — Meta downloads it server-side");
  onProg&&onProg("Creating Instagram media container");
  const cr=await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media`,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({media_type:"REELS",video_url:videoUrl,caption:caption||"",access_token:accessToken})
  });
  const cd=await cr.json().catch(()=>({}));
  if(!cr.ok||cd.error)throw new Error("Instagram container failed: "+((cd.error&&cd.error.message)||("HTTP "+cr.status)));
  for(let i=1;i<=30;i++){
    await new Promise(r=>setTimeout(r,4000));
    onProg&&onProg("Instagram processing the video ("+(i*4)+"s)");
    const st=await fetch(`https://graph.facebook.com/v19.0/${cd.id}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`);
    const sd=await st.json().catch(()=>({}));
    if(sd.status_code==="FINISHED")break;
    if(sd.status_code==="ERROR")throw new Error("Instagram couldn't process that URL — must be a public, direct MP4 link");
    if(i===30)throw new Error("Instagram processing timed out");
  }
  onProg&&onProg("Publishing Reel");
  const pb=await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media_publish`,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({creation_id:cd.id,access_token:accessToken})
  });
  const pd=await pb.json().catch(()=>({}));
  if(!pb.ok||pd.error)throw new Error("Instagram publish failed: "+((pd.error&&pd.error.message)||("HTTP "+pb.status)));
  return pd;
}
async function loadSeg(c,i){
  const blob=await blobFetch(c.src);
  const url=URL.createObjectURL(blob);
  if(c.kind==="video"){
    const v=document.createElement("video");
    v.src=url;v.muted=true;v.loop=true;v.playsInline=true;
    await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error("video load"));setTimeout(()=>rej(new Error("timeout")),15000);});
    try{await v.play();}catch{}
    return{kind:"video",el:v,w:v.videoWidth,h:v.videoHeight,seed:i+1,credit:c.credit,thumbUrl:url};
  }
  const img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("img load"));img.src=url;setTimeout(()=>rej(new Error("timeout")),10000);});
  return{kind:"image",el:img,w:img.naturalWidth,h:img.naturalHeight,seed:i+1,credit:c.credit,thumbUrl:url};
}
/* user-uploaded media → segments; works everywhere incl. sandboxed previews */
async function filesToSegments(files,startIdx=0){
  const segs=[];
  for(let i=0;i<files.length&&segs.length<10;i++){
    const f=files[i];
    try{
      const url=URL.createObjectURL(f);
      if(f.type&&f.type.startsWith("video")){
        const v=document.createElement("video");
        v.src=url;v.muted=true;v.loop=true;v.playsInline=true;
        await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error("video load"));setTimeout(()=>rej(new Error("timeout")),15000);});
        try{await v.play();}catch{}
        segs.push({kind:"video",el:v,w:v.videoWidth,h:v.videoHeight,seed:startIdx+segs.length+1,credit:"Your upload",thumbUrl:url});
      }else if(f.type&&f.type.startsWith("image")){
        const img=new Image();
        await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("img load"));img.src=url;});
        segs.push({kind:"image",el:img,w:img.naturalWidth,h:img.naturalHeight,seed:startIdx+segs.length+1,credit:"Your upload",thumbUrl:url});
      }
    }catch{}
  }
  return segs;
}
async function srcCommonsVideo(q){
  const out=[];
  try{
    const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:`filetype:video ${q}`,gsrnamespace:"6",gsrlimit:"6",prop:"imageinfo",iiprop:"url|size|mime",format:"json",origin:"*"});
    const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);
    if(r.ok){const d=await r.json();Object.values(d?.query?.pages||{}).forEach(pg=>{
      const ii=pg.imageinfo?.[0];
      if(!ii?.url)return;
      if(ii.size&&ii.size>40*1024*1024)return; /* skip huge files */
      if(!/\.(webm|ogv|mp4)$/i.test(ii.url))return;
      out.push({kind:"video",src:ii.url,credit:"Wikimedia Commons",meta:pg.title||""});
    });}
  }catch{}
  return out;
}
/* ── visual query planning ──
   The script's frequent words make terrible image queries ("person",
   "because"). Instead we plan concrete VISUAL queries from the topic:
   via Claude when reachable, via a niche dictionary offline.        */
const NICHE_Q={
  gym:["gym workout","weightlifting barbell","dumbbell training","athlete running track"],
  fitness:["gym workout","athlete running","stretching exercise"],
  workout:["gym workout","weightlifting barbell","push ups training"],
  muscle:["bodybuilder training","weightlifting barbell"],
  money:["counting cash money","stock market chart screen","city skyline finance"],
  finance:["stock market chart screen","counting cash money","financial documents desk"],
  invest:["stock market chart screen","bull statue wall street"],
  crypto:["bitcoin coins","trading chart screen"],
  food:["chef cooking kitchen","fresh ingredients vegetables","restaurant plate dish"],
  cooking:["chef cooking kitchen","frying pan stove","chopping vegetables"],
  travel:["airplane window wing","tropical beach palm","city street travel"],
  meditation:["meditation sunrise silhouette","calm lake morning","yoga pose outdoor"],
  mindfulness:["meditation sunrise silhouette","calm lake morning","breathing fresh air"],
  study:["student studying library","writing notebook desk","stack of books"],
  learning:["student studying library","writing notebook desk"],
  tech:["programmer coding laptop","server room datacenter","circuit board closeup"],
  ai:["futuristic technology abstract","robot artificial intelligence","data center servers"],
  coding:["programmer coding laptop","code on screen dark"],
  nature:["forest sunlight trees","ocean waves aerial","mountain landscape"],
  business:["business meeting office","handshake deal suit","entrepreneur laptop cafe"],
  startup:["startup office team","whiteboard planning meeting"],
  motivation:["athlete sunrise training","mountain climber summit","runner determination road"],
  discipline:["athlete sunrise training","cold morning run","boxer training gym"],
  success:["mountain summit victory","city skyline sunrise","trophy celebration"],
  mindset:["chess board strategy","sunrise meditation","climber focus"],
  sleep:["person sleeping bed","dark calm bedroom","alarm clock morning"],
  shower:["cold water shower","water splash closeup"],
  cold:["ice bath winter","cold water swimming","frozen lake winter"],
  stoic:["greek statue marble","ancient ruins columns","old books candlelight"],
  philosophy:["greek statue marble","old library books","thinking man statue"],
  car:["sports car driving road","car engine detail","night highway lights"],
  gaming:["esports gaming setup neon","game controller closeup","pc gaming room"],
  history:["ancient ruins stone","vintage old map","museum artifacts"],
  space:["galaxy stars night sky","rocket launch","astronaut spacewalk"],
  phone:["person scrolling smartphone","smartphone screen dark","social media apps screen"],
  dopamine:["person scrolling smartphone","neon lights night city","junk food closeup"],
  morning:["sunrise window bedroom","coffee journaling morning","making bed morning"],
  habit:["journaling notebook coffee","calendar planner desk","running shoes door"],
  routine:["sunrise window bedroom","coffee journaling morning"],
};
const QSTOP=new Set("the a an and of in on for to with how why what your you best top guide tips about every day daily".split(" "));
function topicTokens(t){return String(t).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>2&&!QSTOP.has(w));}
function offlineVisualQueries(topic){
  const t=topic.toLowerCase();
  const hits=[];
  for(const k in NICHE_Q)if(t.includes(k))hits.push(...NICHE_Q[k]);
  const base=topicTokens(topic).join(" ")||topic;
  return [...new Set([base,...hits])].slice(0,5);
}
async function genVisualQueries(topic,style){
  try{
    const t=await llmText(`Video topic: "${topic}" (${style} style). Give 5 stock-footage search queries: concrete visual subjects a camera can film, 2-3 words each, directly depicting the topic's subject. Reply ONLY a JSON array of strings.`,200);
    const arr=JSON.parse(stripFence(t));
    if(Array.isArray(arr)&&arr.length)return [...new Set([topicTokens(topic).join(" ")||topic,...arr.map(String)])].slice(0,6);
  }catch{}
  return offlineVisualQueries(topic);
}
/* relevance: trusted sources (Pexels/Pixabay) tag-search well; for the
   free full-text sources we score title/tags against the queries and
   REJECT anything with zero overlap — random photos are worse than none */
function relScore(c,tokens){
  if(c.trusted)return 3;
  const m=String(c.meta||"").toLowerCase();
  let n=0;for(const t of tokens)if(new RegExp("\\b"+t+"\\b").test(m))n++;
  return n;
}
async function gatherMedia(topic,queries,plat,onProg,target=6){
  const px=getKey("av_pexels_key",OWNER_KEYS.pexels),pb=getKey("av_pixabay_key",OWNER_KEYS.pixabay);
  const gk=getKey("av_gcse_key",OWNER_KEYS.googleKey),gx=getKey("av_gcse_cx",OWNER_KEYS.googleCx);
  const qs=[...new Set([...(queries&&queries.length?queries:[topic])])].slice(0,5);
  const tokens=[...new Set(qs.flatMap(topicTokens))];
  let cands=[];
  for(const q of qs){
    onProg&&onProg(`Searching footage: "${q}"`);
    const batches=await Promise.all([srcPexels(q,px,plat),srcPixabay(q,pb,plat),srcGoogleCSE(q,gk,gx),srcCommonsVideo(q),srcOpenverse(q),srcWikimedia(q)]);
    batches.forEach(b=>cands.push(...b));
    const good=cands.filter(c=>relScore(c,tokens)>0);
    if(good.filter(c=>c.kind==="video").length>=4&&good.length>=Math.max(10,target))break;
  }
  const seen=new Set();
  cands=cands.filter(c=>c.src&&!seen.has(c.src)&&seen.add(c.src));
  cands.forEach(c=>{c._s=relScore(c,tokens);});
  cands=cands.filter(c=>c._s>0);
  cands.sort((a,b)=>((b.kind==="video"?1:0)-(a.kind==="video"?1:0))||(b._s-a._s));
  const segs=[];
  for(const c of cands){
    if(segs.length>=target)break;
    onProg&&onProg(`Downloading ${c.kind} ${segs.length+1} of ${target}`);
    try{segs.push(await loadSeg(c,segs.length));}
    catch{
      if(c.fallback){try{segs.push(await loadSeg({...c,src:c.fallback},segs.length));}catch{}}
    }
  }
  return segs;
}
/* footage renderer: cover-fit, Ken Burns on photos, crossfades, caption-legibility gradients */
function drawSeg(ctx,seg,W,H,p){
  const el=seg.el,iw=seg.w,ih=seg.h;
  if(!el||!iw||!ih)return;
  const z=seg.kind==="image"?1.08+0.10*p:1.03;
  const sc=Math.max(W/iw,H/ih)*z;
  const dw=iw*sc,dh=ih*sc;
  const dx=(W-dw)/2+(seg.kind==="image"?Math.sin(seg.seed*7)*(dw-W)*.18*(p-.5):0);
  const dy=(H-dh)/2+(seg.kind==="image"?Math.cos(seg.seed*5)*(dh-H)*.18*(p-.5):0);
  try{ctx.drawImage(el,dx,dy,dw,dh);}catch{}
}
function drawMedia(ctx,W,H,t,segments,SEG){
  ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
  const FT=.5;
  const phase=t/SEG,i=Math.floor(phase)%segments.length,sec=(phase-Math.floor(phase))*SEG;
  drawSeg(ctx,segments[i],W,H,sec/SEG);
  const rem=SEG-sec;
  if(rem<FT&&segments.length>1){
    const j=(Math.floor(phase)+1)%segments.length;
    ctx.save();ctx.globalAlpha=Math.min(1,1-rem/FT);drawSeg(ctx,segments[j],W,H,0);ctx.restore();
  }
  let g=ctx.createLinearGradient(0,0,0,H*.28);
  g.addColorStop(0,"rgba(0,0,0,.45)");g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H*.28);
  g=ctx.createLinearGradient(0,H*.62,0,H);
  g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.55)");
  ctx.fillStyle=g;ctx.fillRect(0,H*.62,W,H*.38);
}

/* ─── TITLE SUGGESTIONS ──────────────────────────────────────── */
function suggestTitles(topic,dur){
  const T=String(topic||"").trim().replace(/^\w/,c=>c.toUpperCase());
  const secs=dur?Math.round(dur)+" Seconds":"60 Seconds";
  return[
    `${T}: What Nobody Tells You`,
    `The Truth About ${T}`,
    `Why ${T} Changes Everything`,
    `${T} — Watch This Before You Start`,
    `How ${T} Rewires Your Brain`,
    `${T} Explained in ${secs}`,
    `STOP Ignoring ${T}`,
    `${T} Is Not What You Think`,
  ];
}
async function genTitlesAI(topic,script){
  try{
    const t=await llmText(`Topic: "${topic}". Script excerpt: "${String(script).slice(0,400)}". Write 6 viral, curiosity-driven video titles under 70 chars that promise the video's actual value (not just repeating the topic). Reply ONLY a JSON array of strings.`,300);
    const arr=JSON.parse(stripFence(t));
    if(Array.isArray(arr)&&arr.length)return arr.map(String);
  }catch{}
  return suggestTitles(topic);
}

/* ─── THUMBNAIL RENDERER — image + bold text bars ────────────── */
function renderThumbCanvas(seg,text,theme){
  const W=1280,H=720,cv=document.createElement("canvas");
  cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");
  ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
  if(seg&&seg.el&&seg.w&&seg.h){
    const sc=Math.max(W/seg.w,H/seg.h),dw=seg.w*sc,dh=seg.h*sc;
    try{ctx.drawImage(seg.el,(W-dw)/2,(H-dh)/2,dw,dh);}catch{}
  }else if(theme){
    const g=ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,theme.bg0);g.addColorStop(1,theme.bg1);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  let g2=ctx.createLinearGradient(0,H*.32,0,H);
  g2.addColorStop(0,"rgba(0,0,0,0)");g2.addColorStop(1,"rgba(0,0,0,.8)");
  ctx.fillStyle=g2;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=(theme&&theme.acc)||"#FFE600";ctx.lineWidth=12;
  ctx.strokeRect(6,6,W-12,H-12);
  const t=String(text||"").trim().toUpperCase();
  if(t){
    ctx.font="700 92px 'Space Grotesk',Impact,sans-serif";
    const words=t.split(/\s+/),lines=[];let cur="";
    for(const w of words){const tr=cur?cur+" "+w:w;if(ctx.measureText(tr).width>W*.72&&cur){lines.push(cur);cur=w;}else cur=tr;}
    if(cur)lines.push(cur);
    const lh=110;let y=H-52-(Math.min(lines.length,3)-1)*lh;
    lines.slice(0,3).forEach(line=>{
      const tw=ctx.measureText(line).width;
      ctx.fillStyle="rgba(255,230,0,.97)";
      ctx.fillRect(50,y-80,tw+40,100);
      ctx.fillStyle="#0a0a0a";
      ctx.fillText(line,70,y);
      y+=lh;
    });
  }
  return cv;
}

/* ─── AI METADATA (title / description / hashtags) ───────────── */
async function genMeta(topic,script){
  try{
    const raw=await llmText(`Video topic: "${topic}". Actual script: "${String(script).slice(0,600)}"
Write metadata that reflects what the script actually SAYS (specific, not generic). Hashtags must be relevant to the real subject. Reply ONLY raw JSON, no markdown:
{"title":"viral YouTube title under 90 chars","description":"2-3 sentence YouTube description summarizing the real content","hashtags":["#specific","#relevant","#tags","#here","#now"],"igCaption":"punchy Instagram caption under 150 chars"}`,600);
    return JSON.parse(stripFence(raw));
  }catch{
    return{title:topic,description:`A video about ${topic}.`,hashtags:["#shorts","#viral","#"+topic.replace(/\s+/g,"").toLowerCase()],igCaption:topic};
  }
}

/* ─── FREE RECORDABLE TTS (StreamElements — no key, CORS-open) ── */
const SE_VOICES=["Brian","Matthew","Joanna","Amy","Emma","Joey","Justin","Kendra","Salli","Russell","Nicole","Ivy"];
/* ─── NEURAL VOICES — Microsoft Edge read-aloud service ──────────
   Genuinely human-sounding neural voices, free, no key, reachable
   from the browser over WebSocket. Unofficial endpoint (the one
   Edge itself and the popular edge-tts tools use) — if Microsoft
   ever changes it, export auto-falls back to the classic engine. */
const EDGE_VOICES=[
  {id:"en-US-AndrewNeural",     l:"Andrew · US male, warm"},
  {id:"en-US-BrianNeural",      l:"Brian · US male, casual"},
  {id:"en-US-ChristopherNeural",l:"Christopher · US male, deep"},
  {id:"en-US-GuyNeural",        l:"Guy · US male, energetic"},
  {id:"en-US-EricNeural",       l:"Eric · US male, calm"},
  {id:"en-US-RogerNeural",      l:"Roger · US male, mature"},
  {id:"en-US-AvaNeural",        l:"Ava · US female, expressive"},
  {id:"en-US-EmmaNeural",       l:"Emma · US female, friendly"},
  {id:"en-US-JennyNeural",      l:"Jenny · US female, natural"},
  {id:"en-US-AriaNeural",       l:"Aria · US female, newscast"},
  {id:"en-US-MichelleNeural",   l:"Michelle · US female, warm"},
  {id:"en-GB-RyanNeural",       l:"Ryan · UK male"},
  {id:"en-GB-ThomasNeural",     l:"Thomas · UK male, deep"},
  {id:"en-GB-SoniaNeural",      l:"Sonia · UK female"},
  {id:"en-GB-LibbyNeural",      l:"Libby · UK female, bright"},
  {id:"en-AU-NatashaNeural",    l:"Natasha · AU female"},
  {id:"en-AU-WilliamNeural",    l:"William · AU male"},
  {id:"en-IN-NeerjaNeural",     l:"Neerja · IN female"},
  {id:"en-IN-PrabhatNeural",    l:"Prabhat · IN male"},
];
const xmlEsc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
/* ── delivery marks: *word* = vocal stress, [pause] = dramatic beat ──
   The AI script includes these; autoMark() adds them when it doesn't. */
function stripMarks(t){return String(t).replace(/\[pause\]/gi," ").replace(/\*([^*\s][^*]*)\*/g,"$1").replace(/\s+/g," ").trim();}
function autoMark(t){
  let x=" "+String(t)+" ";
  const stress=["however","never","always","nothing","everything","must","remember","today","stop","truth","every","refuse"];
  stress.forEach(w=>{x=x.replace(new RegExp("\\b("+w+")\\b(?![^*]*\\*)","gi"),"*$1*");});
  x=x.replace(/([.!?])\s+(\*?(However|But|Because|Remember|So listen|And yet|Yet|Here's)\b)/g,"$1 [pause] $2");
  x=x.replace(/,\s+(\*?however\*?)/gi,", [pause] $1");
  return x.replace(/\s+/g," ").trim();
}
function markedToSsml(chunk){
  let out="";
  const parts=String(chunk).split(/(\[pause\]|\*[^*\s][^*]*\*)/g);
  for(const p of parts){
    if(!p)continue;
    if(/^\[pause\]$/i.test(p))out+='<break time="900ms"/>';
    else if(/^\*[^*]+\*$/.test(p)){
      const w=p.slice(1,-1);
      out+=`<emphasis level="strong"><prosody rate="-18%" pitch="-4%">${xmlEsc(w)}</prosody></emphasis>`;
    }else out+=xmlEsc(p);
  }
  return out;
}
async function edgeGec(skewMin=0){
  const TOKEN="6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  let secs=BigInt(Math.floor(Date.now()/1000)+Math.round(skewMin)*60)+11644473600n;
  secs-=secs%300n;
  const str=(secs*10000000n).toString()+TOKEN;
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function edgeParseFrame(data){
  /* binary frame: 2-byte BE header length, header text, payload */
  const dv=new DataView(data);
  const hlen=dv.getUint16(0);
  const header=new TextDecoder().decode(data.slice(2,2+hlen));
  return {header,payload:data.slice(2+hlen)};
}
function edgeTTS(text,voice,ratePct,pitchPct,timeoutMs=30000,innerXml=null,skewMin=0){
  return new Promise(async(resolve,reject)=>{
    let settled=false;
    const done=(fn,v)=>{if(!settled){settled=true;fn(v);}};
    try{
      const gec=await edgeGec(skewMin);
      const reqId=(crypto.randomUUID?crypto.randomUUID():(""+Math.random()+Date.now())).replace(/-/g,"");
      const ws=new WebSocket(`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${reqId}`);
      ws.binaryType="arraybuffer";
      const chunks=[];
      const to=setTimeout(()=>{try{ws.close();}catch{};done(reject,new Error("Neural voice service timeout"));},timeoutMs);
      ws.onopen=()=>{
        const ts=new Date().toString();
        ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
        const r=Math.round(ratePct||0),p=Math.round(pitchPct||0);
        const ssml=`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody rate='${r>=0?"+":""}${r}%' pitch='${p>=0?"+":""}${p}%'>${innerXml||xmlEsc(text)}</prosody></voice></speak>`;
        ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`);
      };
      ws.onmessage=ev=>{
        if(typeof ev.data==="string"){
          if(ev.data.includes("Path:turn.end")){
            clearTimeout(to);try{ws.close();}catch{}
            const total=chunks.reduce((n,c)=>n+c.byteLength,0);
            if(!total)return done(reject,new Error("Neural voice returned no audio"));
            const out=new Uint8Array(total);let off=0;
            for(const c of chunks){out.set(new Uint8Array(c),off);off+=c.byteLength;}
            done(resolve,out.buffer);
          }
        }else{
          try{
            const {header,payload}=edgeParseFrame(ev.data);
            if(header.includes("Path:audio")&&payload.byteLength)chunks.push(payload);
          }catch{}
        }
      };
      ws.onerror=()=>{clearTimeout(to);done(reject,new Error("Neural voice service unreachable"));};
      ws.onclose=()=>{if(!settled)done(reject,new Error("Neural voice connection closed early"));};
    }catch(e){done(reject,e);}
  });
}
/* last-resort: synthesize with the browser's built-in speech engine and
   capture it to an AudioBuffer so export always produces SOME voiceover */
async function deviceSpeechBuffer(actx,text,rate,pitch){
  if(!SYNTH||typeof SpeechSynthesisUtterance==="undefined")throw new Error("No speech engine available at all");
  /* device speech can't be routed into Web Audio directly across browsers;
     approximate timing with a silent buffer so visuals/captions still run,
     and speak aloud live so the recorded tab audio (if any) catches it.   */
  const words=text.split(/\s+/).filter(Boolean).length;
  const secs=Math.max(1.2,words/2.6/(rate||1));
  return actx.createBuffer(1,Math.ceil(secs*actx.sampleRate),actx.sampleRate);
}
async function edgeTTSretry(plain,voice,r,p,inner){
  let lastErr;
  for(const skew of [0,-5,5,-10,10]){
    try{return await edgeTTS(plain,voice,r,p,30000,inner,skew);}
    catch(e){lastErr=e;}
  }
  throw lastErr||new Error("neural unavailable");
}
async function ttsChunk(actx,text,engine,voice,rate,pitch){
  if(engine==="edge"){
    const ab=await edgeTTSretry(stripMarks(text),voice,((rate||1)-1)*100,((pitch||1)-1)*40,markedToSsml(text));
    return await actx.decodeAudioData(ab);
  }
  return await fetchTTS(actx,stripMarks(text),voice);
}
function chunkScript(script,max=250){
  const sents=script.match(/[^.!?]+[.!?]*/g)||[script];
  const out=[];let cur="";
  for(const s of sents){
    if((cur+s).length>max&&cur){out.push(cur.trim());cur=s;}
    else cur+=s;
  }
  if(cur.trim())out.push(cur.trim());
  return out;
}
async function fetchTTS(audioCtx,text,voice){
  /* provider 1: StreamElements (Polly) */
  try{
    const u=`https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
    const r=await fetch(u);
    if(r.ok){const ab=await r.arrayBuffer();return await audioCtx.decodeAudioData(ab);}
  }catch{}
  /* provider 2: Google Translate TTS (free, ~200 char limit per call) */
  const clip=String(text).slice(0,200);
  const u2=`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(clip)}`;
  const r2=await fetch(u2);
  if(!r2.ok)throw new Error(`TTS ${r2.status}`);
  const ab2=await r2.arrayBuffer();
  return await audioCtx.decodeAudioData(ab2);
}

/* ─── STORAGE LAYER (persistent on a real domain, in-memory
   fallback inside sandboxed previews that block storage APIs) ── */
const LS=(()=>{
  const mem={};let ok=false;
  try{localStorage.setItem("__t","1");localStorage.removeItem("__t");ok=true;}catch{}
  return{
    get:k=>{try{return ok?localStorage.getItem(k):(k in mem?mem[k]:null);}catch{return mem[k]??null;}},
    set:(k,v)=>{try{if(ok){localStorage.setItem(k,v);return;}}catch{}mem[k]=v;},
    del:k=>{try{if(ok){localStorage.removeItem(k);return;}}catch{}delete mem[k];},
  };
})();
const DB_NAME="autoviral",DB_STORE="videos";
const MEM_DB=new Map();
function openDB(){
  return new Promise((res,rej)=>{
    try{
      const rq=indexedDB.open(DB_NAME,1);
      rq.onupgradeneeded=()=>{if(!rq.result.objectStoreNames.contains(DB_STORE))rq.result.createObjectStore(DB_STORE,{keyPath:"id"});};
      rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);
    }catch(e){rej(e);}
  });
}
async function dbPut(v){
  try{const db=await openDB();return await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).put(v);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
  catch{MEM_DB.set(v.id,v);}
}
async function dbAll(){
  try{const db=await openDB();return await new Promise((res,rej)=>{const rq=db.transaction(DB_STORE).objectStore(DB_STORE).getAll();rq.onsuccess=()=>res(rq.result||[]);rq.onerror=()=>rej(rq.error);});}
  catch{return[...MEM_DB.values()];}
}
async function dbDel(id){
  try{const db=await openDB();return await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
  catch{MEM_DB.delete(id);}
}

/* ─── AUTH / USERS (localStorage) ────────────────────────────── */
const LS_USERS="av_users",LS_SESSION="av_session";
function loadUsers(){
  try{
    let u=JSON.parse(LS.get(LS_USERS)||"null");
    if(!u){
      u=[{id:"admin",email:"admin@autoviral.com",pass:"admin123",name:"Admin",credits:9999,plan:"admin",isAdmin:true,onboarded:true,connected:{yt:null,ig:null},createdAt:Date.now()}];
      LS.set(LS_USERS,JSON.stringify(u));
    }
    return u;
  }catch{return[];}
}
function saveUsers(u){LS.set(LS_USERS,JSON.stringify(u));}
function getSession(){const id=LS.get(LS_SESSION);return id?loadUsers().find(x=>x.id===id)||null:null;}
function setSession(id){id?LS.set(LS_SESSION,id):LS.del(LS_SESSION);}
function updateUser(id,patch){const u=loadUsers().map(x=>x.id===id?{...x,...patch}:x);saveUsers(u);return u.find(x=>x.id===id);}

/* ─── AMBIENT MUSIC ──────────────────────────────────────────── */
function makeAmbient(id){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const m=ctx.createGain();m.gain.value=0.06;m.connect(ctx.destination);
    const C={fitness:[[80,"sawtooth",.4],[160,"square",.15]],finance:[[55,"sine",.5],[110,"sine",.2]],tech:[[60,"square",.3],[120,"square",.15]],meditation:[[40,"sine",.6],[80,"sine",.25]],nature:[[65,"sine",.4],[130,"sine",.2]],food:[[70,"sine",.4],[140,"sine",.2]],travel:[[55,"sine",.45],[110,"triangle",.2]],gaming:[[80,"square",.3],[160,"square",.2]],motivation:[[75,"sawtooth",.35],[150,"sine",.15]]};
    const ns=[];
    (C[id]||C.motivation).forEach(([freq,type,vol])=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
      f.type="lowpass";f.frequency.value=700;o.type=type;o.frequency.value=freq;g.gain.value=vol;
      o.connect(f);f.connect(g);g.connect(m);o.start();ns.push(o);
    });
    const lfo=ctx.createOscillator(),lg=ctx.createGain();
    lfo.frequency.value=.07;lg.gain.value=0.02;lfo.connect(lg);lg.connect(m.gain);lfo.start();ns.push(lfo);
    return{sv:v=>{m.gain.value=v*.06;},stop:()=>{ns.forEach(o=>{try{o.stop();}catch{}});setTimeout(()=>{try{ctx.close();}catch{}},500);}};
  }catch{return null;}
}

/* ─── TOAST ──────────────────────────────────────────────────── */
function useToast(){
  const [ts,setTs]=useState([]);
  const show=useCallback((msg,type="success")=>{
    const id=Date.now()+Math.random();setTs(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setTs(t=>t.filter(x=>x.id!==id)),4500);
  },[]);
  const Toasts=()=>(
    <div className="tw">{ts.map(t=>{
      const bc={success:"rgba(0,230,118,.35)",error:"rgba(255,64,64,.4)",warn:"rgba(255,122,48,.4)",info:"rgba(77,138,255,.35)"};
      const ic={success:"✓",error:"✕",warn:"!",info:"i"};
      const cc={success:"var(--gr)",error:"var(--r)",warn:"var(--or)",info:"var(--bl)"};
      return(<div key={t.id} className="ti" style={{borderColor:bc[t.type]||bc.success}}>
        <span style={{color:cc[t.type]||cc.success,fontSize:15}}>{ic[t.type]||ic.success}</span>
        <span style={{flex:1}}>{t.msg}</span>
      </div>);
    })}</div>
  );
  return{show,Toasts};
}

/* ─── PIPELINE ───────────────────────────────────────────────── */
function extractKeywords(script,topic){
  const stop=new Set("the a an and or but if then with without you your this that those these is are was were be been being to of in on for from as at it its we our they their them there here i me my so not no do does did done can cant will wont would could should just have has had what when how why who more most very really about into over your every".split(" "));
  const ws=script.replace(/[^a-zA-Z' ]/g," ").split(/\s+/).filter(w=>w.length>4&&!stop.has(w.toLowerCase()));
  const freq={};
  ws.forEach(w=>{const k=w.toLowerCase();freq[k]=(freq[k]||0)+1;});
  const top=Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,12).map(w=>w.toUpperCase());
  return top.length?top:[topic.toUpperCase()];
}
function Pipeline({config,onDone,onBack}){
  const [steps,setSteps]=useState([
    {id:"script",label:"Writing voiceover script", sub:"Claude AI",                       state:"wait"},
    {id:"visual",label:"Reading script for visuals",sub:"Kinetic keywords",               state:"wait"},
    {id:"media", label:"Finding real footage",     sub:"Pexels · Pixabay · Openverse · Wikimedia",state:"wait"},
    {id:"voices",label:"Loading voice engine",     sub:"Web Speech API",                  state:"wait"},
  ]);
  const [err,setErr]=useState("");
  const [prog,setProg]=useState(0);
  const [noKeyWarn,setNoKeyWarn]=useState(false);
  const ran=useRef(false);
  const setS=(id,state,sub)=>setSteps(p=>p.map(x=>x.id===id?{...x,state,sub:sub??x.sub}:x));

  useEffect(()=>{if(ran.current)return;ran.current=true;run();},[]);

  const run=async()=>{
    const out={script:"",keywords:[],segments:[],theme:detectTheme(config.topic),vstyle:config.vstyle||"aurora"};
    try{
      setS("script","active");setProg(6);
      out.script=await genScript(config.topic,config.style,config.duration,m=>setS("script","active",m));
      out.scriptEngine=genScript.engine||"AI";
      if(genScript.noKey)setNoKeyWarn(true);
      out.scriptMarked=/\[pause\]|\*\S[^*]*\*/.test(out.script)?out.script:autoMark(out.script);
      out.script=stripMarks(out.scriptMarked);
      setS("script","done",`${out.script.split(/\s+/).length} words · ${genScript.engine||"Claude AI"}`);setProg(32);

      setS("visual","active");setProg(36);
      out.keywords=extractKeywords(out.script,config.topic);
      await new Promise(r=>setTimeout(r,350));
      setS("visual","done",`${out.keywords.length} kinetic keywords`);setProg(42);

      setS("media","active");
      out.segments=[];
      if(config.files&&config.files.length){
        setS("media","active","Loading your uploaded clips & photos");
        out.segments=await filesToSegments(config.files);
      }
      const target=config.mediaCount===0
        ?Math.max((config.picked&&config.picked.length)||0,12)
        :(config.mediaCount||6);
      if(config.picked&&config.picked.length&&out.segments.length<target){
        setS("media","active",`Downloading your ${config.picked.length} hand-picked items`);
        for(const c of config.picked){
          if(out.segments.length>=target)break;
          try{out.segments.push(await loadSeg(c,out.segments.length));}
          catch{
            if(c.fallback){try{out.segments.push(await loadSeg({...c,src:c.fallback},out.segments.length));}catch{}}
          }
        }
      }
      if(config.mediaMode!=="motion"&&out.segments.length<target){
        setS("media","active","Planning visual search queries");
        out.vqueries=await genVisualQueries(config.topic,config.style);
        const stock=await gatherMedia(config.topic,out.vqueries,config.platform,m=>setS("media","active",m),target-out.segments.length);
        out.segments=[...out.segments,...stock].slice(0,target);
      }
      if(out.segments.length){
        const nv=out.segments.filter(x=>x.kind==="video").length,ni=out.segments.length-nv;
        const yours=config.files&&config.files.length?" — incl. your uploads":"";
        setS("media","done",`${nv} video clip${nv===1?"":"s"} · ${ni} photo${ni===1?"":"s"}${yours} · matched "${(out.vqueries||[config.topic])[0]}"`);
      }else{
        setS("media","active","Stock blocked here — loading built-in demo photos");
        out.segments=await demoSegments(config.topic);
        out.demo=out.segments.length>0;
        setS("media","done",out.segments.length
          ?`${out.segments.length} built-in demo photos — real footage, stitched. Upload your own clips in the next screen, or deploy for topic-matched stock`
          :"No footage available — using motion graphics");
      }
      setProg(80);

      setS("voices","active");setProg(86);
      await new Promise(r=>setTimeout(r,300));
      let vs=safeVoices();
      if(SYNTH&&!vs.length){await new Promise(r=>{SYNTH.onvoiceschanged=r;setTimeout(r,1500);});vs=safeVoices();}
      out.voices=vs;
      setS("voices","done",SYNTH?`${vs.length} voices`:"Browser speech unavailable here — baked AI voiceover export still works");setProg(100);
      await new Promise(r=>setTimeout(r,400));
      onDone(out);
    }catch(e){
      setErr(e.message||"Something went wrong.");
      setSteps(p=>p.map(x=>x.state==="active"?{...x,state:"wait"}:x));
    }
  };

  return(
    <div className="ov" style={{alignItems:"center"}}>
      <div className="modal" style={{maxWidth:460}}>
        <div style={{padding:"18px 22px",borderBottom:"1px solid var(--g)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"var(--fd)",fontSize:22,color:"var(--y)"}}>CREATING YOUR VIDEO</div>
          <button className="btn bg bic" onClick={onBack}><Ic n="x" s={16}/></button>
        </div>
        <div style={{padding:22}}>
          <div className="pb" style={{height:5,marginBottom:18}}><div className="pf" style={{width:`${prog}%`,height:5}}/></div>
          {steps.map((st,i)=>(
            <div key={st.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:6,background:st.state==="active"?"rgba(255,230,0,.05)":"transparent",marginBottom:4}}>
              <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,background:st.state==="done"?"var(--gr)":st.state==="active"?"var(--y)":"var(--g)",color:st.state==="wait"?"var(--g3)":"#000"}}>
                {st.state==="done"?<Ic n="chk" s={13} c="#000"/>:st.state==="active"?<span className="asp" style={{width:12,height:12,border:"2px solid #000",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block"}}/>:i+1}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:st.state==="done"?"var(--w)":st.state==="active"?"var(--y)":"var(--g3)"}}>{st.label}</div>
                {st.sub&&<div style={{fontSize:10,color:st.id==="script"&&noKeyWarn?"var(--or)":"var(--g3)",marginTop:2}}>{st.sub}</div>}
              </div>
            </div>
          ))}
          {noKeyWarn&&!err&&(
            <div style={{marginTop:14,background:"rgba(255,122,48,.08)",border:"1px solid rgba(255,122,48,.35)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{color:"var(--or)",fontWeight:800,fontSize:12,marginBottom:5}}>Using a generic template — your script won't be topic-specific</div>
              <div style={{color:"var(--g4)",fontSize:11,lineHeight:1.6}}>The Claude API only works inside the claude.ai preview, not in a hosted/downloaded app. For real AI scripts about your exact topic, add a free <strong style={{color:"var(--w)"}}>Gemini API key</strong> (aistudio.google.com/apikey) in Connect → it takes 30 seconds and costs nothing.</div>
            </div>
          )}
          {err&&(
            <div style={{marginTop:16,background:"rgba(255,64,64,.08)",border:"1px solid rgba(255,64,64,.3)",borderRadius:6,padding:"14px 16px"}}>
              <div style={{color:"var(--r)",fontWeight:700,marginBottom:6}}>Error</div>
              <div style={{color:"var(--r)",fontSize:12,fontFamily:"var(--fm)",lineHeight:1.6,marginBottom:10}}>{err}</div>
              <button className="btn bg bsm" onClick={onBack}>Go Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW ────────────────────────────────────────────────── */
function Preview({result,config,onBack,toast,user,onSaved,onGoVideos}){
  const canvRef=useRef(null);
  const rafRef=useRef(null);
  const recRef=useRef(null);
  const chunksRef=useRef([]);
  const ambRef=useRef(null);
  const kaRef=useRef(null);
  const recTRef=useRef(null);

  const [script,setScript]=useState(result.script);
  const [words,setWords]=useState(()=>result.script.split(/\s+/).filter(Boolean));
  const [wi,setWi]=useState(-1);
  const wiRef=useRef(-1);

  const [playing,setPlaying]=useState(false);
  const [recording,setRecording]=useState(false);
  const [recSec,setRecSec]=useState(0);
  const [recorded,setRecorded]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [captStyle,setCaptStyle]=useState(config.captionStyle||"tiktok");
  const [preset,setPreset]=useState(VP[0]);
  const [rate,setRate]=useState(0.92);
  const [pitch,setPitch]=useState(1.0);
  const [voiceIdx,setVoiceIdx]=useState(0);
  const [muteV,setMuteV]=useState(false);
  const [ambOn,setAmbOn]=useState(false);
  const [ambVol,setAmbVol]=useState(0.5);
  const [editMode,setEditMode]=useState(false);
  const [draft,setDraft]=useState(result.script);
  const [showAdv,setShowAdv]=useState(false);
  const [copyOk,setCopyOk]=useState(false);
  const [seVoice,setSeVoice]=useState("Brian");
  const [voEngine,setVoEngine]=useState("edge");
  const [edgeVoice,setEdgeVoice]=useState("en-US-AndrewNeural");
  const [exporting,setExporting]=useState(false);
  const [exMsg,setExMsg]=useState("");
  const [exProg,setExProg]=useState(0);
  const [savedId,setSavedId]=useState(null);
  const lastBlobRef=useRef(null);
  const exportLenRef=useRef(null);  /* during export: visuals wrap at AUDIO length, not config */
  const thumbBlobRef=useRef(null);
  const uploadThumbRef=useRef(null);
  const [uploadTick,setUploadTick]=useState(0);
  /* metadata & thumbnail studio */
  const [mTitle,setMTitle]=useState("");
  const [mDesc,setMDesc]=useState("");
  const [mTags,setMTags]=useState("");
  const [mIg,setMIg]=useState("");
  const [titleIdeas,setTitleIdeas]=useState(()=>suggestTitles(config.topic,config.duration));
  const [tIdx,setTIdx]=useState(0);
  const [thumbIdx,setThumbIdx]=useState(-2); /* -2 = unset, -1 = current frame */
  const [thumbText,setThumbText]=useState("");
  const [thumbUrl,setThumbUrl]=useState(null);
  const [metaBusy,setMetaBusy]=useState(false);
  const [kwOn,setKwOn]=useState(true);
  const kwRef=useRef(true);
  useEffect(()=>{kwRef.current=kwOn;},[kwOn]);
  const [recExt,setRecExt]=useState("webm");

  const theme=result.theme;
  const keywords=result.keywords||[];
  const [segments,setSegments]=useState(result.segments||[]);
  const SEG=segments.length?Math.max(5,Math.min(10,config.duration/segments.length)):8;
  const upRef=useRef(null);
  const addFiles=async fl=>{
    const list=Array.from(fl||[]);
    if(!list.length)return;
    const add=await filesToSegments(list,segments.length);
    if(add.length){setSegments(p=>[...p.filter(x=>!x.demo),...add]);toast(`${add.length} clip${add.length>1?"s":""} added to the video`);}
    else toast("Couldn't read those files — use common image/video formats (jpg, png, mp4, mov, webm).","warn");
    if(upRef.current)upRef.current.value="";
  };
  const [vstyle,setVstyle]=useState(result.vstyle||"aurora");
  const voices=[...((result.voices&&result.voices.length)?result.voices:safeVoices())].sort((a,b)=>{
    const sc=v=>(/natural|neural|online/i.test(v.name)?4:/google/i.test(v.name)?3:/premium|enhanced|siri/i.test(v.name)?2:/microsoft/i.test(v.name)?1:0);
    return sc(b)-sc(a);
  });
  const po=config.platform==="portrait";
  const CW=po?720:1280,CH=po?1280:720;
  const WD=po?300:504,HD=po?534:284;

  useEffect(()=>{wiRef.current=wi;},[wi]);

  /* ── timeline playhead: pausable, seekable virtual clock ── */
  const phRef=useRef(0);            /* playhead seconds */
  const tlPlayRef=useRef(true);     /* timeline running? */
  const lastTsRef=useRef(0);
  const speakingRef=useRef(false);  /* live voiceover owns captions while true */
  const [tlPlaying,setTlPlaying]=useState(true);
  const [tlPos,setTlPos]=useState(0);
  const setTimeline=on=>{
    tlPlayRef.current=on;setTlPlaying(on);
    /* play = also speak the voiceover from the current playhead; pause = silence */
    if(on){
      if(SYNTH&&typeof SpeechSynthesisUtterance!=="undefined"){
        if(SYNTH.paused&&SYNTH.speaking){try{SYNTH.resume();}catch{}}
        else if(!SYNTH.speaking)startVoice(phRef.current);
      }
    }else{
      try{if(SYNTH&&SYNTH.speaking)SYNTH.pause();}catch{}
    }
  };
  const seekTo=sec=>{
    phRef.current=Math.max(0,Math.min(config.duration,sec));
    setTlPos(phRef.current);
    if(!speakingRef.current){
      const est=Math.min(words.length-1,Math.floor((phRef.current/config.duration)*words.length));
      setWi(est);wiRef.current=est;
    }
  };

  /* sensible defaults on arrival: first suggested title, first image as thumb, title words as thumb text */
  useEffect(()=>{
    if(!mTitle)setMTitle(titleIdeas[0]||config.topic);
    if(thumbIdx===-2){
      const best=segments.findIndex(x=>x.kind==="image");
      setThumbIdx(best>=0?best:(segments.length?0:-1));
    }
    /* eslint-disable-next-line */
  },[]);
  useEffect(()=>{
    if(!thumbText&&mTitle)setThumbText(mTitle.split(/\s+/).slice(0,4).join(" ").toUpperCase());
    /* eslint-disable-next-line */
  },[mTitle]);
  /* re-render the thumbnail whenever its inputs change */
  useEffect(()=>{
    if(thumbIdx===-2)return;
    const seg=thumbIdx===-3?uploadThumbRef.current:(thumbIdx>=0?segments[thumbIdx]:(canvRef.current?{el:canvRef.current,w:CW,h:CH}:null));
    try{
      const cv=renderThumbCanvas(seg,thumbText,theme);
      cv.toBlob(b=>{
        if(!b)return;
        thumbBlobRef.current=b;
        setThumbUrl(u=>{if(u)URL.revokeObjectURL(u);return URL.createObjectURL(b);});
      },"image/jpeg",0.85);
    }catch{}
    /* eslint-disable-next-line */
  },[thumbIdx,thumbText,segments,theme,uploadTick]);

  const loop=useCallback(()=>{
    const canvas=canvRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const now=performance.now();
    const dt=lastTsRef.current?(now-lastTsRef.current)/1000:0;
    lastTsRef.current=now;
    if(tlPlayRef.current){
      phRef.current+=dt;
      const wrapAt=exportLenRef.current||config.duration;
      if(phRef.current>=wrapAt)phRef.current=exportLenRef.current?wrapAt:0; /* clamp during export, loop otherwise */
      if(!speakingRef.current)wiRef.current=Math.min(words.length-1,Math.floor((phRef.current/config.duration)*words.length));
    }
    setTlPos(p=>Math.abs(p-phRef.current)>0.2?phRef.current:p);
    const t=phRef.current;
    if(segments.length){
      drawMedia(ctx,CW,CH,t,segments,SEG);
      if(kwRef.current)drawKeyword(ctx,CW,CH,t,theme,keywords);
      vignette(ctx,CW,CH);
    }else{
      drawScene(ctx,CW,CH,t,vstyle,theme,kwRef.current?keywords:null);
    }
    renderCaptions(ctx,words,wiRef.current,CW,CH,captStyle,config.platform);
    rafRef.current=requestAnimationFrame(loop);
  },[words,captStyle,theme,keywords,vstyle,segments,SEG,config.platform,config.duration]);

  useEffect(()=>{
    cancelAnimationFrame(rafRef.current);
    segments.forEach(sg=>{if(sg.kind==="video"&&sg.el&&sg.el.paused){sg.el.play().catch(()=>{});}});
    rafRef.current=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(rafRef.current);segments.forEach(sg=>{if(sg.kind==="video"&&sg.el){try{sg.el.pause();}catch{}}});};
  },[loop]);

  useEffect(()=>{
    if(ambOn){if(!ambRef.current)ambRef.current=makeAmbient(theme.id);if(ambRef.current)ambRef.current.sv(ambVol);}
    else{if(ambRef.current){ambRef.current.stop();ambRef.current=null;}}
    return()=>{if(ambRef.current){ambRef.current.stop();ambRef.current=null;}};
  },[ambOn,ambVol,theme.id]);

  const ap=p=>{setPreset(p);setRate(p.rate);setPitch(p.pitch);toast(`Voice: ${p.l}`,"info");};

  const stopS=useCallback(()=>{
    try{SYNTH&&SYNTH.cancel();}catch{}
    clearInterval(kaRef.current);clearInterval(recTRef.current);
    setPlaying(false);setWi(-1);wiRef.current=-1;speakingRef.current=false;
  },[]);

  const startVoice=useCallback((fromSec=0)=>{
    if(!words.length)return;
    if(!SYNTH||typeof SpeechSynthesisUtterance==="undefined"){
      /* no speech engine — captions still track the playhead via the loop */
      speakingRef.current=false;return;
    }
    try{SYNTH.cancel();}catch{}
    /* speak from the word nearest the current playhead */
    const startWord=Math.max(0,Math.min(words.length-1,Math.floor((fromSec/config.duration)*words.length)));
    const sub=words.slice(startWord).join(" ");
    const utt=new SpeechSynthesisUtterance(sub);
    utt.rate=rate;utt.pitch=pitch;utt.volume=muteV?0:(preset.vol||1);
    const vs=safeVoices();
    if(vs[voiceIdx])utt.voice=vs[voiceIdx];
    speakingRef.current=true;
    utt.onboundary=e=>{
      if(e.name!=="word")return;
      const idx=Math.max(0,startWord+sub.substring(0,e.charIndex).trim().split(/\s+/).filter(Boolean).length-1);
      setWi(idx);wiRef.current=idx;
    };
    kaRef.current=setInterval(()=>{try{if(SYNTH.speaking&&!SYNTH.paused){SYNTH.pause();SYNTH.resume();}}catch{}},14000);
    utt.onend=()=>{clearInterval(kaRef.current);speakingRef.current=false;setPlaying(false);};
    utt.onerror=e=>{clearInterval(kaRef.current);speakingRef.current=false;if(e.error!=="canceled"&&e.error!=="interrupted")toast(`Voice: ${e.error}`,"error");};
    SYNTH.speak(utt);setPlaying(true);
  },[words,rate,pitch,muteV,preset,voiceIdx,config.duration,toast]);

  const saveToLibrary=async(blob,actualDur)=>{
    try{
      setExMsg("Saving to My Videos…");
      /* user-built thumbnail wins; else current frame */
      const thumb=thumbBlobRef.current||await new Promise(res=>canvRef.current.toBlob(res,"image/jpeg",0.82));
      /* user-edited metadata wins; AI fills any gaps */
      let title=mTitle.trim(),description=mDesc.trim(),tags=mTags.trim(),ig=mIg.trim();
      if(!title||!description){
        const meta=await genMeta(config.topic,script);
        title=title||meta.title||config.topic;
        description=description||meta.description||"";
        tags=tags||(meta.hashtags||[]).join(" ");
        ig=ig||meta.igCaption||"";
      }
      const vid={id:"v"+Date.now(),userId:user?.id||"guest",topic:config.topic,
        title,description,hashtags:tags.split(/\s+/).filter(Boolean),igCaption:ig,
        platform:config.platform,duration:Math.round(actualDur||config.duration),
        size:blob.size,ext:recExt,blob,thumb,status:"draft",scheduledAt:null,createdAt:Date.now()};
      await dbPut(vid);
      setSavedId(vid.id);
      toast(`"${vid.title}" saved to My Videos ✓`);
      onSaved&&onSaved(vid);
      return vid;
    }catch(e){toast(`Save failed: ${e.message} — use the "Save to My Videos" button to retry`,"error");}
  };

  const exportFinal=async()=>{
    if(exporting)return;
    stopS();setExporting(true);setSavedId(null);setRecorded(null);setRecSec(0);
    let actx=null,timers=[],pi=null,amb=[];
    try{
      let eng=voEngine;
      phRef.current=0;setTlPos(0);tlPlayRef.current=true;setTlPlaying(true);
      speakingRef.current=true;   /* export word-timers own the captions */
      setExMsg("Synthesizing AI voiceover…");setExProg(4);
      actx=new(window.AudioContext||window.webkitAudioContext)();
      try{await actx.resume();}catch{}
      const parts=chunkScript(result.scriptMarked||script);
      const bufs=[];
      for(let i=0;i<parts.length;i++){
        setExMsg(`Voiceover ${i+1}/${parts.length}…`);
        let buf=null;
        try{ buf=await ttsChunk(actx,parts[i],eng,eng==="edge"?edgeVoice:seVoice,rate,pitch); }
        catch(err){
          if(eng==="edge"){
            eng="se";
            toast("Neural voices unreachable — using classic voice for this export","warn");
            try{ buf=await ttsChunk(actx,parts[i],"se",seVoice,rate,pitch); }catch(e2){ eng="dev"; }
          }
          if(!buf&&eng==="se"){ eng="dev"; }
          if(!buf&&eng!=="dev")throw err;
        }
        if(!buf&&eng==="dev"){
          buf=await deviceSpeechBuffer(actx,stripMarks(parts[i]),rate,pitch);
          if(i===0)toast("Online voices unreachable — recording your device's built-in voice instead","warn");
        }
        if(buf)bufs.push(buf);
        setExProg(4+((i+1)/parts.length)*42);
      }
      const dest=actx.createMediaStreamDestination();
      const master=actx.createGain();master.gain.value=1;
      master.connect(dest);
      const monitor=actx.createGain();monitor.gain.value=0.9;   /* what you hear while rendering — recording is unaffected */
      master.connect(monitor);monitor.connect(actx.destination);
      if(ambOn){
        const ag=actx.createGain();ag.gain.value=0.045*ambVol;ag.connect(master);
        [[55,"sine"],[110,"triangle"]].forEach(([f,ty])=>{
          const o=actx.createOscillator(),fl=actx.createBiquadFilter();
          fl.type="lowpass";fl.frequency.value=600;o.type=ty;o.frequency.value=f;
          o.connect(fl);fl.connect(ag);o.start();amb.push(o);
        });
      }
      const cs=canvRef.current.captureStream(30);
      const stream=new MediaStream([...cs.getVideoTracks(),...dest.stream.getAudioTracks()]);
      const {mime,ext}=pickMime();
      setRecExt(ext);
      chunksRef.current=[];
      const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:5000000}:{videoBitsPerSecond:5000000});
      rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      const stopped=new Promise(res=>{rec.onstop=res;});
      const audioLen=bufs.reduce((n,b)=>n+b.duration,0);
      exportLenRef.current=audioLen+1.2;
      phRef.current=0;lastTsRef.current=performance.now();   /* visual clock = 0 at record start */
      tlPlayRef.current=true;setTlPlaying(true);
      rec.start(250);
      setExMsg("Rendering final video…");
      const wpc=parts.map(p=>stripMarks(p).split(/\s+/).filter(Boolean).length);
      let t=actx.currentTime+0.3,wBase=0;
      bufs.forEach((b,ci)=>{
        const src=actx.createBufferSource();src.buffer=b;src.connect(master);src.start(t);
        const wc=Math.max(wpc[ci],1),per=(b.duration/wc)*1000,delay=(t-actx.currentTime)*1000,base=wBase;
        for(let w=0;w<wc;w++)timers.push(setTimeout(()=>{setWi(base+w);wiRef.current=base+w;},delay+w*per));
        t+=b.duration;wBase+=wpc[ci];
      });
      const totalMs=(t-actx.currentTime+0.8)*1000,t0=Date.now();
      pi=setInterval(()=>{setExProg(46+Math.min(48,((Date.now()-t0)/totalMs)*48));setRecSec(Math.floor((Date.now()-t0)/1000));},400);
      await new Promise(r=>setTimeout(r,totalMs));
      rec.stop();await stopped;
      const blob=new Blob(chunksRef.current,mime?{type:mime}:undefined);
      lastBlobRef.current=blob;
      setRecorded(URL.createObjectURL(blob));
      setExProg(96);
      await saveToLibrary(blob,bufs.reduce((n,b)=>n+b.duration,0)+0.8);
      setExProg(100);
    }catch(e){
      toast(`Export failed: ${e.message}. Try the tab-audio method below.`,"error");
    }finally{
      clearInterval(pi);timers.forEach(clearTimeout);
      amb.forEach(o=>{try{o.stop();}catch{}});
      try{actx&&actx.close();}catch{}
      setWi(-1);wiRef.current=-1;speakingRef.current=false;
      exportLenRef.current=null;
      setExporting(false);setExMsg("");setExProg(0);setRecSec(0);
    }
  };

  const startRec=async()=>{
    if(recording)return;
    const cs=canvRef.current.captureStream(30);let fs=cs;
    try{
      const ds=await navigator.mediaDevices.getDisplayMedia({video:false,audio:{echoCancellation:false,noiseSuppression:false,sampleRate:44100}});
      const at=ds.getAudioTracks()[0];
      if(at){fs=new MediaStream([...cs.getTracks(),at]);toast("Tab audio captured ✓");}
    }catch{toast("Video only — share tab audio for voiceover","warn");}
    const {mime,ext}=pickMime();
    setRecExt(ext);
    chunksRef.current=[];
    const rec=new MediaRecorder(fs,mime?{mimeType:mime,videoBitsPerSecond:5000000}:{videoBitsPerSecond:5000000});
    rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
    rec.onstop=()=>{
      const blob=new Blob(chunksRef.current,mime?{type:mime}:undefined);
      setRecorded(URL.createObjectURL(blob));
      setRecording(false);setRecSec(0);clearInterval(recTRef.current);
      toast(`Recorded — ${(blob.size/1024/1024).toFixed(1)} MB`);
      saveToLibrary(blob);
    };
    recRef.current=rec;rec.start(200);setRecording(true);
    let s=0;recTRef.current=setInterval(()=>setRecSec(++s),1000);
if(tlPlayRef.current)startVoice(phRef.current);
    setTimeout(()=>{if(rec.state!=="inactive")rec.stop();clearInterval(recTRef.current);},(config.duration+4)*1000);
  };

  const applyEdit=()=>{setScript(draft);setWords(draft.split(/\s+/).filter(Boolean));setEditMode(false);stopS();toast("Script updated ✓");};
  const fSec=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const vlbl=VSTYLES.find(v=>v.id===vstyle)?.l||"Aurora";

  return(
    <div style={{display:"flex",gap:20,height:"calc(100vh - 64px)",overflow:"hidden",padding:"0 0 16px"}}>
      <div style={{flexShrink:0,display:"flex",flexDirection:"column",gap:10,width:WD}}>
        <div style={{borderRadius:12,overflow:"hidden",border:"2px solid var(--g)",boxShadow:"0 20px 60px rgba(0,0,0,.7)",background:"#000",position:"relative",flexShrink:0}}>
          <canvas ref={canvRef} width={CW} height={CH} style={{display:"block",width:WD,height:HD,cursor:"pointer"}} onClick={()=>!exporting&&setTimeline(!tlPlayRef.current)}/>
          {recording&&<div style={{position:"absolute",top:10,left:10,display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,.8)",padding:"4px 10px",borderRadius:20}}><span className="rdot"/><span style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--r)"}}>REC {fSec(recSec)}</span></div>}
          {playing&&<div style={{position:"absolute",bottom:8,left:8,fontSize:9,fontFamily:"var(--fm)",color:"rgba(255,255,255,.4)",background:"rgba(0,0,0,.5)",padding:"2px 7px",borderRadius:10}}>{Math.max(0,wi)}/{words.length} · {fSec(elapsed)}</div>}
          <div style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,.75)",padding:"3px 8px",borderRadius:10,fontSize:9,fontFamily:"var(--fm)",color:theme.acc}}>{segments.length?`${segments.length}-clip footage`:vlbl}</div>
        </div>

        {/* ── transport: play/pause · skip · scrub · timestamp ── */}
        <div className="tbar">
          <button className="tbtn" title={tlPlaying?"Pause":"Play"} onClick={()=>setTimeline(!tlPlayRef.current)} disabled={exporting}>
            {tlPlaying?<span style={{display:"flex",gap:3}}><span className="pbar"/><span className="pbar"/></span>:<Ic n="play" s={13} c="#000"/>}
          </button>
          <button className="tbtn sm" title="Back 5s" onClick={()=>seekTo(phRef.current-5)} disabled={exporting}>«5</button>
          <button className="tbtn sm" title="Forward 5s" onClick={()=>seekTo(phRef.current+5)} disabled={exporting}>5»</button>
          <input type="range" className="scrub" min={0} max={config.duration} step={0.1} value={tlPos}
            onChange={e=>seekTo(parseFloat(e.target.value))} disabled={exporting}
            style={{backgroundSize:`${(tlPos/config.duration)*100}% 100%`}}/>
          <span className="tstamp">{fSec(tlPos)} <span style={{color:"var(--g2)"}}>/</span> {fSec(config.duration)}</span>
        </div>

        <div style={{display:"flex",gap:8}}>

          <button className="btn bg bic" onClick={()=>setMuteV(m=>!m)}><Ic n={muteV?"mut":"vol"} s={15}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {!exporting
            ?<button className="btn by" style={{width:"100%",justifyContent:"center",padding:"12px",fontSize:13}} onClick={exportFinal}><Ic n="film" s={14} c="#000"/>Generate Final Video</button>
            :<div style={{background:"var(--k3)",border:"1px solid var(--y)",borderRadius:6,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"var(--fm)",marginBottom:6}}>
                <span style={{color:"var(--y)"}}>{exMsg}</span><span style={{color:"var(--g3)"}}>{fSec(recSec)}</span>
              </div>
              <div style={{height:4,background:"var(--k1)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${exProg}%`,background:"var(--y)",transition:"width .3s"}}/></div>
            </div>
          }
          <div style={{fontSize:9,color:"var(--g3)",lineHeight:1.5}}>Renders the video with a real neural AI voiceover baked into the audio track — no screen-share needed. Auto-saves to <strong style={{color:"var(--g4)"}}>My Videos</strong> with your title, description & thumbnail.</div>
          {recorded&&<a href={recorded} download={`${config.topic.replace(/\s+/g,"-")}.${recExt}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px",background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.35)",color:"var(--gr)",borderRadius:6,fontWeight:700,fontSize:13,textDecoration:"none"}}><Ic n="dl" s={13} c="var(--gr)"/>Download .{recExt}</a>}
          {recorded&&!savedId&&<button className="btn by" style={{width:"100%",justifyContent:"center",padding:"10px",fontSize:12}} onClick={()=>lastBlobRef.current&&saveToLibrary(lastBlobRef.current)}>Save to My Videos</button>}
          {savedId&&<button className="btn bo" style={{width:"100%",justifyContent:"center",padding:"10px",fontSize:12}} onClick={onGoVideos}><Ic n="chk" s={12} c="var(--y)"/>View in My Videos →</button>}
        </div>
        <div style={{background:"rgba(77,138,255,.06)",border:"1px solid rgba(77,138,255,.18)",borderRadius:6,padding:"9px 11px",fontSize:10,color:"var(--g4)",lineHeight:1.6}}><strong style={{color:"var(--bl)"}}>Audio:</strong> Share <em>this tab</em> with <strong>tab audio</strong> checked when recording dialog appears.</div>
      </div>

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"var(--fd)",fontSize:34,color:"var(--y)",lineHeight:.9}}>{config.topic.toUpperCase()}</div>
            <div style={{fontSize:11,color:"var(--g3)",fontFamily:"var(--fm)",marginTop:5}}>{segments.length?`${segments.length} footage segments`:vlbl} · {theme.label} · {words.length} words · {fSec(config.duration)}</div>
          </div>
          <button className="btn bg bsm" onClick={onBack}>← New Video</button>
        </div>

        <div className="card" style={segments.length?{}:{border:"1px solid rgba(255,230,0,.4)",boxShadow:"0 0 24px rgba(255,230,0,.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8,flexWrap:"wrap"}}>
            <label className="lbl" style={{marginBottom:0}}>Footage · {segments.length} segment{segments.length===1?"":"s"}</label>
            <input ref={upRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
            <button className="btn bo bsm" onClick={()=>upRef.current&&upRef.current.click()}><Ic n="plus" s={11} c="var(--y)"/>Add clips / photos</button>
          </div>
          {result.demo&&segments.some(x=>x.demo)&&(
            <div style={{fontSize:10,color:"var(--g4)",lineHeight:1.6,marginBottom:10,background:"rgba(255,230,0,.05)",border:"1px solid rgba(255,230,0,.2)",borderRadius:6,padding:"8px 11px"}}>
              <strong style={{color:"var(--y)"}}>You're seeing built-in demo photos</strong> — real images, stitched with crossfades, captions and voiceover, because this sandbox blocks stock-media sites. Tap <strong style={{color:"var(--w)"}}>Add clips / photos</strong> to swap in your own, or deploy to a domain for automatic topic-matched footage.
            </div>
          )}
          {segments.length===0&&config.mediaMode!=="motion"&&(
            <div style={{fontSize:11,color:"var(--g4)",lineHeight:1.7,marginBottom:4}}>
              <strong style={{color:"var(--y)"}}>This preview sandbox blocks stock-media sites</strong>, so no footage could be auto-loaded here. Two ways to see real footage stitched right now:
              <br/>1. Tap <strong style={{color:"var(--w)"}}>Add clips / photos</strong> above and pick a few from your device — they'll play in the video instantly, with crossfades, captions and voiceover.
              <br/>2. Deploy this file to your own domain — the automatic Pexels / Pixabay / Wikimedia footage works there.
            </div>
          )}
          {segments.length>0&&(<>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {segments.map((sg,i)=>(
                <div key={i} style={{width:86,height:50,borderRadius:5,overflow:"hidden",border:"1px solid var(--g)",position:"relative",flexShrink:0,background:"#000"}}>
                  {sg.kind==="video"
                    ?<video src={sg.thumbUrl} muted loop autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<img src={sg.thumbUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                  {sg.kind==="video"&&<span style={{position:"absolute",top:3,left:3,background:"rgba(0,0,0,.78)",borderRadius:3,padding:"1px 5px",fontSize:8,fontFamily:"var(--fm)",color:"var(--y)"}}>VIDEO</span>}
                  {sg.demo&&<span style={{position:"absolute",top:3,right:3,background:"rgba(255,122,48,.9)",borderRadius:3,padding:"1px 5px",fontSize:8,fontFamily:"var(--fm)",color:"#000",fontWeight:800}}>DEMO</span>}
                </div>
              ))}
            </div>
            {result.demo&&<div style={{fontSize:10,color:"var(--or)",marginTop:8,lineHeight:1.5,background:"rgba(255,122,48,.07)",border:"1px solid rgba(255,122,48,.25)",borderRadius:5,padding:"7px 9px"}}>These are built-in demo photos, NOT matched to your topic — the sandbox blocks stock libraries. Open index.html on your computer for topic-matched footage.</div>}
            <div style={{fontSize:9,color:"var(--g3)",marginTop:8,lineHeight:1.5}}>Credits: {[...new Set(segments.map(x=>x.credit).filter(Boolean))].join(" · ")}</div>
          </>)}
        </div>

        {/* ── TITLE · DESCRIPTION · HASHTAGS · THUMBNAIL ── */}
        <div className="card">
          <label className="lbl">Title, Description & Thumbnail — saved with the video</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input className="inp" style={{flex:1,fontWeight:700}} placeholder="Video title…" value={mTitle} onChange={e=>setMTitle(e.target.value)}/>
            <button className="btn bo bsm" title="Cycle suggested titles" onClick={()=>{
              const next=(tIdx+1)%titleIdeas.length;
              setTIdx(next);setMTitle(titleIdeas[next]);
            }}>Suggest</button>
            <button className="btn bg bsm" disabled={metaBusy} onClick={async()=>{
              setMetaBusy(true);
              const ideas=await genTitlesAI(config.topic,script);
              setTitleIdeas(ideas);setTIdx(0);setMTitle(ideas[0]);
              setMetaBusy(false);toast("AI titles loaded — keep hitting Suggest to cycle","info");
            }}>{metaBusy?"…":"AI titles"}</button>
          </div>
          <div style={{marginBottom:10}}>
            <textarea className="inp" style={{minHeight:64,fontSize:12}} placeholder="Description…" value={mDesc} onChange={e=>setMDesc(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <input className="inp" style={{flex:1,fontSize:12}} placeholder="#hashtags #here" value={mTags} onChange={e=>setMTags(e.target.value)}/>
            <button className="btn bg bsm" disabled={metaBusy} onClick={async()=>{
              setMetaBusy(true);
              const m=await genMeta(config.topic,script);
              setMDesc(m.description||"");setMTags((m.hashtags||[]).join(" "));setMIg(m.igCaption||"");
              if(!mTitle.trim())setMTitle(m.title||"");
              setMetaBusy(false);toast("Description & hashtags generated ✓");
            }}>{metaBusy?"…":"AI describe"}</button>
          </div>

          <label className="lbl">Thumbnail</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            <div onClick={()=>setThumbIdx(-1)} title="Use current video frame"
              style={{width:74,height:44,borderRadius:6,border:thumbIdx===-1?"2px solid var(--y)":"2px solid var(--g)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--k3)",fontSize:8,fontWeight:800,color:thumbIdx===-1?"var(--y)":"var(--g3)",textAlign:"center",lineHeight:1.3}}>CURRENT<br/>FRAME</div>
            {segments.map((sg,i)=>(
              <div key={i} onClick={()=>setThumbIdx(i)} style={{width:74,height:44,borderRadius:6,overflow:"hidden",cursor:"pointer",border:thumbIdx===i?"2px solid var(--y)":"2px solid var(--g)",background:"#000"}}>
                {sg.thumbUrl?(sg.kind==="video"
                  ?<video src={sg.thumbUrl} muted playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<img src={sg.thumbUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>)
                  :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><Ic n="film" s={14} c="var(--g2)"/></div>}
              </div>
            ))}
            <button className="btn bg bsm" onClick={()=>{
              const best=segments.findIndex(x=>x.kind==="image");
              setThumbIdx(best>=0?best:(segments.length?0:-1));
              toast("Suggested image selected ✓","info");
            }}>Suggested image</button>
            <label className="btn bg bsm" style={{cursor:"pointer"}}>
              Upload image
              <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                const f=e.target.files&&e.target.files[0];if(!f)return;
                try{
                  const url=URL.createObjectURL(f);
                  const img=new Image();
                  await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
                  uploadThumbRef.current={el:img,w:img.naturalWidth,h:img.naturalHeight,thumbUrl:url,kind:"image",credit:"Your upload"};
                  setThumbIdx(-3);setUploadTick(t=>t+1);
                  toast("Thumbnail image uploaded ✓","info");
                }catch{toast("Could not read that image","error");}
              }}/>
            </label>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input className="inp" style={{flex:1,fontWeight:800}} placeholder="THUMBNAIL TEXT" value={thumbText} onChange={e=>setThumbText(e.target.value)}/>
            <button className="btn bo bsm" onClick={()=>{
              const base=(mTitle||config.topic).split(/\s+/).slice(0,4).join(" ");
              setThumbText(base.toUpperCase());
            }}>Suggested text</button>
          </div>
          {thumbUrl&&(
            <div style={{borderRadius:8,overflow:"hidden",border:"1px solid var(--g)"}}>
              <img src={thumbUrl} alt="thumbnail" style={{width:"100%",display:"block"}}/>
            </div>
          )}
          <div style={{fontSize:9,color:"var(--g3)",marginTop:8,lineHeight:1.5}}>This thumbnail, title, description and hashtags are attached to the video when it saves to My Videos — and used when posting to YouTube.</div>
        </div>

        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <label className="lbl" style={{marginBottom:0}}>Caption Style</label>
            <label style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"var(--g4)",cursor:"pointer",fontWeight:600}}>
              <input type="checkbox" checked={kwOn} onChange={e=>setKwOn(e.target.checked)} style={{accentColor:"var(--y)",width:14,height:14,cursor:"pointer"}}/>
              Big keyword text overlay
            </label>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[{id:"tiktok",l:"TikTok Bold"},{id:"subtitle",l:"Subtitle"},{id:"center",l:"Center Pop"},{id:"clean",l:"Clean"}].map(c=>(
              <div key={c.id} className={`cpick${captStyle===c.id?" on":""}`} style={{height:48,background:"linear-gradient(135deg,#0d0d14,#1a1a26)"}} onClick={()=>setCaptStyle(c.id)}>
                <span style={{fontSize:11,fontWeight:700,color:captStyle===c.id?"var(--y)":"var(--g4)",textAlign:"center",padding:"0 4px"}}>{c.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <label className="lbl" style={{marginBottom:0}}>Voiceover</label>
            <span className="tg tb" style={{fontSize:9}}>{voEngine==="edge"?"Neural · in exported video":"Classic"}</span>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <select className="inp" style={{width:108,fontSize:12}} value={voEngine} onChange={e=>setVoEngine(e.target.value)} disabled={exporting}>
              <option value="edge">Neural voice</option>
              <option value="se">Classic voice</option>
            </select>
            {voEngine==="edge"
              ?<select className="inp" style={{flex:1,fontSize:12}} value={edgeVoice} onChange={e=>setEdgeVoice(e.target.value)} disabled={exporting}>
                {EDGE_VOICES.map(v=><option key={v.id} value={v.id}>{v.l}</option>)}
              </select>
              :<select className="inp" style={{flex:1,fontSize:12}} value={seVoice} onChange={e=>setSeVoice(e.target.value)} disabled={exporting}>
                {SE_VOICES.map(v=><option key={v} value={v}>{v}</option>)}
              </select>}
          </div>
          <div style={{fontSize:10,color:"var(--g3)",marginBottom:10,lineHeight:1.5}}>This voice is baked into your exported video. The in-app play button uses your device's voice for a quick preview.</div>
          <label className="lbl">Delivery</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            {VP.map(p=>(
              <button key={p.id} className={`vbtn${preset.id===p.id?" on":""}`} onClick={()=>ap(p)} title={p.desc}>
                <span style={{fontSize:11,fontWeight:800,color:preset.id===p.id?"var(--y)":"var(--g4)"}}>{p.l}</span>
                <span style={{fontSize:9,color:"var(--g3)"}}>{p.rate}× {p.pitch}p</span>
              </button>
            ))}
          </div>
          <button className="btn bg bsm" style={{width:"100%",justifyContent:"center",marginBottom:showAdv?10:0}} onClick={()=>setShowAdv(a=>!a)}>
            <Ic n="slider" s={12}/>{showAdv?"Hide":"Fine-tune"} speed & pitch
          </button>
          {showAdv&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label className="lbl">Speed {rate.toFixed(2)}×</label><input type="range" min={0.5} max={1.5} step={0.03} value={rate} onChange={e=>setRate(+e.target.value)} style={{width:"100%",accentColor:"var(--y)",marginTop:4}}/></div>
              <div><label className="lbl">Pitch {pitch.toFixed(2)}</label><input type="range" min={0.2} max={2.0} step={0.05} value={pitch} onChange={e=>setPitch(+e.target.value)} style={{width:"100%",accentColor:"var(--y)",marginTop:4}}/></div>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><label className="lbl" style={{marginBottom:0}}>Ambient Music</label><div style={{fontSize:11,color:"var(--g3)",marginTop:4}}>{theme.label} ambient bed</div></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {ambOn&&<input type="range" min={0} max={1} step={0.05} value={ambVol} onChange={e=>{setAmbVol(+e.target.value);if(ambRef.current)ambRef.current.sv(+e.target.value);}} style={{width:80,accentColor:"var(--y)"}}/>}
              <div className={`tog${ambOn?" on":""}`} onClick={()=>setAmbOn(a=>!a)}/>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <label className="lbl" style={{marginBottom:0}}>Script · {words.length} words</label>
            <div style={{display:"flex",gap:6}}>
              <button className="btn bg bsm" onClick={()=>{navigator.clipboard.writeText(script);setCopyOk(true);setTimeout(()=>setCopyOk(false),1800);}}>
                {copyOk?<><Ic n="chk" s={11} c="var(--gr)"/>Copied</>:<><Ic n="copy" s={11}/>Copy</>}
              </button>
              <button className="btn bg bsm" onClick={()=>{setEditMode(e=>!e);setDraft(script);}}>
                <Ic n={editMode?"x":"edit"} s={11}/>{editMode?"Cancel":"Edit"}
              </button>
            </div>
          </div>
          {editMode?(<><textarea className="inp" value={draft} onChange={e=>setDraft(e.target.value)} style={{minHeight:140,fontSize:12,lineHeight:1.75}}/><button className="btn by bsm" style={{marginTop:8}} onClick={applyEdit}>Apply</button></>):(
            <div style={{fontSize:12,color:"var(--g4)",lineHeight:1.8,background:"var(--k3)",padding:"12px 14px",borderRadius:6,maxHeight:180,overflowY:"auto",cursor:"text"}} onClick={()=>{setEditMode(true);setDraft(script);}}>
              {words.map((w,i)=>(<span key={i} style={{color:wi===i?"#000":wi>i?"var(--g3)":"var(--g4)",background:wi===i?"var(--y)":"transparent",padding:wi===i?"0 3px":"0",borderRadius:wi===i?"2px":0,marginRight:3,transition:"background .08s"}}>{w}</span>))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MEDIA PICKER POPUP ─────────────────────────────────────── */
function MediaPicker({topic,plat,initCount,initPicked,onApply,onClose,toast}){
  const [q,setQ]=useState(topic||"");
  const [count,setCount]=useState(initCount||6);
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [sel,setSel]=useState(()=>{const m={};(initPicked||[]).forEach(c=>{m[c.src]=c;});return m;});
  const nSel=Object.keys(sel).length;
  const gk=getKey("av_gcse_key",OWNER_KEYS.googleKey),gx=getKey("av_gcse_cx",OWNER_KEYS.googleCx);
  const px=getKey("av_pexels_key",OWNER_KEYS.pexels),pb=getKey("av_pixabay_key",OWNER_KEYS.pixabay);

  const search=async()=>{
    const query=q.trim();if(!query){toast("Type a search first","warn");return;}
    setLoading(true);setSearched(true);
    try{
      const tokens=topicTokens(query);
      const batches=await Promise.all([
        srcGoogleCSE(query,gk,gx),
        srcPexels(query,px,plat),
        srcPixabay(query,pb,plat),
        srcCommonsVideo(query),
        srcOpenverse(query),
        srcWikimedia(query),
      ]);
      const seen=new Set();
      let cands=batches.flat().filter(c=>c.src&&!seen.has(c.src)&&seen.add(c.src));
      cands.forEach(c=>{c._s=relScore(c,tokens);});
      cands.sort((a,b)=>(b._s-a._s)||((b.kind==="video"?1:0)-(a.kind==="video"?1:0)));
      setResults(cands);
      if(!cands.length)toast(SANDBOXED?"The chat sandbox blocks searches — open index.html on your computer":"No results — try different words","warn");
    }catch(e){toast("Search failed: "+e.message,"error");}
    setLoading(false);
  };
  useEffect(()=>{if(topic&&topic.trim())search();/* eslint-disable-line */},[]);

  const toggle=c=>setSel(p=>{
    const n={...p};
    if(n[c.src])delete n[c.src];
    else{
      if(count>0&&Object.keys(n).length>=count){toast(`You chose ${count} max — raise the count, pick "No limit", or unselect one`,"warn");return p;}
      n[c.src]=c;
    }
    return n;
  });
  const autoPick=()=>{
    const top=results.slice(0,count>0?count:24);
    const m={};top.forEach(c=>{m[c.src]=c;});
    setSel(m);
  };
  return(
    <div className="mov" onClick={onClose}>
      <div className="mbox afi" onClick={e=>e.stopPropagation()} style={{maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"var(--fd)",fontSize:26,color:"var(--y)"}}>CHOOSE YOUR IMAGES & CLIPS</div>
            <div style={{fontSize:11,color:"var(--g3)"}}>Search Google{gk&&gx?"":" (add free key in Connect)"} + stock libraries, pick exactly what goes in your video</div>
          </div>
          <button className="btn bg bic" onClick={onClose}><Ic n="x" s={15}/></button>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <input className="inp" style={{flex:"1 1 240px"}} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Search images & clips…"/>
          <button className="btn by" onClick={search} disabled={loading}><Ic n="search" s={13} c="#000"/>{loading?"Searching…":"Search"}</button>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--g3)",letterSpacing:1}}>HOW MANY IN THE VIDEO</span>
          {[4,6,8,10,12,0].map(n=>(
            <button key={n} className={`pill bsm${count===n?" on":""}`} style={{padding:"4px 13px",fontWeight:800}} onClick={()=>setCount(n)}>{n===0?"No limit":n}</button>
          ))}
          <span style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            <span className="tg ty" style={{fontSize:10}}>{nSel}{count>0?`/${count}`:""} selected{count===0?" · no limit":""}</span>
            <button className="btn bg bsm" onClick={autoPick} disabled={!results.length}>Auto-pick {count>0?`top ${count}`:"all"}</button>
          </span>
        </div>

        <div style={{minHeight:200,maxHeight:"46vh",overflowY:"auto",borderRadius:8,border:"1px solid var(--g)",padding:10,background:"var(--k2)"}}>
          {loading?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:180,gap:10,color:"var(--g3)",fontSize:12}}>
              <span className="asp" style={{width:16,height:16,border:"2px solid var(--y)",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block"}}/>Searching sources…
            </div>
          ):results.length?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
              {results.map((c,i)=>{
                const on=!!sel[c.src];
                return(
                  <div key={c.src+i} onClick={()=>toggle(c)} style={{position:"relative",borderRadius:7,overflow:"hidden",cursor:"pointer",border:on?"2px solid var(--y)":"2px solid var(--g)",aspectRatio:"4/3",background:"#000",boxShadow:on?"0 0 14px rgba(255,230,0,.35)":"none"}}>
                    {c.thumb
                      ?<img src={c.thumb} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",opacity:on?1:.85}} onError={e=>{e.currentTarget.style.display="none";}}/>
                      :<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><Ic n="film" s={22} c="var(--g2)"/></div>}
                    {c.kind==="video"&&<span style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,.8)",borderRadius:3,padding:"1px 5px",fontSize:8,fontFamily:"var(--fm)",color:"var(--y)"}}>VIDEO</span>}
                    {on&&<span style={{position:"absolute",top:4,right:4,width:18,height:18,borderRadius:"50%",background:"var(--y)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="chk" s={11} c="#000"/></span>}
                    <span style={{position:"absolute",bottom:0,left:0,right:0,padding:"3px 6px",fontSize:8,fontFamily:"var(--fm)",color:"#ccc",background:"linear-gradient(transparent,rgba(0,0,0,.85))",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.credit}</span>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:180,gap:8,color:"var(--g3)",fontSize:12,textAlign:"center",padding:"0 20px"}}>
              <Ic n="search" s={26} c="var(--g2)"/>
              {searched?"Nothing found. Try different words — or add the free Google/Pexels keys in Connect for far better results.":"Search to load images and clips."}
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"var(--g3)",lineHeight:1.5,flex:"1 1 300px"}}>Pick fewer than {count} and the AI auto-fills the rest with topic-matched stock. Pick none to let it choose everything.</span>
          <button className="btn bg" onClick={()=>{setSel({});}}>Clear</button>
          <button className="btn by" onClick={()=>{onApply({picked:Object.values(sel),count});onClose();}}>Use {nSel?nSel+" selected":"auto-pick"} →</button>
        </div>
      </div>
    </div>
  );
}

/* ─── STUDIO ─────────────────────────────────────────────────── */
function Studio({onGenerate,toast}){
  const [topic,setTopic]=useState("");
  const [style,setStyle]=useState("motivational");
  const [plat,setPlat]=useState("portrait");
  const [dur,setDur]=useState(60);
  const [cstyle,setCstyle]=useState("tiktok");
  const [vstyle,setVstyle]=useState("aurora");
  const [picker,setPicker]=useState(false);
  const [picked,setPicked]=useState([]);
  const [mediaCount,setMediaCount]=useState(6);
  const mediaMode="stock";  /* stock footage always; motion graphics only auto-fallback */
  const [files,setFiles]=useState([]);
  const fileRef=useRef(null);
  const hasPx=!!getKey("av_pexels_key",OWNER_KEYS.pexels),hasPb=!!getKey("av_pixabay_key",OWNER_KEYS.pixabay);

  const VS=[
    {id:"motivational",l:"Motivational",d:"High energy, inspire"},
    {id:"educational", l:"Educational", d:"Teach something"},
    {id:"facts",       l:"Facts",       d:"Mind-blowing facts"},
    {id:"story",       l:"Story",       d:"Narrative journey"},
    {id:"news",        l:"News",        d:"Authoritative"},
  ];
  const EX=["The gym","Cold showers","Stoicism","Discipline","Morning routines","Billionaire habits","Meditation","Sleep science","Self-improvement","Dopamine detox"];
  const theme=detectTheme(topic||"motivation");
  const canGo=topic.trim().length>=2;

  return(
    <div className="aup" style={{maxWidth:680,margin:"0 auto",padding:"0 0 40px"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"var(--fd)",fontSize:46,color:"var(--w)",lineHeight:.88,marginBottom:10}}>CREATE A VIDEO</div>
        <div style={{fontSize:13,color:"var(--g3)"}}>AI script · real stock footage · voiceover · word-synced captions — rendered into a finished video in your browser</div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <label className="lbl">What's your video about?</label>
        <input className="inp" style={{fontSize:17,padding:"14px 16px"}}
          placeholder='"the gym" "cold showers" "stoicism" "discipline"…'
          value={topic} onChange={e=>setTopic(e.target.value)} autoFocus/>
        {topic.trim().length>1&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:11,color:"var(--g3)"}}>
            Palette: <strong style={{color:theme.acc}}>{theme.label}</strong>
            <div style={{width:9,height:9,borderRadius:"50%",background:theme.acc}}/>
          </div>
        )}
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>
          {EX.map(ex=>(<button key={ex} className="pill bsm" style={{padding:"4px 12px",fontSize:11}} onClick={()=>setTopic(ex)}>{ex}</button>))}
        </div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <label className="lbl">Footage — real video clips & photos, AI-matched to your topic</label>
        {(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <button className="btn bo bsm" onClick={()=>setPicker(true)}><Ic n="search" s={12} c="var(--y)"/>Pick images & clips yourself</button>
            {picked.length>0
              ?<span className="tg ty" style={{fontSize:10}}>{picked.length} hand-picked{mediaCount>0?` · ${mediaCount} total`:" · no limit"}</span>
              :<span className="tg tgg" style={{fontSize:10}}>Auto-pick · {mediaCount>0?mediaCount+" segments":"no limit"}</span>}
            {picked.length>0&&<button className="btn bg bsm" onClick={()=>setPicked([])}>Clear picks</button>}
          </div>
        )}
        {(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",fontSize:10,fontFamily:"var(--fm)"}}>
            <span className="tg tgg">Openverse · free, no key</span>
            <span className="tg tgg">Wikimedia · free, no key</span>
            <span className="tg" style={{border:"1px solid var(--g)",color:hasPx?"var(--gr)":"var(--g3)"}}>Pexels video {hasPx?"· key set":"· add free key"}</span>
            <span className="tg" style={{border:"1px solid var(--g)",color:hasPb?"var(--gr)":"var(--g3)"}}>Pixabay video {hasPb?"· key set":"· add free key"}</span>
          </div>
        )}
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}}
            onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,10))}/>
          <button className="btn bo bsm" onClick={()=>fileRef.current&&fileRef.current.click()}>
            <Ic n="plus" s={11} c="var(--y)"/>Upload your own clips & photos
          </button>
          {files.length>0&&(<>
            <span className="tg tgg" style={{fontSize:9}}>{files.length} file{files.length>1?"s":""} ready — always works, even in this preview</span>
            <button className="btn bg bsm" onClick={()=>{setFiles([]);if(fileRef.current)fileRef.current.value="";}}>Clear</button>
          </>)}
        </div>
        {!hasPx&&!hasPb&&(
          <div style={{fontSize:10,color:"var(--g3)",marginTop:8,lineHeight:1.6}}>For real <strong style={{color:"var(--g4)"}}>video clips</strong> (not just photos), paste a free Pexels or Pixabay key in <strong style={{color:"var(--y)"}}>Connect → Stock Footage Sources</strong> — takes 2 minutes, costs nothing.</div>
        )}
      </div>

      <div className="card" style={{marginBottom:14}}>
        <label className="lbl">Script Style</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:7}}>
          {VS.map(v=>(
            <button key={v.id} className={`pill${style===v.id?" on":""}`} style={{textAlign:"left",justifyContent:"flex-start",flexDirection:"column",alignItems:"flex-start",gap:2,padding:"10px 14px"}} onClick={()=>setStyle(v.id)}>
              <span style={{fontSize:13,fontWeight:700}}>{v.l}</span>
              <span style={{fontSize:10,color:"var(--g3)"}}>{v.d}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card">
          <label className="lbl">Platform</label>
          {[{id:"portrait",l:"Reels / Shorts",a:"9:16",ic:"ig"},{id:"landscape",l:"YouTube",a:"16:9",ic:"yt"}].map(p=>(
            <button key={p.id} className={`pill${plat===p.id?" on":""}`} style={{width:"100%",justifyContent:"space-between",marginBottom:6,padding:"10px 14px"}} onClick={()=>setPlat(p.id)}>
              <span style={{display:"flex",alignItems:"center",gap:8,fontWeight:700}}><Ic n={p.ic} s={14}/>{p.l}</span>
              <span style={{fontSize:10,color:"var(--g3)",fontFamily:"var(--fm)"}}>{p.a}</span>
            </button>
          ))}
        </div>
        <div className="card">
          <label className="lbl">Duration</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{s:30,l:"30s"},{s:60,l:"60s"},{s:90,l:"90s"},{s:120,l:"2m"},{s:180,l:"3m"},{s:300,l:"5m"}].map(d=>(
              <button key={d.s} className={`pill${dur===d.s?" on":""}`} style={{justifyContent:"center",padding:"9px 6px",fontWeight:700}} onClick={()=>setDur(d.s)}>{d.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:22}}>
        <label className="lbl">Caption Style</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[{id:"tiktok",l:"TikTok Bold"},{id:"subtitle",l:"Subtitle"},{id:"center",l:"Center Pop"},{id:"clean",l:"Clean"}].map(c=>(
            <button key={c.id} className={`cpick${cstyle===c.id?" on":""}`} style={{height:46,background:"linear-gradient(135deg,#0d0d14,#1a1a26)"}} onClick={()=>setCstyle(c.id)}>
              <span style={{fontSize:11,fontWeight:700,color:cstyle===c.id?"var(--y)":"var(--g4)"}}>{c.l}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn by" style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px"}}
        onClick={()=>onGenerate({topic:topic.trim(),style,platform:plat,duration:dur,captionStyle:cstyle,vstyle,picked,mediaCount,mediaMode,files})}
        disabled={!canGo}>
        <Ic n="sparkle" s={16} c="#000"/>
        {canGo?`Generate "${topic}"`:"Enter a topic above"}
      </button>
      {picker&&<MediaPicker topic={topic} plat={plat} initCount={mediaCount} initPicked={picked} toast={toast}
        onApply={({picked:pk,count})=>{setPicked(pk);setMediaCount(count);}}
        onClose={()=>setPicker(false)}/>}
    </div>
  );
}

/* ─── EXTRA CSS (platform shell) ─────────────────────────────── */
const CSS2=`
.side{width:200px;flex-shrink:0;border-right:1px solid var(--g);padding:18px 12px;display:flex;flex-direction:column;gap:4px;min-height:calc(100vh - 64px);background:var(--k1)}
.sitem{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--g4);transition:all .15s;border:1px solid transparent;margin-bottom:3px}
.sitem:hover{background:var(--k3);color:var(--w)}
.sitem.on{background:rgba(255,230,0,.1);color:var(--y);border-color:rgba(255,230,0,.25)}
.vcard{background:var(--k2);border:1px solid var(--g);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .18s}
.vcard:hover{border-color:var(--y);transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.5)}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:9px;font-weight:800;font-family:var(--fm);letter-spacing:.5px;text-transform:uppercase}
.chip.draft{background:rgba(152,152,168,.12);color:var(--g4);border:1px solid var(--g)}
.chip.scheduled{background:rgba(77,138,255,.12);color:var(--bl);border:1px solid rgba(77,138,255,.3)}
.chip.posted{background:rgba(0,230,118,.12);color:var(--gr);border:1px solid rgba(0,230,118,.3)}
.mov{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px}
.mbox{background:var(--k1);border:1px solid var(--g);border-radius:14px;max-width:880px;width:100%;max-height:92vh;overflow-y:auto;padding:22px}
.ptab{flex:1;padding:9px;text-align:center;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;border:1px solid var(--g);color:var(--g4);background:var(--k2)}
.ptab.on{background:rgba(255,230,0,.1);color:var(--y);border-color:var(--y)}
.utr{display:grid;grid-template-columns:1.6fr 1fr .7fr .7fr .9fr;gap:10px;padding:11px 14px;align-items:center;border-bottom:1px solid var(--k3);font-size:12px}
.utr:hover{background:var(--k2)}
.obdot{width:8px;height:8px;border-radius:50%;background:var(--g)}
.obdot.on{background:var(--y);box-shadow:0 0 10px rgba(255,230,0,.6)}
.vpick{border:2px solid var(--g);border-radius:9px;overflow:hidden;cursor:pointer;position:relative;transition:all .15s;background:#000}
.vpick:hover{border-color:var(--g2);transform:translateY(-1px)}
.vpick.on{border-color:var(--y);box-shadow:0 0 18px rgba(255,230,0,.25)}
.vplbl{position:absolute;bottom:0;left:0;right:0;padding:5px 8px;font-size:10px;font-weight:800;letter-spacing:.4px;background:linear-gradient(transparent,rgba(0,0,0,.88));color:#fff}
.vpick.on .vplbl{color:var(--y)}
.ptab{display:flex;align-items:center;justify-content:center;gap:7px}
/* ── AMBIENT FX ───────────────────────────── */
.bgfx{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.fxa,.fxb{position:absolute;width:900px;height:900px;border-radius:50%;filter:blur(90px);opacity:.10}
.fxa{background:radial-gradient(circle,#FFE600 0%,transparent 60%);top:-300px;left:-220px;animation:fxa 26s ease-in-out infinite}
.fxb{background:radial-gradient(circle,#FFB800 0%,transparent 60%);bottom:-360px;right:-260px;animation:fxb 32s ease-in-out infinite}
@keyframes fxa{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(150px,90px) scale(1.15)}}
@keyframes fxb{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-170px,-110px) scale(1.1)}}
.scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,230,0,.022) 0 1px,transparent 1px 4px)}
/* ── GLOW CARDS & BUTTONS ─────────────────── */
.card{transition:border-color .2s,box-shadow .25s,transform .2s}
.card:hover{border-color:rgba(255,230,0,.28);box-shadow:0 0 0 1px rgba(255,230,0,.05),0 14px 44px rgba(0,0,0,.45),0 0 36px rgba(255,230,0,.05)}
.by{position:relative;overflow:hidden;box-shadow:0 0 22px rgba(255,230,0,.22),0 4px 18px rgba(0,0,0,.4)}
.by:hover{box-shadow:0 0 36px rgba(255,230,0,.42),0 6px 22px rgba(0,0,0,.45)}
.by::after{content:"";position:absolute;top:0;left:-80%;width:50%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);transition:left .55s ease}
.by:hover::after{left:130%}
/* ── HERO 3D & TYPE GLOW ──────────────────── */
.hglow{text-shadow:0 0 26px rgba(255,230,0,.55),0 0 80px rgba(255,230,0,.22)}
.float3d{transform:perspective(1100px) rotateY(-9deg) rotateX(3deg);animation:fl3d 7s ease-in-out infinite;position:relative}
@keyframes fl3d{0%,100%{transform:perspective(1100px) rotateY(-9deg) rotateX(3deg) translateY(0)}50%{transform:perspective(1100px) rotateY(-5deg) rotateX(1.5deg) translateY(-14px)}}
.fxring{position:absolute;inset:-28px;border-radius:46px;background:radial-gradient(ellipse at 50% 45%,rgba(255,230,0,.22),transparent 65%);filter:blur(14px);z-index:-1;animation:pulse 4.5s ease-in-out infinite}
/* ── MARQUEE ──────────────────────────────── */
.marq{overflow:hidden;border-top:1px solid var(--g);border-bottom:1px solid var(--g);background:rgba(255,230,0,.025);padding:13px 0;white-space:nowrap}
.marq-in{display:inline-block;animation:marq 30s linear infinite}
.marq span{font-family:var(--fd);font-size:22px;letter-spacing:2px;color:transparent;-webkit-text-stroke:1px rgba(255,230,0,.45);margin:0 26px}
.marq span.fill{color:var(--y);-webkit-text-stroke:0;text-shadow:0 0 18px rgba(255,230,0,.5)}
@keyframes marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* ── SIDEBAR GLOW BAR ─────────────────────── */
.sitem{position:relative}
.sitem.on::before{content:"";position:absolute;left:-12px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--y);box-shadow:0 0 12px rgba(255,230,0,.8)}
.hslash{display:inline-flex;align-items:center;gap:12px}
.hslash::before{content:"";width:34px;height:4px;background:var(--y);box-shadow:0 0 14px rgba(255,230,0,.7);transform:skewX(-22deg)}
/* ── transport bar ─────────────────────── */
.tbar{display:flex;align-items:center;gap:8px;background:var(--k2);border:1px solid var(--g);border-radius:10px;padding:8px 12px}
.tbtn{width:34px;height:30px;border-radius:7px;background:var(--y);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:10px;font-weight:700;color:#000;transition:transform .15s var(--ease),box-shadow .2s}
.tbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 0 14px rgba(255,230,0,.4)}
.tbtn:disabled{opacity:.4;cursor:default}
.tbtn.sm{background:var(--k3);color:var(--g4);border:1px solid var(--g)}
.tbtn.sm:hover:not(:disabled){color:var(--y);border-color:var(--y);box-shadow:none}
.pbar{width:3px;height:11px;background:#000;border-radius:1px;display:inline-block}
.tstamp{font-family:var(--fm);font-size:10px;color:var(--g4);white-space:nowrap;min-width:74px;text-align:right}
.scrub{flex:1;-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:var(--k4) linear-gradient(var(--y),var(--y)) no-repeat;cursor:pointer;outline:none;transition:height .15s}
.scrub:hover{height:7px}
.scrub::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--y);box-shadow:0 0 8px rgba(255,230,0,.6);cursor:grab;border:2px solid #000}
.scrub::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--y);border:2px solid #000;cursor:grab}
.scrub:disabled{opacity:.45;cursor:default}
/* ── refined motion language ───────────── */
.aup{animation:up .45s var(--ease)}
.aup>.card,.aup>div>.card{animation:up .5s var(--ease) backwards}
.aup>.card:nth-of-type(2),.aup>div>.card:nth-of-type(2){animation-delay:.05s}
.aup>.card:nth-of-type(3),.aup>div>.card:nth-of-type(3){animation-delay:.1s}
.aup>.card:nth-of-type(4),.aup>div>.card:nth-of-type(4){animation-delay:.15s}
.aup>.card:nth-of-type(5),.aup>div>.card:nth-of-type(5){animation-delay:.2s}
.mov{animation:fi .18s ease-out}
.mbox{animation:mpop .32s var(--ease)}
@keyframes mpop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
.btn,.pill,.sitem,.vpick,.vcard,.ptab{transition:all .18s var(--ease)}
.pill:hover{transform:translateY(-1px)}
.pill.on{box-shadow:0 0 12px rgba(255,230,0,.15)}
.btn:active,.tbtn:active{transform:scale(.96)}
.inp{transition:border-color .18s,box-shadow .18s}
.inp:focus{border-color:var(--y);box-shadow:0 0 0 3px rgba(255,230,0,.12);outline:none}
.sitem:hover{transform:translateX(2px)}
/* ── logo ──────────────────────────────── */
.logoMark{position:relative;display:inline-flex;border-radius:30%;flex-shrink:0;transition:transform .25s var(--ease);animation:logoGlow 4s ease-in-out infinite}
.logoMark:hover{transform:rotate(-6deg) scale(1.08)}
@keyframes logoGlow{0%,100%{filter:drop-shadow(0 0 5px rgba(255,230,0,.35))}50%{filter:drop-shadow(0 0 13px rgba(255,230,0,.7))}}
/* ── ambient movement ── */
.gbg{animation:gridDrift 26s linear infinite}
@keyframes gridDrift{from{background-position:0 0}to{background-position:52px 52px}}
.by{animation:ctaBreathe 3.4s ease-in-out infinite}
@keyframes ctaBreathe{0%,100%{box-shadow:0 0 20px rgba(255,230,0,.2),0 4px 18px rgba(0,0,0,.4)}50%{box-shadow:0 0 38px rgba(255,230,0,.45),0 4px 18px rgba(0,0,0,.4)}}
.floaty{animation:floaty 5.5s ease-in-out infinite}
.floaty:nth-of-type(2){animation-delay:.7s}.floaty:nth-of-type(3){animation-delay:1.4s}.floaty:nth-of-type(4){animation-delay:2.1s}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.fxc{position:absolute;top:18%;left:52%;width:560px;height:560px;border-radius:50%;border:1px dashed rgba(255,230,0,.08);animation:spinSlow 70s linear infinite}
.fxc::after{content:"";position:absolute;top:-4px;left:50%;width:7px;height:7px;border-radius:50%;background:rgba(255,230,0,.5);box-shadow:0 0 12px rgba(255,230,0,.8)}
@keyframes spinSlow{to{transform:rotate(360deg)}}
.sitem.on::before{animation:barPulse 2.6s ease-in-out infinite}
@keyframes barPulse{0%,100%{box-shadow:0 0 8px rgba(255,230,0,.6)}50%{box-shadow:0 0 16px rgba(255,230,0,1)}}
.chip.scheduled{animation:chipBlink 2.4s ease-in-out infinite}
@keyframes chipBlink{0%,100%{opacity:1}50%{opacity:.55}}
.logoMark:hover{transform:rotate(-7deg) scale(1.07)}
.logoMark::after{content:"";position:absolute;top:0;left:-130%;width:60%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-20deg);animation:glint 5.5s ease-in-out infinite}
@keyframes glint{0%,76%{left:-130%}88%{left:150%}100%{left:150%}}
/* ── rising sparks ─────────────────────── */
.sp{position:absolute;bottom:-4vh;width:4px;height:4px;border-radius:50%;background:var(--y);box-shadow:0 0 10px 2px rgba(255,230,0,.5);opacity:0;animation:rise var(--d,20s) linear infinite}
.sp1{left:8%;--d:22s;animation-delay:0s;transform:scale(.7)}
.sp2{left:23%;--d:17s;animation-delay:4s}
.sp3{left:46%;--d:26s;animation-delay:9s;transform:scale(.6)}
.sp4{left:64%;--d:19s;animation-delay:2s;transform:scale(1.2)}
.sp5{left:81%;--d:24s;animation-delay:12s}
.sp6{left:93%;--d:16s;animation-delay:6s;transform:scale(.8)}
@keyframes rise{0%{transform:translateY(0);opacity:0}8%{opacity:.45}85%{opacity:.25}100%{transform:translateY(-108vh);opacity:0}}
/* ── living headline + CTA ─────────────── */
.hglow{animation:hpulse 3.8s ease-in-out infinite}
@keyframes hpulse{0%,100%{text-shadow:0 0 22px rgba(255,230,0,.45),0 0 70px rgba(255,230,0,.18)}50%{text-shadow:0 0 34px rgba(255,230,0,.75),0 0 110px rgba(255,230,0,.32)}}
.bxl::after{animation:autosheen 4.6s ease-in-out infinite}
@keyframes autosheen{0%,68%{left:-80%}84%{left:130%}100%{left:130%}}
/* ── scroll reveal ─────────────────────── */
.rv{opacity:0;transform:translateY(26px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.rv.on{opacity:1;transform:none}
.tstamp,.chip{font-variant-numeric:tabular-nums}
@media(prefers-reduced-motion:reduce){.fxa,.fxb,.fxc,.float3d,.marq-in,.by,.by::after,.aup,.aup .card,.mbox,.sp,.hglow,.gbg,.floaty,.logoMark,.logoMark::after,.bxl::after,.sitem.on::before,.chip.scheduled{animation:none;transition:none}.rv{opacity:1;transform:none}}
@media(max-width:860px){.side{width:60px}.side .slbl{display:none}}
`;

/* ─── helpers ────────────────────────────────────────────────── */
const fDate=ts=>new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fDur=s=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;

/* ─── AUTH SCREEN ────────────────────────────────────────────── */
function AuthScreen({mode,onAuth,onSwitch,onHome,toast}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [err,setErr]=useState("");
  const submit=()=>{
    setErr("");
    const users=loadUsers();
    if(mode==="login"){
      const u=users.find(x=>x.email.toLowerCase()===email.trim().toLowerCase()&&x.pass===pass);
      if(!u){setErr("Invalid email or password.");return;}
      setSession(u.id);onAuth(u);
    }else{
      if(!name.trim()){setErr("Enter your name.");return;}
      if(!/.+@.+\..+/.test(email)){setErr("Enter a valid email.");return;}
      if(pass.length<6){setErr("Password must be 6+ characters.");return;}
      if(users.some(x=>x.email.toLowerCase()===email.trim().toLowerCase())){setErr("Account already exists — log in instead.");return;}
      const u={id:"u"+Date.now(),email:email.trim(),pass,name:name.trim(),credits:10,plan:"free",isAdmin:false,onboarded:false,connected:{yt:null,ig:null},createdAt:Date.now()};
      saveUsers([...users,u]);setSession(u.id);
      toast("Account created — 10 free credits added ✓");
      onAuth(u);
    }
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} className="gbg">
      <div style={{width:"100%",maxWidth:400}} className="aup">
        <div style={{textAlign:"center",marginBottom:26,cursor:"pointer"}} onClick={onHome}>
          <div style={{display:"inline-flex",marginBottom:10}}><Logo s={48}/></div>
          <div style={{fontFamily:"var(--fd)",fontSize:34,letterSpacing:2,color:"var(--y)"}}>AUTOVIRAL</div>
          <div style={{fontSize:12,color:"var(--g3)"}}>{mode==="login"?"Welcome back":"Create your account · 10 free credits"}</div>
        </div>
        <div className="card">
          {mode==="signup"&&<div style={{marginBottom:12}}><label className="lbl">Name</label><input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div>}
          <div style={{marginBottom:12}}><label className="lbl">Email</label><input className="inp" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com"/></div>
          <div style={{marginBottom:14}}><label className="lbl">Password</label><input className="inp" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          {err&&<div style={{background:"rgba(255,64,64,.1)",border:"1px solid rgba(255,64,64,.3)",color:"var(--r)",borderRadius:6,padding:"9px 12px",fontSize:12,marginBottom:12}}>{err}</div>}
          <button className="btn by" style={{width:"100%",justifyContent:"center",padding:"13px"}} onClick={submit}>{mode==="login"?"Log In":"Sign Up Free"} →</button>
          <div style={{textAlign:"center",marginTop:14,fontSize:12,color:"var(--g3)"}}>
            {mode==="login"?"No account? ":"Already a member? "}
            <span style={{color:"var(--y)",cursor:"pointer",fontWeight:700}} onClick={onSwitch}>{mode==="login"?"Sign up":"Log in"}</span>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:14,fontSize:10,fontFamily:"var(--fm)",color:"var(--g2)"}}>Demo admin · admin@autoviral.com / admin123</div>
      </div>
    </div>
  );
}

/* ─── ONBOARDING ─────────────────────────────────────────────── */
function Onboarding({user,onDone}){
  const [step,setStep]=useState(0);
  const [niche,setNiche]=useState("");
  const [plats,setPlats]=useState([]);
  const NICHES=["Motivation","Fitness","Finance","Tech & AI","Mindfulness","Food","Travel","Gaming","Facts & Education"];
  const steps=[
    {t:"Welcome to Autoviral",d:`Hey ${user.name.split(" ")[0]}! Autoviral turns a topic into a finished, ready-to-post video — AI script, real stock footage, voiceover, captions, title & description — all in your browser, free.`,
      body:<div style={{display:"flex",flexDirection:"column",gap:10}}>{[["sparkle","AI writes the script","A hook-first voiceover script for any topic"],["film","Real footage & photos","Stock video clips and imagery matched to your script"],["mic","AI voiceover baked in","Real audio track — download a finished video file"],["cal","Schedule & manage","Library, scheduling, and per-platform formatting"]].map(([e,t,d])=>(
        <div key={t} style={{display:"flex",gap:12,alignItems:"flex-start",background:"var(--k2)",border:"1px solid var(--g)",borderRadius:8,padding:"11px 14px"}}>
          <span style={{width:34,height:34,borderRadius:8,background:"rgba(255,230,0,.08)",border:"1px solid rgba(255,230,0,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n={e} s={15} c="var(--y)"/></span><div><div style={{fontWeight:700,fontSize:13}}>{t}</div><div style={{fontSize:11,color:"var(--g3)"}}>{d}</div></div>
        </div>))}</div>},
    {t:"What's your channel about?",d:"This helps pre-fill themes and image searches. You can always change it per video.",
      body:<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{NICHES.map(n=>(
        <button key={n} className={`pill${niche===n?" on":""}`} style={{padding:"10px 18px"}} onClick={()=>setNiche(n)}>{n}</button>))}</div>},
    {t:"Where will you post?",d:"Pick your platforms — videos get formatted for each (9:16 Reels/Shorts or 16:9 YouTube, captions, hashtags).",
      body:<div style={{display:"flex",gap:12}}>{[["yt","YouTube","16:9 + Shorts"],["ig","Instagram","Reels 9:16"]].map(([id,l,d])=>(
        <button key={id} className={`pill${plats.includes(id)?" on":""}`} style={{flex:1,flexDirection:"column",padding:"18px",gap:4}} onClick={()=>setPlats(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}>
          <Ic n={id} s={20}/>
          <span style={{fontSize:15,fontWeight:800}}>{l}</span><span style={{fontSize:10,color:"var(--g3)"}}>{d}</span>
        </button>))}</div>},
    {t:"You have 10 free credits",d:"1 credit = 1 generated video. Create your first one now — it takes about a minute.",
      body:<div style={{textAlign:"center",padding:"10px 0"}}><div style={{fontFamily:"var(--fd)",fontSize:72,color:"var(--y)",lineHeight:1}}>10</div><div style={{fontSize:12,color:"var(--g3)"}}>credits ready · earn more from the admin or upgrade later</div></div>},
  ];
  const s=steps[step];
  const canNext=step!==1||!!niche;
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} className="gbg">
      <div style={{width:"100%",maxWidth:520}} className="aup" key={step}>
        <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:22}}>{steps.map((_,i)=><div key={i} className={`obdot${i<=step?" on":""}`}/>)}</div>
        <div className="card" style={{padding:26}}>
          <div style={{fontFamily:"var(--fd)",fontSize:32,color:"var(--y)",marginBottom:8}}>{s.t.toUpperCase()}</div>
          <div style={{fontSize:13,color:"var(--g3)",lineHeight:1.7,marginBottom:18}}>{s.d}</div>
          {s.body}
          <div style={{display:"flex",gap:10,marginTop:22}}>
            {step>0&&<button className="btn bg" style={{padding:"11px 20px",borderRadius:6}} onClick={()=>setStep(step-1)}>← Back</button>}
            <button className="btn by" style={{flex:1,justifyContent:"center",padding:"12px"}} disabled={!canNext}
              onClick={()=>{
                if(step<steps.length-1)setStep(step+1);
                else onDone({niche,platforms:plats});
              }}>
              {step<steps.length-1?"Continue →":"Create my first video"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── VIDEO MANAGE MODAL ─────────────────────────────────────── */
function VideoModal({vid,urls,onClose,onChange,onDelete,user,toast}){
  const [tab,setTab]=useState(vid.platform==="landscape"?"yt":"ig");
  const [title,setTitle]=useState(vid.title);
  const [desc,setDesc]=useState(vid.description);
  const [igCap,setIgCap]=useState(vid.igCaption||vid.title);
  const [sched,setSched]=useState(vid.scheduledAt?new Date(vid.scheduledAt).toISOString().slice(0,16):"");
  const [posting,setPosting]=useState("");
  const [igUrl,setIgUrl]=useState(vid.igUrl||"");
  const tags=(vid.hashtags||[]).join(" ");
  const conn=user?.connected||{};
  const saveMeta=async()=>{await onChange({...vid,title,description:desc,igCaption:igCap});toast("Metadata saved ✓");};
  const doSchedule=async()=>{
    if(!sched){toast("Pick a date & time first","warn");return;}
    await onChange({...vid,title,description:desc,igCaption:igCap,status:"scheduled",scheduledAt:new Date(sched).getTime()});
    toast(`Scheduled for ${fDate(new Date(sched).getTime())} ✓`);
  };
  const assistedPost=async(plat)=>{
    const a=document.createElement("a");a.href=urls.blob;a.download=`${title.replace(/\s+/g,"-")}.${vid.ext||"webm"}`;a.click();
    const text=plat==="yt"?`${title}\n\n${desc}\n\n${tags}`:`${igCap}\n\n${tags}`;
    try{await navigator.clipboard.writeText(text);}catch{}
    window.open(plat==="yt"?"https://studio.youtube.com/channel/upload":"https://www.instagram.com/","_blank");
    await onChange({...vid,title,description:desc,igCaption:igCap,status:"posted",postedVia:"assisted",postedAt:Date.now()});
    toast(`Video downloaded + ${plat==="yt"?"title/description":"caption"} copied — paste in the upload page ✓`);
  };
  const postNow=async(plat)=>{
    if(posting)return;
    if(plat==="yt"){
      const cid=getKey("av_yt_client",OWNER_KEYS.googleClientId);
      if(!cid){await assistedPost("yt");return;}
      try{
        setPosting("Authorizing…");
        const v=await ytUpload(vid.blob,{title,description:desc,tags:vid.hashtags},m=>setPosting(m));
        await onChange({...vid,title,description:desc,igCaption:igCap,status:"posted",postedVia:"youtube",ytId:v.id,postedAt:Date.now()});
        toast(`Uploaded to YouTube ✓ — youtu.be/${v.id}`);
        window.open(`https://youtu.be/${v.id}`,"_blank");
      }catch(e){
        toast(`YouTube upload failed: ${e.message}. Using assisted posting instead.`,"error");
        await assistedPost("yt");
      }finally{setPosting("");}
    }else{
      const igId=(LS.get("av_ig_user")||"").trim(),igT=(LS.get("av_ig_tok")||"").trim();
      if(igId&&igT&&igUrl.trim()){
        try{
          setPosting("Publishing to Instagram…");
          await igPublish({igUserId:igId,accessToken:igT,videoUrl:igUrl.trim(),caption:`${igCap}\n\n${tags}`},m=>setPosting(m));
          await onChange({...vid,title,description:desc,igCaption:igCap,status:"posted",postedVia:"instagram",postedAt:Date.now()});
          toast("Published to Instagram ✓");
        }catch(e){
          toast(`Instagram publish failed: ${e.message}`,"error");
        }finally{setPosting("");}
      }else{
        await assistedPost("ig");
      }
    }
  };
  return(
    <div className="mov" onClick={onClose}>
      <div className="mbox afi" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <span className={`chip ${vid.status}`}>{vid.status}</span>
            <div style={{fontFamily:"var(--fd)",fontSize:26,color:"var(--w)",marginTop:6}}>{vid.topic.toUpperCase()}</div>
            <div style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--g3)"}}>{fDur(vid.duration)} · {vid.platform==="portrait"?"9:16":"16:9"} · {(vid.size/1024/1024).toFixed(1)} MB · {fDate(vid.createdAt)}</div>
          </div>
          <button className="btn bg bsm" onClick={onClose}><Ic n="x" s={13}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:vid.platform==="portrait"?"260px 1fr":"380px 1fr",gap:18}}>
          <div>
            <video src={urls.blob} poster={urls.thumb} controls preload="metadata"
              onLoadedMetadata={e=>{const v=e.currentTarget;if(!isFinite(v.duration)){v.currentTime=1e7;const fix=()=>{v.removeEventListener("timeupdate",fix);v.currentTime=0;};v.addEventListener("timeupdate",fix);}}}
              style={{width:"100%",borderRadius:10,border:"1px solid var(--g)",background:"#000",aspectRatio:vid.platform==="portrait"?"9/16":"16/9"}}/>
            <a href={urls.blob} download={`${title.replace(/\s+/g,"-")}.${vid.ext||"webm"}`} className="btn bo" style={{width:"100%",justifyContent:"center",marginTop:10,textDecoration:"none"}}><Ic n="dl" s={13} c="var(--y)"/>Download</a>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:8}}>
              <div className={`ptab${tab==="yt"?" on":""}`} onClick={()=>setTab("yt")}><Ic n="yt" s={13}/>YouTube {conn.yt?"· "+conn.yt.handle:""}</div>
              <div className={`ptab${tab==="ig"?" on":""}`} onClick={()=>setTab("ig")}><Ic n="ig" s={13}/>Instagram {conn.ig?"· "+conn.ig.handle:""}</div>
            </div>
            {tab==="yt"?(<>
              <div><label className="lbl">Title · {title.length}/100</label><input className="inp" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></div>
              <div><label className="lbl">Description</label><textarea className="inp" style={{minHeight:90,fontSize:12}} value={desc} onChange={e=>setDesc(e.target.value)}/></div>
            </>):(<>
              <div><label className="lbl">Reel Caption · {igCap.length}/2200</label><textarea className="inp" style={{minHeight:90,fontSize:12}} value={igCap} maxLength={2200} onChange={e=>setIgCap(e.target.value)}/></div>
              <div>
                <label className="lbl">Public video URL — required for real auto-publish</label>
                <input className="inp" placeholder="https://yourdomain.com/videos/this-video.mp4" value={igUrl} onChange={e=>setIgUrl(e.target.value)}/>
                <div style={{fontSize:9,color:"var(--g3)",marginTop:5,lineHeight:1.5}}>Meta downloads the video from a public link (MP4) — it can't take a local file. Host the downloaded file on your site, then paste its URL. Without it, posting uses the assisted flow.</div>
              </div>
              {vid.platform==="landscape"&&<div style={{fontSize:10,color:"var(--or)",background:"rgba(255,122,48,.07)",border:"1px solid rgba(255,122,48,.2)",borderRadius:6,padding:"8px 10px"}}>Heads up: this video is 16:9 — Reels prefer 9:16. Regenerate in Portrait for best reach.</div>}
            </>)}
            <div style={{fontSize:11,color:"var(--g4)",display:"flex",gap:6,flexWrap:"wrap"}}>{(vid.hashtags||[]).map(h=><span key={h} className="tg ty" style={{fontSize:9}}>{h}</span>)}</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg bsm" onClick={saveMeta}><Ic n="chk" s={11}/>Save metadata</button>
            </div>
            <div className="card" style={{padding:14}}>
              <label className="lbl">Schedule auto-post</label>
              <div style={{display:"flex",gap:8}}>
                <input className="inp" type="datetime-local" value={sched} onChange={e=>setSched(e.target.value)} style={{flex:1}}/>
                <button className="btn bo bsm" onClick={doSchedule}>Schedule</button>
              </div>
              {vid.scheduledAt&&<div style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--bl)",marginTop:8}}>Queued for {fDate(vid.scheduledAt)}</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn by" style={{flex:1,justifyContent:"center"}} onClick={()=>postNow(tab)} disabled={!!posting}>{posting||`Post to ${tab==="yt"?"YouTube":"Instagram"} now →`}</button>
              <button className="btn bsm" style={{background:"rgba(255,64,64,.1)",color:"var(--r)",border:"1px solid rgba(255,64,64,.35)",borderRadius:6,padding:"8px 14px"}} onClick={()=>{onDelete(vid.id);onClose();}}>Delete</button>
            </div>
            <div style={{fontSize:9,color:"var(--g3)",lineHeight:1.5}}>"Post now" downloads the file and copies the formatted {tab==="yt"?"title + description":"caption"}, then opens the upload page. Fully automated posting requires YouTube Data API / Instagram Graph API keys on a server — slots for those are in Connect Accounts.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MY VIDEOS SCREEN ───────────────────────────────────────── */
function VideosScreen({user,toast,onCreate,refreshKey}){
  const [vids,setVids]=useState([]);
  const [urls,setUrls]=useState({});
  const [open,setOpen]=useState(null);
  const [filter,setFilter]=useState("all");
  const load=useCallback(async()=>{
    const all=(await dbAll()).filter(v=>!user||v.userId===user.id||user.isAdmin).sort((a,b)=>b.createdAt-a.createdAt);
    setVids(all);
    setUrls(prev=>{
      const next={...prev};
      all.forEach(v=>{if(!next[v.id])next[v.id]={blob:URL.createObjectURL(v.blob),thumb:v.thumb?URL.createObjectURL(v.thumb):null};});
      return next;
    });
  },[user]);
  useEffect(()=>{load();},[load,refreshKey]);
  const onChange=async(v)=>{await dbPut(v);load();};
  const onDelete=async(id)=>{await dbDel(id);toast("Video deleted");load();};
  const shown=vids.filter(v=>filter==="all"||v.status===filter);
  return(
    <div className="aup">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"var(--fd)",fontSize:38,color:"var(--w)",lineHeight:.9}}>MY VIDEOS</div>
          <div style={{fontSize:12,color:"var(--g3)"}}>{vids.length} videos · stored locally in your browser (IndexedDB)</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["all","draft","scheduled","posted"].map(f=>(
            <button key={f} className={`pill bsm${filter===f?" on":""}`} style={{padding:"5px 14px",fontSize:11,textTransform:"capitalize"}} onClick={()=>setFilter(f)}>{f}</button>
          ))}
          <button className="btn by bsm" onClick={onCreate}><Ic n="plus" s={12} c="#000"/>New</button>
        </div>
      </div>
      {shown.length===0?(
        <div className="card" style={{textAlign:"center",padding:"54px 24px"}}>
          <div style={{marginBottom:12,display:"flex",justifyContent:"center"}}><Ic n="film" s={40} c="var(--g2)"/></div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>No videos {filter!=="all"?`with status "${filter}"`:"yet"}</div>
          <div style={{fontSize:12,color:"var(--g3)",marginBottom:18}}>Generate a video in the Studio and hit "Generate Final Video" — it lands here automatically.</div>
          <button className="btn by" onClick={onCreate}><Ic n="sparkle" s={14} c="#000"/>Create a video</button>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:14}}>
          {shown.map(v=>(
            <div key={v.id} className="vcard" onClick={()=>setOpen(v)}>
              <div style={{aspectRatio:"16/9",background:"#000",position:"relative"}}>
                {urls[v.id]?.thumb?<img src={urls[v.id].thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><Ic n="film" s={26} c="var(--g2)"/></div>}
                <span style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,.8)",padding:"2px 7px",borderRadius:4,fontSize:9,fontFamily:"var(--fm)",color:"#fff"}}>{fDur(v.duration)}</span>
                <span style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,.8)",padding:"2px 7px",borderRadius:4,fontSize:9,fontFamily:"var(--fm)",color:"var(--y)"}}>{v.platform==="portrait"?"9:16":"16:9"}</span>
              </div>
              <div style={{padding:"11px 13px"}}>
                <div style={{fontWeight:700,fontSize:13,lineHeight:1.35,marginBottom:7,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{v.title}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span className={`chip ${v.status}`}>{v.status}</span>
                  <span style={{fontSize:9,fontFamily:"var(--fm)",color:"var(--g3)"}}>{v.status==="scheduled"&&v.scheduledAt?fDate(v.scheduledAt):fDate(v.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open&&urls[open.id]&&<VideoModal vid={vids.find(v=>v.id===open.id)||open} urls={urls[open.id]} user={user} toast={toast} onClose={()=>setOpen(null)} onChange={onChange} onDelete={onDelete}/>}
    </div>
  );
}

/* ─── SCHEDULE SCREEN ────────────────────────────────────────── */
function ScheduleScreen({user,toast,refreshKey}){
  const [vids,setVids]=useState([]);
  const load=useCallback(async()=>{
    const all=(await dbAll()).filter(v=>(!user||v.userId===user.id||user.isAdmin));
    setVids(all.sort((a,b)=>(a.scheduledAt||a.createdAt)-(b.scheduledAt||b.createdAt)));
  },[user]);
  useEffect(()=>{load();},[load,refreshKey]);
  const sched=vids.filter(v=>v.status==="scheduled");
  const posted=vids.filter(v=>v.status==="posted").reverse();
  const Row=({v})=>(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderBottom:"1px solid var(--k3)"}}>
      <span className="tg" style={{fontSize:9,fontFamily:"var(--fm)",border:"1px solid var(--g)",color:"var(--g4)"}}>{v.platform==="portrait"?"9:16":"16:9"}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.title}</div>
        <div style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--g3)"}}>{fDur(v.duration)} · {v.topic}</div>
      </div>
      <span className={`chip ${v.status}`}>{v.status==="posted"?(v.postedVia==="youtube"?"YouTube ✓":v.postedVia==="instagram"?"Instagram ✓":"prepared"):v.status}</span>
      <span style={{fontSize:10,fontFamily:"var(--fm)",color:v.status==="scheduled"?"var(--bl)":"var(--gr)",width:120,textAlign:"right"}}>{fDate(v.scheduledAt||v.postedAt||v.createdAt)}</span>
    </div>
  );
  return(
    <div className="aup" style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{fontFamily:"var(--fd)",fontSize:38,color:"var(--w)",lineHeight:.9,marginBottom:4}}>SCHEDULE</div>
      <div style={{fontSize:12,color:"var(--g3)",marginBottom:20}}>Queued posts fire automatically while the app is open — and genuinely upload to YouTube once you've authorized it in Connect (otherwise they're marked prepared). Schedule videos from My Videos → open a video → Schedule.</div>
      <div className="card" style={{padding:0,marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid var(--g)",fontWeight:800,fontSize:12,color:"var(--bl)"}}>QUEUED · {sched.length}</div>
        {sched.length?sched.map(v=><Row key={v.id} v={v}/>):<div style={{padding:"22px 14px",fontSize:12,color:"var(--g3)"}}>Nothing queued yet.</div>}
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid var(--g)",fontWeight:800,fontSize:12,color:"var(--gr)"}}>POSTED · {posted.length}</div>
        {posted.length?posted.slice(0,15).map(v=><Row key={v.id} v={v}/>):<div style={{padding:"22px 14px",fontSize:12,color:"var(--g3)"}}>No posts yet.</div>}
      </div>
    </div>
  );
}

/* ─── CONNECT ACCOUNTS ───────────────────────────────────────── */
function ConnCard({plat,icon,name,handle,setHandle,desc,user,connect,disconnect}){
  const c=user.connected?.[plat];
  return(
    <div className="card" style={{flex:1,minWidth:280}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{width:40,height:40,borderRadius:9,background:"rgba(255,230,0,.07)",border:"1px solid rgba(255,230,0,.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n={icon} s={20} c="var(--y)"/></span>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15}}>{name}</div><div style={{fontSize:10,color:"var(--g3)"}}>{desc}</div></div>
        {c&&<span className="chip posted">linked</span>}
      </div>
      {c?(
        <div>
          <div style={{background:"var(--k3)",borderRadius:6,padding:"10px 12px",fontFamily:"var(--fm)",fontSize:13,color:"var(--y)",marginBottom:10}}>{c.handle}</div>
          <button className="btn bg bsm" onClick={()=>disconnect(plat)}>Disconnect</button>
        </div>
      ):(
        <div style={{display:"flex",gap:8}}>
          <input className="inp" placeholder={plat==="yt"?"@yourchannel":"@yourhandle"} value={handle} onChange={e=>setHandle(e.target.value)} style={{flex:1}}/>
          <button className="btn by bsm" onClick={()=>connect(plat,handle)}>Link</button>
        </div>
      )}
    </div>
  );
}
function ConnectScreen({user,setUser,toast}){
  const [ytH,setYtH]=useState(user.connected?.yt?.handle||"");
  const [igH,setIgH]=useState(user.connected?.ig?.handle||"");
  const [ytKey,setYtKey]=useState(LS.get("av_yt_client")||LS.get("av_yt_key")||"");
  const [igTok,setIgTok]=useState(LS.get("av_ig_tok")||"");
  const [igUser,setIgUser]=useState(LS.get("av_ig_user")||"");
  const [ytAuthed,setYtAuthed]=useState(!!ytToken());
  const [authing,setAuthing]=useState(false);
  const authYt=async()=>{
    setAuthing(true);
    try{await ytAuthorize();setYtAuthed(true);toast("YouTube authorized — uploads are now fully automatic ✓");}
    catch(e){toast("Authorization failed: "+e.message,"error");}
    setAuthing(false);
  };
  const [pxKey,setPxKey]=useState(LS.get("av_pexels_key")||"");
  const [pbKey,setPbKey]=useState(LS.get("av_pixabay_key")||"");
  const [gKey,setGKey]=useState(LS.get("av_gcse_key")||"");
  const [gCx,setGCx]=useState(LS.get("av_gcse_cx")||"");
  const [gemKey,setGemKey]=useState(LS.get("av_gemini_key")||"");
  const [localModel,setLocalModel]=useState(LS.get("av_localmodel")||"Llama-3.2-3B-Instruct-q4f32_1-MLC");
  const [useLocal,setUseLocal]=useState((LS.get("av_use_local")||"on")!=="off");
  const localOk=typeof navigator!=="undefined"&&!!navigator.gpu;
  const [testing,setTesting]=useState(false);
  const [testRes,setTestRes]=useState("");
  const testSources=async()=>{
    setTesting(true);setTestRes("");
    const q="nature";
    const [a,b,c,d,g]=await Promise.all([
      srcPexels(q,pxKey.trim(),"landscape"),srcPixabay(q,pbKey.trim(),"landscape"),srcOpenverse(q),srcWikimedia(q),srcGoogleCSE(q,gKey.trim(),gCx.trim())
    ]);
    const line=n=>{const st=SRC_STATUS[n];return st?`${st.ok?"OK   ":"FAIL "}${n}: ${st.info||"working"}`:`     ${n}: untested`;};
    setTestRes([line("Pexels"),line("Pixabay"),line("Google"),`${c.length?"OK   ":"FAIL "}Openverse: ${c.length} results`,`${d.length?"OK   ":"FAIL "}Wikimedia: ${d.length} results`].join("\n"));
    setTesting(false);
    const tot=a.length+b.length+c.length+d.length+g.length;
    toast(tot?`${tot} results found — see per-source details below`:"Every source failed — if you're in the chat preview that's the sandbox; on your computer, check the details below","info");
  };
  const connect=(plat,handle)=>{
    if(!handle.trim()){toast("Enter your channel/handle first","warn");return;}
    const connected={...user.connected,[plat]:{handle:handle.trim().replace(/^@?/,"@"),at:Date.now()}};
    const u=updateUser(user.id,{connected});setUser(u);
    toast(`${plat==="yt"?"YouTube":"Instagram"} linked as ${connected[plat].handle} ✓`);
  };
  const disconnect=plat=>{const connected={...user.connected,[plat]:null};const u=updateUser(user.id,{connected});setUser(u);toast("Disconnected");};
  return(
    <div className="aup" style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{fontFamily:"var(--fd)",fontSize:38,color:"var(--w)",lineHeight:.9,marginBottom:4}}>CONNECT ACCOUNTS</div>
      <div style={{fontSize:12,color:"var(--g3)",marginBottom:20}}>Link your channels so posts are formatted and labelled per account.</div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:18}}>
        <ConnCard plat="yt" icon="yt" name="YouTube" handle={ytH} setHandle={setYtH} desc="16:9 videos + Shorts" user={user} connect={connect} disconnect={disconnect}/>
        <ConnCard plat="ig" icon="ig" name="Instagram" handle={igH} setHandle={setIgH} desc="Reels 9:16" user={user} connect={connect} disconnect={disconnect}/>
      </div>
      <div className="card" style={{marginBottom:18}}>
        <label className="lbl">Stock Footage Sources — free API keys</label>
        <div style={{fontSize:11,color:"var(--g3)",lineHeight:1.7,marginBottom:14}}>
          These power the <strong style={{color:"var(--g4)"}}>real video clips and photos</strong> inside generated videos. Both are completely free for commercial use: sign up, copy your key, paste it once. Openverse and Wikimedia photos work with no key at all.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label className="lbl">Pexels API key · <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" style={{color:"var(--y)"}}>get free key</a></label>
            <input className="inp" placeholder="563492ad…" value={pxKey} onChange={e=>{setPxKey(e.target.value);LS.set("av_pexels_key",e.target.value.trim());}}/>
          </div>
          <div>
            <label className="lbl">Pixabay API key · <a href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer" style={{color:"var(--y)"}}>get free key</a></label>
            <input className="inp" placeholder="41234567-abc…" value={pbKey} onChange={e=>{setPbKey(e.target.value);LS.set("av_pixabay_key",e.target.value.trim());}}/>
          </div>
          <div>
            <label className="lbl">Google Search API key · <a href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noreferrer" style={{color:"var(--y)"}}>get free key</a></label>
            <input className="inp" placeholder="AIza…" value={gKey} onChange={e=>{setGKey(e.target.value);LS.set("av_gcse_key",e.target.value.trim());}}/>
          </div>
          <div>
            <label className="lbl">Google Engine ID (cx) · <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noreferrer" style={{color:"var(--y)"}}>create engine</a></label>
            <input className="inp" placeholder="0123456789abc…" value={gCx} onChange={e=>{setGCx(e.target.value);LS.set("av_gcse_cx",e.target.value.trim());}}/>
          </div>
          <div style={{gridColumn:"1 / -1",background:"rgba(255,230,0,.04)",border:"1px solid rgba(255,230,0,.2)",borderRadius:8,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:8}}>
              <label className="lbl" style={{marginBottom:0}}>Local AI — runs in your browser, no server, no API</label>
              <span className="tg" style={{fontSize:9,background:localOk?"rgba(0,230,118,.12)":"rgba(255,122,48,.12)",color:localOk?"var(--gr)":"var(--or)"}}>{localOk?"WebGPU ready":"WebGPU not detected"}</span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <select className="inp" style={{flex:"1 1 220px",fontSize:12}} value={localModel} onChange={e=>{setLocalModel(e.target.value);LS.set("av_localmodel",e.target.value);}}>
                <option value="Llama-3.2-3B-Instruct-q4f32_1-MLC">Llama 3.2 3B — best quality (~1.7 GB)</option>
                <option value="Llama-3.2-1B-Instruct-q4f32_1-MLC">Llama 3.2 1B — fast (~0.9 GB)</option>
                <option value="Qwen2.5-3B-Instruct-q4f32_1-MLC">Qwen 2.5 3B — strong writer (~1.9 GB)</option>
                <option value="Phi-3.5-mini-instruct-q4f16_1-MLC">Phi 3.5 mini (~2.2 GB)</option>
              </select>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"var(--g4)",cursor:"pointer",fontWeight:600}}>
                <input type="checkbox" checked={useLocal} onChange={e=>{setUseLocal(e.target.checked);LS.set("av_use_local",e.target.checked?"on":"off");}} style={{accentColor:"var(--y)",width:14,height:14}}/>
                Use local AI
              </label>
            </div>
            <div style={{fontSize:10,color:"var(--g3)",marginTop:8,lineHeight:1.6}}>This is a real language model running entirely on your device — no Anthropic, no Google, no cost, fully private. First generation downloads the model once (then it's cached and works offline). Needs a WebGPU browser (Chrome/Edge 113+ or Safari 18+){localOk?"":" — yours doesn't support it, so a key below is used instead"}.</div>
          </div>
          <div style={{gridColumn:"1 / -1"}}>
            <label className="lbl">Gemini API key — cloud fallback if local AI is off/unsupported · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{color:"var(--y)"}}>get free key</a></label>
            <input className="inp" placeholder="AIza… (Google AI Studio)" value={gemKey} onChange={e=>{setGemKey(e.target.value);LS.set("av_gemini_key",e.target.value.trim());}}/>
            <div style={{fontSize:10,color:"var(--g3)",marginTop:6,lineHeight:1.6}}>Optional. Used only when local AI is disabled or unavailable. Without either, the app uses built-in topic templates.</div>
          </div>
        </div>
        <div style={{fontSize:10,color:"var(--g3)",marginTop:8,lineHeight:1.6}}>Google Programmable Search powers the "Pick images yourself" popup with real Google Image results — free, 100 searches/day. Create an engine, turn on <strong style={{color:"var(--g4)"}}>Search the entire web</strong> and <strong style={{color:"var(--g4)"}}>Image search</strong>, copy its ID. (Bing's image API was retired by Microsoft in 2025, so Google is the search-engine route.)</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button className="btn bo bsm" disabled={testing} onClick={testSources}>{testing?"Testing…":"Test sources"}</button>
          {testRes&&<pre style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--g4)",whiteSpace:"pre-wrap",margin:"8px 0 0",background:"var(--k3)",borderRadius:6,padding:"9px 11px",lineHeight:1.7}}>{testRes}</pre>}
        </div>
        <div style={{fontSize:9,color:"var(--g3)",marginTop:10,lineHeight:1.5}}>Note: sandboxed previews (like this chat) block requests to outside media sites, so tests may show zero here — on your deployed domain they work.</div>
      </div>

      <div className="card">
        <label className="lbl">Real auto-posting — no server needed for YouTube</label>
        <div style={{fontSize:11,color:"var(--g3)",lineHeight:1.7,marginBottom:14}}>
          <strong style={{color:"var(--g4)"}}>YouTube</strong>: genuinely uploads from the browser. Create a free OAuth client at console.cloud.google.com (enable <strong style={{color:"var(--g4)"}}>YouTube Data API v3</strong>, "Web application" type, add your site to Authorized JavaScript origins), paste the Client ID, click Authorize. Free quota ≈ 6 uploads/day. <strong style={{color:"var(--g4)"}}>Instagram</strong>: publishes via the Graph API — needs a Business/Creator account, a Meta-app token, and a public video URL per post (Meta downloads it server-side). Note: Google sign-in works on http(s) origins — your domain or localhost, not file:// or this chat preview.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label className="lbl">YouTube OAuth Client ID</label>
            <input className="inp" placeholder="xxxx.apps.googleusercontent.com" value={ytKey} onChange={e=>{setYtKey(e.target.value);LS.set("av_yt_client",e.target.value.trim());}}/>
          </div>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            {ytAuthed
              ?<div style={{display:"flex",gap:8,alignItems:"center",width:"100%"}}>
                <span className="chip posted" style={{fontSize:10}}>YouTube authorized</span>
                <button className="btn bg bsm" onClick={()=>{LS.del("av_yt_token");setYtAuthed(false);toast("YouTube de-authorized");}}>Revoke</button>
              </div>
              :<button className="btn by" style={{width:"100%",justifyContent:"center"}} onClick={authYt} disabled={authing}><Ic n="yt" s={14} c="#000"/>{authing?"Waiting for Google…":"Authorize YouTube upload"}</button>}
          </div>
          <div><label className="lbl">Instagram User ID</label><input className="inp" placeholder="1784xxxxxxxxxxx" value={igUser} onChange={e=>{setIgUser(e.target.value);LS.set("av_ig_user",e.target.value.trim());}}/></div>
          <div><label className="lbl">Instagram Graph token</label><input className="inp" placeholder="IGQVJ… / EAAG…" value={igTok} onChange={e=>{setIgTok(e.target.value);LS.set("av_ig_tok",e.target.value.trim());}}/></div>
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN PANEL ────────────────────────────────────────────── */
function AdminScreen({toast,me}){
  const [users,setUsers]=useState(loadUsers());
  const [vidCount,setVidCount]=useState({});
  useEffect(()=>{(async()=>{
    const all=await dbAll();const m={};
    all.forEach(v=>{m[v.userId]=(m[v.userId]||0)+1;});
    setVidCount(m);
  })();},[]);
  const setCredits=(id,c)=>{const u=users.map(x=>x.id===id?{...x,credits:Math.max(0,c)}:x);saveUsers(u);setUsers(u);};
  const del=id=>{
    if(id===me.id){toast("You can't delete yourself","warn");return;}
    const u=users.filter(x=>x.id!==id);saveUsers(u);setUsers(u);toast("User removed");
  };
  const totV=Object.values(vidCount).reduce((a,b)=>a+b,0);
  return(
    <div className="aup">
      <div style={{fontFamily:"var(--fd)",fontSize:38,color:"var(--w)",lineHeight:.9,marginBottom:18}}>ADMIN PANEL</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
        {[["Users",users.length],["Videos generated",totV],["Credits in circulation",users.reduce((a,u)=>a+(u.isAdmin?0:u.credits),0)],["Connected channels",users.reduce((a,u)=>a+(u.connected?.yt?1:0)+(u.connected?.ig?1:0),0)]].map(([l,v])=>(
          <div key={l} className="card" style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--fd)",fontSize:34,color:"var(--y)",lineHeight:1}}>{v}</div>
            <div style={{fontSize:10,color:"var(--g3)",textTransform:"uppercase",letterSpacing:1,marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="utr" style={{fontWeight:800,fontSize:10,color:"var(--g3)",textTransform:"uppercase",letterSpacing:1,background:"var(--k2)"}}>
          <span>User</span><span>Plan</span><span>Videos</span><span>Credits</span><span>Actions</span>
        </div>
        {users.map(u=>(
          <div key={u.id} className="utr">
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name} {u.isAdmin&&<span className="tg ty" style={{fontSize:8,marginLeft:4}}>ADMIN</span>}</div>
              <div style={{fontSize:10,fontFamily:"var(--fm)",color:"var(--g3)"}}>{u.email}</div>
            </div>
            <span style={{textTransform:"capitalize",color:"var(--g4)"}}>{u.plan}</span>
            <span style={{fontFamily:"var(--fm)"}}>{vidCount[u.id]||0}</span>
            <input className="inp" type="number" value={u.credits} style={{padding:"5px 8px",fontSize:12,width:70}} onChange={e=>setCredits(u.id,+e.target.value)}/>
            <div style={{display:"flex",gap:6}}>
              <button className="btn bg bsm" onClick={()=>{setCredits(u.id,u.credits+10);toast(`+10 credits → ${u.name}`);}}>+10</button>
              {!u.isAdmin&&<button className="btn bsm" style={{background:"rgba(255,64,64,.1)",color:"var(--r)",border:"1px solid rgba(255,64,64,.3)",borderRadius:6,padding:"5px 10px"}} onClick={()=>del(u.id)}>✕</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── LANDING ────────────────────────────────────────────────── */
function LiveDemo(){
  const cr=useRef(null);
  useEffect(()=>{
    const cv=cr.current;if(!cv)return;
    const ctx=cv.getContext("2d");let raf;
    const sw="Discipline is choosing what you want most over what you want right now".split(" ");
    const kws=["DISCIPLINE","FOCUS","MOMENTUM","CONSISTENCY"];
    const loop=()=>{
      const t=Date.now()/1000;
      const st=VSTYLES[Math.floor(t/5)%VSTYLES.length].id;
      drawScene(ctx,360,640,t,st,THEMES.motivation,kws);
      renderCaptions(ctx,sw,Math.floor(t*2.2)%sw.length,360,640,"tiktok","portrait");
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[]);
  return(
    <div style={{width:248,borderRadius:28,border:"1px solid var(--g2)",padding:8,background:"linear-gradient(160deg,#17171f,#0a0a0f)",boxShadow:"0 30px 80px rgba(0,0,0,.65),0 0 70px rgba(255,230,0,.07)",flexShrink:0}}>
      <canvas ref={cr} width={360} height={640} style={{width:"100%",display:"block",borderRadius:20}}/>
    </div>
  );
}
function Landing({onSignup,onLogin}){
  const rootRef=useRef(null);
  useEffect(()=>{
    const els=rootRef.current?rootRef.current.querySelectorAll(".rv"):[];
    if(!("IntersectionObserver" in window)){els.forEach(el=>el.classList.add("on"));return;}
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("on");io.unobserve(e.target);}}),{threshold:.15});
    els.forEach(el=>io.observe(el));
    return()=>io.disconnect();
  },[]);
  return(
    <div ref={rootRef} style={{minHeight:"100vh"}}>
      <div style={{height:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",borderBottom:"1px solid var(--g)",position:"sticky",top:0,zIndex:50,background:"rgba(7,7,10,.92)",backdropFilter:"blur(14px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <Logo s={28}/>
          <span style={{fontFamily:"var(--fd)",fontSize:22,letterSpacing:2,color:"var(--y)"}}>AUTOVIRAL</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn bg bsm" onClick={onLogin}>Log in</button>
          <button className="btn by bsm" onClick={onSignup}>Sign up free</button>
        </div>
      </div>

      <section className="gbg" style={{padding:"72px 48px 64px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"15%",left:"30%",width:700,height:300,background:"radial-gradient(ellipse,rgba(255,230,0,.09) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="scan"/>
        <div style={{position:"relative",zIndex:1,maxWidth:1060,margin:"0 auto",display:"flex",gap:48,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
          <div style={{flex:"1 1 480px",minWidth:320}}>
            <span className="tg ty" style={{marginBottom:20,display:"inline-flex"}}>AI script · Real stock footage · Baked-in voiceover · Up to 5 min</span>
            <h1 style={{fontFamily:"var(--fd)",fontSize:"clamp(48px,6.4vw,88px)",lineHeight:.9,letterSpacing:1,marginBottom:22}}>
              <span style={{color:"var(--w)"}}>TYPE A TOPIC.</span><br/>
              <span className="hglow" style={{color:"var(--y)"}}>GET A FINISHED VIDEO.</span><br/>
              <span style={{color:"var(--w)"}}>POST EVERY DAY.</span>
            </h1>
            <p style={{fontSize:15,color:"var(--g3)",maxWidth:520,marginBottom:32,lineHeight:1.7}}>Autoviral writes the script, matches it with real stock footage and photos, narrates with an AI voice, burns in word-synced captions, and generates the title, description and hashtags — then runs your YouTube and Instagram posting schedule.</p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <button className="btn by bxl" onClick={onSignup}><Ic n="film" s={18} c="#000"/> Start Creating Free</button>
              <button className="btn bo" style={{padding:"14px 26px",fontSize:14}} onClick={onLogin}>Log in</button>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:26}}>
              {["10 free credits","Real video clips","No watermark","30s – 5 min","Schedule queue","9:16 + 16:9"].map(t=>(
                <span key={t} className="tg tgg">{t}</span>
              ))}
            </div>
          </div>
          <div className="float3d"><div className="fxring"/><LiveDemo/></div>
        </div>
      </section>

      <div className="marq" aria-hidden="true">
        <div className="marq-in">
          {[0,1].map(k=>(
            <span key={k} style={{margin:0}}>
              {["MOTIVATION","FITNESS","FINANCE","TECH & AI","STOICISM","FACTS","MINDFULNESS","GAMING","TRAVEL","SELF-IMPROVEMENT"].map((w,i)=>(
                <span key={w} className={i%3===1?"fill":""}>{w}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <section className="rv" style={{padding:"56px 48px",maxWidth:1000,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          <div className="hslash" style={{fontFamily:"var(--fd)",fontSize:38,color:"var(--w)"}}>FROM IDEA TO POSTED IN MINUTES</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          {[["sparkle","Describe","Type your niche or a single video idea — AI handles script, pacing and hooks."],["film","Generate","Real stock footage + AI voiceover + synced captions render into a real downloadable file."],["cal","Manage","Preview, edit titles, format per platform, and schedule daily posts from your library."],["send","Grow","The queue fires on time, and the admin panel runs users and credits."]].map(([ic,t,d])=>(
            <div key={t} className="card floaty">
              <div style={{width:38,height:38,borderRadius:9,background:"rgba(255,230,0,.08)",border:"1px solid rgba(255,230,0,.22)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><Ic n={ic} s={17} c="var(--y)"/></div>
              <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>{t}</div>
              <div style={{fontSize:12,color:"var(--g3)",lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{padding:"20px 48px",borderTop:"1px solid var(--g)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Logo s={24}/>
          <span style={{fontFamily:"var(--fd)",fontSize:20,color:"var(--y)"}}>AUTOVIRAL</span>
        </div>
        <span style={{fontSize:11,fontFamily:"var(--fm)",color:"var(--g3)"}}>AI Faceless Video Platform · runs entirely in your browser</span>
      </footer>
    </div>
  );
}

/* ─── ERROR BOUNDARY — readable crash card instead of a blank error ── */
class ErrorBoundary extends Component{
  constructor(p){super(p);this.state={err:null,info:""};}
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){this.setState({info:(info&&info.componentStack||"").split("\n").slice(0,5).join("\n")});}
  render(){
    if(!this.state.err)return this.props.children;
    const msg=String((this.state.err&&this.state.err.message)||this.state.err);
    return(
      <div style={{minHeight:"100vh",background:"#07070a",color:"#ededf5",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif"}}>
        <div style={{maxWidth:520,width:"100%",background:"#0d0d12",border:"1px solid #383848",borderRadius:14,padding:26}}>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:2,color:"#FFE600",marginBottom:10}}>AUTOVIRAL — SOMETHING BROKE</div>
          <div style={{fontSize:14,lineHeight:1.6,marginBottom:6}}>{msg}</div>
          <pre style={{fontSize:10,color:"#707080",whiteSpace:"pre-wrap",margin:"10px 0 16px",maxHeight:120,overflow:"auto"}}>{this.state.info}</pre>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{this.setState({err:null,info:""});}} style={{flex:1,padding:"11px",borderRadius:7,border:"none",background:"#FFE600",color:"#000",fontWeight:800,cursor:"pointer"}}>Try to continue</button>
            <button onClick={()=>{try{navigator.clipboard.writeText(msg+"\n"+this.state.info);}catch{}}} style={{padding:"11px 16px",borderRadius:7,border:"1px solid #383848",background:"transparent",color:"#9898a8",fontWeight:700,cursor:"pointer"}}>Copy details</button>
          </div>
        </div>
      </div>
    );
  }
}
/* surfaces async/background errors (fetch, promises) as a dismissible bar with context */
function AsyncErrorBar(){
  const [msg,setMsg]=useState("");
  useEffect(()=>{
    const onRej=e=>{const m=e&&e.reason&&(e.reason.message||String(e.reason));if(m)setMsg("Background task: "+m);};
    const onErr=e=>{if(e&&e.message)setMsg(e.message);};
    window.addEventListener("unhandledrejection",onRej);
    window.addEventListener("error",onErr);
    return()=>{window.removeEventListener("unhandledrejection",onRej);window.removeEventListener("error",onErr);};
  },[]);
  if(!msg)return null;
  return(
    <div style={{position:"fixed",bottom:14,left:"50%",transform:"translateX(-50%)",zIndex:500,background:"#1b1b24",border:"1px solid rgba(255,64,64,.5)",borderRadius:9,padding:"10px 14px",display:"flex",gap:12,alignItems:"center",maxWidth:"min(92vw,640px)"}}>
      <span style={{fontSize:11,color:"#ff8a8a",fontFamily:"var(--ff)",lineHeight:1.5,wordBreak:"break-word"}}>{msg}</span>
      <button onClick={()=>setMsg("")} style={{border:"none",background:"transparent",color:"#9898a8",cursor:"pointer",fontWeight:800,flexShrink:0}}>✕</button>
    </div>
  );
}

/* ─── APP ROOT ───────────────────────────────────────────────── */
export default function App(){
  return(<ErrorBoundary><AppInner/><AsyncErrorBar/></ErrorBoundary>);
}
function AppInner(){
  const [user,setUser]=useState(()=>getSession());
  const [screen,setScreen]=useState("create");
  const [authMode,setAuthMode]=useState(null); // null | "login" | "signup"
  const [config,setConfig]=useState(null);
  const [result,setResult]=useState(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const {show:toast,Toasts}=useToast();

  const go=cfg=>{
    if(user&&!user.isAdmin&&user.credits<1){
      toast("You're out of credits — ask the admin or upgrade.","error");return;
    }
    setConfig(cfg);setScreen("pipeline");
  };
  /* credit is charged only when generation succeeds — failed runs are free */
  const done=res=>{
    if(user&&!user.isAdmin)setUser(updateUser(user.id,{credits:Math.max(0,user.credits-1)}));
    setResult(res);setScreen("preview");
  };
  const logout=()=>{setSession(null);setUser(null);setAuthMode(null);setScreen("create");};

  /* global auto-post queue — checks on load and every 5s while the app is open */
  useEffect(()=>{
    if(!user)return;
    const check=async()=>{
      if(window.__avPosting)return;   /* one upload at a time */
      try{
        const all=await dbAll();let fired=false;
        for(const v of all){
          if(v.status!=="scheduled"||!v.scheduledAt||v.scheduledAt>Date.now())continue;
          if(ytToken()&&v.blob){
            /* genuinely upload to YouTube */
            window.__avPosting=true;
            try{
              toast(`Uploading "${v.title}" to YouTube…`,"info");
              const r=await ytUpload(v.blob,{title:v.title,description:v.description,tags:v.hashtags});
              await dbPut({...v,status:"posted",postedVia:"youtube",ytId:r.id,postedAt:Date.now()});
              toast(`Auto-posted to YouTube ✓ — youtu.be/${r.id}`);
            }catch(e){
              await dbPut({...v,status:"draft",postError:e.message});
              toast(`Auto-post failed for "${v.title}": ${e.message} — moved back to drafts`,"error");
            }finally{window.__avPosting=false;}
          }else{
            /* not authorized: prepare-only mode */
            await dbPut({...v,status:"posted",postedVia:"assisted",postedAt:Date.now()});
            toast(`"${v.title}" queue time reached — authorize YouTube in Connect for real auto-upload`,"info");
          }
          fired=true;
        }
        if(fired)setRefreshKey(k=>k+1);
      }catch{}
    };
    check();
    const iv=setInterval(check,5000);
    return()=>clearInterval(iv);
  },[user]);

  /* unauthenticated flows */
  if(!user){
    if(authMode)return(<><style>{CSS}</style><style>{CSS2}</style>
      <div className="bgfx" aria-hidden="true"><div className="fxa"/><div className="fxb"/><div className="fxc"/><span className="sp sp1"/><span className="sp sp2"/><span className="sp sp3"/><span className="sp sp4"/><span className="sp sp5"/><span className="sp sp6"/></div>
      <AuthScreen mode={authMode} toast={toast}
        onAuth={u=>{setUser(u);setAuthMode(null);setScreen("create");}}
        onSwitch={()=>setAuthMode(authMode==="login"?"signup":"login")}
        onHome={()=>setAuthMode(null)}/>
      <Toasts/></>);
    return(<><style>{CSS}</style><style>{CSS2}</style>
      <div className="bgfx" aria-hidden="true"><div className="fxa"/><div className="fxb"/><div className="fxc"/><span className="sp sp1"/><span className="sp sp2"/><span className="sp sp3"/><span className="sp sp4"/><span className="sp sp5"/><span className="sp sp6"/></div>
      <Landing onSignup={()=>setAuthMode("signup")} onLogin={()=>setAuthMode("login")}/>
      <Toasts/></>);
  }

  /* onboarding for new users */
  if(!user.onboarded){
    return(<><style>{CSS}</style><style>{CSS2}</style>
      <div className="bgfx" aria-hidden="true"><div className="fxa"/><div className="fxb"/><div className="fxc"/><span className="sp sp1"/><span className="sp sp2"/><span className="sp sp3"/><span className="sp sp4"/><span className="sp sp5"/><span className="sp sp6"/></div>
      <Onboarding user={user} onDone={({niche,platforms})=>{
        setUser(updateUser(user.id,{onboarded:true,niche,platforms}));
        setScreen("create");
      }}/>
      <Toasts/></>);
  }

  const NAV=[
    {id:"create",ic:"sparkle",l:"Create"},
    {id:"videos",ic:"film",l:"My Videos"},
    {id:"schedule",ic:"cal",l:"Schedule"},
    {id:"connect",ic:"link",l:"Connect"},
    ...(user.isAdmin?[{id:"admin",ic:"shield",l:"Admin"}]:[]),
  ];
  const inFlow=["pipeline","preview"].includes(screen);

  return(
    <>
      <style>{CSS}</style><style>{CSS2}</style>
      <div className="bgfx" aria-hidden="true"><div className="fxa"/><div className="fxb"/><div className="fxc"/><span className="sp sp1"/><span className="sp sp2"/><span className="sp sp3"/><span className="sp sp4"/><span className="sp sp5"/><span className="sp sp6"/></div>
      <div style={{height:64,background:"rgba(7,7,10,.96)",backdropFilter:"blur(16px)",borderBottom:"1px solid var(--g)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",position:"sticky",top:0,zIndex:80}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setScreen("create")}>
          <Logo s={28}/>
          <span style={{fontFamily:"var(--fd)",fontSize:22,letterSpacing:2,color:"var(--y)"}}>AUTOVIRAL</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span className="tg ty" style={{fontSize:10,display:"inline-flex",alignItems:"center",gap:5}}><Ic n="zap" s={10} c="var(--y)"/>{user.isAdmin?"Unlimited":user.credits} credits</span>
          <span style={{fontSize:12,color:"var(--g4)",fontWeight:700}}>{user.name}</span>
          <button className="btn bg bsm" onClick={logout}>Log out</button>
        </div>
      </div>
      <div style={{display:"flex"}}>
        <div className="side">
          {NAV.map(n=>(
            <div key={n.id} className={`sitem${screen===n.id||(n.id==="create"&&inFlow)?" on":""}`}
              onClick={()=>{if(inFlow&&n.id==="create")return;setScreen(n.id);}}>
              <Ic n={n.ic} s={15}/><span className="slbl">{n.l}</span>
            </div>
          ))}
          <div style={{marginTop:"auto",fontSize:9,fontFamily:"var(--fm)",color:"var(--g2)",padding:"10px 6px",lineHeight:1.6}} className="slbl">
            {user.connected?.yt&&<div style={{display:"flex",alignItems:"center",gap:5}}><Ic n="yt" s={10} c="var(--g3)"/>{user.connected.yt.handle}</div>}
            {user.connected?.ig&&<div style={{display:"flex",alignItems:"center",gap:5}}><Ic n="ig" s={10} c="var(--g3)"/>{user.connected.ig.handle}</div>}
          </div>
        </div>
        <div style={{flex:1,padding:"24px",minWidth:0}}>
          {screen==="create"  &&<Studio onGenerate={go} toast={toast}/>}
          {screen==="pipeline"&&config&&<Pipeline config={config} onDone={done} onBack={()=>setScreen("create")}/>}
          {screen==="preview" &&result&&config&&<Preview result={result} config={config} user={user} toast={toast}
            onBack={()=>setScreen("create")}
            onSaved={()=>setRefreshKey(k=>k+1)}
            onGoVideos={()=>setScreen("videos")}/>}
          {screen==="videos"  &&<VideosScreen user={user} toast={toast} onCreate={()=>setScreen("create")} refreshKey={refreshKey}/>}
          {screen==="schedule"&&<ScheduleScreen user={user} toast={toast} refreshKey={refreshKey}/>}
          {screen==="connect" &&<ConnectScreen user={user} setUser={setUser} toast={toast}/>}
          {screen==="admin"   &&user.isAdmin&&<AdminScreen toast={toast} me={user}/>}
        </div>
      </div>
      <Toasts/>
    </>
  );
}

/* ─── BUILT-IN DEMO FOOTAGE — real public-domain photos embedded as data,
   immune to sandbox network blocks. Used only when no other footage loads. */
const DEMO_PACK=[
  {tags:"space astronaut science career woman success",credit:"NASA (public domain)",b64:"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"},
  {tags:"space rocket launch technology startup success power",credit:"NASA (public domain)",b64:"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"},
  {tags:"space galaxy stars universe night dream",credit:"NASA/Hubble (public domain)",b64:"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"},
  {tags:"space moon night dark calm sleep",credit:"NASA (public domain)",b64:"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgwKCA0MCwwPDg0QFCIWFBISFCkdHxgiMSszMjArLy42PE1CNjlJOi4vQ1xESVBSV1dXNEFfZl5UZU1VV1P/2wBDAQ4PDxQSFCcWFidTNy83U1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1P/wAARCAIAAgADASIAAhEBAxEB/8QAGwABAQEBAQEBAQAAAAAAAAAAAQACAwQFBgf/xAAzEAACAgICAQMDAgUEAgMBAAAAAQIRITEDQRIEUWEFInETgTJCkaGxFCPB8NHhBiTxM//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDi9IrsWlfyGEAN5QXkb+4gLsluiIAe7DsXkzkCTK8hVaBW37AdEJhYNfkBejP5NWGwAVhS+aAtAHRLDLRAV/an7igJATRUOiSAlodZF+6DQC8SRl5ZMG8gTWSRbKgNWN4AgHsW+wYgTBi8hVbAU04xg8JXk5wflNo308GVFJ2B05Wv1MOw434eWN0YNJ1sCH5Zdlp+9gDxgX7A0a2sZAN3mg6NJBdN3+wAxi6TVGfLFkqA31aDsLz8F+AFKyewbogCauOC45eKV9DD75UtnNvKA1dl2DB4A6Jinmzknm0aTe2Bu7o1CVJ42crf5NXsDrxtM78H2ej54Pc/Gv2Z44YkqPSuTd6QHGapnn5V5Jndu2cpyVXqgPCoeNO7NRy0Sbn5eC/YxxOX6kozjX7gfTeCykmTyiAFuyImBltoXrAnOfIotLsBV1kT1+m+ncvqvTz5OHLjX249/wAnkXsAVgkjVEAUJEBMlsGs2VgREFgILJUIB2JE6sCKyIBRB8FTAVvOgJCANexJ0VkAp4WMjgyy+QEcWF0QCGSLYEBMEAyq3X9CAUAr2NVcqeAtJaNNJJP3AyslZN4RZVLoBerezLyLq8aAC9kC+6fijRlrNoAv7kvc6VWHsxFW6ZpUBYp4z0Zs0zLAH79mVvJsK+QJKxRZ/cUgMNUhV6NeDi2pLJJU7AniNm+FRkmnj5DUXXZYv7QFx+1SXZm+jSeDhNTXqYckZUo3areAOmtni+tOUPp05ccvGSrNX2j6PqeeXqPUS5ZKnKv8Uc9waegPkf8Ax7n/ANRFueUu/fZ9Xm4ov1Fr/uDwen9GvS88pcOIy6/Y+n6bM05OgJ5LSKQNgXZESVAMXn3Pj/UHPj9bB19jvP7I+wjMoxkmnkD6X0D6pH0fn+o/snWfar+Pk+dyS8+WUkqT6MqKWh6AtkRAVk8kyQBdkT6RU/LOAKiStry37jLYdARC2rxhA/cCM39woqrIFY/gBAhD3EC7wSyRYAugfwNPxtaLYFLSJ6LbrS9zMnlIClZuU7il7FJJVT2ZASAgIh2IEl0VdMQAmQvLAB/If5F5dpUW2AdAKTICWSaHQXSrpgH7BdKjS3oKALshRaACF4wCyBLZpYQeIpWBXSojNhoDpZfgzF2jS+QJ6M0JbX4AGCHsngDm407OnF/FgqthH7WBTbxg6TcZRj4qnm/kEirAAiEHTAQe9DkMgRFRMA7LoieEBaRMrGrAzWS3s00ZYFkLpDViuKUloAU746ZdGWmtkmAi9FpBoCuiTab9mC9h7AUKMjYCQL3L3AdKkREBB7kQFRLJFQEVZIVh5Aka0ZQ2BEXsQA39x25PB8cWlTycqTRbTrSAesdFQD0BdUGxJgVh3gh7VgZEkXVADoUyYdAJJCo4skAtYM6eDSxYAZawZaNmQJG0zKNICJlaGqYAkElmujVZ9w+ACsi9BLCNQ4pTVpXQGbJMmQFuheEw6HqgKyerIHlAa8XKNmehUmlQAHQ9khQBRqOCqzf8CsDnOSRw/Us5eo5qmo+4cUroD1QeT6XpbhNdI+VxSxg+r9PaU03/AN2B9qX0rh9bxRil4yznLr+/wfm/qH0/k9FyeM1h6eM6+fk/cfToyUIy499/Ox+r+h/1vpZQ3L+V/ur/AMAfzy2yrWNGpx8ZNABaIaoqAB9vcKIDSXlJRW2X+SWiAtklnLLZARFggBaFbdkXQB2XWBxYbAUWisGA2VgLj2A2WtGHsrA6MLwF2ZsDomX/AAc0zSYGmXRmzXWGAIsNpaFvLrBKnIBlhGZKzT2G3QE7pL2BuhewrsBWY2gUgeFgE+gN15GKyaukWmwJqnkYk8igBL+hpaZLQpdgC6Jo6eh9PP1spLj6/wC/8HNW17gZlBtUdOLkfGsMHh5GumBzr2yDHsloCftsd7CxTAGXwLACRESyAaFEaVZA1BBzOuMVaD1KqCA/Nc3qJy9VSWP84PZwSVWuz5E1XqWte/8AQ+h6VNcaV5A+pxStn1PQyT5FG6f/AOnyPTPJ7KalgD+henTh6ZRqvf8AqdmlT8Fbel7nyPpX1F80VHldy7fvv4PpfqRUG1t6QH4X6vxR4vqHJGDuOK/ojxHo9fPz9VNp2sf4RwWALsuySHoA7LRE17AQxk4sKyPYBLDx2aSi4vP3dAnjOgawpICTyItOk2tg8PIEtaIu0QBhRt7FqljJV/QugASSEBhFSZ3fFhM58Ucs9LSSoDwzjUjJ6eaD2eaSpgYfl5p3g1Zl/JWBpFZhyoy5q7A62bi7/JwUrO0MAbJbsLLoDX4Da1lAtD/1gW9bMyumhVqSaYNtvID6aUVK5aMzX+7aeBqiawAyfk2/c0vuV3syngtANWxti6cVWH2SdAOrHPjZcTUpNSzYe9PQDGH6c/KDoqaof+C9gJrHyjMX4y8k8rSNNGUsfDAx8kRfLASBIQIFoei6yAEOw6A1BxWHG1+TXlFqlGn+TmqtmgNxechyq4FHGDV4oD839Q9H4+qXLGP9/hDCSlJZq9H2vUenU401aZ8rk9FycNKOYdgerhtVbv5Pbxyzk8PDfilJUz1QwB9r0XqfGW6fWD6X1D6p+l6JKLqb6/dfB+c4uVcbUntHLl5Zcsm2wMN+UrFAqo6RVXKSuIGeyKyAnkBRAQET2BLINOsF0KxgDUncUukMX5JqW3pmeg6AkJL27JAQl/KmQF+CJdkB24My8X2eyH8Xi3V9HzVKmmevj8nOLirQHXlinF+70fPnHJ9icV4RbxvPufP9RBxnn+oHjmqOE5+Oj087pHhdeTwBqfJ9jPJz8soU7z0e+MPKOUfJ+qqfDJu/t6+NAejg9T5RT9z6HFyKUT8nD1ahBJOqPu/T/UqaTT3/AOwPqxFGEzaA0hAuwLbQVkSdgQMdFJf0AzRqvkCYCnTYxy6ZlaFPNMBSyaStX7GU8v5Nwk4xklqW0BXjJrxaRh+/RpO0BWv6DhquzLTryRqXQHFkx7yQDlF06JEgJg+6K+iXYBmyWhTyQFSuxM9joDWtAmysEwOm4hKmq2Zsu/yBiXGg8TpYNNPOwMNAlk2ABW0ySz4o1Rlq2Bd5IW32DAtERABC1aIALRFbsBIBu0AMSYXQDRbRD0n0wKnV9Mur9wWqQgSyfQ4UlmsHz06Ppeld5WmB6edKUU1tHh52py/O37n0PHxn9y2eSfGlsD5nIjxTi1M+nzcfjs8fLBMA4uROJ+U+uc039QmrwqpV8I/Syahl7PhfVfQy55z5k6ljHvpAco8PF6j6VLm1yQ/OLlR3+kcic2k7Xv8A1Pmfp8kYfpJ4lvR9P6bB8aja3/7A/R8buKOqOHA24qzsnSA2hXv7mUKAh6Gm4trrYIALVDQSyAVkjX8SvszsCRZstldAa0yVpE7/AGHVp4AvcUmnXuF0tC3eQHyvBuVUmtSOUvuaaNOTlhvAGNqy6svku8ANhgtF/cCaLTIfhgGngnsrppk8gHYkFgV0KyRATeSUsEVZAGrWVnorfYTk00kduZ8coQ8VUs3nYHGhIn8gWir90Duhk6SrQAzOomqzRl3QGZto0hf8KBMB7BjZdADImXYEMVabXQFWQImXwSAbLrC0Z1RrACyeAtE8oBivLTO3ppOM1TOEPsOnB/8A0QH6Pij+tFtLfRw5+Om8VR19JJdYNcks3/UD43qoVno+by6PvesgpKlldnxeaOWgPmcnI8J9mf4otNUb9Tx9Ls88ZNp+SwgOcvRxfLfto7cXF4T2doNYaNfxNqqA7ccqpM9CeDz8ezom/OKr7e37Adk8a/I7MRNoBFYRm/Y3JZxoAWmSVxcl0QaAWF2hWVkOwB3sVkHkANO3Gl0dOXk/UptU1s5jtgSGLoBx42AxVtGtME6iKxFNvYHKwsfTTXkpPKO/rowh6qS4n9uP8IDii7C9kAhOVKyCWUB19NGPI6kXPxPg5nB9HODfHTemanKXJJzYGeyoisAbrCNOkkuzm4/ddmrdgaTIzdI3wePIn5OvkDO0BbF72BXkH8CD2A95BZRXeyACInoAeyFoAK+wzZVRdgJMq7ACsbRlhYG7QnPyNJgLMtmjMtAY81Yp52eflb/lMrkalVge5Ss7cGORP2PHCXZ6eOVZA+v6PnpNPR6nyycnbuj5PDOno9a5HW8PYHXm8JQaapLR8nmhLNn0OSXmnk8/JBqKdUB8fnh2fM5bg5Vs+56iFrGmfJ5fLhk5yVxQHDi5Jakz2KSkrX9DzLjUpqSxZ6EvGS7sDvxLPweiKweXik20euGUApGgFAT+BsKySwwHI10WU18kBdMz0aeAyBSS8vtdoEiNd0BdZBXViCwsgK1fZWSd6L/AGoypJLYp002rQcVLltq0uhw5NJYA4L7XgU828i1kABukUZXozKNio1+QOiJ6ArAJttJdI6cfJ48co+5ia8MSKn4qSAotzl4xy0V4sy12tmlKuNxAlgtmbybnHxkAAsLBGYSuQG0VG/UOH6z8MIwtAKePkGPVewAXZNUBWBBY2ZazYGtgyvKKwA1FWHZqIA1gw0d2lRhqmBxbYLWTo1gzJAc4VS8dHZHCP8TbO8WBtV2ZmjolizM3aA8fLFOTPM8vyWT1c6bTaWejxOMkpJvOAPTxTe9nrg7R83y/Sp7PdwP7QPXCdbPTHltI8KZuM3H8Ae9TVI6KKfHK8Jnihyo93ByKcdXWwPDz8fR8/wBRxqcaZ9f1dJUtnzpoDwODgordnSKvJ2aOSxIDHCpfqZPbDR54RyemGkAimRIDUM8lPQ+9ZBD0Bd7Jp2L2V5AGv3DBt5ZnLXwgCiLYAax0Djf4Kvuob8U29IDKVMYuk7OnJBwlT0c3abYGkqja/c0mlG1svTySi0+9knUcaA5A8ETwBfgGrQqmr7JugJu22FfcLKwMyTayMbUaWmTQK0gCTqNmkk4WmX5BxqKA5pv9Q93qfT1xrlh/C/7dHz6lGWr+T1x5/wDZlBdgckSjTJCBRw8j0D+BtaAsVb2DFr7qD4YAy6TIgKzMmlGxM8sfLjrsDl6bm/WnJLo9vJ6eUONT6PkfTOB8HLySnK5Srr8n3J+sb9K+L3/8geVbNxOZuwNrISRQp7Nc2gOdYObR0WTDA83JfmzrCVmWm2+ihtgeuDMTeQi+glrIGWrOHLx4PQtWc520B45q5O1+56uB9HFwud9ex34lTA7aFbAgFOmevg5Kv5PJ0ag2B6+WVnjng6z5LMPIHGvgzKJ1ayYkrAysbOq0Cjg3QCSy6JvNsXBpJ1vQEjUc4QV9uNlqfksAblFwnTWgpJm+Xl/Vnb0YeOgNLGWZhHz4pTTyqwDd/ge0AKDcHJZS2ZrGTcW4QkovD6KcWoxl1LQGOy6p6Nca821dGU/cDTdv8BbQXlomApUrNRWEnvswneNHRvybaQHHoi7LsCfsTIAEKyIbAWsJ2DJPFEBSXsSZaeCAOyRXgFsBskHHJfrKM19pnmuL+3KA6WX8yo7eUH6Vp/xLX9TgtgUHfJk3yp7SOLtO10duPn8ZKLewOeSs9PN6SVOcMxR5b9wJsEx2FZAGlYqOM5Fr2NN3nsCBssogNRlg08xOHGlGbdbOjfsAP4Be5N+4ADyCWbQ00aSwAJ/cMtHOqdnWLTQGY5RiavB1eDOwOSidIxoUsm6wAERdgIoya43Us5ALyKfRmSMpuwOr0ZSsUSQClgiECatNC2/GKeokADf9RRm6NQSnF3sBb2lolpO96M5NUBLT9yWLNccnDkU1mjKf3JgKV49zLdI0sfgywNKKlzKKw2El4txayHz7FerAg7IWAXklkN4Qp4/IGQuivJAXVC3kC/cCuieGW9l8gHQ7WSACWCWcA5fckdZcbhLyWvcDmEG4TsTDnXJGPuB0dXgK8nSyPMvCWNBjfYAPRLViAV9pw5otPyXR6AksUwOvpvUvip7j2jHLFOTlDRzpVQxtAFiRASzfwWaSIgJ7+CeyC8gQSTtZwaoy3kCYLAJmoNMBWzSMR8oyleU6r4EDMluihgcoogLySSRdkAjeAHoCQWDLbATcWYRMBYNEhvIAje0Ze8GloCH3AQH5Io7DasCv3FexFQCV4L49i/ICsErv8lX9CArZNe2iWGPwBJdBeRy2YAiu0ai/GcXV/BnWAJ10WmQeNuwMpuMrRKvONr7e2DxsmqSYCRPRXYEgWqENZAegIQOX81s9C5v9mUK3/wCTmDQCYlxxnNSazHRsmAP3Yg8WEWnoDSEESdyoBM3ZqX2sAMt0VjQNWAltl2TwAmHKuRJ9mgcE3faAuRY+022nxrGfcyWwJFLMQeDLligOUOJQm5L+bZ2rGATs0BJ4CL81hloEvFYA1YWYinbbZvoCsg6GwNYGKwYr7k/Y6LVAZeDKf9Tozm0BpMjk00sDDkrYHSjDbUkbjJSVoGgGLNdnOKzRuwNCZsuwNRtO0Rvl5FOVpUvYztpAV4HUkm6MvKK3YCv7iZui8sAaukTdGG8lebA1ZeQOVu2F4fyBryzYORgcgMnjB0jOK41FrPv7HGsGrb2B04ZOPN59GZNOTZJ00/YuwOcVbti8vBL7dbBAQ0RICZD0CWQAqyIr+HOwMshBgEXbrtD2BWBS0C0O8EtgJVkHJJZLugGy7IgBFZEwDTEugVrbAUWUD0QGkyWwNxacFap9gE8HifJUmtnu5o/YmfJ5ZSSnJfAHt46Z0pWeL0vMmlebPXF9gLRJ2TM1d0A7bKLvsk2o5JJJt+4Fk0C0MV5aAk7FOjOsEgNkBXkBaMuKG6Q7Ayo0sFbZurQLABFmqOU345O3E7WQMdmrCWGSYG3qhDqwuqa6A18kM0lFS9wdpIAewNAAMhaKqACSNUKX3UwMJGqNKvCKa/cqAEtMqxY0IGdN/wBg0asH7oDD0RaIAEghfJxz5I5jCrf5AbEzY9gXRMVmLkujID0Wy2ABku6Jgsr5AVhkDysArrIGm1RVkHdYYpgIPREAoM2RMAIuwYCVghAr6NRbRix0B6fJS4qZ8z1XDabjg9nk0jMqayB+a448kPVxcNe37H6DjzHJl8EfKztFYpAc+WahG26Rnh5YT/hd/sY9XX6dS0zzenvz8tLr5A+gsMrz7GZN+OAldXQG/guNOCoFoUBXdnn9TNxar+p6e7BxT2A8buKZrbCKodMAad2avBWqGgK/cTLG6QGZJPAxXihFgYkCNUUUBpPFCsJkQFtZGi6JbAqHAqDcZS6WwAiJCsypbAEvcV38i01hDt0AVa3kHhmluwWZAVV+SrI9X7mUqeQILVV2MmTw8gZiovibe+mZQLCoQDv4OfHxR40/BUpbOi1QAS7G6eAIBLWSTyFgaaoAtoe0BdhVCzOpAUfuj5LRdl1gGrp+wGmEXnJSbcsgBoDPdiAp2rQXaJLFIUgM77FEti8aAgTtjdbDQBnJq7Mu7wKwgENbFDVgZooGqGOGB5fVRuDTR5+GPiqPZ6qDcHR8n0fqocnJKH8yA+tDMb7HZnjbSSNdgDV0xWMDtYMRhUmwNloG6THaAUjRlCBGmZQgDeTXQEAl2CHQFQgsq3sQJCZ1o0gLCRp4kZFbyA3hkWCAVoaM2hQGmHaLbtg8oDV9US6MkAvKrobvYd2xukk99gD/AATur6Y3YW1FR6WgORdAy2BF2SxgAMc8/wBPicjr6aVNN5MNWqZQX6eE9AdvVwhx+qlHj/hVf4OKZCBIrKw6AVaBZH99F0AdF0Wy+egDRLJdjoAzWCH8EALYki2AgSyXYF8EQLXwAmW6F7HxrAGFNWdEcZx79hhNasDqTM+Q2Aza8T5EPRw4OX9SKq+7PocspRnXTOkqapgYhlGks2EFRrQF8Er08iC2BJUhBv8AYW8AISl4jeAawBI0Z6G8gXYg9CkAl8AKAfyQCBdD2A7QFeRQEgEuysuwEU/siq1YRptrRVWALQ+9GbJsCtGrt2zDdrBpu22sAI2sUZsryBqwdGWwbuwM7RN1gTlycSnKMtSjdP8AIHQBk225Sy2TWE+mAfJYsmQB0PZf8kgLte3ZBVD2BdWXRUNUAVkNXXYkBiSbaadJdGu8FeSsCk0r6JESSTAnRImCAasieGSAFrIk/cq7A5ymv1VB9neUc1tHGUE5KdZR1i7A58ixR415fqKXR7ZZOPJx1lAS5V5Udonyufl/087m6R9LgnfHbA3OKcTEk6s6GWrQGYO4mzNUqRq7X4ABANIBeykrQ48bLNYAksEW0umKACq3ZCnYGZNrQwcklexBAaREnotgJB0KAS6IgG/YdbBEBE9EwsDTdu2HSZYBboCsi9/gAEUA5AcIk23S2EsvCIAbLQk8gZ6JkTAi6okQEwZP5C82BAv7oHfQq9PIC7znJZa9mQoBu8kWmQAlSoiWskBllnyS69xd9ZJ90BETqwVqNN2/cBKrBbECZFb8Ve+wsDTDsLJAKFboy3Qp2rAzK0Dkp3Q8ibg62eX0qmk/PEgNSgppPaN3+mskn4ckV0w54qVroDrDOTWDjwJca8Vo7IA7DkV49zRNWBZi8l+SQP27AXF18EtGvKo0YAbJMibArZFkrAtj2FiBroFougQGiBl2A2QDYCTZEwJl2QAJF0HQEQMUAjd6BCgJkiGrAKGsDWBa9gORFLQgBEQAGjS9w7Ay8IUNZBgSKNUvcaTjZJZAaTd+w6DZAQCABeSFkAbSYPaYpKKSWkDVoCvK9hsGrWSp2AZGiTyIBRCsi0BlpUZj9scDJ9EgNrKzs881U7TOsmkjLSdMBTU3TOcvtk7yjawsHk5pXJ28AdeFuSs9KOHBTO4F8FVYYPY3lYwBdiDyrRPYD0Yk1HJTl4RbfQ8SXLHK2ARfnHyix6D9L/T3BaRRvbAdYB69xDPaoCiai7SMPtdmgGxRkUne8AV/dReSbpBK2jhKPIpyp17awB6VkQi7iiA0EX7kQCyJAwFg3TFnNyanlXEDSeTaMpJu0bQEOmS2XdgQpYRqT8qrYLAF3gaXin79DH3oqoDgyRUQE0WhRAFYEiXuAEsNldUjUkk345Ax0KIuwIngi6ACi8Z2SQgBCHYB7kLxkGms2AdkXQJUAky9yA3Emgjo21gDzyTsLo6yRigMp2KwTwqBNNALaawfD+qcnJxxvh/i/b4PtuS6PBzwUueN/wAKvP7AX0uXJPiuaz/+n0onlTXFG0sHpg7jYGyM+VMQLSOXJy+DOv8AMUkm9AcOaL5ONpdnT08qjqmaKuwFu5t9MvkqpiALKygaHogChJolltAWiTIaAmTQoy7AtC8C6cTErrAGrGzj6fklONyVP2s7AOgRFsCMtWa2ioBisWbTBewgRWiFLS7AhDWxrsBWsCsvRnSRpey7A4/5IHlEryAkD0WwEl7Ii7AiWXgi07Auy3kqzRJUAaLoQAuh6sNFWKAFktDQADyqLNUIAFUX5LZARCFAb48nSPyYjhDYGJdmUqOkjGG69gM0mznyYR1eDz87Sg01dgcozebQeLk78se1HLljJ5gdeC18gPNBR46Wjpx8qVU7DmbVXox/C79wPWmnk0tnmhOllnaEr0B0BlZaAkY5J+CXybTM8iUo0wOyUXxNt5OfYZSpi9pgRGZS+5Y2bdLQAHZoAEegK80BpIy6s2tGJIAQmU8mgKholsWBETywAWRWKQCvckSFbAkKSuw0x2A7yWEUZNcbj0xrTXYF8dj1fRReG3iiWegOJjldRtGzE7/Uji45sD0eilBzSmri9nEZePk/FUgQCyWi6ICWJK1aIi2BdktFZABETAkQEAszK6xsS0gCLX6Svb2VULXQbAKzYv8ABEBGkZ7NpWBPZBWTTQBdoyxoyAb2eb1Cp7PVR5uVeUqYHnV+X3ZOsVWEZr7lZ1ik6ldoDU+NOKXR5uWNppvK0eu2jjyxTdvoDEKnHeDvw0tHh5eX9Pmilhdnt4NAd7qSxjsmVgBFVEQFY6QIQLZBY2Aog0iARSoELAUUsgKywMqNMmzTRiqA0iJFXYFeSIugEe8AhAexfYLIoCe8aFE3ZJZAUSX9gzZdAafY6eNGbFbA5XgCCgFZwVNMSAiRF0AS1gZO3ZA1YEhAv8gT/wAkRdgBPQmewIUGwWZuOgFigaoX8gQMdkBI2tGLNLdgLjTLv4NtYMSVYYGWD9xewAHs5Tjb8jqZkrQHh9RmLaeQ4ef7PF7XZz9TJQk7Pl8nqX+opJ0gP0HHyKawXJH7aZ4fS+o8mj6KalH8bA+Y1fknlKsno9JPwSiy5I+Evj2OEJLw85Ya6A+rvsVo8/BO1bOyeLA1LANoJW9A4poDUWCbFVZP4AryFthsrwA3jJqLTMykqt6NLFgbTwWU8mfG96NALArIBTJ5DsE/YComWUZ2gNXkkArACaRkUBq6LpAIEKAv8AL9xM2Z8gOi6f8ARi66MN1gUBghABu2RaCwIvwX4B35JrXaA0ROr1S9gAltERWBF2Vgs66AXuwKyABwAgHZnlTccG1sgNKdcTj7mSIARuOzHVGlsDvGNxOU8HSEnVHPl3gDj5fcb7MyqrYOVKwOjRzm6PRH7oHPkjQH5/6ryRfd/wDUfAnyLzdLDPt/WV4U/wCbr+x+eec2B9H0HNLg9RFKVRV2q3hn6bj5YtNn5Dh5fGMfi7Pvehk/U8bcHhf+wPfyciq3j5PH5pJW8+5w/wBQ/Jq7r4OHL6jTWwPrenxNNnqbfkq0fG9JztJs+rxT8tbA9CFKmyjpCAJVkLxkXhhTQEl7hCpN2aTGqAw8fk2rtFizKtcnwB1K6RSd0AFeQlKiezlfnyL2QHbaKGMGVawa7ApOyInoC00Lpt0HuW3gBEz1YrsDRAQDYtU87DorAgSp5yXQoCptmqJfArMqQGAZEBFoisCJMCAbLTAy3sDVgjMU6y7KqiBqyT8baM9ksIBckqtmfP7q7M8lOSXZucM09AKdpGjK/hHsBICYCDdRsuieVTAeNKcbCwTpYLoDtxv7h568rRyTwak3ID5/1KcocX2uv+o9foeSMuK5rZi15OM1vQccEp+CVJ6A9nC77wPLGoBxwfHLxYcjwB+c+up+NtYWv7HwOLii5pSf2vTP1n1L0754OP8A3o+XP0r44RVfw3fyB8iXp5Q8ov8AiR9T6Rzv0fByOUd138v/AMm16CbqUn9vf/bPNz/qQ4/HyuK6oDP071H/AN7739r3/Rj6+ahzycVUevnCPP58fmqzXWT6n+ih6zjja8fH/v8AwB8ry5YRhKt37H2fps5zg23b6/ufH9Xy4fEsRjr57Neg9X+lNKX7f3A/Xw0kbRx4JJpSXZ2tXTASKSaVksgVCg7EAQmVa5M6Ok2nLAATJBJ5ApYiYUakzba8UYSdgais2aLogIOxL2ACGskA3iukZT6EUsgS1QgaoA0STGhAkhQCgFOiWHaAVsDn18EVUiYEVETdZAiF4oAAmXv8gBf4CkyZP4ADEpPyVGpOjNLy+5Y6YGmlJ2txNttsHGlh/uXYEn4Rceis+by/UPH6n/pKxH+KX7Wuj6HLxy4PUSh5eUXrFdAaKzzT9VD/AFa9Mpf7j3jWLPQ04zcZKmAkCeC6yA9BJNrDoekZ4m5yzpdAEk3GjfByOMalsprxnWzK3TAzywXJTvWmaypxa6JpONI6cSwgN8vI3Kzpz+PivFmJNV7mZx+1SA83Km3R5vUcHnVYo9PK/HItJUB5/GuOkj43reOuCX811jXZ92UvFni9Vwx5YtyWvkD4PFxvj9E5Shbenesn1uDnjHiUNxe37HR8HGlDiatq6ydfT8KXLJXd7XsB+Y9ZxQ4uSov9jUOWMPTqNXP86yez6l6ZR9TV4fX7IvSekTVzygPr/SOZy41CW1r+57+eEpRThtHj9MlxpNLLPXHkqot3KWgPQ5twSCjjwTcoq0ejoDNUJN0ZVgaZESxkBvsK7LZAHv8A2NJYBqyeAFERAREF5ASIrAhAewEfyXuWgNIOi2UbvID2JkQEuthZIDBCM3crYGS3siAiJFoALoiANIGaBgY5Ifqcbj7motSv3RCqqwBLBUKush0/gDx+o9Bx8/PHn1ON5znFHquT+55YrCoLyB5+b0qnzrlhLwkt4u8Ud3bfk3bY7ZNWgCPuN3KltEkSjU3L3A0l4rxfRmEaVx0abtuyqlQA7bRiavZ0rNht0wMrt+534n/Q87i7XR1jKkB1kk0c2rjSNykpJUShh+4Hl5k53GOZDyS8Wm+tiuJw5nP32cOfka5o3H7c27A3J0zmkoxSl12LUZeXj8HP1EZckXFMDw8/By8f1OHOs8cr9vaj6XPXJyRlX8PZhVD06incesfIzdw+QPByQjzcyg3hndcLgkol+m018HrilGKQHn4eLx5lPR6f01OSbWFouPj+6Vals7+NLAGYx8W/k2jnPRRlbA6MqyQgBIQrICXRIgKiZDV60AdfJCAEG0RJAXQ2QoATzT2aKi7AVTdPRFHTsgNEC2WgEBACEEVgUZOEk1hmeyDoB7As5K8gNACdmgAiaJAQaadkwYCBbIC7D+Wh+QeAJ7S7Mt06F15V2yxYFSIf5k/YEApCQrYATDkkoQcnpFxvz4VyLTATL3kXb0ceD1EeeU1D+Sv7gdmT/hrTJp+VrQrQHOfJLjlFKNp7d6PTCaZykk9mYSqVdgejlp17nl5Y2ju20zzyy6rAHOUVGvYzOr/B2krWAUcAeXm4ny8aj7GuFStRaO73SLwjFpgcVCS9RmP2+9/B3lH2NxyglNQtyA3HRroFhGZzUUBzmnkzwpqTsozU7o68UPFe7A6dEiFAFZJ/gSAzeaEqECRdEQEA9EBl4/AkT+AJZF7D+xqv3AEqFFQ9ARIB7Aei7AQECaJgRdl2QGewbIgBkNFQAhX+QbpoXSlgCIgAtMy5Uxdoy0m/wBq+yDokgK7RdogtPAFur2W3nX+S72K1+QL+4pB7CAouyrDJgT1T0YjBQSjHS6NPRP4ATnGEYN0tmrbRPKAtimjmm0aTpsAlatnLgTc1J4aO12ZqldZA7PWTlNYtE/Kq2Kfis6A5vk8ErWWdJRSV2HjHlT7JxwByj5L1Hk8w/wDR0VSbrQRT8rNJWBVWUaVSWQTyajXQE8I8XqOV39uWeyR8yfFGHJ9uEB6OCP3OR61JU76PJ6dVFdHsTugHtC1kkQET0RAREVPfQAnYmfwaWAIi6LTAiJaHYB2RdCAt3sLyIATyiSwJbQD0QaQtLxVACFbD2ECBaEEB/9k="},
  {tags:"coffee food drink morning routine cafe energy",credit:"scikit-image (CC0)",b64:"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"},
  {tags:"cat animal pet cute relax",credit:"scikit-image (CC0)",b64:"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"},
  {tags:"motorcycle bike speed travel road adventure car",credit:"scikit-image (CC0)",b64:"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgwKCA0MCwwPDg0QFCIWFBISFCkdHxgiMSszMjArLy42PE1CNjlJOi4vQ1xESVBSV1dXNEFfZl5UZU1VV1P/2wBDAQ4PDxQSFCcWFidTNy83U1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1NTU1P/wAARCAF6AjADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAABAUBAgMGAAf/xABJEAACAQMDAgMFBgMECAUDBQEBAgMABBEFEiExQRNRYQYicYGRFDJCUqGxI8HRFTNiciQ0Q1OCkuHwBxYlY3NUovEmNoOTssL/xAAaAQADAQEBAQAAAAAAAAAAAAAAAQIDBAUG/8QALBEAAgICAgICAgEEAgMBAAAAAAECEQMhEjEEQTJREyJhBRRxoZGxFSPBgf/aAAwDAQACEQMRAD8ASXIPgnvSs5VgCoI+FNpTuiPwpM0w4yPu1xo9CzZwoXBABqI+BkNwPOhUnE0h3DHzoh9vugAjHNNqtCi09jDR52W9WNl91zjPlR9u6rLJvbgk49BSNJzE6svBB4x2pikizOmOM7h8aq9EuOzbU8NZFWOcOORzis9LVPCuwJd/8E5AGMVhv8GxaB8kZwM8c5JOP0q+iHH2sAAfwiaUgS0DwNEIx4Nvx+ZzuP8AStmZmQ5Lj0oSBjsPvEc+VbMxK/eNS27NKVB9ySdBGMnA70MvO3txW5OfZ6X0/rWI6LmnEiXYBeSyRynY5XIwcd6OgIUK4iCng586W37FZ+MUyjm326EZ+6Pw0SscKNZIlFpdRgkAzJgemM/zpnpi7bVBz97v8aWsd8z24BB8cEnHHCimlrkKRgja3elNUghKw1P7+5+CH9TT+3OYIz/hFc8hxdXQ/wDbQ/8A3Gn9r/q6fCujF8TmyfI3FTUV6tSCRVgKgVagD2KsBUVYUAeA5qwFQOpq1AiMUtY5nf8AzGmlKm4mf/OaBMSauoPtJbZH4D+xrPVP9Sux5Iw/Sr6wSPaG1I67f5GsdSc/ZbwMMHYenwrjn8zsh8DiZCHlwBhFAJ+NZqMQk+ZNXjTxFDvznkCrygCLoK6zhZ3Hs9LDD7K2rySBSA7YPkG5NES65pzLn7XHj40gt2jHs5ZBs+J9mn246YzzXMnJUpjgitLpE0fRotWsLmZIoLqKSRzhVDck+VZyapYBipu4QwOCC44rgNGnXT9UtbtwWEMoYjzANUu4VkupXV+HcsMjzNQ8iRpHG5He/b7R2IS5iYjnhhXnuIR96VR8TXz+GKSOTKNgnj5Gvocdnvt4t6KQEGcjNZyz16NY4L7Zgbi3PSaP/mFVM0PaVP8AmFaSaNZzIDLCgPmOK53WtHggkXwOMnpmkvIT7QPx/pjwyxt0kX/mFSHTGNy/Wlmi+z8c5PjEcrkYNLde0s2mpSRQMSi47+lNZ1dCeB12dNuX8wPzquR50lsdA8aySZnZGYZ+NXTQ8sMykr3waP7iN0P+3lV2N6igF0NNv96+fias2iKFGJpM/wCY1X5UR+JhvNTzSi700w2skizy5VSR7x60v0G2utT1AwG4kAVSW980flQfiZ1bM4tm49zzx3ojDpoFgCPc+zrk46E5OKT3ok092h3mRVixye/c0fqETtaW8aOyILJBgfmxnNWpJkuLRnv9a9vrmbe3vpULfaZMZ4941rJZ38ds8v2iX3R+Y1DyxWmaRwykrR0JfNRvrj3n1BXwZZh6bqMs4dRuYi6zy4Bx1pPLFKwWGTdHSbqndSm00vUbibw/tUgOM8mgtaTUNMvzbi5kbChic+dCyxfQSwyj2dKkpUBW5Tdkjz86oV8GV4TyFPuk917VytrJqVyjMs8uFPJoqebUvs8MLsxdWykueceXwo/JGx/jnxOhzUZpJb2mrTLn7Q4rU2GrAcXDn5CnzRHCQ3HwqR8qTGy1cD/WH+grK4i1aC3eU3D7VGTwKOcQ4SH/ABUgDyrn7kapb2/iG5JOB0A714rrAHMzD/hFCnFg4SR0HFTxSIQ6vgH7Sef8IqJk1eG2kma491B+UUc4hxkPeKm7m8LTJV8JSGXO8ryD5A0g36mo96cn/hFMbqa6eza3ZyYiFwP8R6mi01oKaZyLgTJLJJ98HjFWga4kjEUSqQSOT6UR4TJFcZU5DsucVrpcZVCx/NgVi5frZsoXJDI/cPqKRSDbJJzxzR2quwsVKsQcjoaVK7GIknJx1qYx1Zblui0P389KLJO4HqCMfOlyuVk+lGjcBxyO+aqa2LHLVDJNMnnRShjyecFucUXIkbMNo93GfnRdhHJJaQMsgUFccD+dZNCEjBPPbFZS6NIPbFM7ZmcE5xwN1G6MT49wDggwN0oK4QeO1EaSRHdOrHG6Nh+lCKl0BxN98Ecbq1RspzWcY5f/ADVcD0FDGhhGd2gXA8j/ADFZjOwelRauv9lXMRPv5yB51Yc85pozn2KNQ5lauv8AZk50ODPJyR+tcffnMzV0Ps3qVrBpaxSvh0YnGM1fozZ0FwAbeXgcCl8ilHbcO2RitH1axkidEmG5hjG017UCMDaeqDkVnkReJ+j0LN9ruS3GYQR9a6e1H+ix/wCUVyMEjSPMWOT9mb9CK66zObSH/IP2rfF8TLL8jbtXq9Xu9bGRK1cVRauKQHh1qwqvc1IpgWHWrVQGrZoEW7UqJ3TP/nI/WmgpRAcu5P8AvW/egGJ9ZB/8w2mPL+RobUZMxXisOkZx9KL1aORvaC2dVyiJkny6ihNWiBiuW/8AbP7VxT+Z14/gcLPcfw0KEgjirPOrNsGSfhRetWYiS3KIFR41bPmcc0AsbRzYxkkV1p2jjkqZ1MJcezdqAo2C2l3HuDu4rnJT4ZQnp0rolQJocBZzlbVxjscmuclO/EYG9zwqjtVsmjEN4ilgOpo5VIjXcMnHNbWOlMmoRWlywXcMkg8HzANY3UgicLzycYrnyW6o6cVRuyhIz1I+Irt/Z0zT6YhcA7eAT3FcbBCZ2wuSAMn4V39mUgtkijQhVAxWEmdFEygofeQYrndfeMyx8456YrppZxjJBA9a5bX0k+0oVwAe1Quyhn7NqBcbgcgpSr2nG7V5iD0wP0pt7M4EzqThtgJFJ/aE41edcHr1FP2L2N9KVhpsHX7vnVgg8TOCPOo09v8A0+Da2SEFWiLNKcngjipj8ipfE0A4+VecHA5xU4PAHTvUSds9K6DmFuqEiwmx+WgPYho4r2/uJThY4s/rRmsMF0ydvID96W+zG97HUFi8JXmKoHkOAvc49aaTaBuje+uGup3z99wZGA7KOg+tP9VbYDnqkCjHwWl1lY21xBJsmzdSZQnacbQPLy60y1L3rxlV9vIG74CtY6iZy3IQ6bNb2sKvM+Tk5GM9hTC6uIbu0ZIGVmI4GafWNkg0+3Uqp/hgnK+lSbS3ZhmGMn/KK45u3bOqC4qkcVLp19JcMwiLAn72Rimumq1tDtmUq2TnAp1JbwxyEJGo+AxW5t4hGhMYJI5ptKtjTd6FEWo2dvcsZpCp9RmkmuTrfapJLb5kjIABA68V2D6bYyuS9tGzdyRSbX7O1tLXdbwrG2eq0kkgbbFejgxpIHXHvcg1XVEE8yokm34GlDSMGPX61jatuupSSatQ/axSn+tHZ6VaypDtNwSccZFGxh14kILDvXHJPLF7ySOCPI1vb6rdxyhxKSR2bmtbMTsMAofKl2tjbpE4/MAPqQKVrrl0BztI+FYalrbT26xvGADIp49Dmkhsc6hBClhjb/FkmjXPpn/pWshyppRfa1HKtuNpG2YMfkDRH9q27x4Lc0sd0LI9htu5ZH3LjaevnWOqn/0d1PJd0X6sKtCrLbEA/e54rLUvesYE/NOg/Wh9koidBuVQQBkkVpAoe7tlYZVpcnPpWU6hXjHof3rWzbGq2KjzY/oa0WoEv5CfaZ5ZINv8M3RTjqTu/wCtQ8McFzLFFnw0kYLk54BxU26NLc3AgmVZTMzBmPCnINZRbmIydzHqfMk1jL4nRD5geoHfpkZ+FKc4QU1m9/R0+X7Up52getbQ6MJvZ78ZpjFyuM0vH32+NMICCAPSjIPEM7bVLi2tljRUKr0yOaP3GWzjlOAW5OKQsMeYp3atnSYznp/WsJdHQkkxddDEzfCsYs5NbXvMwwe1Dhgr4JJB9aS6KZsMc4+dTms1kUoTnPOBirAFl49340UFhNqqtay+Ybr8qtEQBjy61WwbAmGc8VcL7gwe9XEymKLzmdsURpze4VEfI6nzoe65nai7E7YTjrmiT0OCNdo3BsYIOcYppbXJulfKhQnAApU74GSQKN0hgwm58qzfRr7Gduu2d/I27/yrrbTm0hP+AftXKoP4v/8AC4/Suqs+bGA/+2v7V0YficuX5G1ex6141NbIxPDNWFVWr0wPDqamqjrVhQBIqwqBUigRIApSjoGkc8KHbP1puKRHiCf0d/3oBgt3Kkt2JEO5WjXB8+TQWqYNpcf5D+1XQ+7D/wDEP/8ARrHUyRbTgD8B/auCb/c7YL9DO70+3utEh8YMfDhDAg4I4rltDt01C5mWcttRdy4OO9dNqVx4HswWzy0KqPmKUew8Hi3N9kZAtXPTPatoN0Yyqxm5jFgq4zF4JyR25pFJbyQyZtJBLE3OQORx3p7ZQLJpkEbk7WTaRn1rl57r7JqM0MYygcjk9RWskZxdMtJHPMQ+7CjH4v1pnpmgXF7FHdyK2ZGO1ewUd6007TRc3zWqTSLOFVlKjIwRmuvstLu4kUNcPkDBOzio9UW3s4bUlWzvdscbRoOMH96aWGuHcq3G3b+YU8vtN2TvMYhKApDB1/b41zl7YWzSwtZRzCSRwrptIQZ7jNZuCaNFkY+e6g2hjMoU9DmkeuTYkVlfIFOh7H+HE6S3Zcke7tGAK5zWdHl0sxCScShzwAK54zxykop7NG2lfoaexbNNf3Uh/IFH1oLXEL+0FxJuwqnG2htD1c6PqMm6PcrgBgD0p3d2FtqLtcLcGKSYhl8T3QAe3rW7i70Qpr2FWsUbWkO5Tu2D3hwayjDpISBvA+RrSSRLNY4RMshC4JXtQjahDFI29wOKzimpbLk046DkkVjjOG8jwa9K2CKWWerw3srQmPJHQ0ym0+6UZ8WMDH3SckfOuhRbOdySEPtBLOlhIv2dvBc7fF7Z4NU9m9O+3WMfvYiSQs/mzdh9P3onW5ZTobWsre7G24cefr0NE+xWE0R2PeU49TxTn+q0EP2ewm4i8C03K2GknVFC8YXgEf8AfnVdSMbXEu8ErluPkcVWW4e4a3idCjxTrGwPnuyf3qbl2eabZtc5IbnpzWkvi2Zx+VHTwjbBEvkgH6VJjXPSrkYwPKoNcTOtGTRITkrzUkDAGOlWNRQMpgDp3rnvalgLZFzyWrojXL+1zbREB3BJpLsZym3dzWNkMvKx/NRCOQoGO1Z2aFEfxFIJbNbL2Zv0FMuUIHWso0O4k5xWpbHTGKoMrnB60wLgcHmhroZMI83FbxnhsnkmsJ+biAepNC7E+j1wBvhHqT+leKbmRQfvOo/WvSnNxH6AmtbdfEvrZPOVf3qo9IifbOuYKiBQeRQt+fesV858/QE0VKu0Dv8ACgb5h9rsl8mc/wD24/nU+w9F52LTEgcBRWUEmzXLTn7qOx/5DUTSg3DqN2cA9OKW3d4tvqschDBfCdQB1yy4FbV+pnf7A6SzxhjbCRXyzM6eR60Ra7vtEIXGdwFb6Sht7HVyGyY4tg7EbjzQ1nKI7tZJCAsZ3H5CspqqRvjd2wGM7tGHwFKx97HrTG2OdII8j/OlxwHHyrSHswyeiy/fOeme1HxDCgr7y+YoBcEjFEwtjByRg0pl4w7buHQ00sSDpJGc4Y9PjSZgWPLEj1NNtKP/AKdKp5wxrB9HQjC6A3KeelDeGrtnaeKJuuNpyaCfecFSSc9M0olsMSNFj2hQMVXbgV4E4BbGcdqknnFAi9n96QdyKJIChV796DtWxOR2xRbMWbjoKtGUhJcH+O1EWJ2xOPXrQ03961E2I/hODyc0S6KibZz1AzRmln+JKBxwKExg9DROmkieTt7tZvo0HTypH4bMQBsZSf8AhrqNMcSaZasvQxL+1cMlo88wjdzslJ+XBrs9DXZotmuc4iArfD0cuX5B3f1rxqO9TW6MSwqagVOaYE1IqoqwoEWFSKgV7tQBbNJzHuEqZxudufnTYc0vkG2ZsfmoBiea3+zTRxFt22Ic/wDEaE1P/V5//jb9qYaqcXw/+Nf3oC7Uzs0Y/ENv1FcE/mdsPgKtf59n4h+SNCfn/wBmtf8Aw7ChNVc9rU172jTbodxjoJEQfAVh7FyGHT9WkH/0xH61rHown2GxyRrYRDxFXgHnsM8mk15plpLHPeIWYsGZSG4JDYo+SE/YFAZiPBxtx1J5oG3lQaIbctiVHddpHY1pkbSVCx9uwvRLlofaGA5IDrGMr/lHWvqo6V8fsY5hqCSWsckpCqrBBnoAP3r60lzF4KsW5xzWkWqMpJ2bEVjKo8h9Kg3sP+I/Khnvt0yosLFW4354BpSa4sEnYvuS8WpFogrM/G0y4B+XekHtFcSLCBcBYZGOBjDADNdJc2/+lPIszKx6cA4+Fcf7RRrdKLeWV9yD75HJrxcbX5kz0IYpzXGKEelWUc9xPG/vkP7rnjIpgZFit1MpCr0CPxmsEtY5b4EvHDBwCQuT0pkLbTHQrCk1y6Z99ztHyHWvWjUumc+TFPH81RTVLefTEimkGyOcDYFIIPHl2pcLNp7H7WZWMbERqoQkk4/6URee0FwLWGPejqzNHhlyUGB5/GrLhtCjiS7VVSTcAEwQee/zraOJU+RhzfoU6c1vDqUeySR+egG2u1uLu2uZpEiSdnJOxlPHpxXz4x41FVVjywGVFbpLdJKwgnYlSQMvg0NcQuzrvaCOaXRJ4reylEkjoSoXsBU+yMZtNIJugYyhd/DdcHOOKT6e+pXNpcXDX88KQbdw3ckk9Kwn1GeBJk8SR3dgWctnI8v1NQ0mVyfY3hLvcweKNpN1kHzHnWkSmR5C38L+NwPzjcBSOw1opNbG4UusT5z3xginliqFo2LGUvMCrdhl805v9GKHyR1zdTVak9azmJWJipwQK4jrLGooOCV2mUM5I8qMpDINcf7XNvvbWH85VcfE12DdK43W/wCP7X6dD/7qU4/IG6THqezen2+9VRm3Jt9452+o9aiH2TsGQkyTdfMUTfQTSzu0YODjkPjPyphYK6WcYkzu75oX+QehHP7I2YjZknm47cUtvPZy3itJGSaTxAuQTjFdjOT4DepxSfVOLCY5/CamUmuioq+zglRYyyrk88k9TWDtm8jHkpNdjpfsu15pAukbM7nIVjxiqP7GXPi+J4YLYxxIK15V2ZuKfRyR96557L/OvNMbaeGVQCytkCupPshdqxb7K5JGOHBqZ/ZKSHTpLuQiIxqWZHGTgVSmkS4WxRD7Q5CiWMj4GrzapbTahbMW2IiNknzOKSz2zrcMCrYB644rC7icuNqkgDqKtU2RxlVo6NmWS4uHWQY2gD060svgH1SFXOVDKDV9NIEMm8H3pFWrW0f2n2hjUAEB9xB8gM1s+kZL2bwW2NGvbuTO9rkIqgnHYmlV/JiLYD1JJp5c709m7c7wUnu3fYF544zmuZu33SN6cVm1c0WnUGb2bZ0+RfJqD/2oNE2rbbadfWhvxD51Ue2TN6RbncvHlW8YyGGKpg7kz5CiI0Akb61M2aY0F+Aq2MMmOSSM/CjtGObWdfX+VZOmdDib8sp/Wr6PkLOBzWDNzO85RfjQbcDgfSi7gh4R2we9CAHHOKUSmELkqD3qrglTliKleV4PSoY+7TAi0G2frnIo4kjmhLb+/XgGice6fhVoxkKJ+JTRGnlG3rnnHSsLge+D6VrprYmcbMnHWk+i1phgAYkfzraywlw2Py1l7pPQj5VrZgC64/KazZoOLXDT2xHdsfvTvTr8wafFEYtzIMZ3YzzSK2z4tt/8w/emkAwpHkx/et8HRy5+xgNRc/7AD4v/ANKut+e6D60EQMZIrwVfKtzCxiL4d0P1qwvUJ+41Lgq+tWAAIxTEMheR+TVZbuP/ABfSlwr2MnqRQFjQXUXmfpUm5i/N+lKwP8Rq3Tq+KAGq3EWPvigpCGlYjoTWCnPIfcPStB1oASe0Mzw6vZlOhA3L+Yc8V619+6Lntlqy9p2/9YsVHUj+tWkBhtLqcE7hHsA9TXHk+R2Y/gAe1B/9APq4P15pb7OSNFoWqOp5AUD15BxR/tH/APttP+D9qH9mVA9nLxu5kx+gqofEzn2NFEksALZjDEAkDoSKzGlWuV8S4ZsEnlPOtpJFCAGQA7vuennVIpo5ywiZZCn3tpziuiWNPtmMZtdIa2kttbRhFZcDyXFHLqFuPxLXNeLGScOmR194cVG9T91lPwYUvw/yH5P4Ol/tQHhUh+Jlq320O0f93hWycOOa5rB9a8AfWk8LaqwWRfR10t3G+SpbPoRQcpgayIltPFkPDYxlh8a52rDIHBNYYvDWOTkmW8yaqgmCwtPtsbPpNwIRzzID9eeaYm2sVkZ44XTPQNETt9MikgkfJw7D51YTyj/av9a3WNr6B5nLTb/5DW03TJ51kurePdjqY24+lHtZ6ZIgiMduUIxgxEH60k+0zZz4jE/Grfbrj/fP9apKceiHKL+w9dA0NJ0mVIw6NkfxG4IoW99m9HaOaSMskgBYbMsCazF/cjpIfnirLqVyM+/+gpNTfY04/YtfTTaDwbeczpKpZgymNV288561zmqzPNesyxIjMcBY+n0rsmupLplWRhgBugA6giubtrSG6v5PFdlCqG4pU7Vhap0AQ2hAle5Ro242jHB+dNdH1lbVoku22wiVTu2dgT/Wh7+92yCO2IeJFKbmXr8BWdlIgTdJGLiFTmSFvLzFE1oIPZ9HtryC9TxbaZJUPdTmtZRmB/8ALXFR2NupF3o8klrIRkBXyp9CDTHR9Q1AW8i6mC7Z93BA479KweKXo3WVexvbsN8agc5yTR9KVvo15ETD4Ef0rT+00/JJ+lS8c/or8kfsYN901xF0Gufb6JExlSTyfJTXTnUoz+GQfIf1palvZJqragpnE5GM4BFEYSTugc4tVY/iUpCinqBg1sszKuMDAFLF1CPu7/NKt/aERHEhHxQ1nwn9F84fYdLKZFAxgA5pRr7bNJnPpiift0X+8X5qaD1Pw7+0MK3MceWDZKk9DS4yvaKU4rpnQaPHNBpUCjawxx2wKZEnYfc5HTmklprCxQrHI8B2jAKEj96IGt25x7yjz96tzAdKy7RkjpSv2jlCaRcYwQY8fU1QazbHneM/EUv1u8S/02S3gZBI5HLOMAU5TtUKMadnD3EiyRRqwJGc9aDaDxJNyARoOpJzinP9hT5yLiI8Y5bNU/8ALcmRukRvgam0ax5R6YBZOWgjIXILnJx04pTM7rdSOjlWwxBBrpJbYWqMnOYx8ua5ctuMhP5cfU1uukYSdtsLs7m5tpIMS8MpwDzgGlVwSbmUn8xphKQJrcDoqgUuuP8AWJP8xoXyIlqJqjYM48z/ADqmf4Y4PU1ZeLqTyBJqzqTGFAyeKpEvZY8lfQCphkfxQCMjzqOQQxHHH7VJKvcRg5C45qfRfu0dDBG0ui+EpUBnPJPTmvaZDJBcTqwJGMbscGvaOAdPZRIW97O0npRUTlUkwBkOec1lS6NeTTBZ7aUqQE5znkisUsJ26Bf+ai3LNksealFZhkbsCkoof5GYJYS9yo+Jqz6ZIMAyRgMevNFEEHJJwfWoU5T0FOkLmzGDTDHLuEysB1AolbGPBBnzxzgdKzQEc9QasW2OWGOnNMVsHfSbRpADNKeOowKvHYWVvJlGkJxjlq2Vkc5LL9RWqxIykg59eOKKDk/syWK1/GpJ9GoiGG08QER7D3JNeW2UqXXLKOMg5FaQxpIV2MH7HBziil9Byf2bxpDuBXb7pyOe9S10Iz7vckms4zCFwXUkHsaj7OJmJUhseRprXRL32btfAe7jr69KzbUXWQqFBA71k0ZLAqDg9yKykt5C4wCwp3IVRGcF6JPvDBq73ao+MZA647UtWGYEHbnHpW5tzIwJBHpii5hUQxr1F7/UYqh1JAT7rcelCzWjuVxkgedVEMtxhVjIbGBnABo5SFUQ1dTjK5xn5VV7+O4VVXrk8EelC/2fNEwLRdfdwpGa9FYyQ4dgApbBGelFyCojSxK4baoXpkCjBQVkeW4xwKMLACtYfEzl2c97SN/6/Ynsqj+dbai2NNKdC4Zj9KG9oznVrI55I/rVbq6FzDIRwqx7Rn4Vy5fkdWL4g/tGB/5bi567P2obQML7MSgnhpT/ACrf2gIf2fhXOSSn7UssI5l0W2LkwwF2bcRnfz2Herx/EifY2QJJdKpzkx/LGaB0K2nS5vWJa3hkOFcgcnJ6Zr0uosqgWsLk4xvZCSPl0rCKS8lcu8UrsfxNWkv2M46CX0uGxS4MkjztL1BIA/7+lLIdJnaYTWIyyMCELYx9flTi5srm30tbmVRiYYVmYYHP71hBFII2kLh2bpjnik7Kik3s0T2Y1hYpmuJbeIykHe03K/Sq3irB9k061kdmZwpYMRuJPc0QkphdJriOSTBzyMCq65dpeXFnc2cXhtHnpgc4pK7tly4pUnsO1CD+1bSP+zYTbsrMAyTY3gHGSPXFKxpOrRErNcXqNjK7E3j5kkYrqtOKWOlL9shEGw/3ikYx1464Oe1BDVbnU7zbZIY1zku5z866ueNfqkYuLq2ItIiu7jUY4bm8uI485cmLnb6YBqvtRcPpWoRxWF688TxByzqDgkn0rs3ubeWOV5Fed4nwfDj3AnuoP04riPaJ1l1FQ6BVVAACMbc5OP1qMso9wCMb1QrXX78fiQ/FBWi+0N6BysR/4aqsYjUtsTpxuPWi43tZdNYGMJMG5BrFZWW8SRiPaK67wxH5Grj2jm720Z+BNE6LZTX0jQWtos7KpY/4RQN3HtuCroqMONoHSrUmzNxSGWn62Xv4EntxHGzgM+/hR50ZpOq2Om3l349uJvHzEkjdFGetIbeQYMMh285V/wApqXGQY5Rhh1/rQ5b2NLWgjVLf7PcnaMhuRQiq8R8WMHA6nt8KFnaUHmVmVeB71H6ZfxmJ7a4PuMODjODTe+iVpmun6pHazStICkLchF5ANMB7Q2B/G4+K0ntrSKa52zu6W5zuZFywHwq8+jW63YEMs32XbkyMgLZ9FFJSrQ3G9jca/YH/AGxHxU1ddbsCP9YUfEGlKey1+1lHeRxFoZCNpbAOPh1rO309It7vGJOSMsOBRLKoqyoYnKXFDwatYkf6ylWGp2Z6XMX/ADUinsIJYxsTw5COo6fSlCW0jziIL75qYZlIrJ48sfZ2wvrU9LiL/nFaC5hPSVD/AMQrn7b2eZoVkc9aLHs67L7rr08qr8hCgNvGjPSRfrXvEU9GH1rnLywjsphEZd8uM7V7fGhlhkbgNg5xjNUpX6Jca9nV7h5j617d61xzN4c2x5Tu9DwDTfSdNuLyYoJ13nopY5Pwo5BxHOagmh00C8STY0jBRxu3HiiZvZrU0UGJ9wzz73akppj4Fc1GfKhrzSdQhXcsjd+9JVu7oAfxmJNJZIsfBju9fFpKNi+e/HJ46Vym4AMMdSP0p5dzTNBOj52qAFPmSOaSKDtGUJG4n5U5dhHo2aUSzh1zt3DGaGuYh4pI7nNaqcy8DA3dPKr3K4bjkmsrpmtXEDAJmcDJLMBxT7VNPFl/Z6Ae8wy7HgE5/wCtD6FaifUkZvuoxc/Lp+prbWdQ+2XLAH+Gnur/AFreEeRg3Q5hsoH0GS23DLZI889q47YYp8SA5Q4Za672Yu4Z3SCVQHTJB8/L+dLPaew+z6sXVTsmXfwOnnSapFdsnRpWeOZVGIwfdHeoEm3WdrE7CRlc8GiNERTYKeMsx5rC5QJ7RRoe4Brnb2zZLqyuoNi5hPKoz87T2yKeTNYW9vCcEFmIJ/bNI9XGBHt7NRuqpjTVbycZ+lHIOJF9bEoZbbcwxygP6ilAukYn3mwOuaNsNQMDqjklM5HpV77TFuommtlXeTllHcelNU+wbaAY7qNWyX93FbIwnRhEQxI6ClshkaPwkiOA2PX4U90qwFjbmSc/xCPeP5RTaSRPK2aWsENnatNPjcB1Pb0p3pE8d1os21SrSRuRj0z1rjdSv2vJNijbEh90efqa6X2WwNK3syqoV1JY4pLQ3sa+ykKzaK0T9PEb+VA6BN9mtpUCgkz9fLpV/Z7Vrexs3jkDs28nCjPbzrHTsx21wcfelDKfrRukN1bItQY7uYfh8Q4prpY8N7jceCeP0pRE5a7nB5IOabacySTzRE8gbsfIUQehZFs1b+GxVgMZ4rFsBuOB5VlqV0Ev5I+TtxnHwoVdRiLrG/uZHDGtOtoy70xkAAm7NWTBQHNLbyW4jtt0fIHXA6VSzaZo8zOVHXB4wKfNULgw/wAXc4xjYOpPepmlVAHjf3gex6CkVxfiScRQnEQPX81FW7FtwPTFZtt7ZaX0Mbm73wIhLb8Ak/KqSXjERQkdxzmhF5nAPdcfpVTzcx48xS5b/wDwrj/2FPetbY2YOeKFutamUALjJOKrqACMABgZpTK2+6HktOEnRMls21K5lur+2LHlBigJryVGlRW9054o5lYO0mPwGlz20jbiVPSs5O3s2gtaMru6mNsgZyQMYBp1oEpl0mME5KEqM9hmlup6e8enRy44O0fWh7C+ltLUpHjBHerjtGcuzpHkVQS7YUedBPf28kyQ+NsB7isLwhrf33ADopJPXNACC0ypc7j5ljWnAjml0dMkLLwCJYGUGPc+MZHWj7W/tbSMxCI72Jz7+RXNfbf4KxRTCNFGATyRjyNZNLK1uUF0NxPD9DVyUZRqSFGcou0zq7KO1ubC4FxOLeFMDaOS3fPJrn725s7bIjLmFZOh+8w/lS+9uJ4rWKGWQspGc55Y+tA3E2/fvYMysSD505NvRCDYdSW5aWPJzuLKCeD/ANa3n114bP7LZfwyR/ElHVvQUqismmVTwCBnOcGtJrdLTZuIZyOg7GooYRYajJYbGjnlJbl0Q4Gf502js/7Vt3vbhw8kkgLODwp/KfL50su9P2QRSxXEUxYZcKCrKT2INDRzXInJiZk3DBK8DHqKTVlp0y97bzxSyJIhzz06VgWMFnEXA3kkYz27fzpkuoeIgjuYwVUFd6jOT6jyoK5nSV5fBtYgmAFLE4XA5xk1CiXKQz0DU5rPc9vIUMi4bHlU6lZl/wCOnQ8k1z1jOYZgrHCt+lNpL+SSEwqxEZ6nua3TVHO1uyIbN7mGR1I9wdO5oCVnDEsSzAYGaPtLmS1kyiM/HKgdRSi8uDcTM4XapPQdqitlXozUSXEoA7/pTe1swiYA+J8zROiaSzWyyshy/IpyunmVnjg5wwQEjG5jnn4AZJolaWhxSb2KERhKqRKGI5JIyBRtzbLOUaR2eTHJ3Hj+Q+VE/Y1hXwoQcA8se5861jtlByTuNYm/Zha315YQfZvG3QbgyFxu8MjypdHLu1BUVw0YIGQMA/Km93AAg2gBV5PrTex9lbXWNPhvopDayOPeRVyuRxnFTOMpR0XinGErkc9cWobU4YYAcsw69819D/sHSW2n7JDuUYDLwaXaf7H29uxkup5J5fwshKYoyT2asn/2l0D6TGjBicI/sPycyyS/Vlz7N2AH8NZIx/hf+tZn2dhXPh3Mq/EA1mfZpFH8HUL6M+kuakaNfxDKa3d4H51DVvS+jmt/Yvb2GsmlaRnMjltxJJGT9av/AOTbAdbfd8JiP5Vnf6zcaMC1xfvcYB90xKuTXLL/AOI+rK53RWzjPAKkfzpppieuzqD7EaOWLPZTEnynzR1t7P6baSpJFbTq6cqd+cVycP8A4lXZOJNNhbz2uRRqf+I0e4rNprLjylH9KdIVnWPaWrtl1lB+BrRI7dE2B2C+RJrnrf23tZ4hJ9hugp7jaf50WntXp78FLhPjHmjQ9jGS0tJB7xBxzy1ch7UaXZWAt/scChpGO4g5pzce1+jRD3pmZvyiM5pPr+t2d/BAunyBj4mWIXBApSSocXs5m/Jjgdt2dzdPKi/Z6+RzZWptY32GSV2fkHg+lL9UctbLjJJNZ6Zcy2cytGiFjAy++Ome9F7F6IhaJ2vi+FZjuQfOsJSC/wAq9c7PEDKeuMitAQQTxWLTWzoTT0a6dL9msLqUH3mxGvz5NBqQSc9Kndt0+NfzSE/QCskYbuSMGu6NJHGwuxmFtfRSH7ueab69cNcTrErb41XaC3XJ5PP0rnse7kHOOKPLFdOeXJLptOCc5BNY5N6Rviaj+zDNHkCo1swIZcsPUVlqrbNftXU/eAr2k3CySbgPf2nAq2oAtNaSyqY2wDz2Oa51p7N5JNrizW/X3OezVveZbSpfQqay1IMbVigyd/8AWrzuRpMmR1Vc5+VJEsSAHxB6UZZ30kE7KvvKPw0JkM46qaPhtBEC6nJJyNw/WqQn0MYIY3k+0lNhUZIP70PeXJmWQKCqAdD3rGDUGE4A5jTk8dT50xmMd/C5G2N8YBA6/GmRRymw7i2OAadw6VdtAjGOU26e8eDtBNDw2+yYQXKEAt7xzjA8819L12CC10dZLWVuEXdhuCvHNVFXYTdUcppNhBd2dzvH8VGAQ56cUJB9rs23TRYjLbG54z2/nWqXN1p8EksaIqyvlS5yTj0H86Bu9Zup4RDK6qPvMVTrTinWyJNXoZWjA6vP/iXP60Vo7Ee1FyD9zw/5CuRW6kBOW3rnqCQRRthqstrc70zKSMHcMHHxqVGhuVsfa2w+3zEcZApBdZYrTa6vob7MoBSQqAQ1CQxAyBz7wHQDmmIZaW8i2oEpyuO/UCrX8LtGCj5VuoqbJQ0bO578L5VvIqeDlZFVgfuk9aSi6sG1dCW302XxQdh+dHpC0TsD1wTW8N2uSCVOPI5xQ0NyJ7p9rqTg5APpTlXEF2bD++RvygVD4WcMPwsD+tUkYiVQDywqrsVm2t1wP3rFdr/Br6f+SNRYMPEBGMkcHODSuRR4asB7zGm+sKoiXaoXJJOO586VId2weTVrBKtGcrsLuW+yaRDI496WUKPgK03pLC5TGNp/asPaUF5rKzUHEagnHY0uine2d0bOCCKwmrOiDpDnUAH0+yj496SMc1yDe6Cvriugvr1VSxDH3VdGb4CkL4M3HIJzWmNaMZ9j25sWuLGNkUl2CqPXA/60vmsbmKRQbeTHXgZ/an1qnixxxrJlgASv5eP51tcI9uqnYz7um3+flXTa6swp90cy0TiUEwSBfVMc1sEhtmMr4JH4SOBWt5qJY7cliT7qrzW9nok8zCe+Q46rF/Wk2kCTexXeTy377mDCMLhMr0HpQiWkkg2qPeyMeZNdsQ0a4wVUDy6Upe6vbq5K2u2OJPxkCiv5Hf8ABRnTRogiYlv3XDEjIQeVJZBvfe7tIx5OfOumisoYiXky7H7zOetbpLYxDY0UIRRn+7HP1olocU2cuDKMFcj55rwhd5c+LtJ6sRiuh1G1g+zNcWjDqDtEeBt7n60p1F7V7O3SFCkwz4pzksc8H0rNyNY4X2ZWkkcTlJkR1/NzTJbnTZItklkSe8kdwVP06UjMLsMAH4Zod1KHJzj0NSqZcsckjqrfSdFuly2pzwD8k0Qf9RSWe1ktp5EAzEpwsg+6w7Gr21qlrGjXrKWmAZUDklQemQO5onUrZ7XRjcLZFYJ22pK77mz8O1aJV7OduwPSbqWz1eJp1JhlOwkeR8j6VfVEs5tQCwFUUERiNF547k96po9pJfGJYXeWRW3GIJnpRbW8cWoz3BQBgGcjdwvPTFVRJ3GkXFitjsdR/ChPfHNc1pt2f7UuJEkYIgKrzjBPU/QCqaZPHew3UIjZWbCsQcqPUGqaRbLtYu+0tJxkdecVM5LouEPYwcrN/Dw5DcFk61ez0u7ih/hRSuGOQNuCaeaRfaZZljKDIcddvAOa6A3QubQyLCqw4JGXxms0tFt7Pns1wVEiyptZQQc9q6r/AMP5zN7Mrk7tkrrn55/nSnU9ObVLe4e3CKP7tTnGT/8Aj96J9j4LvQraW1nMUkDNvUq3Kn/sURkl2KUW1o7KooIaip/A1W/tCPuGHyq+cfsnhL6C6pKcIaw+3w+Z+lD32pQRWzNuycdB1ocl9gos+de3VyHuFh3YySa5SO3eRdysgGcYNO9dtL/UdSadLaQxjhRjnFZQ6XdxxDdbSg/5aUGqHNOwVrVo1URzxyqRzgFSD5HNZ2thLcXISSSKFepeRuKPaznU+9DIPiprNoWHVSPlWmjPY5XYIwqSwYHH38UHf3rwRiOFAZG53L7wA+NAbMdaqVIPBqFjVmjyOgZYXmlaSQMAe5HWibVNl0nhOxXk4+VeO4dz9a0tyxdyWIwh58q0ozsrqMskcSbTtJHJxilsZfdvZiSQRRmqnEiKfeAGD61hCFMK5RD8qVbCyHjPuyOwAAzgGsHuMkFM+tHJFHKwQxKM9SKDjhxcGIrjB5PpSbS0Uk3tFjHtUGZivcKOteBhJACSHJA+91rR5BJCm4DIYkt3qm3ZhuMKM/Hyp+rYJW6PXA2N4cakBPvZPOavHMqWF2hPvSBcfI1ko2ksW56/GqyLjGBwwyKVUOTvYd7OSbdTQeYP7U812NTPAoPJXrnpSLSYpLXU7eR0Kq2SMjtim2tRSXj26wYEmSeTWElcjbHLirJ1bcNNkKnBDirksNEE3BIj5B86mWF5bJ4XA97GTu7irxZh0+O3kXJHX1FTXRfKt2C2zRtZhntUSUnIbvj4UBd35ZikRyo+960dexTXC7UdI1PXPU0INKBAzOqt8KuKSFPJKbuQOLh1iMiRHaTjPUCrW11ceNvMqgDqGOAflRlvZCCTct0vIwylCVNVfTbZpd8Tug/LjOPnVJoxad9hh2ahHsEnQcEdRXTveFvZmC0mUFyqwsT6HHHyrkLazSKTeszA/DpXRRyeJpiEgOyyYzjOMjrV43uhTWjP2BtrW7g1LTrxR48Um5Ce3Y/tVNb0J4pybcf3edrdiPI0HbSCw9pTKJMLeRhlbp73cfXNdCmplgEk5Oc5NaJaMmcHc2+HIKtC4PvLj9q1gjlMe4I3hDjgZzXdRW9nfLi4jVhn51qPZGwky0E0sPwNDiCZw5uEHGyRD5I39auHUkMXc46g44+nWuvuPY5duTeu4/xE0v8A/L4gBCXLKM9mxmlxHYk+0RIPdZwPIL3qJp4liEs0hJzxGuOfiaZXWk7UJaZnHq2aS3dqojkh43HlCD3FFBYJcXk0+RkRRZ+6owKwgna3kEkJIcfizVCGxyScdvKvKueelZlHR2WoC8uISfdccEUXeSg3akdDkVy8TmJwUBz6HpTqDU43QJKVD47VDjTtGilaoNvpQ6BfImhdNUS3Uat0MgzW3uvPHyGQyYOD2o/V7OC1tVnhyuxgFx5evnUKSiqLcXJ2B3syzarvHIO8fQgUJqMO+JiEAxwD8qHtJSTEx54Y/rRN3MPBJ9KiWpGsNxEc7E2QYnJBFZScSD4D9qJuLZ47GGf8LMKq1vJPeiOJdxxn5AVtE55HR6YVW9zgglFGfPim08K3EDwv91hikEc4gvEZpBtBX3fyjBzTyC5inGYpFfHXBpZe7Hi6oD0jRY7EtLLiWfJw3kKbnmqis5rhYlySBWW3s3jFvSAtcuDDZ+EmS8x2AUOwt7DTkgkbaqkMWY+8x8+KxnnM+o7k3MYh93tnsfj1qTpS3U4mumc4/AOarko6OjH4k5pyBJ9Rkujtt0wn52H7CpXTpdhmkU4AyZJTgfKnsMMcAHhRKmO55NLfaCRvswjBJaRguSahybO6HixgrexfawtfEmSSRYE4UJ+L50V9jtol/hwD4sSTRcMYgtkQADaKFuZworNybO3H48Iq5K2DPDGxx4agHy4oK9sDDcKsjbUYZDEZ4q085J60XpOdW1i3guJGEEYLdckKO1awTPP8qWNege10KWchxII9hBBNP9QaG40b+z5XaOQ4baoG0nzzXRe0VpbWlhFb2igu4yNvUetcVeQy290VlOXHXvWC8iam1o5I4YZcaZjZTxaBMPsdwWunADsB0Gax1XWPF1WaVQhEqhW3IMZ7nFW9pLFYpbe9t1CRyrggDhWHDD+fzrn5Axw5JJP3vjXpI8uWmdR7J3T2d3cKT/fjYSOlFWJ33UlsTh4ZCBk9iciuUa+mLQtkARrgY7486LXUd8yzofDkHBB6MPKpkrQ4umfRYdLgvUQqRFJzuUNnLD0pIzXsYaFpnWHcQwJ4oS39o5oE3KVR2zkjBJ+dQmsQmQS3BZmY5HGQKxaOiCUnTdDVpmMSRqSI0HA8z3Pxqu5h+KtxICgwkZz321mWA/An0q1nitUdL/ps3tSRTxZB+M/Wp+0TDpI3/MagsP8Adr9TVCy94/o1H5oP0T/47MumjT7bcD/av/zVP9o3I/2p+eDQ7siqSUb5NSi51KWNyFRT8aanifoyn4eeCtv/AGP/AO0rjuQfiorw1ObusZ/4aA0Zm1KzeZ8RlZCgA5zwP60cbFscP+lN/iMKylv7UfvGlT/aQP3oEPzrJrFx+JaobGXsV+tFYg/9psb23b71ohqhmsG+9Zr9BWLWkw7D61T7NNjIQ/Wjjj+/9ivJ9GzLpb9bbHwFC3NtYgKLaMjccNny+tZXUqWm37Qwj3cDd3rITwzJujlUgeXc+VWoLtMlyfTRz+qysL0gdAKHjuGVANoIHSrX5338uOeaHAwKdk0NrBxKhk6N0IrSVQJN2BzQOmS7ZmjPRqYTDKZHaued8jpx1xF1qyyOY3IOenNWdRnaSQo71rNZfZ8Mp8SI/jFVYmQMSDt6DFdBzptKgdsBcZJPp0oq1RQLZ2Iz42NnU445rJQqjcFPxFXQZvIEHXcM/Emk+hp7Onv4Y47SMpjcJBSu9uTatDKRnqD8KOvi5tVUD3hIKDubdpwBLENo6BmxXPjTXZvlab0WTU7faSkzr3O6EH//AKoa41hixWNlkQdDsx+9aC0RR7kUfTsc1UWJPJVQPhmtdfRlv7MDfyHPvL/wrRNlDeXci7mjhj7swxmrxW8aSLhRkHOeK6OyV7u8WBmVVKk52AnpWU5qJ6HjeL+WLm3pC+LRFmDFdSiAHXIxj60BqEVvZnal+ZmA58Ne9F37lDd2zKhRWAyFGfr8qSWpH2qNccMcGhTTNJ+K09ewiBlaMtJM/P4Rwata3kkM7R+LIYn5wxzg0+S0j27Wto5F806/SoT2eiuXBhaWLnnd0qoyXaOTL484umimuWsd3p1uY4cSqOXHGaT2uoPGRBdkk592Q9/Q+tdLeaU9vCNjNOAuPd4x8aQXGjTvu3tEkbHOGbmujku0cjhJOmhhaXzQy46iukttViSDJcZ8q+fN4thL4E8glj/BKp7etbvO6KH97aeh7GnzRLxyq6OzudYDZAf9aAnv/d+9mubW7zzuwfWpM5b8XPnTsjjQzkvCwOG+tK7liz1Bckc1GQVOetAA00W/3lwH/egsNv2kYPlTEpz6Vm6KwG8E46MOoqGikwQlugyvwNQqvI4Ue8a2dG6t7w/MKhV5CKcBupqaHZvaLKr4hYgg8tjOKZz3s723gzyl1HPvIcmlReSNdq5VR0FVjLs+SxwnJ5ocU+x8n6DoiZCjBAqgEKBwT61u8UTRjxmcnuFGB9TS5XlK+IWJZ+/kKqUaThm5NHBPY+ckqQe8sckSQTAeCCPDQHJ47k1Z5058KPC+be6D8h1oTZslBU8gYxVJXO7GcsewqkkiW2ytxIxlwAAT2AxmtdFlkGpx7TgKcyE9MVZIYmi2KpkumxjHRPjTbT9L8GP3zy3LY6k1hkmlo7/E8SWV8npDCW+8Q7IFJ+FVSzklIaYn4CjLW3jUYAAHpRO6NOuKx2+z2Iwhj1FCu00ySO/lmZkELKAqrnJ+NMvCVRwOa890qD3TigpL055OabaQ8eOVUugqaJ1DArhlUsQeoA61zWvzKv2Y5znDgjypzY6p4OrzXF4zSIYGCDz5HHzrm763EspUOzIhIQgYGO3WqqBwSz+VbhGP+guS+BkMa4+7lST1PlS+6kZ/FVHBccrj9jWa25jVVZcgYPJ9Oa8Y9uChCkY5A8qLxrolrzcnyb/6A2l3qD3rSzuWtbtJV7cHHlVDbMNzAjA5NUK7QOc5FNV6JnGcn+x2H9tCe4SZX3kKBgnpSfUr0Qb5iSXc+4DzSZQzSqFzknAxWl0PtF2sKZKxLzXNHx4xl/BpLK1jb99I7CYrq2lcdLtPEUD8Mqj3l+Y5+lcNMGjkaMnnPI9a6j2auGdJ7INiXPj2/o69R8xVriyh/tyO6WNTHNGXUEZ2n/ociu9O9nkzVWjnYtOkuWBVGVCM7j0zRd7Yf2Xb28nuu04OPNcHFO5rhY2JlIAx1NJ9Uu47nw/CUnw88465pshC/wALcQ8p5HIwelS5yFIPBqAry5ZuIx+1PtKsYJLoQTIpLJiIk8Buo/p86TZai6sYaPH/AKDCZFy2OpHNGunPH0rO1YlMH7y8GtzXHLs+mw1wVfRgaqasag1JqYz/AN2a566P8R28hT+6OIzXN3zYjc+fFVDs5/IdROi9k8DSCx/FKx/anW7OeaReziFdGhP5iT+tMs88mrl2eLHasKLADkis2lA6c1nHG80gSMbmPbNekikRdzKQvn2pUx2uixkz1FSJVC0OTjvVWagZz/thIGa2UH8x/agtOVfs8W5iGMjMAO+BWntQ2buEeSH969ZZW2h9zI2M27y5rqxfE5MvyFTnddSt6mqZyBVol3iZicYGfjVDhcYP1pkno3McyuOxplJfRKOCWJ7ClRNTtJpOKfY1NrocWUnh5Td4lse3UivCBvEbwnCRj7oPPBoQ20qHMZPyNeKXZGMOR8aqhWbSyGEnMgZuwA6Vhab2u43B6OCc/GvLZzNyykUwsohC6mSPdjoBQ+gXexlrDlbWYocEHIPlQkUka2EcvhqZCOWY5ovVMeHIrfdI6VZbWxSLAs4zx3Yms1S7NHb6M9JdbgSvKxOGwMdAKCurpi52sQM8DNNI1SKIi3jSIk8hehpRNaTLM2ELg9CKm7ZVUjO1uAtyC2W7da661kMW2XG2THxFKNHl+z25UQRht3VkGaZDU5gOig+gpNRfZ04vJyYo8Y9CzVQ0buXbJkbdkfChrNpb/V4d23KAdBgYArb2nv53tbeIttRiS238XTrRXsfbSRo13LGvhniPcOT/ANKUoqKtHRh8l5JqMo7R1NlZKArzHap6DuaY3E4dEijIhhQd+WJ+FKXuCCWLEserGhWvlL7PEBbyHWsFP1E6p43J8pscRtBCCUR5T33nj6ChNTe21BI47i3j2RnKqBj/APNXmgmht8RktKwGAp7npXN+NJHeIGkfcx2OkjdD5jy54pxcpRb6MPyY1kSexmYbJRhbO3A/+MVSaK3ePaYlwfwgcUVFDZNZBprxUuHBKADK49TSw3CtECWANN459m0fLwJ8dowk0y2xuWNAM+WP2oSbToxyEYeqHP6UY0pL9RtP4twqfEGcbgT6HNLlOJ0xj42fSpig27qfcYSjy6MKy8TBI6EdQRzTiWNJfvDnzHWgrm3OPfXxU8x94VrDyH0zj8j+lRavHoE3A1GATVJI2jG5W3J5+XxrIuwrqUlJWjw8mKeKXGSNZMBvcG3HXnrWJIJ5X5ipznvVc0zMtvx0Y1BmJGC2fiajaD8qqygUhk7zjGePKrB/Mk/pVcVGfeCKpZz0AouhqLbpF2Y7OOBRVhYzXWCv8OL/AHh6n4Ve2svBvbaS/wANb/jUdF8qcmQKeCCO3wrmyZtfqez4f9OuV5fXova2sNom2NfiT1Nb+KBQTT+tZNPk4Fc1nuLGkqGBuio4NYSXfrQD3HbNZFyx7mjbC4RDWu8981jJOTQwYscAE/Ct/BfYCVI+PFCi2RLPGJQyHzrNnrzKR1ZB/wAQrJv86f8ANTUTKWdfZ5mrJjUnH+8T61Q7ByzjHkKtIwllX2UmbbEF7tyaFY4FayvvYmqJGZHCjqa0SpHG25PRa3/hxvO34RhfU1fRQ0ty8Qgkllk5ygzisb6Tay26Z2oPqaZ6XdawYPC0m1SOMdXVAST6sarhcXfs48+WpqMfX/fsa6bYxWDi5n/h3RkzFv42qK01DUoBJJHZpkh2ZGboueoHpmgfsWs7jcao2+JFJxvGV+AFD+FPdyv9ni2lE3kE5O3zrSFKNHJkbcroXzzSvLulYsT59q1tLG4vWHhKEAwSzdh51tqVkLRCSTIzlSr9sEZoz2bYgzxseVwRnypTk0tG/jYY5JpS6MBpUsNrPNLKeUYBAOo9a3QH7NaXCnBAAJH7/Wml8N0Dr5qf2oLS1EukxK3QqVNYKb7Z6svGjX44+0//AIMmYeOk64C3AyQOzDqPr+9bGlsEjPDLbn+8GXX/ADL1+o5+Qo6CUSwq/n1p5F7I8HI6eN9oq3DGqGrv96qVieiC3xxHXM6m2IlHmc10WpNiOuW1N90oXyFa4lbOHzZcYH0D2fTZoFn5+HmiiT6VXTV8PRrRfKFf2qTRLs8yPSCLI/xicDO09qmVTHZeG4UktnFRZ/eY+lTen3FHrWq1jM2rmmAMifkX6VQxofwCtTVSKxNji/arA1BNox7leXMdmTv4WEDb5Gqe1B3auV8lAq12VW1uNqkMAqE+fFdeP4nHk+YstE3K3HUiq3K4nYeVEWK/wR6v/Kh5TmVz61Kf7Da/VGVWU9qgioPBBqzM6FVHYc1cdOag8d6qW8sVQyS4FQXBqhJ6mvGlY6GF+A0ZPcx5rzXoWLPhchQfvdapOd8Cn/B/Kh2YG39Slc8jaPVm5vsjiLB891Qt8Vbd4Sk+ZJocDgcVRyRVqKRDk2Em+JJJjUfWrJfKAVdkR2wFLD3R5k0GCp6/tR9tbxXFn7yKxDkAkelOkK2C6fatf6xJBcSpcRR+8XHf4V1U9zFaxAsQiKMKo/YVy9vLLp1wXhxkZABHAz1qlzdeIweSQu5HIzwP6VlODm99Hfh8iGHH+quTD7vV5ZsiNdiefel6XbwuD4hA3ZIFCPIzHrgVQK0jhVXcxOAB1NWoxSpHLPNPI7kzub0NeRRMkzquc7kODSvVVtkhUKpecN7qgZZvU1hp+m3cEKS3U7xQZ4hVjuPOPlXQtZSRWQVB4bysEaUj3zk8/pSwYvxw4sWfL+SfJaOfgXUHsh9nsysbAgySAYAz1Hf51kns9ezLuluY4VJONzcn1+FdPfW1uttHbibdllQgHOE7/pXtQSBbNYog4EuACey55P0rfiYcmcevs/cTJLJFeqYUOA7EjefT09aTzSyWs5WK4ZsfiHFfRLhIBZulrEd5G1QegpPeez+npAXLMCq5JweTRQJsR2GrXJGJozJGOrjginUUyTRh0OVNI5bC70xklaPenUKedv8A1rVNeOGQRrg8gMeFrnngUtrR6njf1PJi/XJtf7Gc9uHy8eFfv5GlU0WGO0bWHVTTO1uo7hRtcF8cgVNxAs6/lcdGrnjKWOVM9fLhxeXj5Q2JuorN8it5VKSFXG1x286zI3cd674yUlZ8vmxPFLizHewORVyxYZIxWtvbvc3Agt4zLKew6D1J7V0VnpNvYDfLtnuB3x7q/AfzqJ5FE28fxJ5nroQ2unXd0RtQxR95HGPoKc2tjBZIfDXdIesjdTRM1xk5JoOSeuGeWUz6PxvCx4N+zSQhgQeQe1BsGg+7lovIdV+HnVjKSeKjeRyamNo6MnFrumRvzgghlPQjvV1ICsWYLx1NA3M8UedrbHPVRzu+XY+tDTXCrIwRfEx3Y5FdEYXtHmZfL4akxj4sW7jdK3+EcVZfFldUjjRGY4AJyT8qWWMk01wfEdxGFyNq8D4gU60mZrW5WaBlMiHIIGOfgav8ZxS85PpN/wCgO5c2rlbmeRCDgqIyMVSK5tp5FTfcsD1O3OPXA5ppfPJrV3NPcoXSLmUggdjgAeeRSS4V7K3guI3Mc7+6MD4HOfmKtQ0c78yTfSN7dVuldra2uJEj++3GBnpzWZaNZFR4JgzHABXOTXY6FBb6d7IQNN4ZF0wd3JBHPb4gD9asun2l0Y2ThWIO0HI8zjywMU3BEryp/S/4OGAikdlVpAy/eGzpULGjZC3CH0JxXQ6X4N1rE/gFU8RzGsj9Mg9fpW9xpm2bf4CPz/eRgc/Loalqi15Ca3Ff7OcSzkYdAc91OaaaXoru2JZBCzjgsOcegptH4QMUmUUIDwqBee5NAXNw1w26GMtITgE5AUVNWV/cV8VQ1tPZ2xtm3uhuJB+KXn9OlM440hjCRqEQdAowKRW15cWzKJGZolI3senyoxtbssfff/8Arb+lS7Mk0a6wf/S7g/4DSWC5ewZZ2ClEaNRjqQRgg/WiNT1a2k06ZVMhLLgfw2x+1ILy9jlt5UhjnDSOpLMMDIAGBWuK1ZnladHQ6rYrJbPGvIjw0Z80bkfQ/vSv2fDS3twxwNqLH5dKcac0x0iL7YhWSAFW/wAUR4J+VCW+lXMmoTfZih2HLAk8+vHalkX0b+JkUZLkETrliKC0MZ01PRmH60zbTLwEExRk9wJD/SgNFt7hNO4tZJFEjDcpHnWCi6Z6358bmnf3/wDD10jQ3Uc0fDEgg/4h0+o4re3KpOypxFKPEjHkD2+XI+VTdpJJCym2uEbqp2ZwR06UNCzPASAVaL+Ko8lJww+Tfua1juNM4ssljzrJB6YdIPerOtRDdSxJIkLMjDIIB5oaczwKS0D9OMA1geopxauwDVmwuK5O4bfOx9ab6pfuWKyKwfHAIxik0S75kXuWAroxRrbPH87NGf6xPq8S7LKFfyxqP0rImtpMCMAUOTWT7Ml0axzNFnABz51WWYykZGMVkXArwbNO3VBSuyaqelTmqt0JqRnDa1/F9oHX/Gq1fU2cWcm8jmTjHlWdyfE9o3PYS/tVNSKiyiCElWYtzXZD4o4p/NlLX3YEP+Y0IDuGa2Ulbcf5D+tYwgsrDHrSitsqT0keNVI4qST5VDZqjM6QwHtVRAc9KYCHB5FWEYNKy6F/gGvfZyaY+Dz5V7wm7YoGDOuIFH+HFKrklI02k5IxTuT3QFNKYIhPM27lUGPnWfVlrejaOJjGpB7V5oW+NbrKkVsm9gOKEmvu0S49TVkHmQoMsQB60Rb6lFDaeGqF5AxIwOtC20P2uQmVyQKYx28Ua4VQKOxC6Zp7qTdINo8hUrEiL9zn1pn4Knp1qkkHumigEzhprkRomWY4AHeuu0rSVsonKKHuwp3Sfk47ULoOneFKLllzJISI8/hA700lufAjkghbksd7DqapL2S36NpGtrazjiT+JKQpJ8uhoW71GRyDI54OQOw+VAT3CxDJbp50seeW+nxChI9abdC7GrXgBzjn1qhvc8FgPicVaLR4IIxLq16tsh5CdWb4L1qG1fQ7I4tNMmumH4pSFz8uTSsKNIrkNgBlP/EK1QynnBHfmqx+1ch6aJGqDzcijIvaPT5Cq3elvFvO0SRkMPqMU7CgKdRPE0cmee4rktSsPBlO0Yr6THZ2GoK32G4UuuQUbhgfIjrSPWNFk5DLtYd6BHBRySQuGRirA9q6XTtSS6iAP9/02D8XwpRe2kkLFWXHrittB0m91C9za/w0i5kmb7qD1/pWWTGpo7fE8qfjy10+x1cW8U0RVxmc9HB4T0Hn8avaaNb3Fvi5keKT80ZBH0q91btaTlclkz7rEYyKtFNtHFcycouj3pY8OaKn3YfawW1jAYrVNid2JyzepNZzTIOvehjcEgjz70JPcwxDMzZPYMc/pT4tieSOJa0i0uHY7Mn+XzrBmRFOSCO5oO61V5R4cKYXsPP5UL4U05zO5x5VpHCcOX+pJaWw5tQiUbYl3t6UFJczz7iMqo5O3t8a2VEjACjrXjEZ5Y4AwHiuB8u5rZY0jzcnlZMnbK2untB4d7dYVDG0qIerAcL9TS8kqpYnkmmWuXgu9Sk2cQxgRRKPyqMClkoOxfWqZzD3QplitJSUV2c4y2OgFFxRNJCLpUwkjAYI7A0k0KZUvVRwcluCO1dzarG9nN/EABO4LtyFqaKsX2ns84j+3G58GDklRzlTzQmqRpqtwsrSK4XIQqMDHnj6UcNbiF4YXiU2qnEwwQOnXNc7PdRJqk4sW3W54QZ7Y7VSE0dT7NQ//p+4tr9RJapKSm0Y9Sc1Je3s1eK2gkjhdcM7n3gT5fKjNNbw/ZqJzgeKu7nHf5H9aDMStbyl9vhKMjYy5J7cDtSkCOfs40tZJ7WORGAB95h7wIOQR69qbaZJfz2jTLh4xkFs4NINjw3Vxdtt91jjB4J8q6LSfDFuEllKQrCCVXqznypUmh20b6ekV7cG3jTcIE8SYk/iP3Uz8ck/AUE1rcLOWRnjz0Bbr/KmmkrZw6ZdQaaXe5kDSsX/ABE8AZrGzu7ifxEktXiZeoYceXfyGaHELAmdnURTLh85ZiO3emdr4vgBY1jYL+Z8ECgrpjNfNIoBGAqNnoB6VvEdiAKxOc5I71HCy1JxCL1Jbm1kjZFDMMDa4wK5a5WWTWLeJgCBJuwPy+ddC5yDnkVz8jk+0qBVUDgfLFXGPEUpckdJFDH70ySbhFHl0P4lJww+nNZ2E7aZqcTlvdjbwZD+ZD91vp+1YK+GPhjarLgiqMd0Klz9z+DIT+U/cb5GhoEzv1XcPfKuCcg7e1K/ZoqmnzQkKTFdTLg/5zXOWurXUURTc26LgjypRc6zNZvMYZGR5pDIQvHJrDi0dCXJWfT3SHGXjQfHiuNvosardSWiJ9nR+dzAA7hhwB1weD8RXJSXd9de9PPJg9txr0MhhlDLkYB5zTi1Fmv9vOS+jttIkm0y+hge5eW2fAHPujd0wPjXVEef7V8fF1Mjho5HXByMMeKaWvtTq1sf9Y8RfyyDdSew/t5Lo67U/Zay1K8e5mGXfGRigp/ZWwtLd5vBiIhUv0545qLH23gcBb62KN+aM5H0o/UNWtr/AEq4is5F8WSMqu4gDnzpbXRm4tP9kLTKJIUccBgDWRaqRJKII1IBKqBwwqGWT/dt8qkZEj9K8j8GspN35H+lUWTaPeyPiKBhQevO/uH4UMJkz94fWomlAhYgg4FAHKxxMdTklwDyxFD6sTtgVgAQvIFF2ZEssv3gdp6D1oPVfeu1XyAFdcejjn2ZSKY7P3hhmOMemP8ArWdnIFk2P91hj4Ve6kMhHXGTihOhzTRLCJFKsR5HFZkcVtEPFV+xAzis9pLbQMt0xQI7cEkcivHIquCO9ZO5z94ipNDUyEeVV8TJ4OaxLjuc1K5btTETNg7W+NDW1s3h7kKjLEnPxopwWjHbBqtsCI2HkxqGk3TKTa2jCHTF3lpm3nPQdKB1HaLoqmAqjHFPNxVC2BxXOybpJWcjqc1Qhto8P8BmPc0e0aAZchR55pXb3M/grFbRcjq1aLps853XU3yBpoTLz39vEdsYMjenSqRreXrqNpjjPXA7UdDaQwfcQE+Z5o63yTkAdQv1oA1izHaiRAc7cAD8K4xmlU9wI0Yk80XdXRZpIl4jBwcd6QajMXfYvSqIPRpLqNztB9wdTTK8vodGhENqqm5xkseQnr8atHt0rSjKQPEbp8T/AEpXa6cdRlZkuQpD5d5FOM1Heyv4NItOuNSIuJXeJnOd8rZz8ccgUwSE2cgt54Vt3P3WHKv6hu9MYLS+SMlzBdAd4Dg/Sq3Fyi2/gzW5ngY+8h4KeoPY1VCALyWG2XEhy5H3R1NJJb99vgxxpGnTB5NHarps9o8cls/jw3Cb4ZW67fI+RFKo9F1C6QzAI2c8Fxk0h2G38zwXVtfQyeHJNArFgce8PdP7V1Gg+063lo6aptZEKr4vcZ45rkNQt5U0vTYZoysgEikem7P866n2K9l47rTZp74OtrM67U6GTaeflmqJHM3stHqEwcuFtDyXHU+gp00OnaTpRh8NIbVRwo6sf5mtLu8ttPhjVykY4SKIHA9AK53XFuJJ91w2cD3QPuj4UAcTr+uz3GonaNkETELH/X1rIaxDtGA2fKsr7bPdzFlGCaVOnhuVNRKKk9nRi8nJijUXodXt1cm3jeH3Y24Yge8G8j/KvWWkyXBLyvsGMnPJNC6fdYBjcb0YbWU/iH9fKmsEnglYixdHGY5PzDyPqKqKSMZ5JT22H2ujr4SmOLG4ZByMkViNKmlwUXIPI8zWiXLx4wWOP8R5/wC8CvS6nceGVj9xsj3g2cc89qp2RoDurJ4gQRhhjt260BjwllmzgoNi/E/9Ka3F284zKzNtXGT5Uuv08KzhT8RBkb4np+mKAFgGQSfjUIgm27DnrxXo45JC+CTGB72OoFF6XbmN9zj/AGiqD+tQMxW0ube5QohDr7wPaukstRuGiKW9tveROW3e6uaZSixuGQyw54w3GKIkNnEqrYROQB9wDFTyLo5XUNIv5FkmYrtzuKK3nj+lK4VUSJE6mKTdjee1fQzbvcWEjOmzjjnI+flSvU9FW405bpExNCQTjuKpbJY6udkVtHaxEP4KhcZPYenP6Glm1WLI0DRg8s8YD/XHP6UfcBfFMjY93GDkA9B/3watoyf6fI80wZR7yiQ+8D6UNAhJNoX8KUozSbjvQKcdfOm82kpZ6OIEdHvJ0Us7cFRjotDz3SXGruSgjIONw4B9Nw+78CMVvcSPOOEMsfcAgfPHT6GgAu2hhtLYsAFiiXC4HI8+1JLq+uZ2JLNtQkqoNa3NwpAihaRY4zkK5JwfXPSlN7qb3Ew8F95iPvFfxAetS2Uka6ZrojlWOeMBGbDNnp5V1IVWHGMelfPL2ZJ7+QoqhXUH3RjnHPzrsNGupJtJt3PJ27SfhxSooZvCjdQAcYBxXOazarY6jZ3yjfHnZLx/32zTzxm7kVjdRi8tnhkxtYdu3rQBstnbModFG1hnIPWkk+o2Q1ZbZCWjkBilbPHPT6Gl15fX+n2c1g3JB4cH8Jpd7PXUMWsR/akV4pfcbd2z3zTS2HaHVzFOs6hVZ5MmORR3I6H6YP1pBF/D1YrdDeQxzzxmvqU0FpCdkAjVLlOAoyfTmvmuvJt1dS6bVbAqZLbN8WZpJfQ5hFvL7pXaT3J4q76aHB2Yb4c1z2m3Uq3UkEzM2MgZ7YpjLepalSZSjHpjrWDx06PaxeXGcXJ6X8mk2muoyBQUsLR9adQe0MrWwSRIriM9C64b61jI9tc52/w2/K39aTtGkeGToTCtUd0IKMVNbz2pRulD4weQaFIieH00EJeMMCUY/wAQ6Vs9w4+7IwHxqtja/a38LcFJIA3dKtqWnPpF74MxWVOD7jZHyraOW+zy83iJP9P+DP7ZOOkrD51YX9yP9oTUeBBIoZGbB9ao1qD91mq7j9HFUl7NRqs4OCVPxFaLqjH70cRH+ShDZN2f9Kj7I/Zx9KP0D9wma9Muzw1SPac5UYrnLw5vC3bimzW8itjgntzQlzYSnDBcsT0HNVaXRLTfZN9Zj7JbzKMBlwfjQAhA95+groJpAukiN1zgbcHsaUrFuwW+lSpMritMBWQxy7wOKMglSG6iuAgfYc7aLOnEgFwFBGc1aKCyt8+KDID1OQMVXJdEcXdjrLHgrVHDBTgZrVZMjB6eVXUBxTACVeeetbLjgDOa1eIA5ryxjyoAwfeCdoGMUIb9bdpIwpdy2RjpTN7dHHIJ+BxUR2UCEsiBWNKt2O9ULQt5ecMRHGe3SjLbS4U5fMjfpRIj98AJx55rdEZTwfpRQiFhCAYAA8hUEHnAokcDkgVBbjqKYGATHJqwbY3T3QC2fWrqxOR2qsrbEcgDhT15poTF88nuk8AnrxSuzT7RqiKeQDk/KmE7bkII6UHovva0ieZ5+tEuhR7CPaaUC4itweI13N8aN0iDwdNh/M43n4mue19z/a1wc+YrsLVf9FhweNg/akNBVhAHYtJkAdMHHNN7dLUyK12njFejHrj186VR3McSLGzKshYnnuK1abnnimHZ0MgsmjAVbfaOwSkuq6XaToTGqxydinH6UOtwyg7SDWsWoRpcKZVBwM7Wp2TxANN9l5rm8gn1QgW9sCIo1PM2TnJ8hTb2h9pbPQLYKQHnIxHAnGB6+Qre6vpZrZjaEeKwOGPOPlXyPUhcyXErXZdp93vM/XNAhos+o+1Oqs6PvnX3kjLBcDyFdxCJbrSZLe7XF5a+4469uDXz600DVkZJYUVG+8rCQfyrrrPUprC5afUZY5JGhCOEB94jpmhDZxMmRM2fM1ncxBlBAwabTWElzdmSMx7ZW3AA8jNE6rpUkcERitmLbcNtXJpAcvESj7l4ZTkV000SS2cV2i7bS55Oz/YyDrj5/pSCe0mibJhkXnupFdD7Ime4ju9KKOBOpeFipIEgHT5j9qYAoufCk8GYHxfNeQw7EfGrG5j/ABbh8VNE6jpNzHbxrdQPbsf7tmGNp/LnyNBQTSNGVlifxIztY5HPypiNPEin2xRsSznB46DufpQWpTiUu7nG9jj4CjwxWzeYxsgwVUtjnzqvszZQ6lrYa6G+2tkLsn5j2H1NDBB2kaZLd6dFFDYyb8nxJ8gLj0zT6D2TQwQm4cRyI+5hEpO4YGPnTCK6lmnWC2yu49Bgc/0ro4oI7KHCjfMRy3WpSG2cpDohS5klngcKT7qo3GPrVrq3tIVULCQSffJySo9abXglkJyW+tLjHMpOx+fJuhpNUCZKTNb2L5VWjZsqygYwRyKW2WqrBdvHcgLHIcDPIB/pRDkOGhul+yydUcf3b/H+tYw2cT3MUt04URyA4Xk8c/SkmU0E6rby2yv4ilQz5JGeR26f0oZ4diAEY9D/AN/tXTXsni23i2xWbe2AnUAf1oCSx8bapjdHI/DyKokRMhjUy7Rn7oyMk/z/AHoS8eKwhXcxjmkIJUHAVfX4031GWK3fYUJMQ92MDKlvXy88Uhv4fEBlk8SV3PvEDOc+nlUtlJDbT4LDYrR4bPLLIfvn/vyoC80iOyukuLWMJGxw6Dop7fKgbGePfJaun+rn3W9M/wBaY3mq7mgthhnmcD4DualMsR6vZLbXcU4wI5k3jHbzFdToVs0Gi2ysMEruOfU5rntU2y3sFu+Sqy4I9Cea6Nb7C7QAAOBS6G9hRhBPJ/SqtFFGrM2AFGSaFfUNo6g0q1nU2GmzherLt+tFhxOVvNQeXUZrnPus3T08qxlRWAuICQvdfymhpBkhavFIY34+70I8xWi6Ik96PoXshqK6pYPZSHFxCN8Xnx2oT2ysUlWO6VSA4JYDsw60i0Gf+ztSjukcgggj4V9C1GzjvYDGGUR3IEsRPQN3FKS0OMt7PmdntkuI5jw5Uq3xFbyw293NJHMzJKEzE34T5g0xk9mLrT75pLhhFagnLDk/AVi6JKY3ST+6c4K/iFR07OpyUsTS7snQrS4vIjHbbGkjH3CwBYeYBra4tJIJWS6ieCTsCvFCXhnUpcWkjRTxDgocZHlTHTvbCXUEjsdYtFvB0V1XDirVSRzKU8TuLoCDyogLAsnrUHZIPd4PlTe60xZbc3GmyGa3bkp0dfOk0sYzmMHP5QMYrKeH3E9PB/Un8cp4M8X3TUPM8gO/LHzPapEgB2yfDNWnjEa5BBJHQVhxldNHdLLhceakjCIvHKNnQ9RRyvkUFFJmJmPDKenpWob1rZJrs8fLkjklcQknOOSMeVX3AdaE3Hzrxc+dMyCn2PyQCB5ipGF6UEXPnXvEbHNMQYwjfBZVOPSqiKNR7qoPlQysccV7xGoEWlt1lPvMwHl2qi2MA/M3pnFaCStFcGmIuSQeK2jlIIxxWzW7x8MMZ9KqqLj3QQR3NWQbLtI5PPlU7B0yauigjjkir43DG3mmBiYzjy9agqw6VqUfoAR8a3WNh2B9aYAo3LzxWyAHnGPhV9i784wPjXvDZDntSA86kr0rNVBPAPFEbwy4xXht6YwKAM8DoBWF03hYBUHcrdRmjosE8DJ9Kxvl/g7wOVOT8KaExHIdynPBoPRW8P2iXd060W55IxQDMbbUIbnBwre98O9N9Ersz9pozFrEwPcmuk0u+jOk2jFGlmddqQjgsRwTnsvrS32sgDNb3u3cjD3sdyP+xXvZa/8AGvrhZsCV1Gw9go/CPIUhr6HdzaPcor3jhnH3VQYVB5D/AK0H9luoSTb3TY/K4yKb2Ae7uwrMdkpAx+Veg+Z6/DFevofslzOoO5Ijjlck0UFiGS51GI/xYQyjvFV7XV45GKSNsb/EMU7tIXvE3QW5lGMnYeR8utDTW9pI5SWNS68EOORSofIgOQMglfIqa1fwb1At3bxzgd2HP1rEWaJ/cuyemciqS+PH0jDjHVTg0bHph8bQrG0cWI9vCp0Fc9qNteXV19lgi8WQqX909QKIjkZWJU7GPUMMUVD9qE/jRyFDs25HXrmixVsE0uKcRok1qYnUAFsYBHYn1pvHIQ38Rc+veohmYbg/Mh6kjrWbS3Ech3xI0OeHjPI+Ior6D/IwQI2CvPlWhSQNkTOh/wAJxSq11KJ5CsMylgeVzg/SnFvcQyth1KHHPPWmmKgHVFunsJMs90i/eibnI8wfOuXRrddt2SJMnYF7n/N8K7QsWQMoYBugNczreniAyXVvHuik5lRRnafzD+dUSKNTvnvV97au1doCjAxTD2ORQl9J7ibdsZIJJbqf+lc7I24bkyQTxgU/9kceBeA5DPIuPkDmkB2/sykYllnlOCDtX+dPL67htlAT+JK/3Vz+p9K5zR5gkLqSMbieaDW5eW/upUJ3KdqqOhAHSn0AzuZ7iUk+MFHkiDH60PHdtE38UCRO7AYYfLvQcmosH2GE/eIJHToP61h9tDMgKMpYr17ZGaTBHR3xtJdNKAiRHGQw7fCuXkhka3a3hmCSPwWYeR862aVomeIH3ThgPLPX9v1oWZyGLZ5rJmiL6MdVjupI5xiMchycjPYA10UOsXCzqBG7CLIfcMZPp50oilJiV1OCR2rWO9ZJP4wyvmOtN/wIMU2V5KxucqzseH6H50Nd2YUCPaOM7GX8QqJ7rTJWG6Zww7+HS+e7LN4VsWcCQESYxuH8qko56836dqErgjDfeOOCDVvZ+F7q/kv7g4jhUnnt6V7UvEvb6Uv7sII3fEdqbTxrZaRFaou2Sf32HkvamhiUsZ9WErHA3F/hTYPkcOKSn+8Z1PHQfCrJMVPWobNEhs5buRS3WDnT2x+YVpHc54arTJHcRFH+6fKpGcvLEy7XYEKw90+dREheRU/MQKa61EEjg24CrkAUBYjN7D/mFbxdo55KmOLx4o7BovCzJwVcdhXT+y+om/0Nrd3/AI1qcoT3xXJ6owxjPQGmHs9JBYWb3DSLJK8m1Y88YproH2MvaS7nnMcUt2zRsPuleAfLFc2jG2uMFQsUn5TkA+Y9K6u/gkuIFcwbGwSAOcY7iuQ1ERzTEmQJIByp4B9RU66ZSv0H5oO/g+ztDfW3uMGAbH4XHIPzqLSbYAkjlhj3cjmjwizwS2/aZcD/ADDkfr+9Sv1ZbqSMG1eWaSa6syYLhP420dCfxjHl3pla3EOuwGWNVgvV++g+6/qK5rTA329CFyM4ceh4NX01mtr2SPcQQcZHYg1o3SMkrY0ljPvB8gqeUrW1NqrgXkUZV+jEnIozK6nHg4W8UcEf7Qf1pY4SEEMm1wcH0oTsGqNLy1tuWtJQTjpuPPpQ6yB9oGc9DnzoiyuwIpI5kZlZ8jAz+lDXoEc/iIrL3KsuD8alopM0wRUYNVt5PEB6YzxWpGazejVbKYqDV9o717Z5UAUqVPNeKnNRtI70AXGM1cHHSsTnzrwPPWmSdF4chOS1aCDceefWjMA84qdqgdxWpmDCLaMCtlQgds/CtFRMcnmtAF/7FAGIQH71eI28dvStiATwKgKCelAGQGT0xUlcjjHzrXw8dBUheeTTEC+Gd3AqQoPWiCg88VVlHxoAy2AdOtWwWUoehGDV1jGRkYq4Rc/eoA5i7jMcrKQAVODx3oaRFdSCM5p9q1p7njIAccNx+tKCAPh50yRvpdvDq+jSWEvE0YyPh2P8q5saNPp+riOXciRguZOmUHWmljcyWN5HcQnDr9CPKujvoINdsfGhJDYwyg8j0PpS6H/Iu9nNSW5jeaLb4ivkoeq+X6YrZY7lpp5ZnDeM5fBPK5pGLWXTbjen8J88Pjg+h9Kd2+oq+1JwIZG6En3X+BoAiK5j0i7i+0SvDBdMUZ48nB+FEf8Al2zvY3eykujJu+80LfzIofW7E3+kSxpjxV9+PH5hVrLW7zUdAjeOSQyIuxkVtp3d8mgQLY2sy+LHclleGUpwcHjzra/li0+NZJ7hUQ9Aw5PwxS6O9MN/FBcPJDITu3ye8rHyzRWqvp8MW7UZBIM7hGeST6CjQweHWbC693eP+IcUUiQyDNvJt7+438q5mTxtfudltDHa2cR54AC+pPc+le1OSGwSO3sJmbb95+nNIDqkSdOpEi+R4NaEqF5DRE9+orirf2hv4CB4gkXycZppb+1i4xcQEZ4JQ5oodja5sEnXdJFHcL+eM7WFaxSiPagboMYf3T+vBrK3vrS+jLwtwvXAK4rQrOANkiSp+SVQf1pOx6Gmj3pup5rKe1aHCb1lIyD2GOaV3MlzpVyA4kubQk7uclG+NVYoNoaKe1wch4G3AH4UytJrZLf7PeTJMkrbvFHDZ/xCmnehNezkDbQXWq3qQSCKAgMAwI5POMCi9BlayFwk2Ps8rbg4PQjjGKnXtCbTtQF9BcskEh5xyT6Cls16GGyNSvYDPQVRJ1kLNGC0fKnHSvRp4Nw0oztlOfga5a2vcExpM6yJx14NdDY34mVUmYK54yehqbHRWW0LTkiZgGYnBXuTRlvZPCMtOG470Rb2JmZmSQhEGSeuKxuojGApmaVmP4hgUqrZfNtUCTkGYtnIOAPgO9DzEtnHQVecMAxDhpPU96Dh8QnbLLgelSxIa26FbZc/Gs55FC/eGT2zQ+2Nhgys3oTUsltApd5FyPwgZNOwooYGxuIOPPFC3D+GyFWwobBK9c1FzqTTLtDMIx0UtTDRNGk1CRbi6HgWMZyztxu9BSSsLBtI09ry6a6uyVsbU73Y/iPZR5k1XV7tneSeTiSXhFH4Vp3ruo24hSKBfCs4vuRjjefM1xd3cvNMXfqenoKH9FLezwOBhRxXtw+FYiTnjNWyag0NgQD0rRJcUNuPepzSoZOp/wAWzyBypzSm2fZcRsezA02c7o2Q8hhikrAqxB6itIfRjkXs6s2kE0d21wpOI8pjPJzSd4JXvoIVjKDeASO3PPNPrLVymkxLJbx3MJIJVuCCOuDSpdSZA7R7Yy2cjaCCPKrRDO5spo5rSRIW8R7N+M9SncVxPtXp4guy8Q9w+8v+U1Pspq7WeuqZf7mY7JB25rpfaSx8S1lQctByp80P/f60pfY19HP+zU0dyjW1xGkqhTgOM44/SontZbJhNaZkhByYyclfgaW2l3JpF8s8UQdcYZH5BHxp/bX0F6pkgBjJ5MTHp8D3oexp0c5b3rWur/aIF2neWCEZ4PaplIGtXBxjLEgeVH6zpgk/0iAYcfeHnSUljcZGS+aLtULp2O4ZmyGGVZT1phNi+t/tKACeP+8XzHnSe18TafEGM0ZaztbTrIvPYjzHlUJ0zVrkgR097KAknueKK+1Ncx+E8W9wOoYVpqNuscivEf4UvvIT2oBGeO48QbdwU8c+damRijGF2XBAPIz1pgDkZzQl4HcB2QDPRlOa9bTbmOT2HHrWckaRdBdSKgZNSQazND3WoPFexVSaAPEVQrVxk1OBimI7IDAxipUDyqwU/OrDIrUxPbR5VAXnpV+teOe9AHhgcVIHpXlGOtacYoA8MYqCgbNW6V4A880AZeH261GzBxjFbrkeVQVzycCmBQg8EmsyPTPrWjAr05qof0oEU2hlKnkEcg1z99ALSXDjER+6wH/fNdHnngVlPEs8TRuOD38qaEzl84PPyoywvZLObfE3xB6Gh7+0ltZgrrlD0kB4/wDzWCMVPINMR2MclnqseCFWUjlGoSTRXiJEJBQ9YnGVNJYZscg8jpTm01edAFbEq+T0AYi2mt+VhngYf7ttyfQ1ktnLa6g8tpKEjuUDsnh597oeO3n86fxarAwHiROn+Ug/vRMep2Qydz5/+MUAc/DozXt8pvRLcwuNrKItoXyI56istU9iHmQfZyMq2MMSXcfy+FdUNdto/uJI59cKKXXetSS5VSIkPZOCfiaBCwez1jp1j4Id3mPLAHhfjSXVrC2Fr4UaBcc57k00ur0IvB5pRcTHw3mm+4v1NOqA5qa08LluM9KHMTZ45UGmF5cG+nyq4QcKPIVkoIXaBk9yKhspKzWGeSGHw42KrnJx3q8d5PGcpK4PxrEI3cGpJUetQaDSDXruPh9sg9Rg0bHrlnOALm3K/wCLGa5wkV7NFsKR0d/f297pZt4rkMBKCiufu9qFs9FLXEbXEqiEZLMhya5+4jLHcPKpgmnt1ykjr3xmqtkNbOgXT4oJD4zQSRk9feBPzo2KPTlYRTK7xnqqysePpSK21e6C58TdzyGGaLXWSR/Gt43+AxSsqjoLjV7DT7FrfSbGUlhjdK+7HwpDc61czR7JDICOm41ompWTYLRSRn/Cc1t4thNj/SQD5OtFhQvtbiKCZ5C8uHOSp5APpRqahbvkoD8W4ouGNAPdNtKh862EEGc/Zrb6/wDSlSYhU+oZlCQr72M7uuPhWtpp19djo2wnO6U4AphOFMJQPFCO5jXmsYVUJjxZZV/xsQKekG2F2llptgweX/TrgdEHCKfWp1DU5J5Q0jZC8JCvCpQBmfYQcR8/dU0MTzUufpFKP2Vuy1wSzElqVSrtcgim2fpWM9uJeamy6FqffrZjg4qGiMZwRUdqARBNeFe+dex9aBk0vvI9sm4dGo8g1nNF4sRHftTi6ZMlaNtDmDpLasefvp8e9A3paCVkx7pOR6elDwyvbzrIvDKab6ii3Nss8QyH5+B8q06Zl2jO3tBcFHz4SccL1JrubW5F3pUMr+9JB/Bm9VrgdKlYBkY8ZwufOun0RnMr7pHjgfiQqe9P+A/kV6mkVg08EqElnGx88Y/68ViNOe1thdZdFZg0ZHQjzFPPaVLaSJJIZFm2DHTqO1IbOVzALe5LCIN7o67V9KlDYzgmEy7iQW6MP50i1SyMN4GjyqSHggdKNtniiviIpN6MdoP5h2NGX0Xi2rbSQ6+8pHWm9Ati4OgH3x9a2gUzk+HgqOrE8KPU0vS1SX3yxO7nLUZgtEsTMTGvRBwPoOtRSXZom2MbWVL2GazRcxxjdE56ufxUpnUjqx64IxRdtKbedJFP3DmtdWt1S7O3+7lG5cevSri7IkqFiSyFTBxhQTkisFYpJyOpq27a27LA9M+VUlRlbqGHUEU2Shmj5UEHipyc586FtXzFjyrfJrFqmbp2jTdmoNVqN2KQy+a9nHWsycmoNAHfng1IGe1X214CtznIA+FexU8VIFAyvXtUipxXsCgDxIr2RUcVIwO1AEgVYAVUNUkmgRJAqjLnpVgamgDIqQOBmoGc+8K2B5xipPXpQAPJCkyMkihkPUGkV5ok0DtNasZo/wDdnqP610oUMfLPlUeEFGM80xM4hZFMjICyuvVW4rZZHUjg4rpr7T7W9H8eIFvzrw31pBfaLPYh57OZpRj+7YZNOxEpfFQec/EV7+0CxxuwKRDV3EjeJGvltxjBq41dS5/grtx0z3osKHjXuTgHNZtNM64AxSY6zIH/AIcaAY4GM4oeS4u53LM5AbqM4FKwobS39vCGDnxJFP3RShpLnUJlT3m590DoKhYBuDMcnyouMYHB2j0qXIpRGNl7MSldzTIuRyOtME9mY1Hv3LAfAAUlS5nj4SVhj/FUteXDj35Xb/iqeRVDaTTdJgBLPJKw7DJpTemCIHwbF1H5pOKlb+eMYRyvwFCXTSXX95IxPqaLCgGSXex4C+gFVLgDnirHdFlJAD5Gojj8VtvFAyICFkDsQxz+lNLrTkiuQu3csg90+VL3sXHKEE+ldJrYFrBZsDmQRc/8tFioQXFibPo+9D3rHNMgwuLDJOQR19aHW0BAO7NK/spAtXVSw4BNGLaoOvNbhFQYUYFKxlLfHhDH0rdWdehqowDUls96kZcTyEHLkfOqbnPVia9jjrUqOaALCrYzUAVIpARtrwXmr8YqKBlWi3cHGKwls8j3cA0WoqdoIzQApktpE6jNYkYp0y5HNCzwKQTjB9KdgLq9moYHJFeB9KoQJeRbW3joeta6ZdBCYJT/AApP0NbMoYEEZBoCWIxvz07Gri70ZyVO0FX0EsTe6MANuyP3o6wvTNAUDFXz7wH71jZXInj8CY+8BhWPf0oR4XtLxGGR7w59Kf8ABP8AI4e0YLuTc8XUjqV+NDXrlrd1jI2Dnp1o3R9TjeYKW8KdTjHn8KPvLW3klfdEFyednGaBnM6eniugxyr5BHlXQ7RWMFtDa7/CX73c84rR5VjjZ2PCjJNDBIRtZ5RkDlVLHI+dUisCHGbl0XvgZreCdZQexzyK1JqOTRpxTNhFaADdJNJ6YxmjL4rPpVvKibdmUxnOMdKWmmNsN+gyA9puKqLbJlFIQ3KjxCQAARmsgWKbgTjyNEXWfDXI4BK0OgWQnnB9KtmaN7Mnmi+e9B2qlZWB7UWc1jLs3h0ezXqio+eKkotXq8DXtwpgfQQx7Zr2cjpUBvnUFu1bHOXGWHA4r2CDiqgnzq27PxoGSc9jiq5Y9+KnHrXsD40AeHFeNe6etW69vpQBTJHQH6VYHPPSrjgda8eaBFcccVOT3rwWrbaAKnk9MVZQe3NXA45qcLQBAPHnXtgYc8GrAAdK9k0AZ7MCqkYHNaFs+VRwT50AK7zQ7G8O6WBQ5/EvBpbJ7IW55ilwPJ1zXTba9jNAHJt7K3Cf3Twt+lYP7PX6/wCyDfBhXZ7T51IOaVBZwx0W+XrbN8sVX+yr7/6aT6V3owete4HelxQ7ZwJ029HW1l/5asNOu8f6tL/y13eATUlQaXFBZwY0y8Y/6tJ9Kj+x74txbPXdkAVZR7ucUUgs4GTQL6VCpgIPY5FYQezmpxyhvBAx1ywr6ESAaq4BGccinQWciug3uRkIB8anU7d73U47WMge4RkjoMCuqB7UgtDn2m57Rt/KigsDfQZobQwwkcnOfL4UMmm3cfumLd5ngZrtzjGDzVDCpPIB+FKrC6OQ/s6cDJFUa1lXqhrqrmW0t/711U+Xekl7qYlJS1TAP4iOalpFJsVkEHBHNe2t5UTDp15OdyxMc924pgmj3JAEjIo8hSpjtCkLVgKcf2Jj8TGspNIcH3SaOLDkhbipxmjG06ZRxzWD28y9UNKmVaMscdaggAdah/EBwVI+VV5PWlQWXBPnXt1eWNmGARitRbYGWJ+VOgsgMpHU1VgCOasVgHRjmsGH5TRQWZPbpuyBWUtqpHucGt8kd6qXbzoAXOjRnDCqSKJE2mmEjZHKhqFkhPVB8qpAK2Uxvg9uhpnZvHqBS3nOJM4VvOhpArZV+D61nDGyPk9M9RWi2ZNUO7n2anhJmhDSKOT+YVETXCLjfux2an/s7ryqiwX5JHRZRyV+PnXSz+ztnqcfjRsqEjIli5VqukRZ86e8ZTh48H40vu72ZJwHAMB6ADgiun1fRbqxJEkfiR54kUZFJvDSSNoZkGxjkMOqHzxU8S+QueHw8T253R9SB1FERzo+MMMmvR28lnKwUNlTyAMj4itjDDdElYhFMeqsAA/w8jUuNjUqMpG2rnqewpwsZt/Z6MN96R91YaZpDTzBpFbwlOMt39BROuTqZRBGfdhGDjzqlGhOViG6H8AnI+//ACoNNpky4wMcUVdnECA9WYmhbdmDMdpYd6bJQXbITKcHPA5ooROe1Z2SEKWUgZPFFb5V7isZdm8ejP7NJjO2s/Bc9Vrc3co4zxUfbW7iloeyq2zkdKn7M3evfbD61U3LMOppiO1zivKx86p4ijvzUBiTwOlamJsHIPXNWDeuaw8TBzj41dZVPagDdSMVfbxWSHIzitA3mBQBZcCpyOxrNmH5cVBI70Aa7gBzjNe3VQYx1qNx7CgDVTlTnipU9M1gWOOalW86ANy3HrXgOOazDDNW8QdM0AXzjioPqagMOlQSRz2oAnHepAwajPHFeB+FAFwT6VOM9RVcnzrwbJpAezzjtXuO2a8VI5qRigD3vf8A5qhDZ6Cte1VoAqqkd+auBwcmvFSuCykfGo6UAWBGasMedYkE8ivI21veXd6UAasmenWs2Tb1FTubqoA9KlXIHP60ACXE0cThckFumBXPF4o9VlNwCy7TjaOc9setdRNFFKPfAI6+WKG/sqyZmaRGkz13N1pDVCeLXRDbKiq8sgz7zn14omBtV1GIOjpbxN5daaJY26cxwxrjyUVqEPwpUFiyL2fgVt88jzMeuTijorS2gGIoUX5VqDj1Ne3elMR44FR8q8CCea8SPKgZII8qlv0rIEZPNeOR3FAE7AwJ4+dUMK+QNaKQ2O3rUZ8jQBh9ljY8rVX06I9EFEAnPWtAaAE82kqeQMfCg5dNZM++fnXSEkjmsJIQ4xxSpDs5Vrbb1bNU8LtXStpqk5wCPKqtpUf5eKniyuRzJiOeOfhXhbyEfdNdCNEthkqXQ+amt4LFYTlpGcds0+IuRzH2KYjIjNYvbSr96Nh8q7V4VI90AUO9lu+9g0cQs4mW28QYZM1gumXKvvhXcPI13Q0+MdVFbJbRr0AqloT2cWsEyDcIzGR1XOaaaTr91prYifCnqp5B+VdA8EbDDqCD5ilV/oySAvEQp6kYq0yKHFv7S2t2uJ1aBz1K+8p+XWomsrC9BZFgkJ7xtg/SuOkt5reQrtb5jrWf2llPIINUI6WbQIWUL/GAXp049Komi2dv77oDjvK3FIft8uMCaQf8RrGS4L/edmPqc0g0Pb7V4oozFaHc+MbwOF+Fc87F2wOSetQdznCjrWM84t1ZY2DTdCey0hg1/KGl2qcog2j+dTZxGQqI294nkdqwij8Z/L0rotNa0hhIk4mYYLY4+AqWykrMZfCiUJGucDGaHLZ4ou4t1JLRyKR8aDK89ayZsiMZqVhY17Faxhe/70AVEGOrCqMAO+aLdkC4DZoRjmgDsdpzwMCtAAF714cAg81fquRWxgZ7QR3qApzzmtT0rwXPPagDwY9ATVcsT14FXZtq9KyByck0DLmU5xxVhJkdKorDn0qyMOhoAujfEVIbB659KozbT7vNUIc45+VAGzNzn9K8JR0rBgwHPJrwBIGKQBIINeDA9DWfQZGPhVAGPO4A/CgAn1zVlLDrQ0W9TgtkYxWoYgcYoA23GvDmsNxPQ1dXwOaANDnvVwvGRWQk8+lXDjrnigDTHbNTgY4rPODx0qd2BQIvuG7npU7lNUBB6AVcAY5wKAJLbupzVC1SThuOahsFc96Bnsjzr2BjNQCA3HNXC+fQ0AVyBXutSy4PWvbSByM0gIIz61AOP6Voi7uvavBFJJHWgCoarA1mykEnPSvByOvSgDXYD2xVWjOcg8V4P37VYtkZFAGJVicYqGXB97rRIdSM1mdp6g5oAwxu6V7ZjnHWtwFzkLVSCT900AUKjHFUIKnBFXb3T0qNwPX9aAPAZ9KkpgcNUZqc4NICpz51GSKsOfSvbaYyyEd6sGIPHSqAVYgkcdaBFiOMjoayORnFaKdvDVYbSKAB9pBzVu1aGqFc0AV21Ur3rTa3ao2EdRTAqQDwcVUxr5fSrnHep2jHFAAc0CuCGUMO+RSu60dGTELmP0xkU8ZD8ayKnyxTsKOSudOvIGLC2jmQD8BwfpSuW6eDCyWhRwed4IzXftHWMkaMuHQEeRGadio4KSeeYEAqiMc4Xis0txnLndXaS6VZSdYAvqnFCyez8J96KV19GGah2UkhAoCrgDAqc0zl0O5XlGRx8cULJp93H1hb4jmopmiaBwa8Dg8VLRyKcMrD4iq4xSGX3E+RqMg9qivUDJ6VPeorwPNIDrjdI2Pw57EVZJFGSDkUKyluGJIHHSqgJH/dgYNbHOHI56gZzUlzjvQKysHwv3fj0rQljzzigZuMscknHxqwAxnNUVSep+tbpHiPk80AVUccd6sSQNqjnvUhasAADnrQBVMD72DVvePO3ArwUE5NaA54FAFADjrXmB6Gr429eRU8FaBGJ4OSM1dCDwRircHjn+lewDjFAyCMc1ViT/KrPgds5qp4/pQB4kVAJPNSBuOavs70AZ5J9KtjK4NT+tWAUUAeVsDr0rQMCKzwDnNewQPSkBorVcMfOsRUg0AbA4NWznjNZCrA0AX7cAVIY5qmRjrVwOKAPbst6VJ6cGoIAFVAA6UAW5bivFCpxnivA4PNW3gjnmgCoIxgZNVAycEcVOAT14qxO0cD50hkMBkBccVXG08EirKD24rxA70AQGx7u3NXXAB5yKhsYBBquDnOOKALqRUOSD0+lQDkZ7VORjHagDw2ucdx515olz0rwwDkVOc/CgDMxkHgVVkI9K3PFZO2WoAz7VIc4qSMjg/Kq7CMdcUwL7sc45rwJIyeBVO/pUnI6c0gJLDHAqEzU5yPKpUdQDTAnPFV3VK8fGoOMdKAJEoHSveIe1ZkLUgY+FAFi4IwRUbePdNebGKsijzpgV571Q9elEbVFYyEL060AYt1rJhVyx5qjdaAMnU5qq+ua0Oe1U3DdQBfbXgozz9auCMdKggd+KAIaNG6qD8qxksrVvvQpn4VqWx3qvWgYI+k2j9I8fA1g+hQHo7imm1gOelRz0NKkO2In0Tk7ZfqKyOjyjo6mugK1TGKVILZgclcsSfLHFVZcLkHcW7CtG+4/wAarb9B8qszKxxDjJX61uVYc7eBWjAGFuB0rP8A2Cj0oA2SMnpVjuHAGBQtizGYgk48s0YaBkA+71qV68c/GoP3vlVvwj40CJJxxVQ56ivN92rL0HwoAhS3JJPWpDg9cmvL1PwqW+6PhSGe3dzzVlbcaxH3q17UAacVRmXPXmobtWD/AHqACVIbjvWgRcdaHh+7WpJwaALFB25rx6YFVP3T8KoTyaQGw6YqOB3qBU/hFAHvOqnOevNSetQO3xoAsKuD6VVO9SO1AFw1e3YPFQKn8IpDJLefSvKcdKjtXqAPHJ8vnXgvrUdqnvQBKg+dTuO6oPSs+1AGxOOaqS2OuKkfcrPuKANFbsTV1OVPlWH4hWsX3TQBYY6Z+dQcAc4qH6mqSUAeaRd3XpXjIMf0rHuK81Ay+4k5DEg1ohHnVR/dCqJ0oEEBc844qdnxxUL0HwqVPFAyjIO3WqHOPKtV++ao/wB+gRUdKsM9qivHoKBltuKgipHSvNTEZmobj5178RqH+4KAPHnpU4xzUDpVk6GgCjOQepq2N45FRJ2q69qAMGTHQ1QqaKl6mh270wMDkHiqqmWJNbGvUgIGSMGqmtB0NUbrQMyXIbBGR5irggV78VV/GKALOxx1rJmKmrt3rNqQzRWBHNexVB0qy9KAP//Z"},
  {tags:"grass nature green outdoor garden calm",credit:"scikit-image (CC0)",b64:"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"},
  {tags:"travel temple china architecture history culture",credit:"scikit-learn (CC0)",b64:"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"},
  {tags:"flower nature beauty garden spring growth",credit:"scikit-learn (CC0)",b64:"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"}
];
async function demoSegments(topic){
  /* pick pack photos whose tags match the topic; fall back to all */
  const tokens=topicTokens(topic||"");
  let picks=DEMO_PACK.map(p=>({p,s:tokens.reduce((n,t)=>n+(p.tags.includes(t)?1:0),0)}));
  const hit=picks.filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.p);
  const list=(hit.length>=3?hit:DEMO_PACK).slice(0,6);
  const segs=[];
  for(let i=0;i<list.length;i++){
    try{
      const img=new Image();
      const url="data:image/jpeg;base64,"+list[i].b64;
      await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("demo img"));img.src=url;});
      segs.push({kind:"image",el:img,w:img.naturalWidth,h:img.naturalHeight,seed:i+1,credit:list[i].credit,thumbUrl:url,demo:true});
    }catch{}
  }
  return segs;
}
