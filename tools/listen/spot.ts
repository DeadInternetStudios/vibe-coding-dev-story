/**
 * Builds docs/voice-spot-check.html, the three minute version of the listening pass: one clip for each voice.
 *
 *     npx tsx tools/listen/spot.ts                write docs/voice-spot-check.html
 *     npx tsx tools/listen/spot.ts --out FILE     write somewhere else
 *
 * It reads public/audio/vo/manifest.json, tools/tts/voices.json (what each voice is meant to sound like) and
 * tools/tts/cast.seed.md (the lines each voice was written around). It plays nothing, and the page plays nothing
 * until a person presses play. The output has no timestamp, so the same inputs give the same file.
 *
 * Flags export in the same shape as the full pass (`flagged-lines.json`), so tools/listen/flags-to-redo.ts reads both.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REASONS } from './model';
import { parseSeedLines, pickSpotClips, type SpotPick } from './spot-model';
import type { Manifest } from './tiers';

const AUDIO_BASE = '../public/audio/vo/';
const STORE_KEY = 'vcds-spot-check-v1';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

interface VoiceMeta {
  readonly role: string;
  readonly description: string;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The first sentence of the voice description: what the voice is meant to sound like. */
export function firstSentence(description: string): string {
  const m = /^(.*?[.!?])(\s|$)/.exec(description.trim());
  return (m?.[1] ?? description).trim();
}

const CSS = `
:root{color-scheme:dark;--bg:#120f24;--card:#1d1838;--line:#3a3166;--ink:#f4efe4;--dim:#b3a9d4;--ok:#52d6a4;--bad:#ff6b8b;--hot:#ff8a3d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;max-width:760px;margin-inline:auto}
h1{font-size:1.6rem;margin:.2em 0}
p{margin:.4em 0}
.dim{color:var(--dim)}
.top{display:grid;gap:10px;margin-bottom:16px}
label{font-weight:600}
input[type=text],select{width:100%;min-height:44px;background:#0e0b1f;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}
.bar{height:10px;background:#0e0b1f;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.bar>i{display:block;height:100%;width:0;background:var(--ok)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:12px 0}
.card.ok{border-color:var(--ok)}
.card.flag{border-color:var(--bad)}
.card h2{margin:0;font-size:1.1rem}
.meant{font-size:.9rem;color:var(--dim)}
.says{font-size:1.05rem;margin:.5em 0;font-style:italic}
audio{width:100%;margin:.4em 0}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
button{font:inherit;font-weight:700;border:2px solid var(--line);background:#0e0b1f;color:var(--ink);border-radius:10px;padding:10px 14px;min-height:44px;cursor:pointer}
button.ok.on{background:var(--ok);color:#0b1a14;border-color:var(--ok)}
button.flag.on{background:var(--bad);color:#2a0711;border-color:var(--bad)}
button.main{background:var(--hot);color:#241006;border-color:var(--hot)}
button:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible,input:focus-visible,select:focus-visible,audio:focus-visible{outline:3px solid #fff;outline-offset:2px}
.why{display:none;gap:8px;margin-top:8px}
.card.flag .why{display:grid}
.signoff{display:none;border:2px solid var(--ok);border-radius:12px;padding:14px;margin:16px 0;background:#10261f}
.signoff.show{display:block}
.line{font-family:ui-monospace,Menlo,monospace;background:#0b1a14;border-radius:8px;padding:10px;word-break:break-word}
`;

const SCRIPT = `
(function(){
  var KEY=${JSON.stringify(STORE_KEY)};
  var data=JSON.parse(document.getElementById('spot-data').textContent);
  var picks=data.picks, reasons=data.reasons;
  var state={name:'',marks:{}};
  try{var saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object'){state.name=String(saved.name||'');state.marks=saved.marks&&typeof saved.marks==='object'?saved.marks:{};}}catch(e){}
  var $=function(id){return document.getElementById(id)};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function counts(){var ok=0,fl=0;picks.forEach(function(p){var m=state.marks[p.id];if(m&&m.s==='ok')ok++;else if(m&&m.s==='flag')fl++;});return{ok:ok,flag:fl,open:picks.length-ok-fl};}
  function render(){
    var c=counts();
    $('count').textContent=(c.ok+c.flag)+' of '+picks.length+' marked'+(c.flag?', '+c.flag+' flagged':'');
    $('fill').style.width=Math.round(((c.ok+c.flag)/picks.length)*100)+'%';
    picks.forEach(function(p){
      var m=state.marks[p.id]||null, card=$('card-'+p.id);
      card.className='card'+(m?(' '+m.s):'');
      card.querySelector('button.ok').className='ok'+(m&&m.s==='ok'?' on':'');
      card.querySelector('button.flag').className='flag'+(m&&m.s==='flag'?' on':'');
      card.querySelector('button.ok').setAttribute('aria-pressed',m&&m.s==='ok'?'true':'false');
      card.querySelector('button.flag').setAttribute('aria-pressed',m&&m.s==='flag'?'true':'false');
      if(m&&m.s==='flag'){card.querySelector('select').value=m.r||'other';card.querySelector('input.note').value=m.n||'';}
    });
    var done=c.open===0;
    var bad=picks.filter(function(p){return state.marks[p.id]&&state.marks[p.id].s==='flag';});
    var line='Voices spot-checked by '+(state.name.trim()||'<your name>')+' on '+today()+': '+picks.length+' clips, one per voice, '+(bad.length?bad.length+' flagged ('+bad.map(function(p){return p.name}).join(', ')+')':'none flagged')+'.';
    $('signoff').className='signoff'+(done?' show':'');
    $('line').textContent=line;
    $('export').hidden=bad.length===0;
    var named=state.name.trim()!=='';
    $('copy').disabled=!named;
    $('copied').textContent=named?'':'Type your name at the top first.';
  }
  function mark(id,s){
    var cur=state.marks[id];
    if(cur&&cur.s===s){delete state.marks[id];}
    else{state.marks[id]={s:s,r:(cur&&cur.r)||'other',n:(cur&&cur.n)||''};}
    save();render();
  }
  picks.forEach(function(p){
    var card=$('card-'+p.id);
    card.querySelector('button.ok').addEventListener('click',function(){mark(p.id,'ok')});
    card.querySelector('button.flag').addEventListener('click',function(){mark(p.id,'flag')});
    card.querySelector('select').addEventListener('change',function(e){var m=state.marks[p.id];if(m){m.r=e.target.value;save();}});
    card.querySelector('input.note').addEventListener('input',function(e){var m=state.marks[p.id];if(m){m.n=e.target.value;save();}});
  });
  $('name').value=state.name;
  $('name').addEventListener('input',function(e){state.name=e.target.value;save();render();});
  $('copy').addEventListener('click',function(){var t=$('line').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){$('copied').textContent='Copied.'},function(){var r=document.createRange();r.selectNodeContents($('line'));var s=getSelection();s.removeAllRanges();s.addRange(r);$('copied').textContent='Press copy on your keyboard.';});});
  $('export').addEventListener('click',function(){
    var out=picks.filter(function(p){return state.marks[p.id]&&state.marks[p.id].s==='flag'}).map(function(p){var m=state.marks[p.id];return{clip:p.id,voice:p.voice,text:p.text,reasons:[m.r?reasons[m.r]||m.r:'other'],note:m.n||''};});
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='flagged-lines.json';document.body.appendChild(a);a.click();a.remove();
  });
  $('reset').addEventListener('click',function(){if(confirm('Clear every mark on this page?')){state.marks={};save();render();}});
  render();
})();
`;

/** The whole page as one string. Pure, so a test can read it. */
export function renderSpotPage(picks: readonly SpotPick[], meta: Readonly<Record<string, VoiceMeta>>): string {
  const total = picks.reduce((n, p) => n + p.dur, 0);
  const minutes = Math.max(1, Math.round(total / 60));
  const reasons = Object.fromEntries(REASONS.map((r) => [r.id, r.label.toLowerCase()]));
  const cards = picks
    .map((p) => {
      const m = meta[p.voice];
      const meant = m ? `${esc(m.role)}. Meant to sound like: ${esc(firstSentence(m.description))}` : '';
      return `<section class="card" id="card-${esc(p.id)}">
  <h2>${esc(p.name)}</h2>
  <p class="meant">${meant}</p>
  <p class="says">&ldquo;${esc(p.text)}&rdquo;</p>
  <audio controls preload="none" src="${AUDIO_BASE}${esc(p.file)}"></audio>
  <div class="row">
    <button type="button" class="ok" aria-pressed="false">Sounds right</button>
    <button type="button" class="flag" aria-pressed="false">Sounds wrong</button>
  </div>
  <div class="why">
    <label for="why-${esc(p.id)}">What is wrong</label>
    <select id="why-${esc(p.id)}">${REASONS.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select>
    <input class="note" type="text" maxlength="200" placeholder="A few words, if you want" aria-label="Note for ${esc(p.name)}">
  </div>
</section>`;
    })
    .join('\n');
  const data = JSON.stringify({ picks: picks.map(({ id, voice, name, text }) => ({ id, voice, name, text })), reasons }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex">
<title>Voice spot check - Vibe Coding Dev Story</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <h1>Voice spot check</h1>
  <p>${picks.length} clips, one for each voice, about ${minutes} minutes. Headphones on. Nothing plays until you press play.</p>
  <p class="dim">Listen for: a word that turns into a note, a joke that lands on the wrong word, a click or a gasp, the wrong kind of voice, a last word that is cut off. The whole pass is <a href="listening-pass.html" style="color:var(--hot)">listening-pass.html</a>, about an hour.</p>
  <div><label for="name">Your name</label><input id="name" type="text" autocomplete="name" maxlength="60" placeholder="Your name"></div>
  <div><span id="count" aria-live="polite">0 of ${picks.length} marked</span><div class="bar"><i id="fill"></i></div></div>
</header>
<main>
${cards}
</main>
<section class="signoff" id="signoff" aria-live="polite">
  <h2>Done</h2>
  <p>Send this line back to the run, or paste it into <code>README.md</code> in &ldquo;The voices&rdquo;, in place of the &ldquo;spot-checked&rdquo; line.</p>
  <p class="line" id="line"></p>
  <div class="row"><button type="button" class="main" id="copy">Copy line</button><button type="button" id="export" hidden>Export flags</button><span id="copied" class="dim"></span></div>
</section>
<p><button type="button" id="reset">Clear all marks</button></p>
<script type="application/json" id="spot-data">${data}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function main(): void {
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx >= 0 && process.argv[outIdx + 1] !== undefined ? resolve(process.argv[outIdx + 1]!) : join(root, 'docs/voice-spot-check.html');
  const manifest = readJson(join(root, 'public/audio/vo/manifest.json')) as Manifest;
  const seedPath = join(root, 'tools/tts/cast.seed.md');
  const seed = existsSync(seedPath) ? parseSeedLines(readFileSync(seedPath, 'utf8')) : {};
  const metaRaw = existsSync(join(root, 'tools/tts/voices.json')) ? readJson(join(root, 'tools/tts/voices.json')) : {};
  const meta: Record<string, VoiceMeta> = {};
  if (isRecord(metaRaw)) {
    for (const [id, v] of Object.entries(metaRaw)) {
      if (isRecord(v)) meta[id] = { role: typeof v.role === 'string' ? v.role : '', description: typeof v.description === 'string' ? v.description : '' };
    }
  }
  const picks = pickSpotClips(manifest, seed);
  const missing = picks.filter((p) => !existsSync(join(root, 'public/audio/vo', p.file)));
  if (missing.length > 0) {
    console.error(`listen/spot: ${missing.length} MP3s are missing, first ${missing[0]?.file}`);
    process.exit(1);
  }
  writeFileSync(out, renderSpotPage(picks, meta));
  const seconds = picks.reduce((n, p) => n + p.dur, 0);
  console.log(`  ${picks.length} voices, one clip each, ${(seconds / 60).toFixed(1)} min`);
  for (const p of picks) console.log(`  ${p.name.padEnd(10)} ${p.dur.toFixed(1).padStart(4)}s  ${p.text}`);
  console.log(`  wrote      ${out.replace(`${root}/`, '')}`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
