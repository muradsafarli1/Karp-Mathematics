/* KARP MathNet question-pool connector.
   Source: ShadenA/MathNet on Hugging Face.
   The Dataset Viewer API exposes /rows in slices of at most 100 rows. */
const MATHNET_FILTER_WHERE = '"language"=\'en\' AND ("problem_type"=\'proof only\' OR "problem_type"=\'proof and answer\')';

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

async function mathnetFilteredRows(offset,length,whereExtra){
  const url=new URL('https://datasets-server.huggingface.co/filter');
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',MATHNET.config);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('where',MATHNET_FILTER_WHERE+(whereExtra?' AND ('+whereExtra+')':''));
  url.searchParams.set('offset',String(Math.max(0,Math.floor(offset||0))));
  url.searchParams.set('length',String(Math.min(100,Math.max(1,length||100))));
  url.searchParams.set('orderby','"id"');
  const res=await fetch(url,{headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error('MathNet filter request failed ('+res.status+')');
  const data=await res.json();
  return {
    total:Number(data.num_rows_total||0),
    rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,(offset||0)+i);}),
    partial:Boolean(data.partial)
  };
}

async function mathnetProblemById(id){
  const safe=String(id||'').replace(/'/g,"''");
  const data=await mathnetFilteredRows(0,1,'"id"=\''+safe+'\'');
  return data.rows[0]||null;
}

async function mathnetRows(offset,length){
  const url=new URL(MATHNET.endpoint);
  url.searchParams.set('dataset',MATHNET.dataset);
  url.searchParams.set('config',MATHNET.config);
  url.searchParams.set('split',MATHNET.split);
  url.searchParams.set('offset',String(Math.max(0,Math.floor(offset||0))));
  url.searchParams.set('length',String(Math.min(100,Math.max(1,length||100))));
  const res=await fetch(url,{headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error('MathNet request failed ('+res.status+')');
  const data=await res.json();
  return {
    total:Number(data.num_rows_total||0),
    rows:(data.rows||[]).map(function(x,i){return normalizeMathnetRow(x,(offset||0)+i);})
  };
}

async function mathnetFind(options){
  options=options||{};
  const categories=Array.isArray(options.categories)&&options.categories.length?options.categories:['A','C','G','N'];
  const difficulty=options.difficulty||'any';
  const types=Array.isArray(options.types)&&options.types.length?options.types:['proof','answer','proof-answer'];
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===Number(options.count||6)?options.sequence:null;
  const count=Math.max(1,Math.min(20,Number(options.count||6)));
  const seed=Number(options.seed||Date.now());
  const preferredLimit=Math.min(MATHNET.maxPreferredRows,900);
  let first=await mathnetRows(Math.floor(seed)%Math.max(1,preferredLimit-99),100);
  let pool=first.rows.slice();
  for(let pass=1;pass<8 && pool.length<Math.max(250,count*12);pass++){
    const offset=(Math.floor(seed/97)+pass*1379)%Math.max(1,preferredLimit-99);
    const batch=await mathnetRows(offset,100);
    pool=pool.concat(batch.rows);
  }
  const byCat={A:[],C:[],G:[],N:[]};
  const seen=new Set();
  pool.forEach(function(q){
    if(seen.has(q.id))return;
    seen.add(q.id);
    if(categories.indexOf(q.category)<0)return;
    if(difficulty!=='any'&&q.difficulty!==difficulty)return;
    if(types.indexOf(q.type)<0)return;
    byCat[q.category].push(q);
  });
  const picked=[],used=new Set();
  for(let i=0;i<count;i++){
    const cat=sequence?sequence[i]:categories[i%categories.length];
    const list=byCat[cat]||[];
    let candidate=list.find(function(q){return !used.has(q.id);});
    if(!candidate){
      const fallback=Object.values(byCat).flat().find(function(q){return !used.has(q.id);});
      candidate=fallback;
    }
    if(!candidate)break;
    used.add(candidate.id);
    picked.push(candidate);
  }
  return {questions:picked,total:first.total,source:'ShadenA/MathNet'};
}

function mathnetSaveMock(mock){
  localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}));
}
function mathnetLoadMock(){
  try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null');}catch{return null;}
}
