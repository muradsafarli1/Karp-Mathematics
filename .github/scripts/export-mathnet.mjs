import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ID = 'able-2ca24';
const API_KEY = 'AIzaSyAjEd4pN33WpoJlT2rsAgDFMO3A4Uh-M4s';
const BASE = 'https://firestore.googleapis.com/v1';
const ROOT = path.resolve('data/mathnet');
const CHUNK_SIZE = 100;

async function fetchJson(url){
  const res = await fetch(url);
  const text = await res.text();
  if(!res.ok) throw new Error(`Firestore REST ${res.status}: ${text.slice(0,500)}`);
  return JSON.parse(text);
}
function decodeValue(v){
  if(!v || typeof v!=='object') return null;
  if('stringValue' in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue;
  if('nullValue' in v) return null;
  if('timestampValue' in v) return v.timestampValue;
  if('referenceValue' in v) return v.referenceValue;
  if('bytesValue' in v) return v.bytesValue;
  if('geoPointValue' in v) return {latitude:v.geoPointValue.latitude,longitude:v.geoPointValue.longitude};
  if('arrayValue' in v) return (v.arrayValue.values||[]).map(decodeValue);
  if('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decodeValue(x)]));
  return null;
}
function decodeDoc(doc){
  const id=decodeURIComponent(String(doc.name||'').split('/').pop());
  return {id,...Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,decodeValue(v)]))};
}
async function listCollection(collection){
  const docs=[];
  let token='';
  do{
    const q=new URLSearchParams({pageSize:'1000',key:API_KEY});
    if(token) q.set('pageToken',token);
    const url=`${BASE}/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?${q}`;
    const data=await fetchJson(url);
    for(const d of (data.documents||[])) docs.push(decodeDoc(d));
    token=data.nextPageToken||'';
  }while(token);
  return docs;
}
function normalizeCategory(x){
  const c=String(x?.category||'A').toUpperCase();
  return ['A','C','G','N'].includes(c)?c:'A';
}
function titleFor(x){
  const competition=String(x?.competition||'MathNet').trim();
  const year=String(x?.year||'').trim();
  const problemNumber=String(x?.problemNumber||'').trim();
  const parts=[];
  if(year && !competition.includes(year)) parts.push(year);
  if(problemNumber && !competition.toLowerCase().includes(problemNumber.toLowerCase())) parts.push(problemNumber);
  return parts.length?competition+' — '+parts.join(' · '):competition;
}
function byId(a,b){return String(a.id).localeCompare(String(b.id));}

const state=decodeDoc(await fetchJson(`${BASE}/projects/${PROJECT_ID}/databases/(default)/documents/mathnetMeta/state?key=${API_KEY}`));
const activeNamespace=state.activeNamespace==='v2'?'v2':'v1';
const problemsCollection=activeNamespace==='v2'?'mathnetProblemsV2':'mathnetProblems';
const shardsCollection=activeNamespace==='v2'?'mathnetIndexShardsV2':'mathnetIndexShards';
const version=String(state.version||'');

const [shards,fullDocs]=await Promise.all([
  listCollection(shardsCollection).catch(async()=>{
    const fallback=activeNamespace==='v2'?'mathnetIndexShards':'mathnetIndexShardsV2';
    return listCollection(fallback);
  }),
  listCollection(problemsCollection)
]);

if(process.env.CHECK_OTHER_NAMESPACE==='1'){
  const otherProblemsCollection=activeNamespace==='v2'?'mathnetProblems':'mathnetProblemsV2';
  const otherDocs=await listCollection(otherProblemsCollection);
  console.log(`Namespace check: ${problemsCollection}=${fullDocs.length}, ${otherProblemsCollection}=${otherDocs.length}, active=${activeNamespace}, version=${version||'(none)'}`);
}

const byProblemId=new Map(fullDocs.map(x=>[String(x.id),x]));
const index=[];
for(const shard of shards.sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(version && String(shard.version||'')!==version) continue;
  for(const item of (Array.isArray(shard.items)?shard.items:[])){
    const id=String(item.id??item.problemId??'').trim();
    if(!id || !byProblemId.has(id)) continue;
    if(!index.some(x=>String(x.id)===id)){
      index.push({
        ...item,
        id,
        sourceType:'mathnet',
        category:normalizeCategory(item),
        title:item.title||titleFor(item)
      });
    }
  }
}
for(const doc of fullDocs){
  if(!index.some(x=>String(x.id)===String(doc.id))){
    index.push({
      id:doc.id, sourceType:'mathnet', category:normalizeCategory(doc),
      title:doc.title||titleFor(doc),
      country:doc.country||'', competition:doc.competition||'', year:doc.year||'',
      problemNumber:doc.problemNumber||'', section:doc.section||'',
      difficulty:doc.difficulty||'', language:doc.language||'',
      problemType:doc.problemType||''
    });
  }
}
index.sort((a,b)=>{
  const ay=Number(a.year||0),by=Number(b.year||0);
  if(ay!==by)return by-ay;
  const c=String(a.country||'').localeCompare(String(b.country||''));
  if(c)return c;
  const cp=String(a.competition||'').localeCompare(String(b.competition||''));
  if(cp)return cp;
  return Number(a.sourceIndex||0)-Number(b.sourceIndex||0);
});

await fs.rm(ROOT,{recursive:true,force:true});
await fs.mkdir(path.join(ROOT,'chunks'),{recursive:true});

for(let i=0;i<index.length;i+=CHUNK_SIZE){
  const chunk=index.slice(i,i+CHUNK_SIZE).map(row=>byProblemId.get(String(row.id))).filter(Boolean);
  const file=`chunks/${String(Math.floor(i/CHUNK_SIZE)+1).padStart(4,'0')}.json`;
  for(const row of index.slice(i,i+CHUNK_SIZE)) row.dataFile='/data/mathnet/'+file;
  await fs.writeFile(path.join(ROOT,file),JSON.stringify(chunk));
}
await fs.writeFile(path.join(ROOT,'index.json'),JSON.stringify(index));
await fs.writeFile(path.join(ROOT,'manifest.json'),JSON.stringify({
  generatedAt:new Date().toISOString(),
  activeNamespace,
  problemsCollection,
  shardsCollection,
  version,
  total:index.length,
  chunkSize:CHUNK_SIZE,
  source:'KARP Firebase archive export'
},null,2));

const uniqueIds=new Set(index.map(x=>String(x.id)));
if(uniqueIds.size!==index.length) throw new Error(`Export validation failed: duplicate IDs (${index.length} rows, ${uniqueIds.size} unique).`);
if(index.length!==fullDocs.length) throw new Error(`Export validation failed: index=${index.length}, fullDocs=${fullDocs.length}.`);
console.log(`Exported ${index.length} MathNet problems from ${problemsCollection} into static KARP data.`);
console.log(`Validation OK: ${uniqueIds.size} unique IDs, ${Math.ceil(index.length/CHUNK_SIZE)} chunks.`);
