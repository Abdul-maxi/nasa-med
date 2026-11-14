const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || '';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'state.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const baseline = [
  { id:'vance', name:'Cmdr. Elena Vance', anonId:'SUBJ-ART4-01 [HASH: 7F3A]', initials:'EV', anonInitials:'S1', role:'Mission Commander', anonRole:'Crew Role: Redacted (RBAC)', activity:'EVA Spacewalk (Airlock B)', avatarBg:'from-cyan-500 to-blue-600', status:'NOMINAL', hr:88, spo2:98.4, resp:17, temp:37.1, hydration:91, radTotal:124.6, radRate:0.94, bpSys:124, bpDia:78, hrv:58, boneIndex:97.8, bmdLoss:'-1.4%', aredQuota:'100% Quota', sleepHours:7.5, iop:15.1, cogScore:97, suitPressure:29.6, co2:0.31, suitStatus:'EVA SUIT NOMINAL', countermeasures:[
    {id:'c1',text:'Verify EMU suit sublimator cooling loop flow (2.1 L/min)',done:true,effect:'temp'},
    {id:'c2',text:'Administer 350 mL electrolyte drink via in-suit drink bag',done:false,effect:'hydration'},
    {id:'c3',text:'Monitor EVA metabolic workload (< 300 kcal/hr threshold)',done:true,effect:'hr'}
  ]},
  { id:'thorne', name:'Dr. Marcus Thorne', anonId:'SUBJ-ART4-02 [HASH: 2B9E]', initials:'MT', anonInitials:'S2', role:'Flight Surgeon / Payload', anonRole:'Crew Role: Redacted (RBAC)', activity:'Microgravity Exercise (ARED)', avatarBg:'from-emerald-500 to-teal-600', status:'ADVISORY', hr:118, spo2:97.6, resp:22, temp:37.5, hydration:84, radTotal:116.2, radRate:0.78, bpSys:136, bpDia:82, hrv:44, boneIndex:98.5, bmdLoss:'-0.9%', aredQuota:'115% Quota', sleepHours:7.2, iop:15.8, cogScore:95, suitPressure:101.3, co2:0.29, suitStatus:'HABITAT NODE 2', countermeasures:[
    {id:'t1',text:'Complete post-ARED 500 mL sodium-potassium rehydration bolus',done:false,effect:'hydration'},
    {id:'t2',text:'Initiate 5-minute parasympathetic recovery breathing protocol',done:false,effect:'hr'},
    {id:'t3',text:'Log lumbar & femoral resistive load telemetry to NASA HRP',done:true,effect:'bone'}
  ]},
  { id:'sato', name:'Eng. Kenji Sato', anonId:'SUBJ-ART4-03 [HASH: 9D1C]', initials:'KS', anonInitials:'S3', role:'Flight Systems Engineer', anonRole:'Crew Role: Redacted (RBAC)', activity:'ECLSS & Avionics Inspection', avatarBg:'from-amber-500 to-orange-600', status:'NOMINAL', hr:68, spo2:99.1, resp:13, temp:36.8, hydration:94, radTotal:121.0, radRate:0.81, bpSys:116, bpDia:74, hrv:71, boneIndex:96.9, bmdLoss:'-2.1%', aredQuota:'95% Quota', sleepHours:7.8, iop:14.9, cogScore:98, suitPressure:101.3, co2:0.26, suitStatus:'HABITAT CORE', countermeasures:[
    {id:'s1',text:'Schedule 45-min ARED squat/deadlift session at 16:00 MET',done:false,effect:'bone'},
    {id:'s2',text:'Daily Vitamin D3 (800 IU) & calcium citrate supplement',done:true,effect:'bone'},
    {id:'s3',text:'Calibrate personal dosimeter badge against TEPC sensor',done:true,effect:'rad'}
  ]},
  { id:'lin', name:'Spec. Maya Lin', anonId:'SUBJ-ART4-04 [HASH: 4E8B]', initials:'ML', anonInitials:'S4', role:'Astrobiology Specialist', anonRole:'Crew Role: Redacted (RBAC)', activity:'Circadian Sleep Cycle (Crew Qtrs)', avatarBg:'from-indigo-500 to-purple-600', status:'NOMINAL', hr:56, spo2:98.9, resp:12, temp:36.5, hydration:93, radTotal:112.8, radRate:0.76, bpSys:110, bpDia:68, hrv:82, boneIndex:97.5, bmdLoss:'-1.5%', aredQuota:'100% Quota', sleepHours:8.1, iop:16.4, cogScore:96, suitPressure:101.3, co2:0.25, suitStatus:'SLEEP BAY 1', countermeasures:[
    {id:'l1',text:'Maintain blue-depleted 450nm circadian lighting in sleep bay',done:true,effect:'sleep'},
    {id:'l2',text:'Perform Optical Coherence Tomography (OCT) SANS scan on wake',done:false,effect:'sleep'},
    {id:'l3',text:'Lower-body negative pressure (LBNP) fluid shift session',done:false,effect:'hr'}
  ]}
];

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function initialState() {
  return { crew: clone(baseline), mission: { activeAnomaly:null, sessionKeyId:'SDLS-K256-09F4A', isAnonymizedView:false, selectedCrewId:'vance', recentLogs:[], updatedAt:new Date().toISOString() } };
}
function loadState() {
  fs.mkdirSync(DATA_DIR, {recursive:true});
  if (!fs.existsSync(DB_FILE)) { const s=initialState(); fs.writeFileSync(DB_FILE, JSON.stringify(s,null,2)); return s; }
  try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { const s=initialState(); fs.writeFileSync(DB_FILE, JSON.stringify(s,null,2)); return s; }
}
let state = loadState();
const clients = new Set();

function saveState() { fs.writeFileSync(DB_FILE, JSON.stringify(state,null,2)); }
function json(res, status, body) { const data=JSON.stringify(body); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}); res.end(data); }
function noContent(res) { res.writeHead(204, {'Access-Control-Allow-Origin':'*'}); res.end(); }
function parseBody(req) { return new Promise((resolve,reject)=>{ let b=''; req.on('data',c=>{b+=c;if(b.length>2e6) reject(new Error('Payload too large'));}); req.on('end',()=>{ if(!b)return resolve({}); try{resolve(JSON.parse(b));}catch(e){reject(e);} }); req.on('error',reject); }); }
function authOK(req) { return !API_KEY || req.headers.authorization === `Bearer ${API_KEY}` || req.headers['x-api-key'] === API_KEY; }
function broadcast(event, payload) { const msg=`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of clients) res.write(msg); }
function touch() { state.mission.updatedAt=new Date().toISOString(); saveState(); }

function route(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-API-Key'}); return res.end(); }
  if (!authOK(req)) return json(res,401,{error:'Unauthorized'});
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res,200,{ok:true,service:'ASTRA-MED Telemetry Backend',version:'1.0.0',time:new Date().toISOString()});
  if (url.pathname === '/api/crew' && req.method === 'GET') return json(res,200,{crew:clone(state.crew),count:state.crew.length});
  const cm=url.pathname.match(/^\/api\/crew\/([^/]+)$/);
  if (cm) {
    const id=cm[1]; const idx=state.crew.findIndex(c=>c.id===id); if(idx<0)return json(res,404,{error:'Crew member not found'});
    if(req.method==='GET') return json(res,200,state.crew[idx]);
    if(req.method==='PUT') return parseBody(req).then(body=>{ state.crew[idx]={...state.crew[idx],...body,id}; touch(); const out=clone(state.crew[idx]); broadcast('crew.updated',out); return json(res,200,out); }).catch(e=>json(res,400,{error:e.message}));
  }
  if (url.pathname === '/api/crew/reset' && req.method === 'POST') { state.crew=clone(baseline); state.mission.activeAnomaly=null; state.mission.recentLogs=[]; touch(); broadcast('state.reset',state); return json(res,200,{ok:true,state:clone(state)}); }
  if (url.pathname === '/api/mission-control' && req.method === 'GET') return json(res,200,clone(state.mission));
  if (url.pathname === '/api/mission-control' && req.method === 'PUT') return parseBody(req).then(body=>{ state.mission={...state.mission,...body,updatedAt:new Date().toISOString()}; saveState(); broadcast('mission.updated',clone(state.mission)); return json(res,200,clone(state.mission)); }).catch(e=>json(res,400,{error:e.message}));
  if (url.pathname === '/api/logs' && req.method === 'POST') return parseBody(req).then(entry=>{ state.mission.recentLogs=[{id:crypto.randomUUID(),timestamp:new Date().toISOString().substring(11,19),...entry},...state.mission.recentLogs].slice(0,18); touch(); broadcast('mission.updated',clone(state.mission)); return json(res,201,state.mission.recentLogs[0]); }).catch(e=>json(res,400,{error:e.message}));
  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});
    res.write(`event: state.initial\ndata: ${JSON.stringify(state)}\n\n`); clients.add(res); req.on('close',()=>clients.delete(res)); return;
  }
  return null;
}

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  try {
    const handled=route(req,res,url); if(handled!==null) return;
    if(req.method!=='GET') return json(res,404,{error:'Not found'});
    let filePath=path.join(PUBLIC_DIR,url.pathname==='/'?'index.html':url.pathname);
    if(!filePath.startsWith(PUBLIC_DIR)) return json(res,403,{error:'Forbidden'});
    if(!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return json(res,404,{error:'Not found'});
    const ext=path.extname(filePath); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'}); fs.createReadStream(filePath).pipe(res);
  } catch(e) { console.error(e); if(!res.headersSent) json(res,500,{error:'Internal server error'}); }
});
server.listen(PORT,HOST,()=>console.log(`ASTRA-MED backend listening on http://localhost:${PORT}`));
