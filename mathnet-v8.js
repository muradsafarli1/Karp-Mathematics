/* KARP MathNet — Firebase-only client
   Runtime data source: Firestore.
   Hugging Face is used only by the one-time Admin MathNet Sync tool.
*/
const MATHNET_FIRESTORE={
  problems:'mathnetProblems',
  shards:'mathnetIndexShards',
  pools:'mathnetPools',
  meta:'mathnetMeta',
  state:'state',
  problemsV2:'mathnetProblemsV2',
  shardsV2:'mathnetIndexShardsV2'
};
let __mathnetIndexPromise=null;
let __mathnetCachePromise=null;

function mathnetCategory(row){return ['A','C','G','N'].includes(row?.category)?row.category:'A';}

async function mathnetRuntimeCollections(db,getDoc,doc){
  const snap=await getDoc(doc(db,MATHNET_FIRESTORE.meta,MATHNET_FIRESTORE.state));
  const state=snap.exists()?snap.data():{};
  if(state.activeNamespace==='v2'){
    return {problems:MATHNET_FIRESTORE.problemsV2,shards:MATHNET_FIRESTORE.shardsV2,state};
  }
  return {problems:MATHNET_FIRESTORE.problems,shards:MATHNET_FIRESTORE.shards,state};
}

function mathnetTitle(row){
  const competition=String(row?.competition||'MathNet').trim();
  const year=String(row?.year||'').trim();
  const problemNumber=String(row?.problemNumber||'').trim();
  const parts=[];
  if(year && !competition.includes(year))parts.push(year);
  if(problemNumber && !competition.toLowerCase().includes(problemNumber.toLowerCase()))parts.push(problemNumber);
  return parts.length?competition+' — '+parts.join(' · '):competition;
}

function mathnetMetaDb(){
  return new Promise((resolve)=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    const req=indexedDB.open('KARP_MATHNET_FIREBASE_CACHE',1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>resolve(null);
  });
}

async function mathnetCacheGet(key){
  const db=await mathnetMetaDb();if(!db)return null;
  return new Promise(resolve=>{
    const req=db.transaction('meta','readonly').objectStore('meta').get(key);
    req.onsuccess=()=>resolve(req.result?.value??null);
    req.onerror=()=>resolve(null);
  });
}

async function mathnetCacheSet(key,value){
  const db=await mathnetMetaDb();if(!db)return;
  await new Promise(resolve=>{
    const tx=db.transaction('meta','readwrite');
    tx.objectStore('meta').put({key,value});
    tx.oncomplete=resolve;tx.onerror=resolve;
  });
}

async function mathnetLoadAllIndex(onProgress,onInitial){
  if(__mathnetIndexPromise)return __mathnetIndexPromise;
  __mathnetIndexPromise=(async()=>{
    const {db}=await fb();
    const {doc,getDoc,collection,getDocs}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    const runtime=await mathnetRuntimeCollections(db,getDoc,doc);
    const state=runtime.state;
    const version=String(state.version||'');
    const cachedVersion=String(await mathnetCacheGet('version')||'');
    const cached=version&&cachedVersion===version?await mathnetCacheGet('index'):null;
    if(Array.isArray(cached)&&cached.length){
      const normalized=cached.map(x=>({...x,sourceType:'mathnet',category:mathnetCategory(x),title:x.title||mathnetTitle(x),hasSolution:true}));
      if(onInitial)onInitial(normalized);
      if(onProgress)onProgress(normalized.length,normalized.length,true,normalized.length);
      return normalized;
    }
    if(!state.ready)throw Object.assign(new Error('MathNet archive has not been synced to Firebase yet.'),{warmingUp:true});
    const snaps=await getDocs(collection(db,runtime.shards));
    const rows=[];
    snaps.forEach(s=>{
      const d=s.data();
      if(version && d.version!==version)return;
      (Array.isArray(d.items)?d.items:[]).forEach(x=>rows.push({...x,sourceType:'mathnet',category:mathnetCategory(x),title:x.title||mathnetTitle(x),hasSolution:true}));
    });
    rows.sort((a,b)=>{
      const ay=Number(a.year||0),by=Number(b.year||0);
      if(ay!==by)return by-ay;
      const c=String(a.country||'').localeCompare(String(b.country||''));
      if(c)return c;
      const cp=String(a.competition||'').localeCompare(String(b.competition||''));
      if(cp)return cp;
      return Number(a.sourceIndex||0)-Number(b.sourceIndex||0);
    });
    await mathnetCacheSet('version',version);
    await mathnetCacheSet('index',rows);
    if(onInitial)onInitial(rows);
    if(onProgress)onProgress(rows.length,rows.length,true,rows.length);
    return rows;
  })();
  try{return await __mathnetIndexPromise}finally{__mathnetIndexPromise=null;}
}

async function mathnetSearch(query,options={}){
  const rows=await mathnetLoadAllIndex();
  const q=String(query||'').trim().toLowerCase();
  const category=String(options.category||'').trim().toUpperCase();
  const difficulty=String(options.difficulty||'').trim().toLowerCase();
  return rows.filter(p=>{
    if(category&&p.category!==category)return false;
    if(difficulty&&difficulty!=='any'&&p.difficulty!==difficulty)return false;
    if(!q)return true;
    return [p.title,p.country,p.competition,p.year,p.problemNumber,p.section,p.sourceBooklet,p.bookletSource]
      .join(' ').toLowerCase().includes(q);
  }).slice(0,Math.min(1000,Math.max(1,Number(options.limit||200))));
}

async function mathnetProblemById(id){
  const target=String(id||'').trim();
  if(!target)return null;
  const {db}=await fb();
  const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const runtime=await mathnetRuntimeCollections(db,getDoc,doc);
  const snap=await getDoc(doc(db,runtime.problems,target));
  if(!snap.exists())return null;
  const x=snap.data();
  return {...x,id:snap.id,sourceType:'mathnet',category:mathnetCategory(x),title:x.title||mathnetTitle(x),hasSolution:true};
}

async function mathnetFind(options={}){
  const categories=Array.isArray(options.categories)&&options.categories.length
    ?options.categories.map(x=>String(x).toUpperCase()).filter(x=>['A','C','G','N'].includes(x))
    :['A','C','G','N'];
  const count=Math.max(1,Math.min(30,Number(options.count||6)));
  const difficulty=String(options.difficulty||'any').toLowerCase();
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count
    ?options.sequence.map(x=>String(x).toUpperCase()).filter(x=>['A','C','G','N'].includes(x))
    :null;
  const wanted=sequence&&sequence.length===count?sequence:Array.from({length:count},(_,i)=>categories[i%categories.length]);
  const excludeIds=new Set(Array.isArray(options.excludeIds)?options.excludeIds.map(String):[]);
  const allowFallback=options.allowFallback!==false;

  // Use the Firebase shard index for random selection. This avoids composite
  // Firestore queries and keeps mock generation entirely on the Firebase runtime DB.
  const index=await mathnetLoadAllIndex();
  const used=new Set(excludeIds);
  const selected=[];

  function candidates(cat){
    return index.filter(p=>{
      if(p.category!==cat)return false;
      if((difficulty==='easy'||difficulty==='hard')&&p.difficulty!==difficulty)return false;
      return !used.has(String(p.id));
    });
  }

  function pick(cat){
    const docs=candidates(cat);
    if(!docs.length)return null;
    return docs[Math.floor(Math.random()*docs.length)]||null;
  }

  for(const cat of wanted){
    const chosen=pick(cat);
    if(chosen){used.add(String(chosen.id));selected.push(chosen.id)}
  }

  if(allowFallback && selected.length<count){
    for(const cat of categories){
      if(selected.length>=count)break;
      const docs=candidates(cat);
      for(const d of docs){
        if(!used.has(String(d.id))){
          used.add(String(d.id));
          selected.push(d.id);
          if(selected.length>=count)break;
        }
      }
    }
  }

  const {db}=await fb();
  const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const runtime=await mathnetRuntimeCollections(db,getDoc,doc);
  const questions=[];
  for(const id of selected){
    const snap=await getDoc(doc(db,runtime.problems,id));
    if(snap.exists()){
      const q=snap.data();
      questions.push({...q,id:snap.id,sourceType:'mathnet',category:mathnetCategory(q),title:q.title||mathnetTitle(q),hasSolution:true});
    }
  }
  return {questions,total:questions.length,source:'ShadenA/MathNet'};
}
function mathnetSaveMock(mock){window.__karpLastMock=mock;return mock}
function mathnetLoadMock(){return window.__karpLastMock||null}


async function mathnetLoadIndexPage(page=0,pageSize=1500){
  const safePage=Math.max(0,Number(page)||0);
  const size=Math.max(1,Math.min(1500,Number(pageSize)||1500));
  const {db}=await fb();
  const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const runtime=await mathnetRuntimeCollections(db,getDoc,doc);
  const state=runtime.state;
  if(!state.ready)throw Object.assign(new Error('MathNet archive has not been synced to Firebase yet.'),{warmingUp:true});
  const version=String(state.version||'');
  const shardSize=300;
  const start=safePage*size;
  const end=Math.min(Number(state.count||0),start+size);
  if(start>=end)return {rows:[],page:safePage,pageSize:size,total:Number(state.count||0),hasNext:false,hasPrevious:safePage>0};
  const firstShard=Math.floor(start/shardSize);
  const lastShard=Math.floor((end-1)/shardSize);
  const snaps=await Promise.all(Array.from({length:lastShard-firstShard+1},(_,i)=>
    getDoc(doc(db,runtime.shards,'shard-'+String(firstShard+i).padStart(4,'0')))
  ));
  const rows=[];
  snaps.forEach(s=>{
    if(!s.exists())return;
    const d=s.data();
    if(version && d.version!==version)return;
    (Array.isArray(d.items)?d.items:[]).forEach(x=>{
      const index=Number(x?.sourceIndex??-1);
      if(index>=start && index<end)rows.push({...x,sourceType:'mathnet',category:mathnetCategory(x),title:x.title||mathnetTitle(x),hasSolution:true});
    });
  });
  rows.sort((a,b)=>Number(a.sourceIndex||0)-Number(b.sourceIndex||0));
  return {rows,page:safePage,pageSize:size,total:Number(state.count||0),hasNext:end<Number(state.count||0),hasPrevious:safePage>0};
}

window.mathnetLoadAllIndex=mathnetLoadAllIndex;
window.mathnetLoadIndexPage=mathnetLoadIndexPage;
window.mathnetSearch=mathnetSearch;
window.mathnetFind=mathnetFind;
window.mathnetProblemById=mathnetProblemById;
window.mathnetSaveMock=mathnetSaveMock;
window.mathnetLoadMock=mathnetLoadMock;
