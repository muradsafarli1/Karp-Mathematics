const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATASET = process.env.MATHNET_DATASET || 'ShadenA/MathNet';
const CONFIG = process.env.MATHNET_CONFIG || 'all';
const SPLIT = process.env.MATHNET_SPLIT || 'train';
const SYNC_VERSION = process.env.MATHNET_SYNC_VERSION || '2026-09-28-v9';
const HF_ROWS = 'https://datasets-server.huggingface.co/rows';
const HF_FILTER = 'https://datasets-server.huggingface.co/filter';
const PAGE_SIZE = 100;
const CONCURRENCY = Math.max(2, Math.min(10, Number(process.env.MATHNET_SYNC_CONCURRENCY || 8)));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /render\\.com|onrender\\.com/i.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX || 6)
    })
  : null;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.gif':'image/gif',
  '.ico':'image/x-icon'
};

const ENGLISH_WORDS = new Set(
  'a an and are as assume because by can consider find for from given hence if in is it let may not of on or prove show since such suppose than that the then therefore this to we which with where when will would thus'.split(' ')
);
const FOREIGN_WORDS = new Set(
  'der die das und ist sind eine einer nicht für mit von zu que para por una uno los las del como pero esta este son una des le la les dans avec pour une et est sont sur ce ces cette mais alors es se não nao uma um dos das em quando seu sua'.split(' ')
);

function stripMath(text){
  return String(text || '')
    .replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g,' ')
    .replace(/\\$\\$[\\s\\S]*?\\$\\$/g,' ')
    .replace(/\\\\[[\\s\\S]*?\\\\]/g,' ')
    .replace(/\\\\([\\s\\S]*?\\\\)/g,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\\\\[A-Za-z]+[*]?/g,' ')
    .replace(/[{}_^$\\]/g,' ')
    .replace(/[0-9]+/g,' ');
}

function looksEnglish(text){
  const raw=stripMath(text).toLowerCase();
  if(!raw.trim())return false;
  if(/[\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Arabic}\\p{Script=Han}]/u.test(raw))return false;
  const tokens=raw.match(/[\\p{L}]+/gu)||[];
  if(tokens.length<3)return true;
  const foreign=tokens.filter(x=>FOREIGN_WORDS.has(x)).length;
  const english=tokens.filter(x=>ENGLISH_WORDS.has(x)).length;
  if(foreign>=2&&foreign>english)return false;
  if(english>=1)return true;
  return tokens.length<=12&&foreign===0;
}

function categoryFor(row){
  const topics=(Array.isArray(row.topics_flat)?row.topics_flat:[]).join(' ').toLowerCase();
  const text=String(row.problem_markdown||'').toLowerCase();
  const rules=[
    ['G',/(geometry|triangle|circle|angle|polygon|quadrilateral|concyclic|similarity|incircle|circumcircle|solid geometry)/],
    ['N',/(number theory|divisib|prime|integer|diophant|congruence|modular|gcd|lcm|factor|remainder)/],
    ['C',/(combinatorics|counting|graph theory|permutation|combination|pigeonhole|invariant|coloring|probability)/],
    ['A',/(algebra|equation|polynomial|inequal|functional equation|sequence|series|absolute value)/]
  ];
  for(const item of rules)if(item[1].test(topics)||item[1].test(text))return item[0];
  return 'A';
}

function yearFor(row){
  if(row.year!=null&&String(row.year).trim())return String(row.year).trim();
  const source=[row.source_booklet,row.booklet_source,row.competition].map(x=>String(x||'')).join(' ');
  const m=source.match(/(?:^|[^0-9])(19\\d{2}|20\\d{2})(?:[^0-9]|$)/);
  return m?m[1]:'';
}

function problemNumberFor(row){
  if(row.problem_number!=null&&String(row.problem_number).trim()){
    const v=String(row.problem_number).trim();
    return /^P/i.test(v)?v:'P'+v;
  }
  const text=String(row.problem_markdown||'').replace(/<[^>]+>/g,' ');
  const patterns=[
    /(?:^|[\\n\\r])\\s*(?:#+\\s*)?(?:problem|question|problem\\s*no\\.?|no\\.)\\s*#?\\s*(\\d{1,2})\\b/i,
    /(?:^|[\\n\\r])\\s*\\*{0,2}\\s*(\\d{1,2})\\s*[\\.)]\\s*/,
    /\\bP\\s*([1-9]\\d?)\\b/i
  ];
  for(const re of patterns){
    const m=text.match(re);
    if(m)return 'P'+m[1];
  }
  return '';
}

function displayTitle(competition,year,problemNumber){
  const base=String(competition||'MathNet').trim();
  const y=String(year||'').trim();
  const p=String(problemNumber||'').trim();
  const parts=[];
  if(y&&!new RegExp('(?:^|[^0-9])'+y.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g,'\\\\$&')+'(?:[^0-9]|$)').test(base))parts.push(y);
  if(p&&!base.toLowerCase().includes(p.toLowerCase()))parts.push(p);
  return parts.length?base+' — '+parts.join(' · '):base;
}

function cleanMathDelimiters(text){
  return String(text||'')
    .replace(/\\\\\\[/g,'\\[')
    .replace(/\\\\\\]/g,'\\]')
    .replace(/\\\\\\(/g,'\\(')
    .replace(/\\\\\\)/g,'\\)');
}

function rowIsGood(row){
  const lang=String(row.language||'').trim().toLowerCase();
  if(!(lang==='english'||lang==='en'||lang.startsWith('en-')))return false;
  const statement=cleanMathDelimiters(row.problem_markdown||'').trim();
  if(!statement||!looksEnglish(statement))return false;
  const solutions=Array.isArray(row.solutions_markdown)
    ?row.solutions_markdown.map(x=>String(x||'').trim()).filter(Boolean)
    :[];
  if(!solutions.length||!solutions.every(looksEnglish))return false;
  const type=String(row.problem_type||'').trim().toLowerCase();
  return type==='proof'||type==='proof only'||type==='proof and answer';
}

function normalizeRow(raw){
  const row=raw&&raw.row?raw.row:raw||{};
  const sourceIndex=Number(raw&&raw.row_idx!=null?raw.row_idx:-1);
  const id=String(row.unique_id||row.id||('mathnet-'+sourceIndex));
  const statement=cleanMathDelimiters(row.problem_markdown||'').trim();
  const solutions=Array.isArray(row.solutions_markdown)
    ?row.solutions_markdown.map(x=>cleanMathDelimiters(x).trim()).filter(Boolean)
    :[];
  const competition=String(row.competition||'').trim()||'MathNet';
  const year=yearFor(row);
  const problemNumber=problemNumberFor(row);
  return {
    id,
    sourceIndex,
    country:String(row.country||'').trim(),
    competition,
    year,
    section:String(row.section||'').trim(),
    problemNumber,
    sourceBooklet:String(row.source_booklet||'').trim(),
    bookletSource:String(row.booklet_source||'').trim(),
    language:'English',
    problemType:String(row.problem_type||'').trim(),
    statement,
    solutions,
    category:categoryFor(row),
    difficulty:difficultyFor(row),
    hasSolution:true,
    hasImages:!!row.has_images || /attached_image_\\d+\\.png/i.test(statement),
    finalAnswer:row.final_answer==null?'':String(row.final_answer||''),
    title:displayTitle(competition,year,problemNumber)
  };
}

function difficultyFor(row){
  const text=String(row.problem_markdown||'');
  const topicCount=Array.isArray(row.topics_flat)?row.topics_flat.length:0;
  const competition=String(row.competition||'').toLowerCase();
  let score=Math.min(4,Math.floor(text.length/900))+Math.min(2,Math.max(0,topicCount-1));
  if(/imo|shortlist|tst|olympiad/.test(competition))score++;
  return score>=3?'hard':'easy';
}

function searchTextFor(q){
  return [q.title,q.country,q.competition,q.year,q.problemNumber,q.section,q.sourceBooklet,q.bookletSource,stripMath(q.statement)]
    .filter(Boolean).join(' ');
}

async function initSchema(){
  if(!pool)return false;
  await pool.query(
    'CREATE TABLE IF NOT EXISTS mathnet_problems ('+
    'id TEXT PRIMARY KEY,'+
    'sync_version TEXT NOT NULL,'+
    'source_index INTEGER NOT NULL,'+
    'country TEXT NOT NULL DEFAULT \'\','+
    'competition TEXT NOT NULL DEFAULT \'\','+
    'year TEXT,'+
    'section TEXT,'+
    'problem_number TEXT,'+
    'source_booklet TEXT,'+
    'booklet_source TEXT,'+
    'language TEXT NOT NULL DEFAULT \'English\','+
    'problem_type TEXT NOT NULL DEFAULT \'\','+
    'category CHAR(1) NOT NULL DEFAULT \'A\','+
    'difficulty TEXT NOT NULL DEFAULT \'easy\','+
    'statement TEXT NOT NULL,'+
    'solutions JSONB NOT NULL DEFAULT \'[]\'::jsonb,'+
    'final_answer TEXT,'+
    'has_images BOOLEAN NOT NULL DEFAULT FALSE,'+
    'search_text TEXT NOT NULL DEFAULT \'\','+
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()'+
    ')'
  );
  await pool.query('CREATE TABLE IF NOT EXISTS mathnet_sync_state (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_mathnet_category ON mathnet_problems(category)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_mathnet_diff ON mathnet_problems(difficulty)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_mathnet_year ON mathnet_problems(year)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_mathnet_source ON mathnet_problems(source_index)');
  return true;
}

async function hfJson(url){
  const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Hugging Face HTTP '+response.status);
  return response.json();
}

async function fetchFiltered(offset){
  const u=new URL(HF_FILTER);
  u.searchParams.set('dataset',DATASET);
  u.searchParams.set('config',CONFIG);
  u.searchParams.set('split',SPLIT);
  u.searchParams.set('where','"language"=\'English\' AND ("problem_type"=\'proof\' OR "problem_type"=\'proof only\' OR "problem_type"=\'proof and answer\')');
  u.searchParams.set('offset',String(offset));
  u.searchParams.set('length',String(PAGE_SIZE));
  return hfJson(u);
}

let syncPromise=null;
let indexCache=null;
let indexCacheVersion=null;

async function syncMathNet(){
  if(!pool)throw new Error('DATABASE_URL is not configured.');
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    console.log('[MathNet] sync started');
    const first=await fetchFiltered(0);
    const total=Number(first.num_rows_total||0);
    const offsets=[];
    for(let offset=0;offset<total;offset+=PAGE_SIZE)offsets.push(offset);

    let cursor=0;
    let fetched=0;
    const rows=[];
    const goodOffsets=new Set();

    async function load(offset){
      const payload=offset===0?first:await fetchFiltered(offset);
      const sourceRows=payload.rows||[];
      fetched+=sourceRows.length;
      rows.push(...sourceRows.map(normalizeRow).filter(rowIsGood));
      goodOffsets.add(offset);
    }

    async function worker(){
      while(true){
        const i=cursor++;
        if(i>=offsets.length)return;
        const offset=offsets[i];
        try{await load(offset)}
        catch(error){console.error('[MathNet] page failed',offset,error.message)}
      }
    }

    await Promise.all(Array.from({length:CONCURRENCY},worker));

    for(let round=1;round<=2;round++){
      const failed=offsets.filter(x=>!goodOffsets.has(x));
      if(!failed.length)break;
      for(const offset of failed){
        try{await load(offset)}
        catch(error){console.error('[MathNet] retry '+round+' failed',offset,error.message)}
      }
    }

    if(!offsets.every(x=>goodOffsets.has(x)))throw new Error('MathNet sync incomplete.');
    const unique=Array.from(new Map(rows.map(x=>[x.id,x])).values()).sort((a,b)=>a.sourceIndex-b.sourceIndex);

    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(let i=0;i<unique.length;i+=100){
        const batch=unique.slice(i,i+100);
        const values=[];
        const tuples=batch.map((q,j)=>{
          const base=j*19;
          const params=[
            q.id,SYNC_VERSION,q.sourceIndex,q.country,q.competition,q.year||null,q.section||null,q.problemNumber||null,
            q.sourceBooklet||null,q.bookletSource||null,q.language,q.problemType,q.category,q.difficulty,q.statement,
            JSON.stringify(q.solutions),q.finalAnswer||null,q.hasImages,searchTextFor(q)
          ];
          values.push(...params);
          return '('+params.map((_,k)=>'$'+(base+k+1)).join(',')+')';
        }).join(',');
        await client.query(
          'INSERT INTO mathnet_problems '+
          '(id,sync_version,source_index,country,competition,year,section,problem_number,source_booklet,booklet_source,language,problem_type,category,difficulty,statement,solutions,final_answer,has_images,search_text) '+
          'VALUES '+tuples+
          ' ON CONFLICT(id) DO UPDATE SET sync_version=EXCLUDED.sync_version,source_index=EXCLUDED.source_index,country=EXCLUDED.country,'+
          'competition=EXCLUDED.competition,year=EXCLUDED.year,section=EXCLUDED.section,problem_number=EXCLUDED.problem_number,'+
          'source_booklet=EXCLUDED.source_booklet,booklet_source=EXCLUDED.booklet_source,language=EXCLUDED.language,problem_type=EXCLUDED.problem_type,'+
          'category=EXCLUDED.category,difficulty=EXCLUDED.difficulty,statement=EXCLUDED.statement,solutions=EXCLUDED.solutions,'+
          'final_answer=EXCLUDED.final_answer,has_images=EXCLUDED.has_images,search_text=EXCLUDED.search_text,updated_at=NOW()',
          values
        );
      }
      await client.query('DELETE FROM mathnet_problems WHERE sync_version <> $1',[SYNC_VERSION]);
      await client.query(
        'INSERT INTO mathnet_sync_state(key,value,updated_at) VALUES($1,$2,NOW()),($3,$4,NOW()),($5,$6,NOW()) '+
        'ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',
        ['version',SYNC_VERSION,'source',DATASET,'row_count',String(unique.length)]
      );
      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{client.release()}

    indexCache=null;
    indexCacheVersion=null;
    console.log('[MathNet] sync complete: '+unique.length+' accepted / '+total+' filtered rows');
    return {totalFiltered:total,accepted:unique.length,fetched};
  })().finally(()=>{syncPromise=null});
  return syncPromise;
}

async function state(){
  if(!pool)return {available:false,ready:false,syncing:!!syncPromise,count:0,version:null};
  const result=await pool.query(
    'SELECT COUNT(*)::int AS count,(SELECT value FROM mathnet_sync_state WHERE key=\'version\') AS version FROM mathnet_problems'
  );
  const count=Number(result.rows[0]?.count||0);
  return {available:true,ready:count>0,syncing:!!syncPromise,count,version:result.rows[0]?.version||null,expectedVersion:SYNC_VERSION};
}

function publicMeta(row){
  return {
    id:row.id,
    sourceIndex:Number(row.source_index),
    country:row.country||'',
    competition:row.competition||'',
    year:row.year||'',
    section:row.section||'',
    problemNumber:row.problem_number||'',
    sourceBooklet:row.source_booklet||'',
    bookletSource:row.booklet_source||'',
    language:row.language||'English',
    problemType:row.problem_type||'',
    category:row.category||'A',
    difficulty:row.difficulty||'easy',
    hasSolution:true,
    hasImages:!!row.has_images,
    title:displayTitle(row.competition,row.year,row.problem_number)
  };
}

async function getIndex(){
  if(indexCache&&indexCacheVersion===SYNC_VERSION)return indexCache;
  const result=await pool.query(
    'SELECT id,source_index,country,competition,year,section,problem_number,source_booklet,booklet_source,language,problem_type,category,difficulty,has_images '+
    'FROM mathnet_problems ORDER BY COALESCE(year,\'\') DESC,country,competition,source_index'
  );
  indexCache=result.rows.map(publicMeta);
  indexCacheVersion=SYNC_VERSION;
  return indexCache;
}

async function getProblem(id){
  const result=await pool.query('SELECT * FROM mathnet_problems WHERE id=$1 LIMIT 1',[String(id)]);
  if(!result.rows.length)return null;
  return publicMetaWithContent(result.rows[0]);
}

function publicMetaWithContent(row){
  const x=publicMeta(row);
  return {
    ...x,
    statement:row.statement||'',
    solutions:Array.isArray(row.solutions)?row.solutions:[],
    finalAnswer:row.final_answer||''
  };
}

function intParam(value,fallback,min,max){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;
}

async function searchProblems(url){
  const q=String(url.searchParams.get('q')||'').trim();
  const category=String(url.searchParams.get('category')||'').trim().toUpperCase();
  const difficulty=String(url.searchParams.get('difficulty')||'').trim().toLowerCase();
  const limit=intParam(url.searchParams.get('limit'),80,1,300);
  const offset=intParam(url.searchParams.get('offset'),0,0,1000000);
  const params=[];
  const where=[];
  if(q){
    params.push('%'+q+'%');
    where.push('search_text ILIKE $'+params.length);
  }
  if(['A','C','G','N'].includes(category)){
    params.push(category);
    where.push('category=$'+params.length);
  }
  if(['easy','hard'].includes(difficulty)){
    params.push(difficulty);
    where.push('difficulty=$'+params.length);
  }
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  const countResult=await pool.query('SELECT COUNT(*)::int AS count FROM mathnet_problems'+clause,params);
  const rowsResult=await pool.query(
    'SELECT id,source_index,country,competition,year,section,problem_number,source_booklet,booklet_source,language,problem_type,category,difficulty,has_images '+
    'FROM mathnet_problems'+clause+' ORDER BY COALESCE(year,\'\') DESC,country,competition,source_index LIMIT '+limit+' OFFSET '+offset,
    params
  );
  return {total:Number(countResult.rows[0]?.count||0),problems:rowsResult.rows.map(publicMeta)};
}

async function randomProblems(url){
  const count=intParam(url.searchParams.get('count'),6,1,30);
  const categories=(url.searchParams.get('categories')||'A,C,G,N').split(',').map(x=>x.trim().toUpperCase()).filter(x=>['A','C','G','N'].includes(x));
  const difficulty=String(url.searchParams.get('difficulty')||'any').toLowerCase();
  const rawSequence=(url.searchParams.get('sequence')||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
  const sequence=rawSequence.length===count&&rawSequence.every(x=>['A','C','G','N'].includes(x))
    ?rawSequence:Array.from({length:count},(_,i)=>categories[i%categories.length]);
  const pools=new Map();

  for(const cat of [...new Set(sequence)]){
    const params=[cat];
    let clause='category=$1';
    if(difficulty==='easy'||difficulty==='hard'){
      params.push(difficulty);
      clause+=' AND difficulty=$2';
    }
    const result=await pool.query('SELECT * FROM mathnet_problems WHERE '+clause+' ORDER BY random() LIMIT '+Math.max(8,count*3),params);
    pools.set(cat,result.rows);
  }

  const used=new Set();
  const picked=[];
  for(const cat of sequence){
    let row=(pools.get(cat)||[]).find(x=>!used.has(x.id));
    if(!row&&difficulty!=='any'){
      const result=await pool.query('SELECT * FROM mathnet_problems WHERE category=$1 ORDER BY random() LIMIT 12',[cat]);
      row=result.rows.find(x=>!used.has(x.id));
    }
    if(!row){
      const result=await pool.query('SELECT * FROM mathnet_problems WHERE category = ANY($1::text[]) ORDER BY random() LIMIT 12',[categories.length?categories:['A','C','G','N']]);
      row=result.rows.find(x=>!used.has(x.id));
    }
    if(row){used.add(row.id);picked.push(publicMetaWithContent(row))}
  }
  return picked;
}

async function maybeStartSync(){
  if(!pool)return;
  try{
    await initSchema();
    const s=await state();
    if(!s.ready||s.version!==SYNC_VERSION)syncMathNet().catch(error=>console.error('[MathNet] background sync failed',error.message));
  }catch(error){console.error('[MathNet] startup database check failed',error.message)}
}

function sendJson(req,res,value,status,cache){
  const payload=Buffer.from(JSON.stringify(value));
  res.statusCode=status||200;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control',cache||'no-store');
  res.setHeader('Vary','Accept-Encoding');
  if(/gzip/i.test(String(req.headers['accept-encoding']||''))){
    zlib.gzip(payload,{level:6},function(error,data){
      if(error){res.end(payload);return}
      res.setHeader('Content-Encoding','gzip');
      res.end(data);
    });
  }else res.end(payload);
}

function sendError(req,res,message,status,extra){
  sendJson(req,res,{error:message,...(extra||{})},status||500);
}

function staticFile(req,res,pathname){
  const routes={
    '/':'/index.html','/problems':'/problems.html','/problem':'/problem.html',
    '/contests':'/contests.html','/contest':'/contest.html','/articles':'/articles.html','/article':'/article.html',
    '/exams':'/exams.html','/exam':'/exam.html','/videos':'/videos.html','/about':'/about.html',
    '/account':'/account.html','/admin':'/admin.html','/login':'/login.html','/signup':'/signup.html',
    '/mock':'/mock.html','/calculator':'/calculator.html','/desmos':'/desmos.html','/geogebra':'/geogebra.html'
  };
  let requestPath=routes[pathname]||pathname;
  if(!path.extname(requestPath))requestPath+='.html';
  const absolute=path.resolve(ROOT,'.'+requestPath);
  if(!absolute.startsWith(ROOT+path.sep)&&absolute!==path.join(ROOT,requestPath)){res.statusCode=403;res.end('Forbidden');return}
  fs.readFile(absolute,function(error,data){
    if(error){res.statusCode=error.code==='ENOENT'?404:500;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(error.code==='ENOENT'?'Not found':'Server error');return}
    const ext=path.extname(absolute).toLowerCase();
    res.statusCode=200;
    res.setHeader('Content-Type',MIME[ext]||'application/octet-stream');
    res.setHeader('Cache-Control',(ext==='.html'||ext==='.js'||ext==='.css')?'public,max-age=300':'public,max-age=86400');
    res.end(data);
  });
}

const server=http.createServer(async function(req,res){
  try{
    if(req.method==='OPTIONS'){
      res.statusCode=204;
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.end();
      return;
    }
    const url=new URL(req.url,'http://'+(req.headers.host||'localhost'));
    if(url.pathname.startsWith('/api/mathnet/')){
      res.setHeader('Access-Control-Allow-Origin','*');
      if(url.pathname==='/api/mathnet/status'){
        const s=await state();
        sendJson(req,res,{...s,dataset:DATASET,rule:'English statement + proof/proof-only/proof-and-answer + fully English supplied solutions'});
        return;
      }
      if(url.pathname==='/api/mathnet/index'){
        const s=await state();
        if(!s.ready){
          sendError(req,res,'MathNet index is still being built on the server.',503,{warmingUp:true,syncing:s.syncing,count:s.count});
          return;
        }
        sendJson(req,res,{source:DATASET,version:SYNC_VERSION,total:s.count,problems:await getIndex()},200,'public,max-age=300,stale-while-revalidate=86400');
        return;
      }
      if(url.pathname==='/api/mathnet/search'){
        if(!pool){sendError(req,res,'PostgreSQL is not configured.',500);return}
        const result=await searchProblems(url);
        sendJson(req,res,result,200,'public,max-age=30,stale-while-revalidate=300');
        return;
      }
      if(url.pathname==='/api/mathnet/random'){
        if(!pool){sendError(req,res,'PostgreSQL is not configured.',500);return}
        const problems=await randomProblems(url);
        sendJson(req,res,{source:DATASET,total:problems.length,problems},200,'no-store');
        return;
      }
      const match=url.pathname.match(/^\\/api\\/mathnet\\/problem\\/(.+)$/);
      if(match){
        const problem=await getProblem(decodeURIComponent(match[1]));
        if(!problem){sendError(req,res,'Problem not found.',404);return}
        if(problem.hasImages&&problem.statement.includes('attached_image_')&&problem.sourceIndex>=0){
          try{
            const u=new URL(HF_ROWS);
            u.searchParams.set('dataset',DATASET);
            u.searchParams.set('config',CONFIG);
            u.searchParams.set('split',SPLIT);
            u.searchParams.set('offset',String(problem.sourceIndex));
            u.searchParams.set('length','1');
            const source=await hfJson(u);
            const row=source.rows?.[0]?.row||{};
            const images=Array.isArray(row.images)?row.images.map(x=>typeof x==='string'?x:x?.src||'').filter(Boolean):[];
            if(images.length){
              problem.statement=problem.statement.replace(/!\\[([^\\]]*)\\]\\(attached_image_(\\d+)\\.png\\)/g,function(_,alt,n){
                return images[Number(n)-1]?'!['+(alt||'Figure')+']('+images[Number(n)-1]+')':'';
              });
            }
          }catch(error){console.error('[MathNet] image refresh failed',problem.id,error.message)}
        }
        sendJson(req,res,problem,200,'public,max-age=300');
        return;
      }
      sendError(req,res,'Unknown MathNet endpoint.',404);
      return;
    }
    staticFile(req,res,url.pathname);
  }catch(error){
    console.error('[KARP] request error',error);
    sendError(req,res,error.message||'Server error',500);
  }
});

server.on('clientError',function(_err,socket){
  try{socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n')}catch(_){}
});

maybeStartSync().finally(function(){
  server.listen(PORT,function(){console.log('KARP server listening on port '+PORT)});
});
