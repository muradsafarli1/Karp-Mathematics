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
    title:String(row.competition||'MathNet')+' — '+id,
    finalAnswer:row.final_answer==null?'':String(row.final_answer)
  };
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
  return (language==='english' || language==='en')
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

async function mathnetProblemById(id){
  const target=String(id||'').trim();
  if(!target)return null;
  const cached=MATHNET_ARCHIVE_CACHE.rows.find(function(q){return q.id===target;});
  if(cached)return cached;

  try{
    const result=await mathnetSearch(target,0,100);
    return result.rows.find(function(q){return q.id===target;})||null;
  }catch{
    return null;
  }
}

async function mathnetSearch(query,offset,length){
  const key=String(query||'').trim().toLowerCase();
  if(!key) return mathnetFilteredRows(offset,length);

  const url=new URL('https://datasets-server.huggingface.co/search');
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',MATHNET.config);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('query',key);
  url.searchParams.set('offset',String(Math.max(0,Math.floor(offset||0))));
  url.searchParams.set('length',String(Math.min(100,Math.max(1,length||100))));
  const res=await fetch(url,{headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error('MathNet search request failed ('+res.status+')');
  const data=await res.json();
  const rows=(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,i);})
    .filter(mathnetQualifies);
  return {total:rows.length,rows:rows,partial:false};
}

function mathnetSaveMock(mock){
  localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}));
}
function mathnetLoadMock(){
  try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null');}catch{return null;}
}
