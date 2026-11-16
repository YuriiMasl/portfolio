const FIXED = ['exhibit', 'stand', 'main', 'copy'];
const PANELS = ['main'];
const LABEL = { exhibit:'витрина', stand:'стойка', main:'экран кейса', copy:'текстовый блок' };
const LS_KEY = 'heroLayoutDraftV3';
let fileHash = '';
const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h); };
const IDENTITY = [[0,0],[1,0],[1,1],[0,1]];

const DEFAULT = {
  exhibit:{ width:64, right:1, bottom:3, rotZ:0 },
  stand:{ scale:1, dx:0, dy:0, brightness:0.78 },
  main:{ left:13, top:7, width:76, rotX:0, rotY:-8, rotZ:-3, z:2, warp:null },
  copy:{ left:4.8, top:42, width:38 },
  text:{ intro:'', title:['',''], cta:'Открыть кейс', facts:'' },
  extra:[]
};

let frame, doc, hero, exhibit, overlay;
let state = JSON.parse(JSON.stringify(DEFAULT));
let selected = 'main';
let warpMode = false;
let drag = null;

const num = (v,d=2) => Math.round(v*10**d)/10**d;
const toast = (m) => { const el=document.getElementById('toast'); el.textContent=m; el.classList.add('is-on');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('is-on'),1700); };
const isExtra = (k) => k.startsWith('x:');
const extraOf = (k) => state.extra.find((l)=>l.id===k.slice(2));
const stateOf = (k) => isExtra(k) ? extraOf(k) : state[k];
const elForKey = (k) => isExtra(k) ? exhibit.querySelector(`[data-extra="${k.slice(2)}"]`) : doc.querySelector(`[data-layer="${k}"]`);

function homography(corners, boxW, boxH) {
  const dst = corners.map(([u,v]) => [u*boxW, v*boxH]);
  const src = [[0,0],[boxW,0],[boxW,boxH],[0,boxH]];
  const A=[], B=[];
  src.forEach(([x,y],i)=>{ const [X,Y]=dst[i];
    A.push([x,y,1,0,0,0,-x*X,-y*X]); B.push(X);
    A.push([0,0,0,x,y,1,-x*Y,-y*Y]); B.push(Y); });
  for (let col=0; col<8; col++) {
    let piv=col;
    for (let r=col+1;r<8;r++) if (Math.abs(A[r][col])>Math.abs(A[piv][col])) piv=r;
    if (Math.abs(A[piv][col])<1e-9) return null;
    [A[col],A[piv]]=[A[piv],A[col]]; [B[col],B[piv]]=[B[piv],B[col]];
    const d=A[col][col];
    for (let c=col;c<8;c++) A[col][c]/=d; B[col]/=d;
    for (let r=0;r<8;r++) { if (r===col) continue; const f=A[r][col]; if (!f) continue;
      for (let c=col;c<8;c++) A[r][c]-=f*A[col][c]; B[r]-=f*B[col]; }
  }
  const [a,b,c,d,e,f,g,hh] = B;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

const t3d = (v) => `perspective(1200px) rotateX(${v.rotX||0}deg) rotateY(${v.rotY||0}deg) rotateZ(${v.rotZ||0}deg)`;

function warpTargets(node, key) {
  if (isExtra(key)) {
    const img = node.querySelector('img') || node;
    return [img];
  }
  return [...node.children].filter((el) => el.tagName !== 'IMG' || el.classList.contains('exhibit-glass'));
}

function applyWarp(node, layer, key) {
  if (!layer?.warp) return false;
  const targets = warpTargets(node, key);
  const ref = targets[0] || node;
  const m = homography(layer.warp, ref.offsetWidth || node.offsetWidth || 1, ref.offsetHeight || node.offsetHeight || 1);
  if (!m) return false;
  targets.forEach((el) => { el.style.transformOrigin = '0 0'; el.style.transform = m; });
  return true;
}

function apply(key) {
  if (key === 'extra') { buildExtras(); return; }
  const node = elForKey(key);
  if (!node) return;
  const v = stateOf(key);
  if (!v) return;
  if (isExtra(key)) {
    Object.assign(node.style, { left:v.left+'%', top:v.top+'%', width:v.width+'%',
      zIndex:String(v.z??5), opacity:v.opacity??1, borderRadius:(v.radius??10)+'px' });
    node.style.transform = t3d(v);
    applyWarp(node, v, key);
    return;
  }
  if (key === 'exhibit') {
    node.style.width = v.width+'%'; node.style.right = v.right+'%'; node.style.bottom = v.bottom+'%';
    node.style.transform = v.rotZ ? `rotate(${v.rotZ}deg)` : '';
  } else if (key === 'copy') {
    node.style.left = v.left+'%'; node.style.top = v.top+'%'; node.style.width = v.width+'%';
  } else if (PANELS.includes(key)) {
    node.style.left = v.left+'%'; node.style.top = v.top+'%'; node.style.width = v.width+'%';
    node.style.zIndex = String(v.z ?? 2);
    node.style.transformOrigin = '';
    node.style.transform = t3d(v);
    applyWarp(node, v, key);
  } else if (key === 'stand') {
    node.style.transform = `translate(${v.dx||0}%, ${v.dy||0}%) scale(${v.scale??1})`;
    node.style.filter = `brightness(${v.brightness ?? 0.78}) drop-shadow(8px 18px 16px rgba(0,0,0,.55))`;
  }
}

function applyText() {
  const t = state.text || {};
  const intro = doc.querySelector('[data-text="intro"]');
  if (intro && typeof t.intro === 'string') intro.innerHTML = t.intro.replace(/\n/g,'<br>');
  const title = doc.querySelector('[data-text="title"]');
  if (title && Array.isArray(t.title)) title.innerHTML = t.title
    .map((l)=>`<span class="line"><span class="line-in">${l}</span></span>`).join('');
  const cta = doc.querySelector('[data-text="cta"]');
  if (cta && t.cta) cta.innerHTML = `${t.cta} <span aria-hidden="true">→</span>`;
  const facts = doc.querySelector('[data-text="facts"]');
  if (facts && typeof t.facts === 'string') facts.innerHTML = t.facts.replace(/\n/g,'<br>');
}

function buildExtras() {
  exhibit.querySelectorAll('[data-extra]').forEach((n)=>n.remove());
  state.extra.forEach((l)=>{
    const wrap = doc.createElement('div');
    wrap.dataset.extra = l.id;
    Object.assign(wrap.style, { position:'absolute', left:(l.left??0)+'%', top:(l.top??0)+'%',
      width:(l.width??30)+'%', borderRadius:(l.radius??10)+'px', opacity:l.opacity??1,
      zIndex:String(l.z??5), pointerEvents:'none', transform: t3d(l) });
    const img = doc.createElement('img');
    img.src = l.src; img.alt = '';
    Object.assign(img.style, { display:'block', width:'100%', height:'auto', borderRadius:'inherit' });
    wrap.appendChild(img);
    exhibit.appendChild(wrap);
    applyWarp(wrap, l, 'x:'+l.id);
    bindNode('x:'+l.id);
  });
}

function fieldsFor(key) {
  if (isExtra(key)) return [['left','слева, %'],['top','сверху, %'],['width','ширина, %'],['rotZ','поворот, °'],['rotX','наклон, °'],['rotY','разворот, °'],['z','слой'],['opacity','прозрачность']];
  if (key === 'exhibit') return [['width','ширина, %'],['right','справа, %'],['bottom','снизу, %'],['rotZ','поворот, °']];
  if (key === 'copy') return [['left','слева, %'],['top','сверху, %'],['width','ширина, %']];
  if (PANELS.includes(key)) return [['left','слева, %'],['top','сверху, %'],['width','ширина, %'],['rotZ','поворот, °'],['rotX','наклон, °'],['rotY','разворот, °'],['z','слой']];
  if (key === 'stand') return [['scale','масштаб'],['dx','сдвиг X, %'],['dy','сдвиг Y, %'],['brightness','яркость']];
  return [];
}

function renderChips() {
  const host = document.getElementById('chips'); host.innerHTML='';
  [...FIXED, ...state.extra.map((l)=>'x:'+l.id)].forEach((key)=>{
    const b = document.createElement('button');
    b.className = 'chip' + (key===selected ? ' is-on' : '');
    b.textContent = isExtra(key) ? (extraOf(key)?.label || 'картинка') : LABEL[key];
    b.addEventListener('click', ()=>select(key));
    host.appendChild(b);
  });
}

function renderFields() {
  const host = document.getElementById('fields'); host.innerHTML='';
  const data = stateOf(selected);
  fieldsFor(selected).forEach(([prop,label])=>{
    const wrap = document.createElement('label'); wrap.textContent = label;
    const input = document.createElement('input'); input.type='number'; input.step = prop==='opacity'?'0.05':'0.5';
    input.value = data?.[prop] ?? 0;
    input.addEventListener('input', ()=>{
      const val = parseFloat(input.value); if (!Number.isFinite(val)) return;
      data[prop] = val; apply(selected); saveDraft();
    });
    wrap.appendChild(input); host.appendChild(wrap);
  });
  document.getElementById('remove').disabled = !isExtra(selected);
  document.getElementById('warp').classList.toggle('is-on', warpMode);
}

function decorate() {
  doc.querySelectorAll('.ow-handle,.ow-corner').forEach((n)=>n.remove());
  overlay.innerHTML = '';
  doc.querySelectorAll('[data-layer],[data-extra]').forEach((n)=>{ n.style.outline='none'; n.style.pointerEvents=''; });
  const node = elForKey(selected);
  if (!node) return;
  node.style.pointerEvents = 'auto';
  node.style.outline = '1px dashed rgba(255,139,61,.8)';
  node.style.outlineOffset = '2px';
  if (warpMode) { drawWarpHandles(node); return; }

  const mk = (style, mode) => {
    const h = doc.createElement('div');
    h.className = 'ow-handle';
    Object.assign(h.style, { position:'absolute', zIndex:9999, width:'14px', height:'14px',
      borderRadius:'50%', background:'#ff8b3d', border:'2px solid #21150c',
      cursor: mode==='rotate'?'grab':'nwse-resize', ...style });
    h.dataset.mode = mode; node.appendChild(h);
    h.addEventListener('pointerdown', (e)=>startDrag(e, mode));
  };
  mk({ right:'-7px', bottom:'-7px' }, 'resize');
  mk({ left:'50%', top:'-22px', marginLeft:'-7px' }, 'rotate');
}

function drawWarpHandles(node) {
  const layer = stateOf(selected);
  if (!layer) return;
  if (!layer.warp) layer.warp = IDENTITY.map((c) => [...c]);
  drawWarpOverlay(node, layer);
}

function drawWarpOverlay(node, layer) {
  overlay.innerHTML = '';
  const targets = warpTargets(node, selected);
  const ref = targets[0] || node;
  const saved = ref.style.transform;
  ref.style.transform = 'none';
  const base = ref.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  ref.style.transform = saved;

  const pts = layer.warp.map(([u, v]) => ({
    x: base.left - heroRect.left + u * base.width,
    y: base.top - heroRect.top + v * base.height
  }));

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' });
  const poly = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
  poly.setAttribute('fill', 'rgba(255,139,61,.10)');
  poly.setAttribute('stroke', '#ff8b3d');
  poly.setAttribute('stroke-width', '1.5');
  poly.setAttribute('stroke-dasharray', '6 5');
  svg.appendChild(poly);
  overlay.appendChild(svg);

  pts.forEach((p, i) => {
    const dot = doc.createElement('div');
    Object.assign(dot.style, {
      position: 'absolute', left: (p.x - 13) + 'px', top: (p.y - 13) + 'px',
      width: '26px', height: '26px', borderRadius: '6px',
      background: 'rgba(255,139,61,.92)', border: '2px solid #1b120a',
      cursor: 'grab', pointerEvents: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.5)',
      zIndex: 99999
    });
    dot.title = 'угол ' + (i + 1);
    overlay.appendChild(dot);

    dot.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startU = layer.warp[i][0], startV = layer.warp[i][1];
      const move = (ev) => {
        layer.warp[i] = [
          num(startU + (ev.clientX - startX) / base.width, 3),
          num(startV + (ev.clientY - startY) / base.height, 3)
        ];
        apply(selected);
        saveDraft();
        drawWarpOverlay(node, layer);
      };
      const up = () => {
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', up);
        drawWarpOverlay(node, layer);
      };
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', up);
    });
  });
}

function boxFor(key) { return (key==='exhibit'||key==='copy') ? hero.getBoundingClientRect() : exhibit.getBoundingClientRect(); }

function startDrag(e, mode) {
  e.preventDefault(); e.stopPropagation();
  const node = elForKey(selected); if (!node) return;
  const r = node.getBoundingClientRect();
  drag = { mode, startX:e.clientX, startY:e.clientY, box:boxFor(selected),
    start: JSON.parse(JSON.stringify(stateOf(selected))), cx:r.left+r.width/2, cy:r.top+r.height/2 };
  doc.addEventListener('pointermove', onMove);
  doc.addEventListener('pointerup', stopDrag, { once:true });
}

function onMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  const t = stateOf(selected); if (!t) return;
  if (drag.mode === 'move') {
    if (selected === 'exhibit') {
      state.exhibit.right = num(drag.start.right - dx/drag.box.width*100);
      state.exhibit.bottom = num(drag.start.bottom - dy/drag.box.height*100);
    } else { t.left = num(drag.start.left + dx/drag.box.width*100); t.top = num(drag.start.top + dy/drag.box.height*100); }
  } else if (drag.mode === 'resize') {
    t.width = num(Math.max(4, drag.start.width + dx/drag.box.width*100));
  } else if (drag.mode === 'rotate') {
    if (e.shiftKey) t.rotX = num((drag.start.rotX||0) + dy*0.35);
    else if (e.altKey) t.rotY = num((drag.start.rotY||0) + dx*0.35);
    else t.rotZ = num((Math.atan2(e.clientY-drag.cy, e.clientX-drag.cx)*180/Math.PI)+90);
  }
  apply(selected); renderFields(); saveDraft();
}

function stopDrag() { drag=null; doc.removeEventListener('pointermove', onMove); }

function saveDraft() {
  applyText();
  const text = JSON.stringify(state, null, 2);
  document.getElementById('out').value = text;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ base: fileHash, state: state }));
  } catch(e) {}
}

function select(key) { selected = key; warpMode=false; renderChips(); renderFields(); decorate(); }

function bindNode(key) {
  const node = elForKey(key);
  if (!node || node.dataset.bound) return;
  node.dataset.bound = '1';
  node.addEventListener('pointerdown', (e)=>{
    if (e.target.dataset.mode || e.target.classList.contains('ow-corner')) return;
    select(key); startDrag(e, 'move');
  });
}

function readTextFromDom() {
  const t = state.text || {};
  const intro = doc.querySelector('[data-text="intro"]');
  const facts = doc.querySelector('[data-text="facts"]');
  const cta = doc.querySelector('[data-text="cta"]');
  const lines = [...doc.querySelectorAll('[data-text="title"] .line-in')];
  if (intro) t.intro = intro.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');
  if (facts) t.facts = facts.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');
  if (cta) t.cta = cta.textContent.replace('→','').trim();
  if (lines.length) t.title = lines.map((l)=>l.textContent.trim());
  state.text = t;
}

function renderText() {
  const t = state.text || {};
  document.getElementById('t-intro').value = t.intro || '';
  document.getElementById('t-l1').value = t.title?.[0] || '';
  document.getElementById('t-l2').value = t.title?.[1] || '';
  document.getElementById('t-cta').value = t.cta || '';
  document.getElementById('t-facts').value = t.facts || '';
}

['t-intro','t-l1','t-l2','t-cta','t-facts'].forEach((id)=>{
  document.getElementById(id).addEventListener('input', ()=>{
    state.text = state.text || {};
    state.text.intro = document.getElementById('t-intro').value;
    state.text.title = [document.getElementById('t-l1').value, document.getElementById('t-l2').value];
    state.text.cta = document.getElementById('t-cta').value;
    state.text.facts = document.getElementById('t-facts').value;
    applyText(); saveDraft();
  });
});

let inlineOn = false;
document.getElementById('inlineText').addEventListener('click', (e)=>{
  inlineOn = !inlineOn;
  e.target.classList.toggle('is-on', inlineOn);
  doc.querySelectorAll('[data-text]').forEach((n)=>{
    n.contentEditable = inlineOn ? 'true' : 'false';
    n.style.outline = inlineOn ? '1px dashed rgba(255,139,61,.55)' : '';
  });
  if (inlineOn) {
    doc.querySelectorAll('[data-text]').forEach((n)=>n.addEventListener('input', ()=>{
      readTextFromDom(); renderText(); saveDraft();
    }));
    toast('Текст можно править прямо на странице');
  }
});

function setup() {
  frame = document.getElementById('frame');
  doc = frame.contentDocument;
  hero = doc.querySelector('.hero');
  exhibit = doc.querySelector('[data-layer="exhibit"]');
  if (!hero || !exhibit) return;

  overlay = doc.createElement('div');
  Object.assign(overlay.style, { position:'absolute', inset:'0', pointerEvents:'none', zIndex:99998 });
  hero.style.position = hero.style.position || 'relative';
  hero.appendChild(overlay);

  exhibit.style.pointerEvents = 'auto';
  const copyEl = doc.querySelector('[data-layer="copy"]');
  if (copyEl) copyEl.style.pointerEvents = 'auto';

  readTextFromDom();

  let draft = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!raw) return null;
      return raw.state ? { state: raw.state, base: raw.base } : { state: raw, base: null };
    } catch(e) { return null; }
  })();

  fetch('assets/hero-layout.json?t=' + Date.now(), { cache:'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((file) => {
      fileHash = hashStr(JSON.stringify(file || {}));
      if (draft && draft.base && draft.base !== fileHash) {
        draft = null;
        toast('Файл обновился — взял актуальную версию');
      }
      const draftState = draft ? draft.state : null;
      const merged = JSON.parse(JSON.stringify(DEFAULT));
      if (file) Object.keys(file).forEach((k) => { merged[k] = file[k]; });
      if (draftState) Object.keys(draftState).forEach((k) => {
        merged[k] = (merged[k] && typeof merged[k] === 'object' && !Array.isArray(merged[k]))
          ? { ...merged[k], ...draftState[k] } : draftState[k];
      });
      if (!Array.isArray(merged.extra)) merged.extra = [];
      if (!merged.text) merged.text = JSON.parse(JSON.stringify(DEFAULT.text));
      state = merged;

      FIXED.forEach((k)=>apply(k));
      applyText();
      buildExtras();
      FIXED.forEach(bindNode);
      renderChips(); renderFields(); renderText(); decorate(); saveDraft();
    });

  doc.addEventListener('keydown', (e)=>{
    const step = e.shiftKey ? 1 : 0.2;
    const map = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] };
    const d = map[e.key]; if (!d) return;
    const t = stateOf(selected); if (!t) return;
    e.preventDefault();
    if (selected === 'exhibit') { state.exhibit.right = num(state.exhibit.right - d[0]); state.exhibit.bottom = num(state.exhibit.bottom - d[1]); }
    else { t.left = num(t.left + d[0]); t.top = num(t.top + d[1]); }
    apply(selected); renderFields(); saveDraft();
  });
}

let VW = 1600, VH = 900;
function fit() {
  const wrap = document.getElementById('stageWrap');
  const stage = document.getElementById('stage');
  const frameEl = document.getElementById('frame');
  frameEl.style.width = VW + 'px';
  frameEl.style.height = VH + 'px';
  const scale = Math.min(wrap.clientWidth / VW, wrap.clientHeight / VH);
  frameEl.style.transform = `scale(${scale})`;
  stage.style.width = VW*scale+'px'; stage.style.height = VH*scale+'px';
  stage.style.left = (wrap.clientWidth-VW*scale)/2+'px';
  stage.style.top = (wrap.clientHeight-VH*scale)/2+'px';
}

document.getElementById('viewport').addEventListener('change', (e) => {
  const [w, h] = e.target.value.split('x').map(Number);
  VW = w; VH = h;
  fit();
  document.getElementById('frame').src = 'index.html?v=' + Date.now();
});

document.getElementById('frame').src = 'index.html?v=' + Date.now();
document.getElementById('frame').addEventListener('load', ()=>setTimeout(setup, 400));
window.addEventListener('resize', fit);
fit();

document.getElementById('warp').addEventListener('click', ()=>{
  warpMode = !warpMode;
  if (warpMode && !stateOf(selected)?.warp) stateOf(selected).warp = IDENTITY.map((c)=>[...c]);
  renderFields(); decorate(); saveDraft();
});

function shiftZ(dir) {
  const t = stateOf(selected); if (!t) return;
  const all = [...PANELS.map(k=>state[k]).filter(Boolean), ...state.extra].map(l=>l.z??0);
  t.z = dir>0 ? Math.max(...all,0)+1 : Math.min(...all,0)-1;
  apply(selected); renderFields(); saveDraft();
}
document.getElementById('warpReset').addEventListener('click', ()=>{
  const t = stateOf(selected); if (!t) return;
  t.warp = null;
  const node = elForKey(selected);
  if (node) [...node.children].forEach((ch)=>{ ch.style.transform=''; ch.style.transformOrigin=''; });
  warpMode = false;
  apply(selected); renderFields(); decorate(); saveDraft();
  toast('Искажение сброшено');
});
document.getElementById('zup').addEventListener('click', ()=>shiftZ(1));
document.getElementById('zdown').addEventListener('click', ()=>shiftZ(-1));

document.getElementById('add').addEventListener('click', ()=>document.getElementById('fileAdd').click());
document.getElementById('fileAdd').addEventListener('change', (e)=>{
  [...e.target.files].forEach((file,i)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const max = Math.max(0, ...[...PANELS.map(k=>state[k]?.z??0), ...state.extra.map(l=>l.z??0)]);
      const layer = { id:'i'+Date.now()+i, label:file.name.replace(/\.[^.]+$/,'').slice(0,22) || 'картинка',
        src: reader.result, left:30, top:30, width:30, rotX:0, rotY:0, rotZ:0, z:max+1, opacity:1, radius:10, warp:null };
      state.extra.push(layer);
      buildExtras(); select('x:'+layer.id); saveDraft();
      toast('Добавил: '+layer.label);
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

document.getElementById('replace').addEventListener('click', ()=>document.getElementById('fileReplace').click());
document.getElementById('fileReplace').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    if (isExtra(selected)) { extraOf(selected).src = reader.result; buildExtras(); decorate(); }
    else if (PANELS.includes(selected)) {
      const inner = elForKey(selected).querySelector('.exhibit-surface > img');
      if (inner) inner.src = reader.result; else toast('У слоя нет картинки');
    } else toast('Выбери слой с картинкой');
    saveDraft();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('remove').addEventListener('click', ()=>{
  if (!isExtra(selected)) return toast('Удаляются только добавленные картинки');
  state.extra = state.extra.filter((l)=>'x:'+l.id !== selected);
  buildExtras(); select('main'); saveDraft();
});

document.getElementById('save').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'hero-layout.json'; a.click();
  URL.revokeObjectURL(a.href);
  toast('Скачал JSON — пришли мне');
});
document.getElementById('copy').addEventListener('click', async ()=>{
  try { await navigator.clipboard.writeText(JSON.stringify(state, null, 2)); toast('JSON в буфере'); }
  catch { toast('Скопируй из поля внизу'); }
});
document.getElementById('reset').addEventListener('click', ()=>{
  try { localStorage.removeItem(LS_KEY); } catch(e) {}
  fetch('assets/hero-layout.json?t=' + Date.now(), { cache:'no-store' }).then(r=>r.json()).then((data)=>{
    state = { ...JSON.parse(JSON.stringify(DEFAULT)), ...data };
    if (!Array.isArray(state.extra)) state.extra = [];
    if (!state.text) state.text = JSON.parse(JSON.stringify(DEFAULT.text));
    FIXED.forEach((k)=>apply(k)); applyText(); buildExtras();
    FIXED.forEach(bindNode); select('main'); renderText(); saveDraft();
    toast('Вернул к файлу');
  });
});
document.getElementById('import').addEventListener('click', ()=>document.getElementById('fileJson').click());
document.getElementById('fileJson').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try {
      const data = JSON.parse(reader.result);
      state = { ...JSON.parse(JSON.stringify(DEFAULT)), ...data };
      if (!Array.isArray(state.extra)) state.extra = [];
      if (!state.text) state.text = JSON.parse(JSON.stringify(DEFAULT.text));
      FIXED.forEach((k)=>apply(k)); applyText(); buildExtras();
      FIXED.forEach(bindNode); select('main'); renderText(); saveDraft();
      toast('Раскладка загружена');
    } catch { toast('Не разобрал JSON'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
