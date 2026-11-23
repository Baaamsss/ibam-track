/* IBAM Track — static, offline-first tracker. No external libraries or API keys. */
'use strict';

const STORAGE_KEY = 'ibam-track-v1';
const DEFAULT_FOODS = [
  {id:'base-rice',name:'Nasi putih matang',kcal:130,p:2.7,c:28.2,f:0.3,source:'Estimasi komposisi umum'},
  {id:'base-egg',name:'Telur ayam rebus utuh (tanpa cangkang)',kcal:155,p:12.6,c:1.1,f:10.6,source:'Estimasi komposisi umum'},
  {id:'base-eggwhite',name:'Putih telur rebus (tanpa kuning)',kcal:52,p:10.9,c:0.7,f:0.2,source:'Estimasi komposisi umum'},
  {id:'base-chicken',name:'Dada ayam matang tanpa kulit',kcal:165,p:31,c:0,f:3.6,source:'Estimasi komposisi umum'},
  {id:'base-tempe',name:'Tempe (tanpa minyak tambahan)',kcal:193,p:20.3,c:7.6,f:10.8,source:'Estimasi komposisi umum'},
  {id:'base-tofu',name:'Tahu putih',kcal:76,p:8,c:1.9,f:4.8,source:'Estimasi komposisi umum'},
  {id:'base-banana',name:'Pisang',kcal:89,p:1.1,c:22.8,f:0.3,source:'Estimasi komposisi umum'},
  {id:'base-oats',name:'Oat kering',kcal:389,p:16.9,c:66.3,f:6.9,source:'Estimasi komposisi umum'},
  {id:'base-milk',name:'Susu sapi plain full cream',kcal:61,p:3.2,c:4.8,f:3.3,source:'Estimasi komposisi umum'},
  {id:'base-bread',name:'Roti gandum',kcal:247,p:13,c:41,f:4.2,source:'Estimasi komposisi umum'},
  {id:'base-potato',name:'Kentang rebus',kcal:87,p:1.9,c:20.1,f:0.1,source:'Estimasi komposisi umum'},
  {id:'base-tuna',name:'Ikan tuna matang tanpa minyak',kcal:132,p:29,c:0,f:1,source:'Estimasi komposisi umum'},
  {id:'base-beef',name:'Daging sapi matang tanpa lemak',kcal:217,p:30,c:0,f:10,source:'Estimasi komposisi umum'},
  {id:'base-apple',name:'Apel',kcal:52,p:0.3,c:13.8,f:0.2,source:'Estimasi komposisi umum'},
  {id:'base-brown-rice',name:'Nasi merah matang',kcal:111,p:2.6,c:23,f:0.9,source:'Estimasi komposisi umum'}
];
const MEALS = ['Sarapan','Makan siang','Makan malam','Camilan'];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const num = (n, fallback=0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const round = (n, dec=1) => Math.round((n+Number.EPSILON)*10**dec)/10**dec;
const fmt = (n,digits=0) => Number(n).toLocaleString('id-ID',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const html = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad = n => String(n).padStart(2,'0');
const today = () => {const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const validDate = s => {if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return false;const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===s;};
const shiftDate = (s,delta) => {const [y,m,d]=s.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d+delta));return date.toISOString().slice(0,10);};
const dateLabel = s => {if(!validDate(s))return s;return new Date(`${s}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});};
const weekStart = iso => {const d=new Date(`${iso}T12:00:00`);return shiftDate(iso,-((d.getDay()+6)%7));};
const makeId = () => (typeof crypto!=='undefined' && typeof crypto.randomUUID==='function') ? crypto.randomUUID() : `i${Date.now()}${Math.random().toString(36).slice(2)}`;
const emptyState = () => ({version:1,profile:null,customFoods:[],customExercises:[],foodLogs:[],weights:[],sleep:[],workouts:[]});
let state = loadState();
let editingFoodId=null, editingWorkoutId=null, toastTimer;

function loadState(){
  try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return emptyState();const data=JSON.parse(raw);if(!data || typeof data!=='object')return emptyState();return {...emptyState(),...data,customFoods:Array.isArray(data.customFoods)?data.customFoods:[],customExercises:Array.isArray(data.customExercises)?data.customExercises:[],foodLogs:Array.isArray(data.foodLogs)?data.foodLogs:[],weights:Array.isArray(data.weights)?data.weights:[],sleep:Array.isArray(data.sleep)?data.sleep:[],workouts:Array.isArray(data.workouts)?data.workouts:[]};}
  catch(err){console.warn('Data tidak dapat dibaca:',err);return emptyState();}
}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(err){toast('Gagal menyimpan. Periksa penyimpanan browser.',true);console.error(err);return false;}}
function toast(msg,error=false){const el=$('#toast');el.textContent=msg;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
const foods = () => [...DEFAULT_FOODS,...state.customFoods];
const foodById = id => foods().find(f=>f.id===id);
function calcItem(food,grams){const k=num(grams)/100;return {kcal:food.kcal*k,p:food.p*k,c:food.c*k,f:food.f*k};}
function dayNutrition(iso){return state.foodLogs.filter(row=>row.date===iso).reduce((sum,row)=>{const food=foodById(row.foodId);if(!food)return sum;const v=calcItem(food,row.grams);for(const key of ['kcal','p','c','f'])sum[key]+=v[key];return sum;},{kcal:0,p:0,c:0,f:0});}
function latestWeight(){const w=[...state.weights].filter(x=>validDate(x.date)).sort((a,b)=>b.date.localeCompare(a.date))[0];return w?.kg ?? state.profile?.weight ?? null;}
function average(numbers){return numbers.length ? numbers.reduce((a,b)=>a+b,0)/numbers.length : 0;}
function getTdee(profile){const bmr=10*num(profile.weight)+6.25*num(profile.height)-5*num(profile.age)+(profile.sex==='female'?-161:5);return Math.round(bmr*num(profile.activity,1.55));}
function autoCalories(profile){const tdee=getTdee(profile);let mod=profile.goal==='cut'?-num(profile.adjustment,300):profile.goal==='bulk'?num(profile.adjustment,300):0;return Math.max(1200,Math.round(tdee+mod));}
function durationHours(bed,wake){const parse=s=>{const [h,m]=String(s).split(':').map(Number);return h*60+m;};let minutes=(parse(wake)-parse(bed)+1440)%1440;return round(minutes/60,2);}
function goalMacros(){const p=state.profile;if(!p)return {calories:2000,protein:140,fat:50,carbs:225};const protein=num(p.protein,Math.round(num(p.weight)*1.8));const fat=Math.round(num(p.weight)*.7);return {calories:num(p.calories,2000),protein,fat,carbs:Math.max(0,Math.round((num(p.calories)-4*protein-9*fat)/4))};}
function get7DayWeights(date=today()){const floor=shiftDate(date,-6);return state.weights.filter(x=>x.date>=floor && x.date<=date).map(x=>x.kg);}
function getWeeklyWorkoutCount(date=today()){const start=weekStart(date),end=shiftDate(start,6);return new Set(state.workouts.filter(x=>x.date>=start && x.date<=end).map(x=>x.date)).size;}
function workoutStreak(){const needed=num(state.profile?.weekly,4);let start=weekStart(today()),weeks=0;for(let i=0;i<100;i++){const end=shiftDate(start,6);const count=new Set(state.workouts.filter(w=>w.date>=start&&w.date<=end).map(w=>w.date)).size;if(count<needed){if(i===0){start=shiftDate(start,-7);continue;}break;}weeks++;start=shiftDate(start,-7);}return weeks;}
function percent(value,target){return target>0?Math.max(0,Math.min(100,100*value/target)):0;}
function progressBar(value,target){return `<div class="bar"><div class="bar-fill ${value>target?'over':''}" style="width:${percent(value,target)}%"></div></div>`;}
function deltaSigned(n,d=2){return `${n>0?'+':''}${fmt(n,d)}`;}

function navigate(name){
  const allowed=['beranda','makanan','progres','gym','pengaturan'];if(!allowed.includes(name))name='beranda';
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));
  $$('[data-nav]').forEach(b=>{const active=b.dataset.nav===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  window.location.hash=name;window.scrollTo({top:0,behavior:'instant'});
}
function statCard(label,value,detail,symbol='◉',hero=false){return `<div class="stat-card ${hero?'hero-card':''}"><div class="stat-label"><span class="stat-symbol">${symbol}</span>${html(label)}</div><div class="stat-value">${html(value)}</div><div class="stat-desc">${html(detail)}</div></div>`;}
function renderDashboard(){
  const profile=state.profile, macro=goalMacros(), now=today(), totals=dayNutrition(now), grams=get7DayWeights(now), lastWeight=latestWeight();
  const sleep=[...state.sleep].sort((a,b)=>b.date.localeCompare(a.date))[0];const sessions=getWeeklyWorkoutCount();
  $('#greeting').textContent=`Halo, ${profile?.name || 'atlet'}! 👋`;
  $('#todayLabel').textContent=new Date(`${now}T12:00:00`).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#openProfile').textContent=(profile?.name||'I')[0].toUpperCase();
  const last7=grams.length?fmt(average(grams),2)+' kg':'Belum ada data';
  $('#dashboard-content').innerHTML=`
    <div class="stat-grid">
      ${statCard('Kalori hari ini',fmt(totals.kcal)+' kcal',`${fmt(Math.max(0,macro.calories-totals.kcal))} kcal sisa dari target`,'🔥',true)}
      ${statCard('Protein',fmt(totals.p,1)+' g',`Target ${fmt(macro.protein)} g`,'◉')}
      ${statCard('Berat terakhir',lastWeight===null?'—':fmt(lastWeight,2)+' kg',`Rata-rata 7 hari: ${last7}`,'↗')}
      ${statCard('Gym minggu ini',`${sessions} / ${profile?.weekly || 4}`,`Target sesi per minggu`,'▤')}
    </div>
    <div class="two-column">
      <article class="panel"><div class="panel-head"><div><h2>Asupan hari ini</h2><p>Diambil dari log makanan</p></div><span class="small-badge">${html(profile?.goal==='bulk'?'BULKING':profile?.goal==='maintain'?'MAINTENANCE':'CUTTING')}</span></div>
        <div class="macro-stack"><div><div class="label-row"><span>Kalori</span><strong>${fmt(totals.kcal)} / ${fmt(macro.calories)} kcal</strong></div>${progressBar(totals.kcal,macro.calories)}</div>
        <div><div class="label-row"><span>Protein</span><strong>${fmt(totals.p,1)} / ${macro.protein} g</strong></div>${progressBar(totals.p,macro.protein)}</div>
        <div class="macro-grid"><div class="macro-pill"><b>${fmt(totals.p,1)}g</b><small>PROTEIN</small></div><div class="macro-pill"><b>${fmt(totals.c,1)}g</b><small>KARBO</small></div><div class="macro-pill"><b>${fmt(totals.f,1)}g</b><small>LEMAK</small></div></div></div>
        <div class="quick-links"><button data-nav="makanan">＋ Makan</button><button data-nav="progres">↗ Timbang</button><button data-nav="gym">▤ Latihan</button></div>
      </article>
      <article class="panel"><div class="panel-head"><div><h2>Recovery & target</h2><p>Ringkasan terbaru</p></div><span class="panel-icon">✦</span></div>
        <div class="mini-kpi"><div class="kpi-box"><div class="kpi-value">${sleep?fmt(durationHours(sleep.bed,sleep.wake),1)+'j':'—'}</div><div class="kpi-label">Tidur terakhir</div></div><div class="kpi-box"><div class="kpi-value">${workoutStreak()} 🔥</div><div class="kpi-label">Streak minggu</div></div><div class="kpi-box"><div class="kpi-value">${fmt(getTdee(profile))}</div><div class="kpi-label">Estimasi TDEE (kcal)</div></div><div class="kpi-box"><div class="kpi-value">${fmt(macro.calories)}</div><div class="kpi-label">Target kalori/hari</div></div></div>
        <p class="tiny-note">Kalori olahraga tidak otomatis ditambahkan ke target harian. TDEE adalah estimasi awal; sesuaikan berdasarkan tren BB.</p>
      </article>
    </div>
    <div class="two-column space-top"><article class="panel"><div class="panel-head"><div><h2>Tren berat badan</h2><p>Hingga 14 penimbangan terakhir</p></div></div>${renderWeightLine(true)}</article>
    <article class="panel"><div class="panel-head"><div><h2>Mulai dari kebiasaan kecil</h2><p>Tracker ini dibuat sesederhana mungkin</p></div></div><div class="list-stack"><div class="list-entry"><div class="entry-main"><div class="entry-title">◉ Log makanan dengan gram</div><div class="entry-meta">Cari nasi, telur, ayam, atau simpan makanan sendiri.</div></div></div><div class="list-entry"><div class="entry-main"><div class="entry-title">↗ Timbang & catat tidur</div><div class="entry-meta">Bandingkan tren mingguan, jangan panik karena satu hari.</div></div></div><div class="list-entry"><div class="entry-main"><div class="entry-title">▤ Catat set gym</div><div class="entry-meta">Beban dan reps berbeda untuk setiap set.</div></div></div></div></article></div>`;
}

function renderFoodOptions(query=''){
  const select=$('#foodSelect'), old=select.value, filtered=foods().filter(f=>f.name.toLowerCase().includes(query.toLowerCase().trim()));
  select.innerHTML=filtered.length?filtered.map(f=>`<option value="${html(f.id)}">${html(f.name)}${f.id.startsWith('custom-')?' (pribadi)':''}</option>`).join(''):'<option value="" disabled selected>Tidak ditemukan — tambah makanan sendiri</option>';
  if(filtered.some(f=>f.id===old))select.value=old;renderFoodPreview();
}
function renderFoodPreview(){const f=foodById($('#foodSelect').value),grams=num($('#foodGrams').value);if(!f||grams<=0){$('#foodPreview').textContent='Pilih makanan dan masukkan berat.';return;}const n=calcItem(f,grams);$('#foodPreview').innerHTML=`<strong>${fmt(n.kcal)} kcal</strong> • Protein ${fmt(n.p,1)} g • Karbo ${fmt(n.c,1)} g • Lemak ${fmt(n.f,1)} g<small>${html(f.source)} · ${fmt(grams,1)} gram</small>`;}
function renderFoods(){
  const date=$('#foodDate').value||today(),list=state.foodLogs.filter(x=>x.date===date),macro=goalMacros(),total=dayNutrition(date);
  $('#foodSummary').innerHTML=`<p class="macro-caption">TOTAL ${html(dateLabel(date))}</p><div class="macro-total">${fmt(total.kcal)} <span style="font-size:16px;color:var(--muted)">kcal</span></div><div class="label-row"><span>Target kalori</span><strong>${fmt(macro.calories)} kcal</strong></div>${progressBar(total.kcal,macro.calories)}<p class="tiny-note">${total.kcal>macro.calories?`Lewat target ${fmt(total.kcal-macro.calories)} kcal`:`Sisa ${fmt(macro.calories-total.kcal)} kcal`}</p><div class="macro-grid" style="margin-top:20px"><div class="macro-pill"><b>${fmt(total.p,1)}g</b><small>PROTEIN</small></div><div class="macro-pill"><b>${fmt(total.c,1)}g</b><small>KARBO</small></div><div class="macro-pill"><b>${fmt(total.f,1)}g</b><small>LEMAK</small></div></div>`;
  if(!list.length){$('#foodList').innerHTML='<div class="empty">Belum ada makanan pada tanggal ini. Mulai dari nasi, telur, atau makanan lain yang lu makan.</div>';}
  else{$('#foodList').innerHTML=MEALS.filter(meal=>list.some(x=>x.meal===meal)).map(meal=>`<div class="group-heading">${meal}</div><div class="list-stack">${list.filter(x=>x.meal===meal).map(row=>{const food=foodById(row.foodId);if(!food)return '';const n=calcItem(food,row.grams);return `<div class="list-entry"><div class="entry-main"><div class="entry-title">${html(food.name)}</div><div class="entry-meta">${fmt(row.grams,1)} g • P ${fmt(n.p,1)} • C ${fmt(n.c,1)} • F ${fmt(n.f,1)}</div></div><div class="entry-right"><div class="entry-number">${fmt(n.kcal)} <small>kcal</small></div><div class="entry-actions"><button class="text-button" data-action="edit-food" data-id="${html(row.id)}">Ubah</button><button class="text-button danger" data-action="delete-food" data-id="${html(row.id)}">Hapus</button></div></div></div>`;}).join('')}</div>`).join('');}
  const custom=state.customFoods;
  $('#customFoodList').innerHTML=custom.length?`<div class="group-heading">Makanan pribadi (${custom.length})</div>${custom.map(f=>`<div class="list-entry"><div class="entry-main"><div class="entry-title">${html(f.name)}</div><div class="entry-meta">${fmt(f.kcal)} kcal / 100 g • ${html(f.source)}</div></div><button class="text-button danger" data-action="delete-custom" data-id="${html(f.id)}">Hapus</button></div>`).join('')}`:'';
}
function clearFoodEdit(){editingFoodId=null;$('#foodSubmit').textContent='＋ Tambah ke log';$('#cancelFoodEdit').classList.add('hidden');}
function handleFoodSubmit(event){event.preventDefault();const date=$('#foodDate').value,foodId=$('#foodSelect').value,grams=num($('#foodGrams').value),meal=$('#foodMeal').value;
  if(!validDate(date)||!foodById(foodId)||!MEALS.includes(meal)||grams<=0||grams>10000){toast('Periksa tanggal, makanan, dan gram.',true);return;}
  if(editingFoodId){const row=state.foodLogs.find(x=>x.id===editingFoodId);if(row)Object.assign(row,{date,foodId,grams,meal});}
  else state.foodLogs.push({id:makeId(),date,foodId,grams,meal});
  if(save()){toast(editingFoodId?'Catatan makanan diperbarui.':'Makanan ditambahkan.');clearFoodEdit();renderAll();}
}
function handleCustomSubmit(event){event.preventDefault();const name=$('#customName').value.trim(),source=$('#customSource').value.trim()||'Input pengguna — belum diverifikasi', kcal=num($('#customKcal').value),p=num($('#customProtein').value),c=num($('#customCarbs').value),f=num($('#customFat').value);
  if(!name||[kcal,p,c,f].some(x=>x<0)||kcal>1000||[p,c,f].some(x=>x>100)){toast('Nilai per 100 g tidak valid.',true);return;}
  if(foods().some(food=>food.name.toLowerCase()===name.toLowerCase())){toast('Nama makanan sudah ada. Gunakan nama lain.',true);return;}
  const computed=4*p+4*c+9*f;if(Math.abs(computed-kcal)>Math.max(80,kcal*.35) && !confirm(`Kalori yang dimasukkan (${fmt(kcal)}) jauh dari energi makro (~${fmt(computed)}). Tetap simpan sesuai sumber kamu?`))return;
  const newFood={id:'custom-'+makeId(),name,kcal,p,c,f,source};state.customFoods.push(newFood);
  if(save()){event.target.reset();$('#foodSearch').value='';renderFoodOptions();$('#foodSelect').value=newFood.id;renderFoodPreview();renderAll();toast('Makanan pribadi disimpan.');}
}

function svgChart(series,{minOverride=null,maxOverride=null,empty='Belum ada data untuk grafik.'}={}){
  if(!series.length||!series.some(s=>s.values.some(v=>Number.isFinite(v))))return `<div class="empty">${html(empty)}</div>`;
  const all=series.flatMap(s=>s.values).filter(v=>Number.isFinite(v)),rawMin=Math.min(...all),rawMax=Math.max(...all),extra=Math.max((rawMax-rawMin)*.2,.35);
  const low=minOverride!==null?minOverride:Math.max(0,rawMin-extra),high=maxOverride!==null?maxOverride:rawMax+extra;
  const W=620,H=224,x0=44,x1=604,y0=16,y1=183,steps=series[0].values.length;
  const x=i=>x0+(steps<=1?(x1-x0)/2:i*(x1-x0)/(steps-1));
  const y=v=>y1-(v-low)/Math.max(.001,high-low)*(y1-y0);
  const grids=Array.from({length:5},(_,i)=>{const val=low+(high-low)*i/4;const Y=y(val);return `<line x1="${x0}" y1="${Y}" x2="${x1}" y2="${Y}" stroke="#304154" stroke-dasharray="3 6"/><text x="${x0-8}" y="${Y+3}" fill="#8295a9" font-size="10" text-anchor="end">${fmt(val,1)}</text>`;}).join('');
  const labels=series[0].labels||[];
  const interval=Math.max(1,Math.ceil(labels.length/6));
  const ticks=labels.map((label,i)=>(i%interval===0||i===labels.length-1)?`<text x="${x(i)}" y="205" fill="#8295a9" font-size="10" text-anchor="middle">${html(label)}</text>`:'').join('');
  const drawings=series.map(s=>{const points=s.values.map((v,i)=>Number.isFinite(v)?[x(i),y(v)]:null);let path='',active=false;for(let i=0;i<points.length;i++){if(!points[i]){active=false;continue;}const [X,Y]=points[i];path+=`${active?'L':'M'}${X.toFixed(1)} ${Y.toFixed(1)} `;active=true;}const dots=points.filter(Boolean).map(([X,Y])=>`<circle cx="${X}" cy="${Y}" r="${s.dotRadius??3}" fill="${s.color}" stroke="#15202b" stroke-width="2"/>`).join('');return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.stroke??2.8}" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;}).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik ${html(series.map(s=>s.name).join(' dan '))}"><title>Grafik ${html(series.map(s=>s.name).join(' dan '))}</title>${grids}${drawings}${ticks}</svg><div class="chart-legend">${series.map(s=>`<span><span class="legend-dot" style="background:${s.color}"></span>${html(s.name)}</span>`).join('')}</div>`;
}
function weightSeries(limit=14){
  const sorted=[...state.weights].filter(r=>validDate(r.date)&&r.kg>0).sort((a,b)=>a.date.localeCompare(b.date));
  return sorted.slice(-limit).map(row=>{const floor=shiftDate(row.date,-6),samples=sorted.filter(w=>w.date>=floor&&w.date<=row.date).map(w=>w.kg);return {...row,rolling:average(samples)};});
}
function renderWeightLine(short=false){const series=weightSeries(short?14:30);if(!series.length)return '<div class="empty">Belum ada log berat badan.</div>';
  return svgChart([{name:'Berat harian',color:'#7ebdff',values:series.map(x=>x.kg),labels:series.map(x=>x.date.slice(5))},{name:'Rata-rata 7 hari',color:'#b7ef72',values:series.map(x=>x.rolling)}])+(short?'<p class="chart-note">Grafik mengikuti tanggal yang dicatat, bukan semua hari kalender.</p>':'<p class="chart-note">Rata-rata 7 hari berdasarkan penimbangan yang tersedia pada tiap jendela 7 hari.</p>');
}
function renderWeight(){
  const sorted=[...state.weights].sort((a,b)=>b.date.localeCompare(a.date));
  const seven=get7DayWeights();
  const latest=sorted[0],prev=sorted[1];
  $('#weightStats').innerHTML=`<div class="mini-kpi" style="margin-bottom:15px"><div class="kpi-box"><div class="kpi-value">${latest?fmt(latest.kg,2)+' kg':'—'}</div><div class="kpi-label">Penimbangan terakhir</div></div><div class="kpi-box"><div class="kpi-value">${seven.length?fmt(average(seven),2)+' kg':'—'}</div><div class="kpi-label">Rata-rata 7 hari (${seven.length} data)</div></div></div>${latest&&prev?`<p class="tiny-note">Dibanding penimbangan sebelumnya: ${deltaSigned(latest.kg-prev.kg,2)} kg</p>`:''}`;
  $('#weightChart').innerHTML=renderWeightLine(false);
  const weekMap=new Map();for(const w of state.weights){const start=weekStart(w.date);if(!weekMap.has(start))weekMap.set(start,[]);weekMap.get(start).push(w.kg);}
  const weeks=[...weekMap.entries()].sort(([a],[b])=>b.localeCompare(a)).slice(0,9);
  $('#weeklyWeight').innerHTML=weeks.length?weeks.map(([start,vals])=>`<div class="week-row"><span>${html(dateLabel(start))} – ${html(dateLabel(shiftDate(start,6)))}</span><strong>${fmt(average(vals),2)} kg</strong><small>${vals.length} penimbangan</small></div>`).join(''):'<div class="empty">Belum ada rata-rata mingguan.</div>';
}
function renderSleep(){
  const sorted=[...state.sleep].sort((a,b)=>b.date.localeCompare(a.date));
  const recent=sorted.slice(0,7),durations=recent.map(s=>durationHours(s.bed,s.wake));
  const avg=average(durations);
  $('#sleepStats').innerHTML=`<div class="mini-kpi" style="margin-bottom:15px"><div class="kpi-box"><div class="kpi-value">${recent.length?fmt(avg,1)+' jam':'—'}</div><div class="kpi-label">Rata-rata ${recent.length} entri</div></div><div class="kpi-box"><div class="kpi-value">${recent.length?fmt(durations[0],1)+' jam':'—'}</div><div class="kpi-label">Tidur terakhir</div></div></div>`;
  $('#sleepChart').innerHTML=recent.length?svgChart([{name:'Durasi tidur (jam)',color:'#b7ef72',values:recent.slice().reverse().map(x=>durationHours(x.bed,x.wake)),labels:recent.slice().reverse().map(x=>x.date.slice(5))}],{minOverride:0,maxOverride:Math.max(10,Math.ceil(Math.max(...durations)+1))}):'<div class="empty">Belum ada catatan tidur.</div>';
}
function renderProgressHistory(){
  const w=[...state.weights].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8),s=[...state.sleep].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  $('#progressHistory').innerHTML=`<div><h3>↗ Berat badan</h3>${w.length?w.map(row=>`<div class="list-entry"><div class="entry-main"><div class="entry-title">${html(dateLabel(row.date))}</div><div class="entry-meta">${fmt(row.kg,2)} kg</div></div><button class="text-button danger" data-action="delete-weight" data-date="${html(row.date)}">Hapus</button></div>`).join(''):'<div class="empty">Kosong.</div>'}</div><div><h3>☾ Tidur</h3>${s.length?s.map(row=>`<div class="list-entry"><div class="entry-main"><div class="entry-title">${html(dateLabel(row.date))}</div><div class="entry-meta">${html(row.bed)} – ${html(row.wake)} • ${fmt(durationHours(row.bed,row.wake),1)} jam ${row.quality?'• Kualitas '+html(row.quality)+'/5':''}</div></div><button class="text-button danger" data-action="delete-sleep" data-date="${html(row.date)}">Hapus</button></div>`).join(''):'<div class="empty">Kosong.</div>'}</div>`;
}
function handleWeight(event){event.preventDefault();const date=$('#weightDate').value,kg=num($('#weightValue').value);if(!validDate(date)||kg<20||kg>400){toast('Isi tanggal dan berat yang valid.',true);return;}const old=state.weights.find(x=>x.date===date);if(old)old.kg=kg;else state.weights.push({date,kg});if(save()){renderAll();toast('Berat badan dicatat.');}}
function handleSleep(event){event.preventDefault();const date=$('#sleepDate').value,bed=$('#bedTime').value,wake=$('#wakeTime').value,quality=$('#sleepQuality').value,h=durationHours(bed,wake);if(!validDate(date)||h<=0||h>16||!/^\d{2}:\d{2}$/.test(bed)||!/^\d{2}:\d{2}$/.test(wake)){toast('Periksa jam tidur. Durasi harus >0 dan ≤16 jam.',true);return;}const old=state.sleep.find(x=>x.date===date);if(old)Object.assign(old,{bed,wake,quality});else state.sleep.push({date,bed,wake,quality});if(save()){renderAll();toast('Tidur dicatat.');}}

// Exercise library is stored locally and also rebuilt from old workout history.
// This keeps names from previous v1 records available without data migration.
function exerciseKey(name){return String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');}
function exerciseNames(){
  const unique=new Map();
  for(const name of state.customExercises||[]){if(typeof name==='string'&&name.trim()&&name.length<=80)unique.set(exerciseKey(name),name.trim());}
  for(const item of state.workouts){if(typeof item.exercise==='string'&&item.exercise.trim()){
    const key=exerciseKey(item.exercise);if(!unique.has(key))unique.set(key,item.exercise.trim());
  }}
  return [...unique.values()].sort((a,b)=>a.localeCompare(b,'id-ID'));
}
function refreshExerciseIdeas(){
  const list=$('#exerciseIdeas');
  list.querySelectorAll('option[data-custom-exercise]').forEach(option=>option.remove());
  const baseNames=new Set([...list.options].map(option=>exerciseKey(option.value)));
  for(const name of exerciseNames()){
    if(baseNames.has(exerciseKey(name)))continue;
    const option=document.createElement('option');option.value=name;option.dataset.customExercise='true';
    list.appendChild(option);
  }
  renderExerciseLastSets();
}
function renderExerciseLastSets(){
  const hint=$('#exerciseLastSets');if(!hint)return;
  const name=exerciseKey($('#exerciseName').value);
  if(!name){hint.textContent='Gerakan yang sudah pernah disimpan akan muncul sebagai saran otomatis.';return;}
  const latest=state.workouts.filter(w=>w.id!==editingWorkoutId&&exerciseKey(w.exercise)===name)
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(!latest){hint.textContent='Belum ada riwayat untuk gerakan ini.';return;}
  hint.textContent=`Terakhir (${dateLabel(latest.date)}): `+latest.sets.map((set,i)=>`Set ${i+1} ${fmt(set.weight,2)} kg × ${fmt(set.reps)}`).join(' • ');
}
function storeExerciseName(name){
  const clean=name.trim().replace(/\s+/g,' '),key=exerciseKey(clean);
  if(!(state.customExercises||[]).some(item=>exerciseKey(item)===key))state.customExercises.push(clean);
}
function currentSets(){return $$('#setRows .set-row').map(row=>({weight:num(row.querySelector('.set-weight').value),reps:num(row.querySelector('.set-reps').value)}));}
function renderSetRows(sets){$('#setRows').innerHTML=`<div class="set-row-legend"><span>SET</span><span>BEBAN (KG)</span><span>REPS</span><span></span></div>`+sets.map((set,i)=>`<div class="set-row" data-set-index="${i}"><span class="set-index">#${i+1}</span><input class="set-weight" aria-label="Beban set ${i+1} kg" type="number" min="0" max="1000" step="0.25" value="${num(set.weight)}" required><input class="set-reps" aria-label="Repetisi set ${i+1}" type="number" min="1" max="200" step="1" value="${num(set.reps,10)}" required><button class="mini-remove" type="button" aria-label="Hapus set ${i+1}" data-action="remove-set" data-index="${i}">×</button></div>`).join('');}
function clearWorkoutEdit(){editingWorkoutId=null;$('#workoutSubmit').textContent='Simpan latihan';$('#cancelWorkoutEdit').classList.add('hidden');$('#workoutNote').value='';$('#exerciseName').value='';renderSetRows([{weight:0,reps:10}]);renderExerciseLastSets();}
function handleWorkout(event){event.preventDefault();const date=$('#workoutDate').value,exercise=$('#exerciseName').value.trim(),note=$('#workoutNote').value.trim(),sets=currentSets();if(!validDate(date)||!exercise||exercise.length>80||!sets.length||sets.length>15||sets.some(s=>s.weight<0||s.weight>1000||s.reps<1||s.reps>200||!Number.isInteger(s.reps))){toast('Cek nama gerakan, beban, dan repetisi tiap set.',true);return;}if(editingWorkoutId){const old=state.workouts.find(x=>x.id===editingWorkoutId);if(old)Object.assign(old,{date,exercise,sets,note});}else state.workouts.push({id:makeId(),date,exercise,sets,note});storeExerciseName(exercise);if(save()){const wasEditing=!!editingWorkoutId;clearWorkoutEdit();renderAll();toast(wasEditing?'Latihan diperbarui.':'Latihan berhasil dicatat.');}}
function renderWorkoutStats(){const count=getWeeklyWorkoutCount(),target=num(state.profile?.weekly,4),week=weekStart(today());$('#workoutStats').innerHTML=`<div class="week-goal"><div class="goal-ring" style="--progress:${percent(count,target)}%"><div class="goal-ring-inner">${count}/${target}</div></div><div><strong>${count>=target?'Target tercapai!':'Terus konsisten'}</strong><small>${html(dateLabel(week))} – ${html(dateLabel(shiftDate(week,6)))}</small></div></div><div class="streak-line">🔥 <b>${workoutStreak()}</b> minggu memenuhi target berturut-turut</div><div class="mini-kpi" style="margin-top:16px"><div class="kpi-box"><div class="kpi-value">${new Set(state.workouts.map(w=>w.date)).size}</div><div class="kpi-label">Total hari latihan</div></div><div class="kpi-box"><div class="kpi-value">${state.workouts.reduce((acc,w)=>acc+(w.sets?.length||0),0)}</div><div class="kpi-label">Total set tercatat</div></div></div>`;}
function renderWorkoutList(){
  const items=[...state.workouts].sort((a,b)=>b.date.localeCompare(a.date));
  if(!items.length){$('#workoutList').innerHTML='<div class="empty">Belum ada latihan dicatat. Tambahkan gerakan pertama untuk mulai memantau progres.</div>';return;}
  const groups=new Map();for(const w of items){if(!groups.has(w.date))groups.set(w.date,[]);groups.get(w.date).push(w);}
  $('#workoutList').innerHTML=[...groups.entries()].map(([date,logs])=>`<div class="group-heading">${html(dateLabel(date))} • ${logs.length} gerakan</div>${logs.map(log=>`<div class="workout-card"><div class="workout-card-top"><div><div class="entry-title">${html(log.exercise)}</div><div class="entry-meta">${log.sets.length} set${log.note?' • '+html(log.note):''}</div></div><div class="workout-actions"><button class="text-button" data-action="edit-workout" data-id="${html(log.id)}">Ubah</button><button class="text-button danger" data-action="delete-workout" data-id="${html(log.id)}">Hapus</button></div></div><div class="sets-pills">${log.sets.map((s,i)=>`<span class="set-pill">Set ${i+1}: ${fmt(s.weight,2)} kg × ${fmt(s.reps)}</span>`).join('')}</div></div>`).join('')}`).join('');
}
function renderSettings(){const p=state.profile,m=goalMacros();$('#settingsProfile').innerHTML=`<div class="list-stack" style="margin-bottom:22px"><div class="list-entry"><span class="muted small">Nama</span><strong>${html(p.name)}</strong></div><div class="list-entry"><span class="muted small">Profil</span><strong>${fmt(p.age)} th • ${fmt(p.height)} cm • ${fmt(p.weight,2)} kg</strong></div><div class="list-entry"><span class="muted small">Tujuan</span><strong>${p.goal==='cut'?'Cutting':p.goal==='bulk'?'Bulking':'Maintenance'}</strong></div><div class="list-entry"><span class="muted small">BMR / TDEE estimasi</span><strong>${fmt(Math.round(getTdee(p)/num(p.activity,1.55)))} / ${fmt(getTdee(p))} kcal</strong></div><div class="list-entry"><span class="muted small">Target kalori</span><strong>${fmt(m.calories)} kcal/hari</strong></div><div class="list-entry"><span class="muted small">Protein</span><strong>${fmt(m.protein)} g/hari</strong></div><div class="list-entry"><span class="muted small">Target gym</span><strong>${fmt(p.weekly)} hari/minggu</strong></div></div>`;}
function renderAll(){if(!state.profile)return;renderDashboard();renderFoods();renderWeight();renderSleep();renderProgressHistory();renderWorkoutStats();renderWorkoutList();refreshExerciseIdeas();renderSettings();}

// First run and profile: compact onboarding, formulas shown transparently.
function openProfile(){const p=state.profile;$('#profileHeading').textContent=p?'Edit profil & target':'Bikin profil dulu, yuk.';$('#closeProfile').classList.toggle('hidden',!p);
  if(p){$('#profileName').value=p.name;$('#profileSex').value=p.sex;$('#profileAge').value=p.age;$('#profileHeight').value=p.height;$('#profileWeight').value=p.weight;$('#profileGoal').value=p.goal;$('#profileActivity').value=p.activity;$('#profileAdjustment').value=p.adjustment;$('#profileWeekly').value=p.weekly;$('#manualCalToggle').checked=!!p.manualCalories;$('#profileProtein').value=p.protein;$('#profileCalories').value=p.calories;$('#profileProtein').dataset.touched='yes';}
  else{$('#profileProtein').dataset.touched='no';$('#manualCalToggle').checked=false;}
  updateProfileEstimate();if(!$('#profileDialog').open)$('#profileDialog').showModal();}
function updateProfileEstimate(){const p={sex:$('#profileSex').value,age:num($('#profileAge').value,20),height:num($('#profileHeight').value,167),weight:num($('#profileWeight').value,78),goal:$('#profileGoal').value,activity:num($('#profileActivity').value,1.55),adjustment:num($('#profileAdjustment').value,300)};
  const manual=$('#manualCalToggle').checked;$('#profileCalories').readOnly=!manual;
  if(!manual)$('#profileCalories').value=autoCalories(p);
  if($('#profileProtein').dataset.touched!=='yes')$('#profileProtein').value=Math.round(p.weight*1.8);
  const tdee=getTdee(p),cal=num($('#profileCalories').value),protein=num($('#profileProtein').value),fat=Math.round(p.weight*.7),carb=Math.max(0,Math.round((cal-protein*4-fat*9)/4));
  $('#profileEstimate').innerHTML=`<strong>Estimasi BMR ${fmt(Math.round(tdee/p.activity))} kcal • TDEE ${fmt(tdee)} kcal/hari</strong><small>Target ${fmt(cal)} kcal • Protein ${fmt(protein)} g • Lemak ~${fmt(fat)} g • Karbo ~${fmt(carb)} g</small><small>Faktor aktivitas bukan pengukuran. Perubahan target harus mengacu pada tren BB dan pemulihan.</small>`;
}
function handleProfile(event){event.preventDefault();const profile={name:$('#profileName').value.trim(),sex:$('#profileSex').value,age:num($('#profileAge').value),height:num($('#profileHeight').value),weight:num($('#profileWeight').value),goal:$('#profileGoal').value,activity:num($('#profileActivity').value),adjustment:num($('#profileAdjustment').value),weekly:num($('#profileWeekly').value),manualCalories:$('#manualCalToggle').checked,calories:num($('#profileCalories').value),protein:num($('#profileProtein').value)};
  if(!profile.name||profile.name.length>40||!['male','female'].includes(profile.sex)||!['cut','bulk','maintain'].includes(profile.goal)||profile.age<18||profile.age>100||profile.height<100||profile.height>240||profile.weight<20||profile.weight>400||!Number.isFinite(profile.calories)||profile.calories<1200||profile.calories>8000||profile.protein<0||profile.protein>500||profile.weekly<2||profile.weekly>6||![1.2,1.375,1.55,1.725].includes(profile.activity)){toast('Periksa kembali data profil dan target.',true);return;}
  const isNew=!state.profile;state.profile=profile;
  if(isNew && !state.weights.some(x=>x.date===today()))state.weights.push({date:today(),kg:profile.weight});
  if(save()){$('#profileDialog').close();renderAll();toast('Profil dan target disimpan. Selamat tracking!');}
}

function exportBackup(){const out={...state,exportedAt:new Date().toISOString(),app:'IBAM Track'};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ibam-track-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup JSON siap disimpan.');}
function isValidBackup(data){
  if(!data||typeof data!=='object'||data.version!==1||!data.profile||typeof data.profile!=='object')return false;
  const p=data.profile;if(typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!['male','female'].includes(p.sex)||!['cut','bulk','maintain'].includes(p.goal)||num(p.age)<18||num(p.age)>100||num(p.height)<100||num(p.height)>240||num(p.weight)<20||num(p.weight)>400||num(p.calories)<1200||num(p.calories)>8000||num(p.protein)<0||num(p.protein)>500||num(p.weekly)<2||num(p.weekly)>6||![1.2,1.375,1.55,1.725].includes(num(p.activity)))return false;
  if(!['customFoods','foodLogs','weights','sleep','workouts'].every(k=>Array.isArray(data[k])&&data[k].length<10000))return false;
  if(data.customExercises!==undefined&&(!Array.isArray(data.customExercises)||data.customExercises.length>=10000||!data.customExercises.every(n=>typeof n==='string'&&n.trim().length>0&&n.length<=80)))return false;
  const customs=data.customFoods;if(!customs.every(f=>typeof f.id==='string'&&f.id.startsWith('custom-')&&typeof f.name==='string'&&f.name.length<=75&&f.name.length>0&&['kcal','p','c','f'].every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=1000)&&typeof f.source==='string'&&f.source.length<=150))return false;
  const foodIds=new Set([...DEFAULT_FOODS,...customs].map(f=>f.id));
  if(!data.foodLogs.every(r=>typeof r.id==='string'&&foodIds.has(r.foodId)&&validDate(r.date)&&MEALS.includes(r.meal)&&Number.isFinite(r.grams)&&r.grams>0&&r.grams<=10000))return false;
  if(!data.weights.every(r=>validDate(r.date)&&Number.isFinite(r.kg)&&r.kg>=20&&r.kg<=400))return false;
  if(!data.sleep.every(r=>validDate(r.date)&&/^\d{2}:\d{2}$/.test(r.bed)&&/^\d{2}:\d{2}$/.test(r.wake)&&durationHours(r.bed,r.wake)>0&&durationHours(r.bed,r.wake)<=16&&typeof r.quality==='string'))return false;
  if(!data.workouts.every(r=>typeof r.id==='string'&&validDate(r.date)&&typeof r.exercise==='string'&&r.exercise.length>0&&r.exercise.length<=80&&typeof r.note==='string'&&r.note.length<=150&&Array.isArray(r.sets)&&r.sets.length>=1&&r.sets.length<=15&&r.sets.every(s=>Number.isFinite(s.weight)&&s.weight>=0&&s.weight<=1000&&Number.isInteger(s.reps)&&s.reps>=1&&s.reps<=200)))return false;
  return true;
}
async function importBackup(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>3*1024*1024){toast('File terlalu besar (maksimum 3 MB).',true);return;}try{const parsed=JSON.parse(await file.text());if(!isValidBackup(parsed)){toast('Format backup tidak cocok atau ada data yang tidak valid.',true);return;}if(!confirm('Impor akan MENGGANTI semua data lokal di perangkat ini. Sudah ekspor backup data lama?'))return;const prior=state;state={version:1,profile:parsed.profile,customFoods:parsed.customFoods,customExercises:parsed.customExercises||[],foodLogs:parsed.foodLogs,weights:parsed.weights,sleep:parsed.sleep,workouts:parsed.workouts};if(!save()){state=prior;return;}clearFoodEdit();clearWorkoutEdit();renderFoodOptions();renderAll();toast('Backup berhasil dipulihkan.');}catch(err){console.error(err);toast('Gagal membaca file backup JSON.',true);}}
function resetEverything(){const answer=prompt('Semua data akan DIHAPUS dari browser ini dan tidak bisa dikembalikan tanpa backup. Ketik HAPUS untuk melanjutkan:');if(answer!=='HAPUS')return;try{localStorage.removeItem(STORAGE_KEY);state=emptyState();clearFoodEdit();clearWorkoutEdit();renderFoodOptions();renderAll();openProfile();toast('Data lokal dihapus.');}catch(err){toast('Gagal menghapus data lokal.',true);}}

function handleActions(event){
  const nav=event.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,id=button.dataset.id,date=button.dataset.date;
  if(action==='edit-food'){
    const row=state.foodLogs.find(x=>x.id===id);if(!row)return;
    editingFoodId=id;$('#foodSearch').value='';renderFoodOptions();$('#foodDate').value=row.date;$('#foodSelect').value=row.foodId;$('#foodGrams').value=row.grams;$('#foodMeal').value=row.meal;$('#foodSubmit').textContent='Simpan perubahan';$('#cancelFoodEdit').classList.remove('hidden');renderFoodPreview();$('#foodForm').scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  if(action==='delete-food'){if(!confirm('Hapus catatan makanan ini?'))return;state.foodLogs=state.foodLogs.filter(x=>x.id!==id);if(editingFoodId===id)clearFoodEdit();if(save()){renderAll();toast('Catatan makanan dihapus.');}return;}
  if(action==='delete-custom'){if(state.foodLogs.some(x=>x.foodId===id)){toast('Makanan masih dipakai di log. Hapus log terkait dahulu.',true);return;}if(!confirm('Hapus makanan pribadi ini?'))return;state.customFoods=state.customFoods.filter(x=>x.id!==id);if(save()){renderFoodOptions();renderAll();toast('Makanan pribadi dihapus.');}return;}
  if(action==='delete-weight'){if(!confirm('Hapus penimbangan ini?'))return;state.weights=state.weights.filter(x=>x.date!==date);if(save()){renderAll();toast('Berat dihapus.');}return;}
  if(action==='delete-sleep'){if(!confirm('Hapus catatan tidur ini?'))return;state.sleep=state.sleep.filter(x=>x.date!==date);if(save()){renderAll();toast('Catatan tidur dihapus.');}return;}
  if(action==='remove-set'){const sets=currentSets();if(sets.length<=1){toast('Minimal satu set.',true);return;}sets.splice(Number(button.dataset.index),1);renderSetRows(sets);return;}
  if(action==='edit-workout'){
    const log=state.workouts.find(x=>x.id===id);if(!log)return;editingWorkoutId=id;$('#workoutDate').value=log.date;$('#exerciseName').value=log.exercise;$('#workoutNote').value=log.note;renderSetRows(log.sets);renderExerciseLastSets();$('#workoutSubmit').textContent='Simpan perubahan';$('#cancelWorkoutEdit').classList.remove('hidden');$('#workoutForm').scrollIntoView({behavior:'smooth',block:'start'});return;
  }
  if(action==='delete-workout'){if(!confirm('Hapus gerakan dan semua set-nya?'))return;state.workouts=state.workouts.filter(x=>x.id!==id);if(editingWorkoutId===id)clearWorkoutEdit();if(save()){renderAll();toast('Latihan dihapus.');}return;}
}
function bind(){
  document.addEventListener('click',handleActions);
  $('#foodForm').addEventListener('submit',handleFoodSubmit);
  $('#customFoodForm').addEventListener('submit',handleCustomSubmit);
  $('#foodSearch').addEventListener('input',event=>renderFoodOptions(event.target.value));
  $('#foodSelect').addEventListener('change',renderFoodPreview);
  $('#foodGrams').addEventListener('input',renderFoodPreview);
  $('#foodDate').addEventListener('change',renderFoods);
  $('#cancelFoodEdit').addEventListener('click',clearFoodEdit);
  $('#copyYesterday').addEventListener('click',()=>{const selected=$('#foodDate').value,prev=shiftDate(selected,-1),items=state.foodLogs.filter(x=>x.date===prev);if(!items.length){toast('Tidak ada makanan di tanggal sebelumnya.',true);return;}if(state.foodLogs.some(x=>x.date===selected)&&!confirm('Tanggal ini sudah ada makanan. Menyalin lagi dapat membuat duplikasi. Lanjut?'))return;state.foodLogs.push(...items.map(x=>({...x,id:makeId(),date:selected})));if(save()){renderAll();toast(`${items.length} makanan disalin dari ${dateLabel(prev)}.`);}});
  $('#weightForm').addEventListener('submit',handleWeight);
  $('#sleepForm').addEventListener('submit',handleSleep);
  $('#workoutForm').addEventListener('submit',handleWorkout);
  $('#exerciseName').addEventListener('input',renderExerciseLastSets);
  $('#workoutDate').addEventListener('change',renderExerciseLastSets);
  $('#addSet').addEventListener('click',()=>{const sets=currentSets();if(sets.length>=15){toast('Maksimal 15 set per gerakan.',true);return;}sets.push({...sets[sets.length-1]});renderSetRows(sets);});
  $('#cancelWorkoutEdit').addEventListener('click',clearWorkoutEdit);
  $('#profileForm').addEventListener('submit',handleProfile);
  $$('#profileForm input,#profileForm select').forEach(el=>{el.addEventListener('input',()=>{if(el.id==='profileProtein')el.dataset.touched='yes';updateProfileEstimate();});el.addEventListener('change',updateProfileEstimate);});
  $('#closeProfile').addEventListener('click',()=>{if(state.profile)$('#profileDialog').close();});
  $('#profileDialog').addEventListener('cancel',event=>{if(!state.profile)event.preventDefault();});
  $('#settingsEdit').addEventListener('click',openProfile);
  $('#openProfile').addEventListener('click',openProfile);
  $('#exportData').addEventListener('click',exportBackup);
  $('#importData').addEventListener('change',importBackup);
  $('#resetData').addEventListener('click',resetEverything);
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'beranda'));
}
function init(){const hint=document.createElement('p');hint.id='exerciseLastSets';hint.className='tiny-note';hint.setAttribute('aria-live','polite');$('#exerciseName').insertAdjacentElement('afterend',hint);const d=today();for(const id of ['foodDate','weightDate','sleepDate','workoutDate'])$('#'+id).value=d;renderSetRows([{weight:0,reps:10}]);renderFoodOptions();refreshExerciseIdeas();bind();navigate(location.hash.slice(1)||'beranda');if(state.profile)renderAll();else openProfile();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
