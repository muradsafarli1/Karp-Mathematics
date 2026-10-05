/* KARP MathNet — internal static archive runtime
   Runtime archive source: KARP Firebase Hosting (/data/mathnet).
   Firestore is NOT used for MathNet archive reads.
*/
const MATHNET_STATIC={
  index:'/data/mathnet/index.json',
  manifest:'/data/mathnet/manifest.json'
};

let __mathnetIndexPromise=null;
let __mathnetIndexCache=null;
const __mathnetChunkCache=new Map();
let __mathnetManifestPromise=null;

function mathnetCategory(row){
  return ['A','C','G','N'].includes(row?.category)?row.category:'A';
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

async function mathnetFetchJson(url,options={}){
  const res=await fetch(url,{cache:'force-cache',...options,headers:{Accept:'application/json',...(options.headers||{})}});
  if(!res.ok)throw new Error('KARP MathNet archive request failed ('+res.status+').');
  return res.json();
}

async function mathnetLoadManifest(){
  if(!__mathnetManifestPromise){
    __mathnetManifestPromise=mathnetFetchJson(MATHNET_STATIC.manifest,{cache:'no-cache'})
      .catch(()=>({}));
  }
  return __mathnetManifestPromise;
}

function mathnetNormalizeIndex(rows){
  return (Array.isArray(rows)?rows:[]).map(x=>({
    ...x,
    id:String(x?.id||''),
    sourceType:'mathnet',
    category:mathnetCategory(x),
    title:x?.title||mathnetTitle(x),
    hasSolution:true
  })).filter(x=>x.id);
}

async function mathnetLoadAllIndex(onProgress,onInitial){
  if(Array.isArray(__mathnetIndexCache)){
    if(onInitial)onInitial(__mathnetIndexCache);
    if(onProgress)onProgress(__mathnetIndexCache.length,__mathnetIndexCache.length,true,__mathnetIndexCache.length);
    return __mathnetIndexCache;
  }
  if(__mathnetIndexPromise)return __mathnetIndexPromise;
  __mathnetIndexPromise=(async()=>{
    const manifest=await mathnetLoadManifest();
    const version=String(manifest?.generatedAt||manifest?.version||'static');
    const data=await mathnetFetchJson(MATHNET_STATIC.index+'?v='+encodeURIComponent(version));
    const rows=mathnetNormalizeIndex(data);
    if(!rows.length)throw new Error('The internal KARP MathNet archive is empty or unavailable.');
    // Older generated indexes may predate the dataFile field. The exporter
    // writes chunks in this exact 100-row order, so safely reconstruct it.
    rows.forEach((row,i)=>{
      if(!row.dataFile) row.dataFile='/data/mathnet/chunks/'+String(Math.floor(i/100)+1).padStart(4,'0')+'.json';
    });
    __mathnetIndexCache=rows;
    if(onInitial)onInitial(rows);
    if(onProgress)onProgress(rows.length,rows.length,true,rows.length);
    return rows;
  })();
  try{return await __mathnetIndexPromise}
  finally{__mathnetIndexPromise=null;}
}

async function mathnetLoadChunk(file){
  const path=String(file||'').trim();
  if(!path)return [];
  if(__mathnetChunkCache.has(path))return __mathnetChunkCache.get(path);
  const promise=mathnetFetchJson(path);
  __mathnetChunkCache.set(path,promise);
  try{
    const data=await promise;
    const rows=Array.isArray(data)?data:[];
    return rows;
  }catch(e){
    __mathnetChunkCache.delete(path);
    throw e;
  }
}

async function mathnetProblemById(id){
  const target=String(id||'').trim();
  if(!target)return null;
  const index=await mathnetLoadAllIndex();
  const row=index.find(x=>String(x.id)===target);
  if(!row)return null;
  const chunk=await mathnetLoadChunk(row.dataFile);
  const doc=chunk.find(x=>String(x?.id||'')===target);
  if(!doc)return null;
  return {
    ...doc,
    ...row,
    id:target,
    sourceType:'mathnet',
    category:mathnetCategory(doc.category||row.category),
    title:doc.title||row.title||mathnetTitle(doc),
    hasSolution:true
  };
}

async function mathnetSearch(query,options={}){
  const rows=await mathnetLoadAllIndex();
  const q=String(query||'').trim().toLowerCase();
  const category=String(options.category||'').trim().toUpperCase();
  const difficulty=String(options.difficulty||'').trim().toLowerCase();
  return rows.filter(p=>{
    if(category&&p.category!==category)return false;
    if(difficulty&&difficulty!=='any'&&String(p.difficulty||'').toLowerCase()!==difficulty)return false;
    if(!q)return true;
    return [
      p.title,p.country,p.competition,p.year,p.problemNumber,p.section,
      p.sourceBooklet,p.bookletSource,p.problemType,p.language
    ].join(' ').toLowerCase().includes(q);
  }).slice(0,Math.min(1000,Math.max(1,Number(options.limit||200))));
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

  const index=await mathnetLoadAllIndex();
  const used=new Set(excludeIds);
  const selected=[];

  function candidates(cat){
    return index.filter(p=>{
      if(p.category!==cat)return false;
      if((difficulty==='easy'||difficulty==='hard')&&String(p.difficulty||'').toLowerCase()!==difficulty)return false;
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
    if(chosen){used.add(String(chosen.id));selected.push(chosen.id);}
  }

  if(allowFallback&&selected.length<count){
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

  const byFile=new Map();
  for(const id of selected){
    const row=index.find(x=>String(x.id)===String(id));
    if(!row?.dataFile)continue;
    if(!byFile.has(row.dataFile))byFile.set(row.dataFile,[]);
    byFile.get(row.dataFile).push(row);
  }

  const resolved=new Map();
  for(const [file,rows] of byFile){
    const chunk=await mathnetLoadChunk(file);
    const wantedIds=new Set(rows.map(x=>String(x.id)));
    for(const doc of chunk){
      if(wantedIds.has(String(doc?.id||'')))resolved.set(String(doc.id),doc);
    }
  }

  const questions=[];
  for(const id of selected){
    const row=index.find(x=>String(x.id)===String(id));
    const doc=resolved.get(String(id));
    if(!row||!doc)continue;
    questions.push({
      ...doc,
      ...row,
      id:String(id),
      sourceType:'mathnet',
      category:mathnetCategory(doc.category||row.category),
      title:doc.title||row.title||mathnetTitle(doc),
      hasSolution:true
    });
  }

  return {questions,total:questions.length,source:'KARP internal MathNet archive'};
}

function mathnetSaveMock(mock){window.__karpLastMock=mock;return mock;}
function mathnetLoadMock(){return window.__karpLastMock||null;}

window.mathnetLoadAllIndex=mathnetLoadAllIndex;
window.mathnetSearch=mathnetSearch;
window.mathnetFind=mathnetFind;
window.mathnetProblemById=mathnetProblemById;
window.mathnetSaveMock=mathnetSaveMock;
window.mathnetLoadMock=mathnetLoadMock;
