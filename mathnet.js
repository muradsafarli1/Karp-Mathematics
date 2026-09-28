/* KARP MathNet question-pool connector.
   Source: ShadenA/MathNet on Hugging Face.
   The Dataset Viewer API exposes /rows in slices of at most 100 rows. */
const MATHNET_FILTER_WHERE = '"language"=\'English\' AND ("problem_type"=\'proof only\' OR "problem_type"=\'proof and answer\')';

const MATHNET = {
  dataset: 'ShadenA/MathNet',
  config: 'all',
  split: 'train',
  maxPreferredRows: 27817,
  endpoint: 'https://datasets-server.huggingface.co/rows'
};

function mathnetCategory(row){
  const paths=(Array.isArray(row.topics_flat)?row.topics_flat:[String(row.topics_flat||'')]).join(' ').toLowerCase();
  const md=String(row.problem_markdown||'').toLowerCase();
  const tests=[
    ['G',/(geometry|triangle|circle|angle|polygon|quadrilateral|concyclic|similarity|incircle|circumcircle)/],
    ['N',/(number theory|divisib|prime|integer|diophant|congruence|modular|gcd|lcm|factor|remainder)/],
    ['C',/(combinatorics|counting|graph theory|permutation|combination|pigeonhole|invariant|coloring|probability)/],
    ['A',/(algebra|equation|polynomial|inequal|functional equation|sequence|series|absolute value)/]
  ];
  for(const [key,re] of tests) if(re.test(paths)||re.test(md)) return key;
  return 'A';
}

function mathnetType(row){
  const t=String(row.problem_type||'').toLowerCase();
  if(t.includes('answer only')) return 'answer';
  if(t.includes('proof and answer')) return 'proof-answer';
  return 'proof';
}

function mathnetDifficulty(row){
  // MathNet v0 does not publish an authoritative easy/hard field.
  // This is only a UI estimate used by the mock filter.
  const text=String(row.problem_markdown||'');
  const topics=Array.isArray(row.topics_flat)?row.topics_flat.length:0;
  const competition=String(row.competition||'').toLowerCase();
  let score=0;
  score += Math.min(4,Math.floor(text.length/900));
  score += Math.min(2,Math.max(0,topics-1));
  if(/imo|imo shortlist|tst|olympiad/.test(competition)) score+=1;
  return score>=3?'hard':'easy';
}

function mathnetImages(row){
  const imgs=Array.isArray(row.images)?row.images:[];
  return imgs.map(x=>typeof x==='string'?x:x?.src||'').filter(Boolean);
}

function mathnetMarkdown(row){
  let md=String(row.problem_markdown||'').trim();
  const imgs=mathnetImages(row);
  md=md.replace(/!\[([^\]]*)\]\(attached_image_(\d+)\.png\)/g,function(_,alt,n){
    const src=imgs[Number(n)-1];
    return src?'!['+(alt||'Figure')+']('+src+')':'';
  });
  return md;
}
function mathnetProblemNumber(row){
  const text=String(row.problem_markdown||'').replace(/<[^>]+>/g,' ').trim();
  const patterns=[
    /(?:^|\n)\s*(?:#+\s*)?(?:problem|question|p)\s*#?\s*(\d{1,2})\b/i,
    /(?:^|\n)\s*\*{0,2}\s*(\d{1,2})\s*[\.)]\s*/,
    /\bP\s*([1-9]\d?)\b/i
  ];
  for(const re of patterns){
    const m=text.match(re);
    if(m)return 'P'+m[1];
  }
  return '';
}


function normalizeMathnetRow(raw,offset){
  const row=raw&&raw.row?raw.row:(raw||{});
  const id=String(row.id||('mathnet-'+((raw&&raw.row_idx!=null)?raw.row_idx:(offset||0))));
  return {
    id:id,
    competition:String(row.competition||'MathNet'),
    country:String(row.country||''),
    statement:mathnetMarkdown(row),
    solutions:Array.isArray(row.solutions_markdown)?row.solutions_markdown.filter(Boolean):[],
    topics:Array.isArray(row.topics_flat)?row.topics_flat:[],
    category:mathnetCategory(row),
    type:mathnetType(row),
    difficulty:mathnetDifficulty(row),
    problemType:String(row.problem_type||''),
    language:String(row.language||''),
    hasSolution:Array.isArray(row.solutions_markdown)&&row.solutions_markdown.some(function(x){return String(x||'').trim()}),
    problemNumber:mathnetProblemNumber(row),
    title:String(row.title||row.competition||'MathNet Problem')+(mathnetProblemNumber(row)?' — '+mathnetProblemNumber(row):''),
    sourceIndex:Number((raw&&raw.row_idx)!=null?raw.row_idx:(offset||0)),
    finalAnswer:row.final_answer==null?'':String(row.final_answer)
  };
}

async function mathnetRows(offset,length){
  const cleanOffset=Math.max(0,Math.floor(offset||0));
  const cleanLength=Math.min(100,Math.max(1,length||100));
  const url=new URL(MATHNET.endpoint);
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',MATHNET.config);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('offset',String(cleanOffset));
  url.searchParams.set('length',String(cleanLength));

  const cacheName='karp-mathnet-v1';
  const cacheKey=url.toString();

  try{
    if('caches' in window){
      const cache=await caches.open(cacheName);
      const cached=await cache.match(cacheKey);
      if(cached){
        const data=await cached.clone().json();
        return {
          total:Number(data.num_rows_total||0),
          rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,cleanOffset+i);})
        };
      }
    }
  }catch{}

  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const res=await fetch(cacheKey,{headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error('MathNet request failed ('+res.status+')');
      const data=await res.json();

      try{
        if('caches' in window){
          const cache=await caches.open(cacheName);
          const response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
          await cache.put(cacheKey,response);
        }
      }catch{}

      return {
        total:Number(data.num_rows_total||0),
        rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,cleanOffset+i);})
      };
    }catch(error){
      lastError=error;
      await new Promise(function(resolve){setTimeout(resolve,700*(attempt+1));});
    }
  }
  throw lastError||new Error('Failed to fetch MathNet.');
}

const MATHNET_ARCHIVE_CACHE = {
  rows: [],
  sourceOffset: 0,
  total: 0,
  exhausted: false,
  searchCache: new Map()
};

function mathnetQualifies(row){
  const language=String(row.language||'').trim().toLowerCase();
  const type=String(row.problemType||'').trim().toLowerCase();
  return (language==='english' || language==='en' || language.startsWith('en-'))
    && row.hasSolution
    && (type==='proof only' || type==='proof and answer');
}

async function mathnetFilteredRows(offset,length){
  // MathNet's /filter endpoint currently returns HTTP 500 for this dataset.
  // Use the stable /rows endpoint and filter the returned records locally.
  const wantedOffset=Math.max(0,Math.floor(offset||0));
  const wantedLength=Math.min(100,Math.max(1,length||100));

  while(MATHNET_ARCHIVE_CACHE.rows.length < wantedOffset+wantedLength && !MATHNET_ARCHIVE_CACHE.exhausted){
    const batch=await mathnetRows(MATHNET_ARCHIVE_CACHE.sourceOffset,100);
    MATHNET_ARCHIVE_CACHE.total=batch.total;
    MATHNET_ARCHIVE_CACHE.sourceOffset += batch.rows.length;

    for(const row of batch.rows){
      if(mathnetQualifies(row)) MATHNET_ARCHIVE_CACHE.rows.push(row);
    }
    if(!batch.rows.length || batch.rows.length<100 || MATHNET_ARCHIVE_CACHE.sourceOffset>=MATHNET_ARCHIVE_CACHE.total){
      MATHNET_ARCHIVE_CACHE.exhausted=true;
    }
  }

  return {
    total:MATHNET_ARCHIVE_CACHE.total,
    qualifyingTotal:MATHNET_ARCHIVE_CACHE.exhausted ? MATHNET_ARCHIVE_CACHE.rows.length : null,
    rows:MATHNET_ARCHIVE_CACHE.rows.slice(wantedOffset,wantedOffset+wantedLength),
    partial:!MATHNET_ARCHIVE_CACHE.exhausted
  };
}

async function mathnetProblemById(id,sourceIndex){
  const target=String(id||'').trim();
  if(!target)return null;

  // Best path: the Problems card passes the exact MathNet row index.
  if(sourceIndex!==undefined && sourceIndex!==null && String(sourceIndex)!==''){
    const idx=Math.max(0,Math.floor(Number(sourceIndex)));
    const exact=await mathnetRows(idx,1);
    const row=exact.rows[0];
    if(row && row.id===target && mathnetQualifies(row)) return row;
  }

  // Fallback for old links without sourceIndex.
  const cached=MATHNET_ARCHIVE_CACHE.rows.find(function(q){return q.id===target;});
  if(cached)return cached;

  return null;
}

async function mathnetSearch(query,offset,length){
  const key=String(query||'').trim().toLowerCase();
  const wantedOffset=Math.max(0,Math.floor(offset||0));
  const wantedLength=Math.min(100,Math.max(1,length||100));
  if(!key) return mathnetFilteredRows(wantedOffset,wantedLength);

  const matches=[];
  let scan=0;
  while(matches.length<wantedOffset+wantedLength && !MATHNET_ARCHIVE_CACHE.exhausted && scan<MATHNET.maxPreferredRows){
    const before=MATHNET_ARCHIVE_CACHE.sourceOffset;
    await mathnetFilteredRows(MATHNET_ARCHIVE_CACHE.rows.length,100);
    for(const q of MATHNET_ARCHIVE_CACHE.rows.slice(0)){
      const hay=(q.id+' '+q.title+' '+q.competition+' '+q.country+' '+q.statement).toLowerCase();
      if(hay.includes(key) && !matches.some(function(x){return x.id===q.id;})) matches.push(q);
    }
    if(MATHNET_ARCHIVE_CACHE.sourceOffset===before)break;
    scan=MATHNET_ARCHIVE_CACHE.sourceOffset;
  }

  return {
    total:MATHNET_ARCHIVE_CACHE.exhausted?matches.length:null,
    qualifyingTotal:MATHNET_ARCHIVE_CACHE.exhausted?matches.length:null,
    rows:matches.slice(wantedOffset,wantedOffset+wantedLength),
    partial:!MATHNET_ARCHIVE_CACHE.exhausted
  };
}

async function mathnetFind(options){
  options=options||{};
  const categories=Array.isArray(options.categories)&&options.categories.length?options.categories:['A','C','G','N'];
  const difficulty=options.difficulty||'any';
  const count=Math.max(1,Math.min(30,Number(options.count||6)));
  const requestedTypes=['proof','proof-answer'];

  // Sample across the whole MathNet source instead of relying on the broken
  // Dataset Viewer /filter endpoint or only the first few hundred rows.
  const batches=[];
  const batchCount=8;
  const maxOffset=Math.max(0,MATHNET.maxPreferredRows-100);
  const seed=Number(options.seed||Date.now());
  for(let i=0;i<batchCount;i++){
    const pseudo=Math.abs(Math.sin(seed*0.000001+i*12.9898)*43758.5453);
    const offset=Math.floor((pseudo-Math.floor(pseudo))*maxOffset);
    batches.push(offset);
  }

  const pool=[];
  const seen=new Set();
  for(const offset of batches){
    let batch;
    try{batch=await mathnetRows(offset,100)}catch{continue}
    for(const q of batch.rows){
      if(seen.has(q.id))continue;
      seen.add(q.id);
      if(!mathnetQualifies(q))continue;
      if(categories.indexOf(q.category)<0)continue;
      if(difficulty!=='any'&&q.difficulty!==difficulty)continue;
      if(requestedTypes.indexOf(q.type)<0)continue;
      pool.push(q);
    }
    if(pool.length>=Math.max(80,count*6))break;
  }

  // Prefer a balanced spread across the selected topics.
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count?options.sequence:null;
  const byCat={A:[],C:[],G:[],N:[]};
  pool.forEach(function(q){(byCat[q.category]||(byCat[q.category]=[])).push(q)});

  const picked=[],used=new Set();
  for(let i=0;i<count;i++){
    const cat=sequence?sequence[i]:categories[i%categories.length];
    const list=byCat[cat]||[];
    let candidate=null;

    if(list.length){
      const start=(seed+i*17)%list.length;
      for(let j=0;j<list.length;j++){
        const q=list[(start+j)%list.length];
        if(!used.has(q.id)){candidate=q;break}
      }
    }
    if(!candidate){
      for(const q of pool){
        if(!used.has(q.id)){candidate=q;break}
      }
    }
    if(!candidate)break;
    used.add(candidate.id);
    picked.push(candidate);
  }

  return {questions:picked,total:MATHNET.maxPreferredRows,source:'ShadenA/MathNet'};
}

function mathnetSaveMock(mock){
  localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}));
}
function mathnetLoadMock(){
  try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null');}catch{return null;}
}
