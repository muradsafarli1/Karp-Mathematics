/* KARP MathNet archive.
   MathNet provides Olympiad problems with solutions; KARP keeps only English
   rows whose supplied solution type is proof-only or proof-and-answer. */

const MATHNET={
  dataset:'ShadenA/MathNet',
  config:'all',
  split:'train',
  endpoint:'https://datasets-server.huggingface.co/rows',
  maxRows:30676
};

const MATHNET_DB_NAME='KARP_MATHNET_ARCHIVE';
const MATHNET_DB_VERSION=1;
const MATHNET_STORE='problems';
const MATHNET_META='meta';
const MATHNET_INFLIGHT=new Map();
let __mathnetAllPromise=null;

function mathnetCategory(row){
  const paths=(Array.isArray(row.topics_flat)?row.topics_flat:[]).join(' ').toLowerCase();
  const text=String(row.problem_markdown||'').toLowerCase();
  const rules=[
    ['G',/(geometry|triangle|circle|angle|polygon|quadrilateral|concyclic|similarity|incircle|circumcircle)/],
    ['N',/(number theory|divisib|prime|integer|diophant|congruence|modular|gcd|lcm|factor|remainder)/],
    ['C',/(combinatorics|counting|graph theory|permutation|combination|pigeonhole|invariant|coloring|probability)/],
    ['A',/(algebra|equation|polynomial|inequal|functional equation|sequence|series|absolute value)/]
  ];
  for(const pair of rules)if(pair[1].test(paths)||pair[1].test(text))return pair[0];
  return 'A';
}

function mathnetType(row){
  const t=String(row.problem_type||'').trim().toLowerCase();
  if(t.includes('proof and answer'))return'proof-answer';
  if(t==='proof only'||t==='proof')return'proof';
  if(t.includes('answer'))return'answer';
  return'';
}

function mathnetDifficulty(row){
  const text=String(row.problem_markdown||'');
  const topics=Array.isArray(row.topics_flat)?row.topics_flat.length:0;
  const competition=String(row.competition||'').toLowerCase();
  let score=Math.min(4,Math.floor(text.length/900))+Math.min(2,Math.max(0,topics-1));
  if(/imo|shortlist|tst|olympiad/.test(competition))score++;
  return score>=3?'hard':'easy';
}

function mathnetImages(row){
  const imgs=Array.isArray(row.images)?row.images:[];
  return imgs.map(x=>typeof x==='string'?x:x?.src||'').filter(Boolean);
}

function mathnetMarkdown(row,withImages){
  let md=String(row.problem_markdown||'').trim();
  if(withImages){
    const imgs=mathnetImages(row);
    md=md.replace(/!\[([^\]]*)\]\(attached_image_(\d+)\.png\)/g,function(_,alt,n){
      const src=imgs[Number(n)-1];
      return src?'!['+(alt||'Figure')+']('+src+')':'';
    });
  }else{
    md=md.replace(/!\[([^\]]*)\]\(attached_image_(\d+)\.png\)/g,'');
  }
  return md;
}

function mathnetYear(row){
  if(row.year!=null&&String(row.year).trim())return String(row.year).trim();
  const text=[
    String(row.source_booklet||''),
    String(row.booklet_source||''),
    String(row.competition||'')
  ].join(' ');
  const m=text.match(/(?:^|[^0-9])(19\d{2}|20\d{2})(?:[^0-9]|$)/);
  return m?m[1]:'';
}

function mathnetProblemNumber(row){
  if(row.problem_number!=null&&String(row.problem_number).trim()){
    const value=String(row.problem_number).trim();
    return /^P/i.test(value)?value:'P'+value;
  }
  const text=(String(row.problem_markdown||'')+' '+String(row.original_problem_markdown||''))
    .replace(/<[^>]+>/g,' ').trim();
  const patterns=[
    /(?:^|\n)\s*(?:#+\s*)?(?:problem|question|p)\s*#?\s*(\d{1,2})\b/i,
    /(?:^|\n)\s*\*{0,2}\s*(\d{1,2})\s*[\.)]\s*/,
    /\bP\s*([1-9]\d?)\b/i
  ];
  for(const re of patterns){
    const m=text.match(re);
    if(m)return'P'+m[1];
  }
  return'';
}

function mathnetCompetition(row){return String(row.competition||'').trim()||'MathNet';}

function mathnetDisplayTitle(row){
  const competition=mathnetCompetition(row);
  const year=mathnetYear(row);
  const problemNumber=mathnetProblemNumber(row);
  const extra=[year,problemNumber].filter(Boolean);
  return competition+(extra.length?' — '+extra.join(' · '):'');
}

function normalizeMathnetRow(raw,offset,sourceConfig,forCache){
  const row=raw&&raw.row?raw.row:(raw||{});
  const index=raw&&raw.row_idx!=null?Number(raw.row_idx):Number(offset||0);
  const id=String(row.unique_id||row.id||('mathnet-'+index));
  const solutions=Array.isArray(row.solutions_markdown)?row.solutions_markdown.map(x=>String(x||'').trim()).filter(Boolean):[];
  return{
    id:id,
    country:String(row.country||'').trim(),
    competition:mathnetCompetition(row),
    year:mathnetYear(row),
    section:String(row.section||'').trim(),
    problemNumber:mathnetProblemNumber(row),
    sourceBooklet:String(row.source_booklet||'').trim(),
    bookletSource:String(row.booklet_source||'').trim(),
    language:String(row.language||'').trim(),
    problemType:String(row.problem_type||'').trim(),
    statement:mathnetMarkdown(row,!forCache),
    solutions:solutions,
    category:mathnetCategory(row),
    type:mathnetType(row),
    difficulty:mathnetDifficulty(row),
    hasSolution:solutions.length>0,
    sourceConfig:String(sourceConfig||MATHNET.config),
    sourceIndex:index,
    title:mathnetDisplayTitle(row),
    finalAnswer:row.final_answer==null?'':String(row.final_answer||'')
  };
}

function mathnetQualifies(row){
  const language=String(row.language||'').toLowerCase();
  const type=String(row.problemType||'').toLowerCase();
  return (language==='english'||language==='en'||language.startsWith('en-'))
    &&row.hasSolution
    &&(type==='proof only'||type==='proof and answer')
    &&String(row.statement||'').trim().length>0;
}

function openMathnetDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    const req=indexedDB.open(MATHNET_DB_NAME,MATHNET_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(MATHNET_STORE)){
        const store=db.createObjectStore(MATHNET_STORE,{keyPath:'id'});
        store.createIndex('year','year',{unique:false});
        store.createIndex('category','category',{unique:false});
        store.createIndex('country','country',{unique:false});
      }
      if(!db.objectStoreNames.contains(MATHNET_META))db.createObjectStore(MATHNET_META,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>resolve(null);
  });
}

async function dbGetAll(){
  const db=await openMathnetDB();
  if(!db)return[];
  return await new Promise(resolve=>{
    const tx=db.transaction(MATHNET_STORE,'readonly');
    const req=tx.objectStore(MATHNET_STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>resolve([]);
  });
}

async function dbMeta(key){
  const db=await openMathnetDB();
  if(!db)return null;
  return await new Promise(resolve=>{
    const tx=db.transaction(MATHNET_META,'readonly');
    const req=tx.objectStore(MATHNET_META).get(key);
    req.onsuccess=()=>resolve(req.result?.value??null);
    req.onerror=()=>resolve(null);
  });
}

async function dbPutBatch(rows){
  const db=await openMathnetDB();
  if(!db)return false;
  return await new Promise(resolve=>{
    const tx=db.transaction(MATHNET_STORE,'readwrite');
    const store=tx.objectStore(MATHNET_STORE);
    rows.forEach(row=>store.put(row));
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>resolve(false);
  });
}

async function dbSetMeta(key,value){
  const db=await openMathnetDB();
  if(!db)return;
  await new Promise(resolve=>{
    const tx=db.transaction(MATHNET_META,'readwrite');
    tx.objectStore(MATHNET_META).put({key:key,value:value});
    tx.oncomplete=resolve;tx.onerror=resolve;
  });
}

async function mathnetFetchRows(config,offset,length,onError){
  const safeConfig=String(config||MATHNET.config);
  const cleanOffset=Math.max(0,Math.floor(offset||0));
  const cleanLength=Math.min(100,Math.max(1,length||100));
  const url=new URL(MATHNET.endpoint);
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',safeConfig);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('offset',String(cleanOffset));
  url.searchParams.set('length',String(cleanLength));
  const key=url.toString();
  if(MATHNET_INFLIGHT.has(key))return MATHNET_INFLIGHT.get(key);

  const task=(async()=>{
    let lastError=null;
    for(let attempt=0;attempt<5;attempt++){
      let timer=null;
      try{
        const controller=new AbortController();
        timer=setTimeout(()=>controller.abort(),12000);
        const response=await fetch(key,{mode:'cors',headers:{Accept:'application/json'},signal:controller.signal});
        clearTimeout(timer);
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        return{
          total:Number(data.num_rows_total||0),
          rows:(data.rows||[]).map((x,i)=>normalizeMathnetRow(x,cleanOffset+i,safeConfig,false))
        };
      }catch(error){
        if(timer)clearTimeout(timer);
        lastError=error;
        if(attempt<4)await new Promise(r=>setTimeout(r,500*Math.pow(1.8,attempt)));
      }
    }
    if(onError)onError(lastError);
    throw lastError||new Error('MathNet request failed.');
  })();
  MATHNET_INFLIGHT.set(key,task);
  try{return await task}finally{MATHNET_INFLIGHT.delete(key);}
}

async function mathnetRows(offset,length){return mathnetFetchRows(MATHNET.config,offset,length);}

async function mathnetLoadAllIndex(onProgress){
  if(__mathnetAllPromise)return __mathnetAllPromise;
  __mathnetAllPromise=(async()=>{
    const existing=await dbGetAll();
    const complete=await dbMeta('complete');
    if(complete&&existing.length){
      existing.sort(mathnetSort);
      if(onProgress)onProgress(existing.length,existing.length,true);
      return existing;
    }

    let first;
    try{
      first=await mathnetRows(0,100);
    }catch(error){
      if(existing.length){
        if(onProgress)onProgress(existing.length,existing.length,false);
        return existing.sort(mathnetSort);
      }
      throw new Error('MathNet could not be reached. Refresh once; the archive will resume from the last saved batch.');
    }

    const total=Math.max(first.total,MATHNET.maxRows);
    const firstBatch=first.rows.filter(mathnetQualifies).map(r=>normalizeForCache(r));
    await dbPutBatch(firstBatch);
    let loadedRaw=first.rows.length;
    let saved=firstBatch.length;
    if(onProgress)onProgress(loadedRaw,total,false);

    const offsets=[];
    for(let offset=100;offset<first.total;offset+=100)offsets.push(offset);

    let cursor=0;
    const workers=Math.min(6,Math.max(2,navigator.hardwareConcurrency?Math.floor(navigator.hardwareConcurrency/2):4));
    async function worker(){
      while(cursor<offsets.length){
        const offset=offsets[cursor++];
        try{
          const batch=await mathnetRows(offset,100);
          loadedRaw+=batch.rows.length;
          const good=batch.rows.filter(mathnetQualifies).map(r=>normalizeForCache(r));
          if(good.length){await dbPutBatch(good);saved+=good.length;}
          if(onProgress)onProgress(loadedRaw,total,false,saved);
        }catch{
          // Retry the same slice once through the request function; if still unavailable,
          // leave the archive incomplete so the next visit can resume rather than failing.
        }
      }
    }
    await Promise.all(Array.from({length:workers},()=>worker()));

    const finalRows=await dbGetAll();
    const finished=finalRows.length>0 && loadedRaw>=first.total;
    await dbSetMeta('total',first.total);
    await dbSetMeta('complete',finished);
    await dbSetMeta('savedCount',finalRows.length);
    finalRows.sort(mathnetSort);
    if(onProgress)onProgress(loadedRaw,first.total,finished,finalRows.length);
    return finalRows;
  })();
  try{return await __mathnetAllPromise}finally{__mathnetAllPromise=null;}
}

function normalizeForCache(row){
  const clone={...row};
  clone.statement=mathnetMarkdown({problem_markdown:row.statement||''},false);
  clone.solutions=Array.isArray(row.solutions)?row.solutions.map(String):[];
  return clone;
}

function mathnetSort(a,b){
  const ay=Number(a.year||0),by=Number(b.year||0);
  if(ay!==by)return by-ay;
  const ac=(a.country||'').localeCompare(b.country||'');
  if(ac)return ac;
  const an=(a.problemNumber||'').match(/\d+/),bn=(b.problemNumber||'').match(/\d+/);
  if(an&&bn&&Number(an[0])!==Number(bn[0]))return Number(an[0])-Number(bn[0]);
  return (a.title||'').localeCompare(b.title||'');
}

async function mathnetGetArchive(){
  const rows=await dbGetAll();
  return rows.sort(mathnetSort);
}

async function mathnetSearch(query){
  const q=String(query||'').trim().toLowerCase();
  const rows=await mathnetLoadAllIndex();
  if(!q)return rows;
  return rows.filter(p=>([
    p.title,p.country,p.competition,p.year,p.problemNumber,p.section,p.sourceBooklet,
    p.bookletSource,p.category,p.statement
  ].join(' ').toLowerCase()).includes(q));
}

async function mathnetProblemById(id,sourceConfig,sourceIndex){
  const target=String(id||'').trim();
  if(!target)return null;
  if(sourceConfig&&sourceIndex!=null&&sourceIndex!==''){
    try{
      const exact=await mathnetFetchRows(sourceConfig,Number(sourceIndex),1);
      const row=exact.rows[0];
      if(row&&row.id===target&&mathnetQualifies(row))return row;
    }catch{}
  }
  const cached=(await mathnetGetArchive()).find(r=>r.id===target);
  return cached||null;
}

async function mathnetFind(options){
  options=options||{};
  const categories=Array.isArray(options.categories)&&options.categories.length?options.categories:['A','C','G','N'];
  const difficulty=options.difficulty||'any';
  const count=Math.max(1,Math.min(30,Number(options.count||6)));
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count?options.sequence:null;
  const all=await mathnetLoadAllIndex();
  let pool=all.filter(q=>categories.includes(q.category)&&(difficulty==='any'||q.difficulty===difficulty));

  // Difficulty is a UI estimate. Never fail a requested 4/6-question mock merely because
  // the estimate is sparse; fall back to the same topics with any difficulty.
  if(pool.length<count)pool=all.filter(q=>categories.includes(q.category));
  if(pool.length<count)pool=all.filter(q=>q.language.toLowerCase()==='english'&&q.hasSolution);

  const by={A:[],C:[],G:[],N:[]};
  pool.forEach(q=>(by[q.category]||(by[q.category]=[])).push(q));
  const used=new Set(),picked=[];
  let seed=Number(options.seed||Date.now());

  for(let i=0;i<count;i++){
    const wanted=sequence?sequence[i]:categories[i%categories.length];
    const list=by[wanted]||[];
    let candidate=null;
    if(list.length){
      const start=Math.abs(Math.floor(seed+i*37))%list.length;
      for(let j=0;j<list.length;j++){
        const q=list[(start+j)%list.length];
        if(!used.has(q.id)){candidate=q;break;}
      }
    }
    if(!candidate){
      for(const q of pool){if(!used.has(q.id)){candidate=q;break;}}
    }
    if(!candidate)break;
    used.add(candidate.id);picked.push(candidate);
  }
  return{questions:picked,total:all.length,source:'ShadenA/MathNet'};
}

function mathnetSaveMock(mock){localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}));}
function mathnetLoadMock(){try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null')}catch{return null;}}
