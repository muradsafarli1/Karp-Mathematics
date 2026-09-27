(function initTheme(){
  const saved = localStorage.getItem('able_theme');
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
})();

(function injectSharedStyles(){
  const style = document.createElement('style');
  style.textContent = `
    .theme-toggle{width:38px;height:38px;border:1px solid #30343d;background:#15181d;color:#f3f5f8;border-radius:10px;font-size:17px;display:grid;place-items:center;padding:0;line-height:1}
    .theme-toggle:hover{background:#22262d;transform:translateY(-1px)}
    .language-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--line,#292d34);background:var(--panel,#101216);border-radius:10px;margin-bottom:28px}
    .language-switch button{border:0;background:transparent;color:#858b96;padding:7px 12px;border-radius:7px;font-size:12px;font-weight:800;letter-spacing:.6px}
    .language-switch button.active{background:#eef0ff;color:#101218}
    .detail-content{font-size:19px;line-height:1.9;color:var(--text);white-space:pre-wrap}
    .detail-content mjx-container{white-space:normal}
    .print-answer-space{display:none}
    .detail-image{display:block;max-width:100%;max-height:520px;margin:28px auto;border-radius:12px;object-fit:contain}
    .solution-reveal{margin-top:38px;padding-top:0}
    .solution-content{display:none;margin-top:30px;padding-top:28px;border-top:1px solid rgba(255,255,255,.12)}
    .solution-content.open{display:block}
    .contest-problem,.article-paper,.problem-detail,.problem-solution{background:transparent!important;box-shadow:none!important}
    .contest-problem{padding:38px 0!important}
    .contest-problem+.contest-problem{border-top:1px solid rgba(255,255,255,.08)!important;margin-top:8px}
    .contest-problem-heading span{border:0!important;background:transparent!important;padding:0!important;min-width:0!important;height:auto!important;font-size:21px!important;letter-spacing:.5px}
    .detail-divider{height:1px;background:rgba(255,255,255,.12);margin:42px 0}
    .exam-finished-screen{min-height:100vh;display:grid;place-items:center;padding:40px 20px;background:var(--bg,#08090b)}
    .exam-finished-card{width:min(720px,100%);text-align:center;padding:52px 40px;border:1px solid #292d34;border-radius:22px;background:#101216}
    .exam-finished-card h1{font-family:'Space Grotesk';font-size:clamp(42px,6vw,70px);letter-spacing:-3px;margin:8px 0 18px}
    .exam-finished-card p{color:#9aa0aa;line-height:1.75}
    .exam-finished-actions{display:flex;justify-content:center;gap:10px;margin-top:30px;flex-wrap:wrap}
    @media(max-width:700px){.language-switch{margin-bottom:22px}.exam-finished-card{padding:38px 22px}}
    html[data-theme="light"] body{background:#f7f7f5!important;color:#15171a!important}
    html[data-theme="light"] .top{background:rgba(247,247,245,.88)!important;border-bottom-color:#dedfdd!important}
    html[data-theme="light"] .navlinks{color:#656a72}
    html[data-theme="light"] .navlinks a:hover,html[data-theme="light"] .navlinks a.active{color:#111!important}
    html[data-theme="light"] .brand{color:#111}
    html[data-theme="light"] .theme-toggle{background:#fff;color:#16181b;border-color:#d5d7d5}
    html[data-theme="light"] .btn{background:#fff;color:#17191c;border-color:#d3d5d8}
    html[data-theme="light"] .btn:hover{background:#f0f1f2}
    html[data-theme="light"] .btn.primary{background:#17191c;color:#fff;border-color:#17191c}
    html[data-theme="light"] .btn.primary:hover{background:#000}
    html[data-theme="light"] .language-switch{background:#fff;border-color:#d9dbde}
    html[data-theme="light"] .language-switch button{color:#73777e}
    html[data-theme="light"] .language-switch button.active{background:#17191c;color:#fff}
    html[data-theme="light"] .pagehero,html[data-theme="light"] .contest-hero{background:radial-gradient(circle at 80% 0,rgba(110,120,220,.10),transparent 30%),#f7f7f5!important;border-bottom-color:#dedfdd!important}
    html[data-theme="light"] .section,html[data-theme="light"] .contest-page,html[data-theme="light"] .article-page{background:#f7f7f5!important}
    html[data-theme="light"] .pagehero h1,html[data-theme="light"] .contest-hero h1,html[data-theme="light"] .article-paper,html[data-theme="light"] .question-text,html[data-theme="light"] .problem-number{color:#17191c!important}
    html[data-theme="light"] .lead,html[data-theme="light"] .card p,html[data-theme="light"] .exam-card p,html[data-theme="light"] .small,html[data-theme="light"] .article-paper p{color:#626770!important}
    html[data-theme="light"] .card,html[data-theme="light"] .exam-card,html[data-theme="light"] .bigcard,html[data-theme="light"] .admin-side,html[data-theme="light"] .admin-main,html[data-theme="light"] .editor-card,html[data-theme="light"] .authbox{background:#fff!important;border-color:#dedfe2!important;box-shadow:0 12px 35px rgba(0,0,0,.05)}
    html[data-theme="light"] .input,html[data-theme="light"] .select,html[data-theme="light"] .textarea{background:#fff!important;color:#17191c!important;border-color:#d4d7da!important}
    html[data-theme="light"] .footer{background:#f7f7f5!important;border-top-color:#dedfdd!important}
    html[data-theme="light"] .footlinks{color:#666b73}
    html[data-theme="light"] .rows,html[data-theme="light"] .row,html[data-theme="light"] .history-list,html[data-theme="light"] .history-row{border-color:#dedfe2!important}
    html[data-theme="light"] .contest-problem+.contest-problem,html[data-theme="light"] .detail-divider,html[data-theme="light"] .solution-content{border-color:#d9dbde!important}
    html[data-theme="light"] .tag,html[data-theme="light"] .eyebrow{color:#70757e!important}
    html[data-theme="light"] .exam-screen{background:#f7f7f5!important;color:#17191c!important}
    html[data-theme="light"] .exam-top{background:rgba(255,255,255,.94)!important;border-color:#d9dbdf!important}
    html[data-theme="light"] .exam-top h1,html[data-theme="light"] .exam-paper-title h2{color:#17191c!important}
    html[data-theme="light"] .exam-clock{color:#17191c}
    html[data-theme="light"] .exam-question{border-bottom-color:#dedfe2!important}
    @media print{
      body{background:#fff!important;color:#111!important}
      .top,.footer,.exam-actions,.contest-actions,.article-actions,.btn,.theme-toggle,.language-switch{display:none!important}
      .exam-screen{padding:0!important;background:#fff!important}
      .exam-top{position:static!important;display:block!important;border:0!important;background:#fff!important;padding:0 0 18px!important}
      .exam-top h1{color:#111!important;font-size:30px!important;margin:8px 0!important}
      .exam-label{color:#555!important}.exam-clock{display:none!important}
      .exam-paper{width:100%!important;margin:25px 0!important}
      .exam-paper-title{margin-bottom:35px!important}
      .exam-paper-title h2,.exam-paper-title p,.problem-number,.question-text{color:#111!important}
      .exam-question{break-inside:avoid;border-bottom:0!important;padding:28px 0!important}
      .question-text{font-size:17px!important;line-height:1.75!important}
      .print-answer-space{display:block!important;height:145px;border-bottom:1px solid #aaa;margin-top:24px}
      .detail-content{color:#111!important}.detail-image{max-height:430px}
    }
  `;
  document.head.appendChild(style);
})();

let __fb=null;
let __authReady=null;
async function fb(){
  if(!__fb){
    __fb=await import('/firebase.js');
    __authReady=new Promise(resolve=>{
      const off=__fb.auth.onAuthStateChanged(user=>{off();resolve(user);});
    });
  }
  return __fb;
}
async function authReady(){
  await fb();
  return __authReady;
}
function publicExam(exam){
  const safe={...exam};
  delete safe.registrations;
  delete safe.submissions;
  safe.questions=(Array.isArray(exam.questions)?exam.questions:[]).map(q=>{
    const out={...q};
    delete out.solution;
    return out;
  });
  return safe;
}
async function api(path, opts = {}) {
  const {db,auth}=await fb();
  await authReady();
  const fs=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const {collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc}=fs;
  const method=(opts.method||'GET').toUpperCase();
  let body={};
  try{body=opts.body?JSON.parse(opts.body):{}}catch{}
  const uid=auth.currentUser?.uid||null;
  let user=null;
  if(path==='/api/me'){
    if(uid){
      const userDoc=await getDoc(doc(db,'users',uid));
      if(userDoc.exists()) user={id:uid,...userDoc.data()};
    }
    return {user:user?{id:user.id,name:user.name,email:user.email,role:user.role||'user',createdAt:user.createdAt}:null};
  }
  if(path==='/api/logout'){await (await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')).signOut(auth);return {ok:true};}
  if(uid && (path.startsWith('/api/exams/history') || path.match(/^\/api\/exams\/[^/]+\/(register|submit)$/) || path.startsWith('/api/admin/'))){
    const userDoc=await getDoc(doc(db,'users',uid));
    if(userDoc.exists()) user={id:uid,...userDoc.data()};
  }
  if(path==='/api/content'){
    // Public content is stored in Firestore and these collections are readable
    // by everyone according to firestore.rules. The previous implementation
    // returned empty arrays here, so items saved successfully in Admin could
    // never appear on the public site.
    const [problemsSnap,articlesSnap,contestsSnap,videosSnap]=await Promise.all([
      getDocs(collection(db,'problems')),
      getDocs(collection(db,'articles')),
      getDocs(collection(db,'contests')),
      getDocs(collection(db,'videos'))
    ]);
    return {
      problems: problemsSnap.docs.map(x=>({id:x.id,...x.data()})),
      articles: articlesSnap.docs.map(x=>({id:x.id,...x.data()})),
      contests: contestsSnap.docs.map(x=>({id:x.id,...x.data()})),
      videos: videosSnap.docs.map(x=>({id:x.id,...x.data()}))
    };
  }
  if(path==='/api/exams'){
    const snap=await getDocs(collection(db,'exams'));
    return {exams:snap.docs.map(x=>({id:x.id,...x.data()})).map(publicExam)};
  }
  if(path==='/api/exams/history'){
    if(!user) throw new Error('Authentication required');
    const snap=await getDocs(collection(db,'exams')),history=[];
    for(const x of snap.docs){
      const sub=await getDoc(doc(db,'exams',x.id,'submissions',uid));
      if(sub.exists()){
        const s=sub.data();
        history.push({examId:x.id,title:x.data().titleEn||x.data().title||'',titleEn:x.data().titleEn||x.data().title||'',titleAz:x.data().titleAz||'',submittedAt:s.submittedAt,answers:s.answers||{}});
      }
    }
    history.sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)); return {history};
  }
  const em=path.match(/^\/api\/exams\/([^/]+)$/);
  if(em&&method==='GET'){const s=await getDoc(doc(db,'exams',em[1]));if(!s.exists())throw new Error('Exam not found');return {exam:publicExam({id:s.id,...s.data()})};}
  const er=path.match(/^\/api\/exams\/([^/]+)\/(register|submit)$/);
  if(er&&method==='POST'){
    if(!user) throw new Error('Authentication required');
    const examRef=doc(db,'exams',er[1]),examSnap=await getDoc(examRef);
    if(!examSnap.exists()) throw new Error('Exam not found');
    if(er[2]==='register'){
      await setDoc(doc(db,'exams',er[1],'registrations',uid),{userId:uid,registeredAt:new Date().toISOString()},{merge:true});
      return {ok:true};
    }
    await setDoc(doc(db,'exams',er[1],'submissions',uid),{userId:uid,userName:user.name,answers:body.answers||{},startedAt:body.startedAt||null,submittedAt:new Date().toISOString(),reason:body.reason||'manual'});
    return {ok:true};
  }
  const am=path.match(/^\/api\/admin\/(problems|articles|contests|videos|exams)(?:\/([^/]+))?$/);
  if(am){
    if(!user||user.role!=='admin') throw new Error('Admin access required');
    const type=am[1],id=am[2],ref=id?doc(db,type,id):null;
    if(method==='GET'){
      if(type==='users') return {users:[]};
      const snap=await getDocs(collection(db,type));
      if(type==='exams'){
        const exams=[];
        for(const x of snap.docs){
          const [regs,subs]=await Promise.all([
            getDocs(collection(db,'exams',x.id,'registrations')),
            getDocs(collection(db,'exams',x.id,'submissions'))
          ]);
          exams.push({id:x.id,...x.data(),registrationsCount:regs.size,submissionsCount:subs.size});
        }
        return {exams};
      }
      return type==='videos'?{videos:snap.docs.map(x=>({id:x.id,...x.data()}))}:snap.docs.map(x=>({id:x.id,...x.data()}));
    }
    if(method==='POST'){
      const item={...body,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
      if(type==='exams'){item.questions=(Array.isArray(item.questions)?item.questions:[]).map((q,i)=>({...q,id:q.id||crypto.randomUUID(),code:q.code||'Q'+(i+1)}));item.registrations=[];item.submissions=[];await setDoc(doc(db,type,item.id),item);return item;}
      await setDoc(doc(db,type,item.id),item);return item;
    }
    if(method==='PUT'){await updateDoc(ref,{...body,id,updatedAt:new Date().toISOString()});const s=await getDoc(ref);return {id:s.id,...s.data()};}
    if(method==='DELETE'){await deleteDoc(ref);return {ok:true};}
  }
  if(path==='/api/admin/users'&&method==='GET'){
    if(!user||user.role!=='admin') throw new Error('Admin access required');
    const snap=await getDocs(collection(db,'users'));return {users:snap.docs.map(x=>({id:x.id,...x.data()}))};
  }
  throw new Error('Not found');
}
function toggleTheme(){const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('able_theme',next);const b=document.getElementById('theme-toggle');if(b){b.textContent=next==='light'?'☾':'☀';b.title=next==='light'?'Switch to dark mode':'Switch to light mode'}}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
async function me(){try{return(await api('/api/me')).user}catch{return null}}
async function logout(){try{await api('/api/logout',{method:'POST'})}finally{location.href='/'}}
async function requireUser(){const u=await me();if(!u){location.href='/login.html';return null}return u}
async function requireAdmin(){const u=await me();if(!u||u.role!=='admin'){location.href='/login.html';return null}return u}
function escapeHtml(x=''){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nav(active){const links=[['Problems','/problems.html'],['Contests','/contests.html'],['Articles','/articles.html'],['Exams','/exams.html'],['Videos','/videos.html'],['About','/about.html']];const light=document.documentElement.dataset.theme==='light';const toolsMenu='<div class="nav-tool"><span class="nav-tool-label">Tools</span><div class="tools-menu"><a href="/desmos.html"><span>Desmos</span><small>Graphing Calculator</small></a><a href="/geogebra.html"><span>GeoGebra</span><small>Dynamic Mathematics</small></a><a href="/calculator.html"><span>Calculator</span><small>Scientific Calculator</small></a></div></div>';return `<header class="top"><div class="wrap nav"><a class="brand" href="/">ABLE</a><nav class="navlinks">${links.map(x=>`<a class="${active===x[0]?'active':''}" href="${x[1]}">${x[0]}</a>`).join('')}${toolsMenu}</nav><div class="actions" id="nav-actions"><button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()">${light?'☾':'☀'}</button><a class="btn ghost" href="/login.html">Login</a><a class="btn primary" href="/signup.html">Join Us</a></div></div></header>`}
async function updateNavUser(){const box=document.getElementById('nav-actions');if(!box)return;const u=await me();if(!u)return;const light=document.documentElement.dataset.theme==='light';box.innerHTML=`<button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()">${light?'☾':'☀'}</button><a class="btn ghost" href="/account.html">${escapeHtml(u.name)}</a>${u.role==='admin'?'<a class="btn" href="/admin.html">Admin</a>':''}<button class="btn primary" onclick="logout()">Log out</button>`}
function shell(active,title,body){document.title=`ABLE — ${title}`;document.body.innerHTML=nav(active)+body+footer();updateNavUser()}
function footer(){return `<footer class="footer"><div class="wrap footgrid"><div><div class="brand">ABLE</div><div class="small">Olympiad mathematics for serious problem solvers.</div></div><div class="footlinks"><a href="/problems.html">Problems</a><a href="/contests.html">Contests</a><a href="/articles.html">Articles</a><a href="/exams.html">Exams</a><a href="/videos.html">Videos</a><a href="/about.html">About Us</a></div></div></footer>`}
function currentLanguage(){return localStorage.getItem('able_lang')==='az'?'az':'en'}
function setLanguage(lang){localStorage.setItem('able_lang',lang);return lang}
function localized(item,field,lang=currentLanguage()){const az=item?.[`${field}Az`],en=item?.[`${field}En`],old=item?.[field];return lang==='az'?(az||en||old||''):(en||az||old||'')}
function languageSwitch(){const lang=currentLanguage();return `<div class="language-switch" role="group" aria-label="Language"><button type="button" class="${lang==='az'?'active':''}" data-lang="az">AZE</button><button type="button" class="${lang==='en'?'active':''}" data-lang="en">ENG</button></div>`}
function bindLanguageSwitch(renderFn){document.querySelectorAll('.language-switch button').forEach(b=>b.onclick=()=>{setLanguage(b.dataset.lang);renderFn()})}
function typesetMath(root){if(!root)return;if(window.MathJax?.typesetPromise)return MathJax.typesetPromise([root]).catch(console.error);setTimeout(()=>typesetMath(root),300)}
function formatDuration(m){m=Number(m||60);const h=Math.floor(m/60),mm=m%60;return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`}
