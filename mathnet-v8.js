/* KARP MathNet client v9
   The browser talks to KARP's PostgreSQL-backed MathNet API.
   Full problem statements/solutions are fetched only when a problem is opened
   or a mock is generated; the 28k+ archive is never scanned in the browser.
*/
const MATHNET_API='/api/mathnet';
const MATHNET_SOURCE='ShadenA/MathNet';
let __mathnetIndexPromise=null;

function mathnetCategory(row){return ['A','C','G','N'].includes(row?.category)?row.category:'A';}

async function mathnetLoadAllIndex(onProgress,onInitial){
  if(__mathnetIndexPromise)return __mathnetIndexPromise;
  __mathnetIndexPromise=(async()=>{
    const response=await fetch(MATHNET_API+'/index',{headers:{Accept:'application/json'},cache:'no-store'});
    const data=await response.json();
    if(!response.ok){
      const e=new Error(data.error||'MathNet archive is still warming up.');
      e.warmingUp=!!data.warmingUp;
      throw e;
    }
    const rows=(data.problems||[]).map(x=>({...x,category:mathnetCategory(x),hasSolution:true,sourceType:'mathnet'}));
    if(onInitial)onInitial(rows);
    if(onProgress)onProgress(rows.length,Number(data.total||rows.length),true,rows.length);
    return rows;
  })();
  try{return await __mathnetIndexPromise}finally{__mathnetIndexPromise=null;}
}

async function mathnetSearch(query,options={}){
  const q=String(query||'').trim();
  const category=String(options.category||'').trim().toUpperCase();
  const difficulty=String(options.difficulty||'').trim().toLowerCase();
  const params=new URLSearchParams();
  if(q)params.set('q',q);
  if(['A','C','G','N'].includes(category))params.set('category',category);
  if(['easy','hard'].includes(difficulty))params.set('difficulty',difficulty);
  params.set('limit',String(Math.min(200,Math.max(1,Number(options.limit||60)))));
  const response=await fetch(MATHNET_API+'/search?'+params.toString(),{headers:{Accept:'application/json'},cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'MathNet search failed.');
  return (data.problems||[]).map(x=>({...x,category:mathnetCategory(x),hasSolution:true,sourceType:'mathnet'}));
}

async function mathnetProblemById(id){
  const target=String(id||'').trim();
  if(!target)return null;
  const response=await fetch(MATHNET_API+'/problem/'+encodeURIComponent(target),{headers:{Accept:'application/json'},cache:'default'});
  if(response.status===404)return null;
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Could not load MathNet problem.');
  return {...data,category:mathnetCategory(data),hasSolution:true,sourceType:'mathnet'};
}

async function mathnetFind(options={}){
  const categories=Array.isArray(options.categories)&&options.categories.length
    ?options.categories.map(x=>String(x).toUpperCase()).filter(x=>['A','C','G','N'].includes(x))
    :['A','C','G','N'];
  const count=Math.max(1,Math.min(30,Number(options.count||6)));
  const difficulty=String(options.difficulty||'any');
  const sequence=Array.isArray(options.sequence)&&options.sequence.length===count
    ?options.sequence.map(x=>String(x).toUpperCase()):null;
  const params=new URLSearchParams({
    count:String(count),
    categories:categories.join(','),
    difficulty:difficulty
  });
  if(sequence)params.set('sequence',sequence.join(','));
  const response=await fetch(MATHNET_API+'/random?'+params.toString(),{headers:{Accept:'application/json'},cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Could not generate a MathNet mock.');
  return {
    questions:(data.problems||[]).map(x=>({...x,category:mathnetCategory(x),hasSolution:true,sourceType:'mathnet'})),
    total:Number(data.total||0),
    source:MATHNET_SOURCE
  };
}

function mathnetSaveMock(mock){
  localStorage.setItem('karp_last_mock',JSON.stringify({...mock,savedAt:new Date().toISOString()}));
}
function mathnetLoadMock(){
  try{return JSON.parse(localStorage.getItem('karp_last_mock')||'null')}catch{return null}
}

window.mathnetLoadAllIndex=mathnetLoadAllIndex;
window.mathnetSearch=mathnetSearch;
window.mathnetFind=mathnetFind;
window.mathnetProblemById=mathnetProblemById;
window.mathnetSaveMock=mathnetSaveMock;
window.mathnetLoadMock=mathnetLoadMock;
