/* KARP MathNet archive — fast browser path.
   Uses Hugging Face's Parquet conversion directly instead of the Dataset Viewer
   /rows endpoint. The first sample opens quickly; the full archive then fills
   IndexedDB in the background. */

const MATHNET={
  dataset:'ShadenA/MathNet',
  config:'all',
  split:'train',
  parquetBase:'https://huggingface.co/datasets/ShadenA/MathNet/resolve/refs%2Fconvert%2Fparquet/all/train/',
  parquetShards:50
};

const MATHNET_DB_NAME='KARP_MATHNET_ARCHIVE_V5';
const MATHNET_DB_VERSION=1;
const MATHNET_STORE='problems';
const MATHNET_META='meta';
const MATHNET_COLUMNS=[
  'unique_id','id','country','competition','year','section','problem_number',
  'problem_markdown','solutions_markdown','topics_flat','language','problem_type',
  'final_answer','source_booklet','booklet_source','original_problem_markdown'
];

let __mathnetLibPromise=null;
let __mathnetBackground=null;
let __mathnetQuickPromise=null;

function mathnetCategory(row){
  const topics=Array.isArray(row.topics_flat)?row.topics_flat:[];
  const top=topics.map(x=>String(x||'').trim().toLowerCase()).find(Boolean)||'';
  const direct=[
    ['G',/^geometry\b/],['N',/^(number theory|number_theory)\b/],
    ['C',/^combinatorics\b/],['A',/^algebra\b/]
  ];
  for(const [key,re] of direct)if(re.test(top))return key;
  const paths=topics.join(' ').toLowerCase();
  const text=String(row.problem_markdown||'').toLowerCase();
  const rules=[
    ['G',/(geometry|triangle|circle|angle|polygon|quadrilateral|concyclic|similarity|incircle|circumcircle|orthocenter)/],
    ['N',/(number theory|divisib|prime|integer|diophant|congruence|modular|gcd|lcm|factor|remainder)/],
    ['C',/(combinatorics|counting|graph theory|permutation|combination|pigeonhole|invariant|coloring|probability)/],
    ['A',/(algebra|equation|polynomial|inequal|functional equation|sequence|series|absolute value)/]
  ];
  for(const p of rules)if(p[1].test(paths)||p[1].test(text))return p[0];
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
  const text=String(row.problem_markdown||'');const topics=Array.isArray(row.topics_flat)?row.topics_flat.length:0;const competition=String(row.competition||'').toLowerCase();
  let score=Math.min(4,Math.floor(text.length/900))+Math.min(2,Math.max(0,topics-1));if(/imo|shortlist|tst|olympiad/.test(competition))score++;
  return score>=3?'hard':'easy';
}
function mathnetYear(row){
  if(row.year!=null&&String(row.year).trim())return String(row.year).trim();
  const text=[row.source_booklet,row.booklet_source,row.competition].map(x=>String(x||'')).join(' ');
  const m=text.match(/(?:^|[^0-9])(19\d{2}|20\d{2})(?:[^0-9]|$)/);return m?m[1]:'';
}
function mathnetProblemNumber(row){
  if(row.problem_number!=null&&String(row.problem_number).trim()){const v=String(row.problem_number).trim();return /^P/i.test(v)?v:'P'+v}
  const text=(String(row.problem_markdown||'')+' '+String(row.original_problem_markdown||'')).replace(/<[^>]+>/g,' ');
  for(const re of [/(?:^|\n)\s*(?:#+\s*)?(?:problem|question|p)\s*#?\s*(\d{1,2})\b/i,/(?:^|\n)\s*\*{0,2}\s*(\d{1,2})\s*[\.)]\s*/,/\bP\s*([1-9]\d?)\b/i]){const m=text.match(re);if(m)return'P'+m[1]}
  return'';
}
function mathnetCompetition(row){return String(row.competition||'').trim()||'MathNet'}
function mathnetDisplayTitle(row){return [mathnetCompetition(row),mathnetYear(row),mathnetProblemNumber(row)].filter(Boolean).join(' — ').replace(' — P',' · P')}
function mathnetSolutions(row){
  if(Array.isArray(row.solutions_markdown))return row.solutions_markdown.map(x=>String(x||'').trim()).filter(Boolean);
  if(Array.isArray(row.solutions))return row.solutions.map(x=>String(x||'').trim()).filter(Boolean);
  return String(row.solutions_markdown||'').trim()?[String(row.solutions_markdown).trim()]:[];
}
function mathnetMarkdown(row){return String(row.problem_markdown||'').trim().replace(/!\[([^\]]*)\]\(attached_image_(\d+)\.png\)/g,'')}
function normalizeMathnetRow(raw,position,shard){
  const row=raw&&raw.row?raw.row:raw;
  const solutions=mathnetSolutions(row);
  const id=String(row.unique_id||row.id||('mathnet-pq-'+shard+'-'+position));
  return {
    id,country:String(row.country||'').trim(),competition:mathnetCompetition(row),year:mathnetYear(row),
    section:String(row.section||'').trim(),problemNumber:mathnetProblemNumber(row),
    sourceBooklet:String(row.source_booklet||'').trim(),bookletSource:String(row.booklet_source||'').trim(),
    language:String(row.language||'').trim(),problemType:String(row.problem_type||'').trim(),
    statement:mathnetMarkdown(row),solutions,category:mathnetCategory(row),type:mathnetType(row),
    difficulty:mathnetDifficulty(row),hasSolution:solutions.length>0,sourceConfig:'all',
    sourceIndex:Number(position),sourceShard:Number(shard),sourceType:'parquet',
    title:mathnetDisplayTitle(row),finalAnswer:row.final_answer==null?'':String(row.final_answer||'')
  };
}
function mathnetQualifies(row){
  const lang=String(row.language||'').trim().toLowerCase();
  const type=String(row.problemType||'').trim().toLowerCase();
  const english=['english','en'].includes(lang)||lang.startsWith('en-');
  const proofType=/^proof(?: only| and answer)?$/.test(type)||!type;
  return english&&row.hasSolution&&proofType&&String(row.statement||'').trim().length>0;
}
function openMathnetDB(){
  return new Promise(resolve=>{
    if(!('indexedDB' in window)){resolve(null);return}
    const req=indexedDB.open(MATHNET_DB_NAME,MATHNET_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(MATHNET_STORE)){
        const s=db.createObjectStore(MATHNET_STORE,{keyPath:'id'});s.createIndex('year','year');s.createIndex('category','category');s.createIndex('country','country');
      }
      if(!db.objectStoreNames.contains(MATHNET_META))db.createObjectStore(MATHNET_META,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
  });
}
async function dbGetAll(){
  const db=await openMathnetDB();if(!db)return[];
  return await new Promise(resolve=>{const tx=db.transaction(MATHNET_STORE,'readonly'),req=tx.objectStore(MATHNET_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>resolve([])});
}
async function dbPutBatch(rows){
  if(!rows.length)return true;const db=await openMathnetDB();if(!db)return false;
  return await new Promise(resolve=>{const tx=db.transaction(MATHNET_STORE,'readwrite'),s=tx.objectStore(MATHNET_STORE);rows.forEach(x=>s.put(x));tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false)});
}
async function dbGetMeta(key){
  const db=await openMathnetDB();if(!db)return null;
  return await new Promise(resolve=>{const tx=db.transaction(MATHNET_META,'readonly'),req=tx.objectStore(MATHNET_META).get(key);req.onsuccess=()=>resolve(req.result?.value??null);req.onerror=()=>resolve(null)});
}
async function dbSetMeta(key,value){
  const db=await openMathnetDB();if(!db)return;
  await new Promise(resolve=>{const tx=db.transaction(MATHNET_META,'readwrite');tx.objectStore(MATHNET_META).put({key,value});tx.oncomplete=resolve;tx.onerror=resolve});
}
async function mathnetLib(){
  if(!__mathnetLibPromise)__mathnetLibPromise=import('https://cdn.jsdelivr.net/npm/hyparquet/src/hyparquet.min.js');
  return __mathnetLibPromise;
}
function shardUrl(shard){return MATHNET.parquetBase+String(shard).padStart(4,'0')+'.parquet'}
async function readShard(shard,rowStart=0,rowEnd=100){
  const lib=await mathnetLib(),file=await lib.asyncBufferFromUrl({url:shardUrl(shard)});
  const rows=await lib.parquetReadObjects({file,columns:MATHNET_COLUMNS,rowStart,rowEnd});
  return rows.map((row,i)=>normalizeMathnetRow(row,rowStart+i,shard)).filter(mathnetQualifies);
}
async function readShardMeta(shard,rowStart=0,rowEnd=100000){
  const lib=await mathnetLib(),file=await lib.asyncBufferFromUrl({url:shardUrl(shard)});
  const rows=await lib.parquetReadObjects({
    file,
    columns:['unique_id','id','country','competition','year','section','problem_number','topics_flat','language','problem_type'],
    rowStart,rowEnd
  });
  return rows.map((row,i)=>({
    id:String(row.unique_id||row.id||('mathnet-meta-'+shard+'-'+(rowStart+i))),
    shard:Number(shard),index:Number(rowStart+i),
    category:mathnetCategory(row),
    language:String(row.language||'').trim().toLowerCase(),
    problemType:String(row.problem_type||'').trim().toLowerCase()
  })).filter(x=>{
    const english=['english','en'].includes(x.language)||x.language.startsWith('en-');
    const proof=/^proof(?: only| and answer)?$/.test(x.problemType)||!x.problemType;
    return english&&proof;
  });
}
function mathnetSort(a,b){
  const ay=Number(a.year||0),by=Number(b.year||0);if(ay!==by)return by-ay;
  const ac=(a.country||'').localeCompare(b.country||'');if(ac)return ac;
  const an=(a.problemNumber||'').match(/\d+/),bn=(b.problemNumber||'').match(/\d+/);
  if(an&&bn&&Number(an[0])!==Number(bn[0]))return Number(an[0])-Number(bn[0]);
  return (a.title||'').localeCompare(b.title||'');
}

async function mathnetSampleShards(shards,rowEnd=220){
  const chunks=[];let cursor=0;
  const targets=[...new Set(shards.map(Number).filter(s=>s>=0&&s<MATHNET.parquetShards))];
  const workers=Math.min(8,targets.length||1);
  async function worker(){
    while(cursor<targets.length){
      const shard=targets[cursor++];
      try{
        const rows=await readShard(shard,0,rowEnd);
        if(rows.length)chunks.push(...rows);
      }catch{}
    }
  }
  await Promise.all(Array.from({length:workers},worker));
  const unique=[...new Map(chunks.map(x=>[x.id,x])).values()].sort(mathnetSort);
  if(unique.length)await dbPutBatch(unique);
  return unique;
}
async function mathnetLoadQuickIndex(){
  if(__mathnetQuickPromise)return __mathnetQuickPromise;
  __mathnetQuickPromise=(async()=>{
    const existing=await dbGetAll();
    const initial=[0,10,20,30,40];
    if(existing.length>=120){existing.sort(mathnetSort);return existing}
    const sampled=await mathnetSampleShards(initial,120);
    const merged=[...existing,...sampled];
    const unique=[...new Map(merged.map(x=>[x.id,x])).values()].sort(mathnetSort);
    return unique;
  })();
  try{return await __mathnetQuickPromise}finally{__mathnetQuickPromise=null}
}

async function mathnetBackgroundLoad(onProgress,onUpdate){
  if(__mathnetBackground)return __mathnetBackground;
  __mathnetBackground=(async()=>{
    const complete=await dbGetMeta('complete');
    if(complete)return dbGetAll();
    const done=new Set((await dbGetMeta('shards')||[]).map(Number));
    const total=MATHNET.parquetShards;
    for(let shard=0;shard<total;shard++){
      if(done.has(shard))continue;
      try{
        const rows=await readShard(shard,0,100000);
        await dbPutBatch(rows);done.add(shard);await dbSetMeta('shards',[...done]);
        if(onProgress)onProgress(done.size,total,false,(await dbGetAll()).length);
        if(onUpdate)onUpdate(await dbGetAll());
      }catch(error){
        if(onProgress)onProgress(done.size,total,false,(await dbGetAll()).length);
      }
    }
    const all=await dbGetAll();all.sort(mathnetSort);
    await dbSetMeta('complete',done.size===total);await dbSetMeta('total',total);await dbSetMeta('savedCount',all.length);
    if(onProgress)onProgress(total,total,true,all.length);
    if(onUpdate)onUpdate(all);
    return all;
  })();
  return __mathnetBackground;
}

async function mathnetLoadAllIndex(onProgress,onInitial){
  const complete=await dbGetMeta('complete'),existing=await dbGetAll();
  if(complete&&existing.length){existing.sort(mathnetSort);onInitial?.(existing);onProgress?.(existing.length,existing.length,true,existing.length);return existing}
  const quick=await mathnetLoadQuickIndex();
  quick.sort(mathnetSort);onInitial?.(quick);
  if(onProgress)onProgress(quick.length, MATHNET.parquetShards*600, false, quick.length);
  mathnetBackgroundLoad(onProgress,onInitial).catch(()=>{});
  return quick;
}
async function mathnetGetArchive(){const rows=await dbGetAll();return rows.sort(mathnetSort)}
async function mathnetSearch(query){const q=String(query||'').trim().toLowerCase();const rows=await mathnetLoadAllIndex();if(!q)return rows;return rows.filter(p=>[p.title,p.country,p.competition,p.year,p.problemNumber,p.section,p.statement].join(' ').toLowerCase().includes(q))}
async function mathnetProblemById(id,sourceConfig,sourceIndex,sourceShard){
  const target=String(id||'').trim();if(!target)return null;
  const shard=Number.isFinite(Number(sourceShard))?Number(sourceShard):null;
  const rowIndex=Number.isFinite(Number(sourceIndex))?Number(sourceIndex):null;
  if(shard!=null&&rowIndex!=null){try{const rows=await readShard(shard,rowIndex,rowIndex+1);const exact=rows[0];if(exact?.id===target)return exact}catch{}}
  return (await mathnetGetArchive()).find(r=>r.id===target)||null;
}
async function mathnetFind(options){
  options=options||{};
  const categories=Array.isArray(options.categories)&&options.categories.length?options.categories:['A','C','G','N'];
  const difficulty=options.difficulty||'any';
  const count=Math.max(1,Math.min(30,Number(options.count||6)));
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count?options.sequence:null;
  const onProgress=typeof options.onProgress==='function'?options.onProgress:()=>{};

  // Do not force the Problems-page content index to finish before a mock can start.
  let all=(await dbGetAll()).sort(mathnetSort);

  function matching(q){
    return categories.includes(q.category)&&(difficulty==='any'||q.difficulty===difficulty);
  }
  function choose(rows){
    const pool=rows.filter(matching);
    const by={A:[],C:[],G:[],N:[]};
    pool.forEach(q=>(by[q.category]||(by[q.category]=[])).push(q));
    const picked=[],used=new Set(),seed=Number(options.seed||Date.now());
    const wanted=sequence||Array.from({length:count},(_,i)=>categories[i%categories.length]);
    for(let i=0;i<wanted.length;i++){
      const list=by[wanted[i]]||[];
      const startIndex=list.length?Math.abs(Math.floor(seed+i*37))%list.length:0;
      let candidate=null;
      for(let j=0;j<list.length;j++){
        const q=list[(startIndex+j)%list.length];
        if(!used.has(q.id)){candidate=q;break}
      }
      if(!candidate){
        if(sequence)break;
        for(const q of pool)if(!used.has(q.id)){candidate=q;break}
      }
      if(!candidate)break;
      used.add(candidate.id);picked.push(candidate);
    }
    return picked;
  }

  let picked=choose(all);
  onProgress(picked.length,count,'cache');
  if(picked.length>=count){
    mathnetBackgroundLoad().catch(()=>{});
    return {questions:picked,total:all.length,source:'ShadenA/MathNet'};
  }

  const wanted=sequence||Array.from({length:count},(_,i)=>categories[i%categories.length]);
  const neededBy={A:0,C:0,G:0,N:0};
  wanted.forEach(x=>{neededBy[x]=(neededBy[x]||0)+1});

  // For difficulty filters we keep a larger shortlist, because difficulty is
  // a derived heuristic and must be checked on the full problem text.
  const shortlistPerQuestion=difficulty==='any'?2:8;
  const targetBy={A:0,C:0,G:0,N:0};
  Object.keys(neededBy).forEach(k=>targetBy[k]=Math.max(neededBy[k]*shortlistPerQuestion,3));

  const shardOrder=[0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,2,5,8,11,14,17,20,23,26,29,32,35,38,41,44,47];
  const known=new Set(all.map(q=>Number(q.sourceShard)));
  const refsBy={A:[],C:[],G:[],N:[]};

  function enoughRefs(){
    return categories.every(cat=>(refsBy[cat]||[]).length>=targetBy[cat]);
  }

  // Metadata only: country/competition/topic/language/type. No long statements or solutions.
  for(let batchStart=0;batchStart<shardOrder.length&&!enoughRefs();batchStart+=8){
    const batch=shardOrder.slice(batchStart,batchStart+8).filter(s=>!known.has(s));
    if(!batch.length)continue;
    const meta=[];
    await Promise.all(batch.map(async shard=>{
      try{meta.push(...await readShardMeta(shard,0,100000))}catch{}
    }));
    for(const ref of meta){
      if((refsBy[ref.category]||[]).length<targetBy[ref.category])refsBy[ref.category].push(ref);
    }
    onProgress(picked.length,count,'metadata');
  }

  const selectedRefs=[];const seenRef=new Set();
  wanted.forEach(cat=>{
    const list=refsBy[cat]||[];
    const keyCount=neededBy[cat]||0;
    // Take multiple candidates per requested slot so easy/hard filtering has room.
    for(let i=0;i<Math.min(list.length,keyCount*shortlistPerQuestion);i++){
      const r=list[i],key=r.shard+':'+r.index;
      if(!seenRef.has(key)){seenRef.add(key);selectedRefs.push(r)}
    }
  });

  // Read only shortlisted full records.
  const full=[];
  let cursor=0;
  async function worker(){
    while(cursor<selectedRefs.length){
      const ref=selectedRefs[cursor++];
      try{
        const rows=await readShard(ref.shard,ref.index,ref.index+1);
        const q=rows[0];
        if(q&&categories.includes(q.category)&&(difficulty==='any'||q.difficulty===difficulty)){
          full.push(q);
          await dbPutBatch([q]);
          onProgress(Math.min(count,full.length+picked.length),count,'candidates');
        }
      }catch{}
    }
  }
  await Promise.all(Array.from({length:Math.min(8,selectedRefs.length||1)},worker));

  all=[...all,...full];
  all=[...new Map(all.map(q=>[q.id,q])).values()].sort(mathnetSort);
  picked=choose(all);

  if(picked.length<count){
    const reason=sequence
      ? 'The archive could not find enough English proof problems for this exact sequence and difficulty.'
      : 'The archive could not find enough English proof problems for the selected filters.';
    return {questions:picked,total:all.length,source:'ShadenA/MathNet',reason};
  }

  mathnetBackgroundLoad().catch(()=>{});
  return {questions:picked,total:all.length,source:'ShadenA/MathNet'};
}
function mathnetSaveMock(mock){localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}))}
function mathnetLoadMock(){try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null')}catch{return null}}