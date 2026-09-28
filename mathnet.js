/* KARP MathNet integration.
   Primary source: official ShadenA/MathNet Hugging Face dataset.
   KARP reads the richer per-config MathNet files so year/section/problem_number
   metadata is available, while keeping requests small and cached. */

const MATHNET = {
  dataset: 'ShadenA/MathNet',
  config: 'all',
  split: 'train',
  maxPreferredRows: 30676,
  rowsEndpoint: 'https://datasets-server.huggingface.co/rows',
  treeEndpoint: 'https://huggingface.co/api/datasets/ShadenA/MathNet/tree/main/data?recursive=false&expand=false'
};

const MATHNET_INFLIGHT = new Map();
const MATHNET_CONFIG_CACHE_KEY = 'karp_mathnet_config_list_v2';

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
  const t=String(row.problem_type||'').trim().toLowerCase();
  if(t==='proof and answer'||t.includes('proof and answer')) return 'proof-answer';
  if(t==='answer only'||t==='final answer only'||t==='answer') return 'answer';
  if(t==='proof only'||t==='proof') return 'proof';
  return t.includes('proof')?'proof':'answer';
}

function mathnetDifficulty(row){
  const text=String(row.problem_markdown||'');
  const topics=Array.isArray(row.topics_flat)?row.topics_flat.length:0;
  const competition=String(row.competition||'').toLowerCase();
  let score=Math.min(4,Math.floor(text.length/900));
  score+=Math.min(2,Math.max(0,topics-1));
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
  const raw=row.problem_number;
  if(raw!=null && String(raw).trim()){
    const value=String(raw).trim();
    return /^P/i.test(value)?value:'P'+value;
  }
  const text=(String(row.problem_markdown||'')+' '+String(row.original_problem_markdown||'')).replace(/<[^>]+>/g,' ').trim();
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

function mathnetYear(row){
  if(row.year!=null && String(row.year).trim()) return String(row.year).trim();
  const source=String(row.source_booklet||'');
  const book=String(row.booklet_source||'');
  const competition=String(row.competition||'');
  const text=source+' '+book+' '+competition;
  const m=text.match(/(?:^|[^0-9])(19\d{2}|20\d{2})(?:[^0-9]|$)/);
  return m?m[1]:'';
}

function mathnetCompetition(row){
  const c=String(row.competition||'').trim();
  return c||'MathNet';
}

function mathnetDisplayTitle(row){
  const competition=mathnetCompetition(row);
  const year=mathnetYear(row);
  const number=mathnetProblemNumber(row);
  const parts=[];
  if(year && !new RegExp('\\b'+year+'\\b').test(competition)) parts.push(year);
  if(number) parts.push(number);
  return competition+(parts.length?' — '+parts.join(' · '):'');
}

function normalizeMathnetRow(raw,offset,sourceConfig){
  const row=raw&&raw.row?raw.row:(raw||{});
  const rowIndex=(raw&&raw.row_idx!=null)?Number(raw.row_idx):Number(offset||0);
  const id=String(row.unique_id||row.id||('mathnet-'+rowIndex));
  const competition=mathnetCompetition(row);
  const year=mathnetYear(row);
  const problemNumber=mathnetProblemNumber(row);
  return {
    id,
    competition,
    country:String(row.country||''),
    statement:mathnetMarkdown(row),
    solutions:Array.isArray(row.solutions_markdown)?row.solutions_markdown.filter(Boolean):[],
    answers:Array.isArray(row.answers_markdown)?row.answers_markdown.filter(Boolean):[],
    topics:Array.isArray(row.topics_flat)?row.topics_flat:[],
    category:mathnetCategory(row),
    type:mathnetType(row),
    difficulty:mathnetDifficulty(row),
    problemType:String(row.problem_type||''),
    language:String(row.language||''),
    hasSolution:Array.isArray(row.solutions_markdown)&&row.solutions_markdown.some(function(x){return String(x||'').trim()}),
    year,
    section:String(row.section||''),
    sourceBooklet:String(row.source_booklet||''),
    problemNumber,
    sourceConfig:String(sourceConfig||MATHNET.config),
    sourceIndex:rowIndex,
    title:mathnetDisplayTitle(row),
    finalAnswer:row.final_answer==null?'':String(row.final_answer)
  };
}

function mathnetQualifies(row){
  const language=String(row.language||'').trim().toLowerCase();
  const type=String(row.problemType||'').trim().toLowerCase();
  return (language==='english'||language==='en'||language.startsWith('en-'))
    && row.hasSolution
    && (type==='proof only'||type==='proof and answer');
}

async function mathnetFetchRows(config,offset,length){
  const safeConfig=String(config||MATHNET.config);
  const cleanOffset=Math.max(0,Math.floor(offset||0));
  const cleanLength=Math.min(100,Math.max(1,length||100));
  const url=new URL(MATHNET.rowsEndpoint);
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',safeConfig);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('offset',String(cleanOffset));
  url.searchParams.set('length',String(cleanLength));
  const cacheKey=url.toString();
  if(MATHNET_INFLIGHT.has(cacheKey)) return MATHNET_INFLIGHT.get(cacheKey);

  const request=(async function(){
    const cacheName='karp-mathnet-rows-v3';
    try{
      if('caches' in window){
        const cache=await caches.open(cacheName);
        const cached=await cache.match(cacheKey);
        if(cached){
          const data=await cached.clone().json();
          return {
            total:Number(data.num_rows_total||0),
            rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,cleanOffset+i,safeConfig);})
          };
        }
      }
    }catch{}

    let lastError=null;
    for(let attempt=0;attempt<3;attempt++){
      let timer=0;
      try{
        const controller=new AbortController();
        timer=setTimeout(function(){controller.abort()},15000);
        const res=await fetch(cacheKey,{method:'GET',mode:'cors',signal:controller.signal,headers:{Accept:'application/json'}});
        clearTimeout(timer);
        if(!res.ok) throw new Error('MathNet request failed ('+res.status+')');
        const data=await res.json();
        try{
          if('caches' in window){
            const cache=await caches.open(cacheName);
            await cache.put(cacheKey,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
          }
        }catch{}
        return {
          total:Number(data.num_rows_total||0),
          rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,cleanOffset+i,safeConfig);})
        };
      }catch(error){
        if(timer)clearTimeout(timer);
        lastError=error;
        if(attempt<2) await new Promise(function(resolve){setTimeout(resolve,500*(attempt+1));});
      }
    }
    throw lastError||new Error('Failed to fetch MathNet.');
  })();

  MATHNET_INFLIGHT.set(cacheKey,request);
  try{return await request}finally{MATHNET_INFLIGHT.delete(cacheKey);}
}

async function mathnetRows(offset,length){
  return mathnetFetchRows(MATHNET.config,offset,length);
}

async function mathnetConfigs(){
  try{
    const cached=JSON.parse(localStorage.getItem(MATHNET_CONFIG_CACHE_KEY)||'null');
    if(Array.isArray(cached)&&cached.length)return cached;
  }catch{}

  try{
    const res=await fetch(MATHNET.treeEndpoint,{headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error('Config list request failed ('+res.status+')');
    const data=await res.json();
    const configs=(Array.isArray(data)?data:[])
      .filter(function(x){return x&&x.type==='directory'&&String(x.path||'').trim();})
      .map(function(x){return String(x.path).split('/').pop();})
      .filter(function(x){return x&&x!=='all';});
    configs.sort(function(a,b){return a.localeCompare(b);});
    if(configs.length){
      localStorage.setItem(MATHNET_CONFIG_CACHE_KEY,JSON.stringify(configs));
      return configs;
    }
  }catch{}
  return [MATHNET.config];
}

const MATHNET_ARCHIVE_CACHE = {
  rows: [],
  totalSourceRows: 0,
  configIndex: 0,
  configOffsets: {},
  configTotals: {},
  exhausted: false,
  sourceFailed: false
};

function archiveAddRows(rows){
  for(const row of rows){
    if(!row||!row.id||!mathnetQualifies(row))continue;
    if(MATHNET_ARCHIVE_CACHE.rows.some(function(x){return x.id===row.id;}))continue;
    MATHNET_ARCHIVE_CACHE.rows.push(row);
  }
}

async function mathnetLoadMoreArchive(targetCount){
  const configs=await mathnetConfigs();
  const target=Math.min(Math.max(1,Number(targetCount||200)),MATHNET.maxPreferredRows);
  while(MATHNET_ARCHIVE_CACHE.rows.length<target&&!MATHNET_ARCHIVE_CACHE.exhausted){
    if(MATHNET_ARCHIVE_CACHE.configIndex>=configs.length){
      MATHNET_ARCHIVE_CACHE.exhausted=true;
      break;
    }

    const config=configs[MATHNET_ARCHIVE_CACHE.configIndex];
    const offset=Number(MATHNET_ARCHIVE_CACHE.configOffsets[config]||0);
    let batch;
    try{
      batch=await mathnetFetchRows(config,offset,100);
    }catch(error){
      MATHNET_ARCHIVE_CACHE.sourceFailed=true;
      MATHNET_ARCHIVE_CACHE.configIndex++;
      continue;
    }

    MATHNET_ARCHIVE_CACHE.totalSourceRows+=batch.rows.length;
    MATHNET_ARCHIVE_CACHE.configOffsets[config]=offset+batch.rows.length;
    MATHNET_ARCHIVE_CACHE.configTotals[config]=batch.total;
    archiveAddRows(batch.rows);

    if(!batch.rows.length||batch.rows.length<100||MATHNET_ARCHIVE_CACHE.configOffsets[config]>=batch.total){
      MATHNET_ARCHIVE_CACHE.configIndex++;
    }
  }
  return {
    rows:MATHNET_ARCHIVE_CACHE.rows,
    qualifyingTotal:MATHNET_ARCHIVE_CACHE.exhausted?MATHNET_ARCHIVE_CACHE.rows.length:null,
    partial:!MATHNET_ARCHIVE_CACHE.exhausted
  };
}

async function mathnetFilteredRows(offset,length){
  const wantedOffset=Math.max(0,Math.floor(offset||0));
  const wantedLength=Math.min(200,Math.max(1,length||100));
  await mathnetLoadMoreArchive(wantedOffset+wantedLength);
  return {
    total:MATHNET_ARCHIVE_CACHE.totalSourceRows,
    qualifyingTotal:MATHNET_ARCHIVE_CACHE.exhausted?MATHNET_ARCHIVE_CACHE.rows.length:null,
    rows:MATHNET_ARCHIVE_CACHE.rows.slice(wantedOffset,wantedOffset+wantedLength),
    partial:!MATHNET_ARCHIVE_CACHE.exhausted
  };
}

async function mathnetProblemById(id,sourceConfig,sourceIndex){
  const target=String(id||'').trim();
  if(!target)return null;

  if(sourceConfig&&sourceConfig!=='undefined'&&sourceIndex!==null&&sourceIndex!==undefined&&String(sourceIndex)!==''){
    try{
      const exact=await mathnetFetchRows(sourceConfig,Number(sourceIndex),1);
      const row=exact.rows[0];
      if(row&&row.id===target&&mathnetQualifies(row))return row;
    }catch{}
  }

  const cached=MATHNET_ARCHIVE_CACHE.rows.find(function(q){return q.id===target;});
  if(cached)return cached;

  return null;
}

async function mathnetSearch(query,offset,length){
  const key=String(query||'').trim().toLowerCase();
  const wantedOffset=Math.max(0,Math.floor(offset||0));
  const wantedLength=Math.min(200,Math.max(1,length||100));
  if(!key)return mathnetFilteredRows(wantedOffset,wantedLength);

  const matches=[];
  const seen=new Set();
  let needed=wantedOffset+wantedLength;
  while(matches.length<needed&&!MATHNET_ARCHIVE_CACHE.exhausted){
    if(MATHNET_ARCHIVE_CACHE.rows.length<Math.min(MATHNET.maxPreferredRows,Math.max(200,needed))){
      await mathnetLoadMoreArchive(Math.min(MATHNET.maxPreferredRows,Math.max(MATHNET_ARCHIVE_CACHE.rows.length+200,needed)));
    }
    for(const q of MATHNET_ARCHIVE_CACHE.rows){
      if(seen.has(q.id))continue;
      const hay=(q.id+' '+q.title+' '+q.competition+' '+q.country+' '+q.year+' '+q.problemNumber+' '+q.statement).toLowerCase();
      if(hay.includes(key)){seen.add(q.id);matches.push(q);}
    }
    if(matches.length<needed&&!MATHNET_ARCHIVE_CACHE.exhausted){
      const before=MATHNET_ARCHIVE_CACHE.rows.length;
      await mathnetLoadMoreArchive(Math.min(MATHNET.maxPreferredRows,before+200));
      if(MATHNET_ARCHIVE_CACHE.rows.length===before)break;
    }else break;
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
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count?options.sequence:null;
  const seed=Number(options.seed||Date.now());

  function acceptable(q){
    return q&&q.id&&mathnetQualifies(q)
      &&categories.indexOf(q.category)>=0
      &&(difficulty==='any'||q.difficulty===difficulty);
  }

  let pool=MATHNET_ARCHIVE_CACHE.rows.filter(acceptable);

  if(pool.length<count){
    const configs=await mathnetConfigs();
    const maxConfigs=Math.min(configs.length,10);
    for(let i=0;i<maxConfigs&&pool.length<Math.max(count*3,30);i++){
      const config=configs[(Math.abs(Math.floor(seed))+i)%configs.length];
      const total=Number(MATHNET_ARCHIVE_CACHE.configTotals[config]||0);
      let offset=Number(MATHNET_ARCHIVE_CACHE.configOffsets[config]||0);
      if(total>100){
        const pseudo=Math.abs(Math.sin(seed*0.000001+(i+1)*17.17)*43758.5453);
        offset=Math.floor((pseudo-Math.floor(pseudo))*Math.max(1,total-100));
      }
      try{
        const batch=await mathnetFetchRows(config,offset,100);
        MATHNET_ARCHIVE_CACHE.configTotals[config]=batch.total;
        MATHNET_ARCHIVE_CACHE.configOffsets[config]=Math.max(Number(MATHNET_ARCHIVE_CACHE.configOffsets[config]||0),offset+batch.rows.length);
        archiveAddRows(batch.rows);
      }catch{}
      pool=MATHNET_ARCHIVE_CACHE.rows.filter(acceptable);
    }
  }

  const byCat={A:[],C:[],G:[],N:[]};
  pool.forEach(function(q){
    if(q&&q.id&&!byCat[q.category])byCat[q.category]=[];
    if(q&&q.id)byCat[q.category].push(q);
  });

  const picked=[];
  const used=new Set();
  for(let i=0;i<count;i++){
    const cat=sequence?sequence[i]:categories[i%categories.length];
    const list=byCat[cat]||[];
    let candidate=null;
    if(list.length){
      const start=Math.abs(Math.floor(seed+i*31))%list.length;
      for(let j=0;j<list.length;j++){
        const q=list[(start+j)%list.length];
        if(q&&q.id&&!used.has(q.id)){candidate=q;break;}
      }
    }
    if(!candidate){
      for(const q of pool){
        if(q&&q.id&&!used.has(q.id)){candidate=q;break;}
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
