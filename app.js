(function initTheme(){
  document.documentElement.dataset.theme = 'light';
})();

(function ensureFavicon(){
  if(!document.querySelector('link[rel="icon"]')){
    const link=document.createElement('link');
    link.rel='icon';
    link.type='image/svg+xml';
    link.href='/favicon.svg';
    document.head.appendChild(link);
  }
})();

(function injectSharedStyles(){
  const style = document.createElement('style');
  style.textContent = `

    .nav-profile{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;overflow:hidden;background:var(--panel2);color:var(--text);text-decoration:none;flex:0 0 34px}
    .nav-profile-img{width:100%;height:100%;object-fit:cover;display:block}.nav-profile-initial{font-size:12px;font-weight:800}
    .nav-logout{border:0;background:transparent;color:var(--muted);font-size:11px;padding:6px 4px;cursor:pointer;white-space:nowrap}
    .nav-logout:hover{color:var(--text)}
    .nav-admin{font-size:11px!important;padding:7px 10px!important}
    #auth-action-modal{display:none;position:fixed;inset:0;z-index:10000}
    #auth-action-modal.open{display:block}.auth-action-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(8px)}
    .auth-action-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 30px));padding:30px;border-radius:20px;background:var(--panel2);color:var(--text);box-shadow:0 30px 100px rgba(0,0,0,.45)}
    .auth-action-card h2{font-family:'Space Grotesk';font-size:30px;letter-spacing:-1px;margin:8px 0}.auth-action-card p{color:var(--muted);font-size:13px;line-height:1.7;margin:0 0 22px}
    .auth-action-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:var(--muted);font-size:25px;cursor:pointer}.auth-action-buttons{display:flex;gap:8px;flex-wrap:wrap}
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

  style.textContent += `/* KARP final visual normalization */
    html[data-theme="dark"]{
      --bg:#08090b;--panel:#101216;--panel2:#171a20;--line:#292d34;--text:#f3f4f6;--muted:#969ba5;
    }
    html[data-theme="light"]{
      --bg:#f7f7f5;--panel:#ffffff;--panel2:#f1f2f3;--line:#dfe1e4;--text:#17191c;--muted:#626770;
    }
    body,.section,.pagehero,.contest-page,.article-page,.account-page,.auth{background:var(--bg)!important;color:var(--text)!important}
    .top,.footer,.card,.exam-card,.bigcard,.account-card,.account-stat,.authbox,.admin-side,.admin-main,.editor-card{background:var(--panel)!important;color:var(--text)!important;border-color:transparent!important}
    .card p,.exam-card p,.lead,.small,.card-subtitle,.profile-meta span,.account-stat-label,.trend-label,.topic-line,.pace-grid span,.exam-history-row .small{color:var(--muted)!important}
    .btn,.google-btn,.theme-toggle,.language-switch{background:var(--panel2)!important;color:var(--text)!important;border-color:transparent!important}
    .problem-page .section,.contest-page .section,.article-page .section,.problem-page .pagehero,.contest-hero,.article-page .pagehero,.problem-detail,.problem-solution,.contest-paper,.article-paper,.contest-problem,.detail-actions{background:var(--bg)!important;color:var(--text)!important}
    .problem-detail,.problem-solution,.contest-paper,.article-paper,.contest-problem *{color:var(--text)!important}
    .detail-actions,.contest-problem+.contest-problem,.solution-content{border-color:transparent!important}
    .authbox .input,.input,.select,.textarea{background:var(--bg)!important;color:var(--text)!important;border-color:transparent!important}

    /* Restore the earlier, balanced detail proportions */
    .problem-page .section,.contest-page .section,.article-page .section{padding-top:70px!important;padding-bottom:70px!important}
    .problem-page .section>.wrap,.contest-page .section>.wrap,.article-page .section>.wrap{width:min(calc(100% - 42px),1240px)!important;max-width:1240px!important}
    .problem-detail,.article-paper,.contest-paper .question-text{font-size:19px!important;line-height:1.9!important}
    .problem-detail{min-height:0!important}.article-paper{min-height:0!important}
    .contest-problem{padding:38px 0!important;min-height:0!important;border-top-color:transparent!important;border-bottom-color:transparent!important}
    .detail-image{max-height:520px!important;margin:28px auto!important}
    .detail-actions{margin-top:55px!important;padding-top:0!important;border-top-color:transparent!important;box-shadow:none!important}`;
  style.textContent += `
/* KARP final surface — unified light gray */
html,html[data-theme="light"],html[data-theme="dark"]{
  --skin:#f7f7f5;--bg:var(--skin);--panel:#f7f7f5;--panel2:#f7f7f5;--line:#d9dad8;--text:#17191c;--muted:#666b73;--soft:#5f646b;
}
html,body{background:#f7f7f5!important;color:#17191c!important}
body,.top,.footer,.hero,.pagehero,.section,.contest-page,.article-page,.account-page,.auth,
.admin,.admin-side,.admin-main,.exam-screen,.exam-finished,.error-page,.problem-page,.mock-page,.exam-page,
.exam-active-shell,.exam-enter,.mock-session,.mock-top,.exam-active-top,.exam-active-body,
.problem-page .section,.problem-page .pagehero,.problem-detail,.problem-solution,
.contest-page .section,.contest-page .pagehero,.contest-paper,.contest-problem,
.article-page .section,.article-page .pagehero,.article-paper,.detail-actions,
.exam-review,.exam-paper,.exam-active-paper,.exam-enter-card,.mock-builder,.mock-field,
.past-box,.past-card,.mock-review,.mock-preview,.mock-paper{
  background:#f7f7f5!important;background-image:none!important;color:#17191c!important;
}
.card,.exam-card,.bigcard,.account-card,.account-stat,.authbox,.admin-mock-card,.live-presence,
.admin-exam-card,.admin-user-summary,.admin-kpi-bar,.admin-participants,.editor-card,.video-card{
  background:#f7f7f5!important;color:#17191c!important;border-color:#d9dad8!important;box-shadow:none!important;
}
.input,.select,.textarea,.video-search,.btn,.google-btn,.language-switch{
  background:#f7f7f5!important;color:#17191c!important;border-color:#d9dad8!important;
}
.btn.primary,.submit{background:#2f78b7!important;color:#fff!important;border-color:#2f78b7!important}
.problem-card-link,.problem-card-link:hover,.choice span,.difficulty,.active-card,.preview-question,
.session-question,.review-question,.exam-question{background:#f7f7f5!important}
.cards .card > .tag{background:#f7f7f5!important;border-color:#d9dad8!important;color:#666b73!important}
.status-badge{background:#f7f7f5!important;border-color:#d9dad8!important}
.admin-mock-questions section,.admin-kpi-bar div,.live-person{background:#f7f7f5!important;border-color:#d9dad8!important}
.detail-content,.problem-detail,.problem-solution,.contest-paper,.article-paper,.question-text,
.solution-content,.review-statement,.preview-statement,.session-statement{color:#17191c!important}
.detail-actions,.contest-problem+.contest-problem,.solution-content,.exam-question,.rows,.row,
.history-list,.history-row{border-color:#d9dad8!important}
.theme-toggle{display:none!important}
`;
  document.head.appendChild(style);
})();

let __fb=null;
let __authReady=null;
async function fb(){
  if(!__fb){
    const [{initializeApp},{getAuth},{getFirestore}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
    ]);
    const firebaseConfig={
      apiKey:"AIzaSyAjEd4pN33WpoJlT2rsAgDFMO3A4Uh-M4s",
      authDomain:"able-2ca24.firebaseapp.com",
      projectId:"able-2ca24",
      messagingSenderId:"784635231366",
      appId:"1:784635231366:web:fbde7a6daaf4e3e4f0e507",
      measurementId:"G-L9C4YX8MEJ"
    };
    const app=initializeApp(firebaseConfig);
    const auth=getAuth(app);
    const db=getFirestore(app);
    __fb={app,auth,db};
    __authReady=new Promise(async resolve=>{
      try{
        const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
        const off=onAuthStateChanged(auth,user=>{off();resolve(user);});
      }catch{resolve(null);}
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
  const {collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,runTransaction}=fs;
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
    return {user:user?{id:user.id,name:user.name,email:user.email,role:user.role||'user',createdAt:user.createdAt,photoURL:user.photoURL||''}:null};
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
    const [problemsSnap,articlesSnap,contestsSnap,videosSnap,aboutSnap]=await Promise.all([
      getDocs(collection(db,'problems')),
      getDocs(collection(db,'articles')),
      getDocs(collection(db,'contests')),
      getDocs(collection(db,'videos')),
      getDoc(doc(db,'about','global'))
    ]);
    return {
      problems: problemsSnap.docs.map(x=>({id:x.id,...x.data()})),
      articles: articlesSnap.docs.map(x=>({id:x.id,...x.data()})),
      contests: contestsSnap.docs.map(x=>({id:x.id,...x.data()})),
      videos: videosSnap.docs.map(x=>({id:x.id,...x.data()})),
      about:aboutSnap.exists()?{id:aboutSnap.id,...aboutSnap.data()}:{}
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
        const rawExam={id:x.id,...x.data()},safe=publicExam(rawExam),reviewQuestions=(rawExam.questions||[]).map(q=>({...q}));history.push({examId:x.id,title:safe.titleEn||safe.title||'',titleEn:safe.titleEn||safe.title||'',titleAz:safe.titleAz||'',submittedAt:s.submittedAt,answers:s.answers||{},questions:reviewQuestions});
      }
    }
    history.sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)); return {history};
  }
  const em=path.match(/^\/api\/exams\/([^/]+)$/);
  if(em&&method==='GET'){
    const s=await getDoc(doc(db,'exams',em[1]));
    if(!s.exists())throw new Error('Exam not found');
    const exam=publicExam({id:s.id,...s.data()});
    let registered=false;
    if(uid){
      const reg=await getDoc(doc(db,'exams',em[1],'registrations',uid));
      registered=reg.exists();
    }
    return {exam,registered};
  }
  const er=path.match(/^\/api\/exams\/([^/]+)\/(register|submit)$/);
  if(er&&method==='POST'){
    if(!user) throw new Error('Authentication required');
    const examRef=doc(db,'exams',er[1]),examSnap=await getDoc(examRef);
    if(!examSnap.exists()) throw new Error('Exam not found');
    if(er[2]==='register'){
      const subRef=doc(db,'exams',er[1],'submissions',uid),sub=await getDoc(subRef);
      if(sub.exists())throw new Error('This exam has already been completed.');
      await runTransaction(db,async tx=>{
        const examRef=doc(db,'exams',er[1]);
        const regRef=doc(db,'exams',er[1],'registrations',uid);
        const regSnap=await tx.get(regRef);
        const examForCount=await tx.get(examRef);
        if(regSnap.exists())return;
        const data=examForCount.data()||{};
        const current=Number(data.registrationCount||0);
        tx.set(regRef,{userId:uid,registeredAt:new Date().toISOString()},{merge:true});
        tx.update(examRef,{registrationCount:current+1});
      });
      return {ok:true};
    }
    const subRef=doc(db,'exams',er[1],'submissions',uid),existingSub=await getDoc(subRef);
    if(existingSub.exists())throw new Error('This exam has already been completed.');
    await setDoc(subRef,{userId:uid,userName:user.name,answers:body.answers||{},startedAt:body.startedAt||null,submittedAt:new Date().toISOString(),reason:body.reason||'manual'});
    return {ok:true};
  }
  const am=path.match(/^\/api\/admin\/(problems|articles|contests|videos|exams|about)(?:\/([^/]+))?$/);
  if(am){
    if(!user||user.role!=='admin') throw new Error('Admin access required');
    const type=am[1],id=am[2],aboutType=type==='about',aboutId='global',ref=doc(db,type,aboutType?(id||aboutId):(id||crypto.randomUUID()));
    if(method==='GET'){
      if(type==='users') return {users:[]};
      if(aboutType){
        const snap=await getDoc(ref);
        return {about:snap.exists()?{id:snap.id,...snap.data()}:{}};
      }
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
      const items=snap.docs.map(x=>({id:x.id,...x.data()}));
      return {[type]:items};
    }
    if(method==='POST'){
      const item={...body,id:aboutType?'global':crypto.randomUUID(),createdAt:new Date().toISOString()};
      if(aboutType){await setDoc(doc(db,'about','global'),item);return item;}
      if(type==='exams'){item.questions=(Array.isArray(item.questions)?item.questions:[]).map((q,i)=>({...q,id:q.id||crypto.randomUUID(),code:q.code||'Q'+(i+1)}));item.registrations=[];item.submissions=[];await setDoc(doc(db,type,item.id),item);return item;}
      await setDoc(doc(db,type,item.id),item);return item;
    }
    if(method==='PUT'){
      await updateDoc(ref,{...body,id:id||'global',updatedAt:new Date().toISOString()});
      const ss=await getDoc(ref);return {id:ss.id,...ss.data()};
    }
    if(method==='DELETE'){await deleteDoc(ref);return {ok:true};}
  }
  if(path==='/api/admin/users'&&method==='GET'){
    if(!user||user.role!=='admin') throw new Error('Admin access required');
    const [snap,presenceSnap]=await Promise.all([
      getDocs(collection(db,'users')),
      getDocs(collection(db,'presence'))
    ]);
    const now=Date.now(),presenceByUid=new Map();
    presenceSnap.forEach(x=>{
      const d=x.data()||{};
      const expires=d.expiresAt?.toMillis?d.expiresAt.toMillis():Number(d.expiresAt||0);
      const last=d.lastSeen?.toDate?d.lastSeen.toDate().toISOString():(d.lastSeen||null);
      presenceByUid.set(x.id,{...d,online:!!d.online&&expires>now,lastSeen:last});
    });
    return {users:snap.docs.map(x=>({
      id:x.id,...x.data(),
      ...(presenceByUid.get(x.id)||{online:false,lastSeen:null,activity:null})
    }))};
  }
  throw new Error('Not found');
}
function toggleTheme(){return false;}
function showAuthPrompt(title='Sign in to continue',message='Create an account or sign in to use this feature.'){
  let box=document.getElementById('auth-action-modal');
  if(!box){
    box=document.createElement('div');box.id='auth-action-modal';
    box.innerHTML='<div class="auth-action-backdrop"></div><div class="auth-action-card"><button class="auth-action-close" aria-label="Close">×</button><div class="eyebrow">KARP ACCOUNT</div><h2></h2><p></p><div class="auth-action-buttons"><a class="btn primary" href="/login.html">Sign in</a><a class="btn" href="/signup.html">Create account</a></div></div>';
    document.body.appendChild(box);
    const close=()=>box.classList.remove('open');
    box.querySelector('.auth-action-backdrop').onclick=close;
    box.querySelector('.auth-action-close').onclick=close;
  }
  box.querySelector('h2').textContent=title;
  box.querySelector('p').textContent=message;
  box.classList.add('open');
}
async function ensureSignedIn(title,message){
  const u=await me();
  if(!u){showAuthPrompt(title,message);return null;}
  return u;
}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}

async function karpUserState(){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid)return {solved:{},saved:{},mocks:[],activeMock:null};
  const {collection,getDocs,doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const [solvedSnap,savedSnap,mockSnap,activeSnap]=await Promise.all([
    getDocs(collection(db,'users',uid,'solved')),
    getDocs(collection(db,'users',uid,'saved')),
    getDocs(collection(db,'users',uid,'mockHistory')),
    getDoc(doc(db,'users',uid,'privateState','state'))
  ]);
  const solved={},saved={};
  solvedSnap.forEach(s=>solved[s.id]={id:s.id,...s.data()});
  savedSnap.forEach(s=>saved[s.id]={id:s.id,...s.data()});
  const mocks=mockSnap.docs.map(s=>({id:s.id,...s.data()})).sort((a,b)=>new Date(b.completedAt||b.createdAt||0)-new Date(a.completedAt||a.createdAt||0));
  const privateState=activeSnap.exists()?activeSnap.data():{};
  return {solved,saved,mocks,activeMock:privateState.activeMock||null};
}

async function karpMigrateLocalState(){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid)return;
  // v4 re-runs once on each device so browsers that already passed an older
  // migration can still merge their remaining local-only data into the cloud.
  const marker='karp_cloud_migrated_v4_'+uid;
  if(localStorage.getItem(marker))return;
  const {collection,doc,getDoc,getDocs,writeBatch}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  try{
    const [cloudSolved,cloudSaved,cloudMocks,cloudPrivate]=await Promise.all([
      getDocs(collection(db,'users',uid,'solved')),
      getDocs(collection(db,'users',uid,'saved')),
      getDocs(collection(db,'users',uid,'mockHistory')),
      getDoc(doc(db,'users',uid,'privateState','state'))
    ]);
    const solvedMap=new Map(cloudSolved.docs.map(s=>[s.id,s.data()]));
    const savedMap=new Map(cloudSaved.docs.map(s=>[s.id,s.data()]));
    const mockMap=new Map(cloudMocks.docs.map(s=>[s.id,s.data()]));
    const batch=writeBatch(db);let changed=false;
    try{
      const local=JSON.parse(localStorage.getItem('able_solved_problems')||'{}')||{};
      Object.entries(local).forEach(([id,data])=>{
        const cloud=solvedMap.get(id);
        const dates=[...(Array.isArray(cloud?.dates)?cloud.dates:[]),...(Array.isArray(data?.dates)?data.dates:[])];
        batch.set(doc(db,'users',uid,'solved',id),{...(cloud||{}),...(data||{}),...(dates.length?{dates:[...new Set(dates)]}:{}),migratedAt:new Date().toISOString()},{merge:true});changed=true;
      });
    }catch{}
    try{
      const local=JSON.parse(localStorage.getItem('karp_saved_mathnet')||'{}')||{};
      Object.entries(local).forEach(([id,data])=>{
        const cloud=savedMap.get(id);
        batch.set(doc(db,'users',uid,'saved',id),{...(cloud||{}),...(data||{}),migratedAt:new Date().toISOString()},{merge:true});changed=true;
      });
    }catch{}
    try{
      const local=JSON.parse(localStorage.getItem('karp_mock_history')||'[]');
      (Array.isArray(local)?local:[]).forEach((m,i)=>{
        const id=String(m.id||('legacy-'+Date.now()+'-'+i)).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,120);
        const cloud=mockMap.get(id);
        batch.set(doc(db,'users',uid,'mockHistory',id),{...(m||{}),...(cloud||{}),id},{merge:true});changed=true;
      });
    }catch{}
    try{
      const local=JSON.parse(localStorage.getItem('karp_active_mock')||'null');
      if(local&&!cloudPrivate.exists())batch.set(doc(db,'users',uid,'privateState','state'),{activeMock:local},{merge:true}),changed=true;
    }catch{}
    if(changed)await batch.commit();
    localStorage.setItem(marker,'1');
    localStorage.removeItem('able_solved_problems');
    localStorage.removeItem('karp_solved_mathnet');
    localStorage.removeItem('karp_saved_mathnet');
    localStorage.removeItem('karp_mock_history');
    localStorage.removeItem('karp_active_mock');
  }catch(e){
    console.warn('KARP cloud migration delayed:',e);
  }
}
async function karpUserRecord(type,id,data){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid)throw new Error('Authentication required');
  const {doc,setDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  await setDoc(doc(db,'users',uid,type,id),data,{merge:true});
}
async function karpDeleteUserRecord(type,id){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid)throw new Error('Authentication required');
  const {doc,deleteDoc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  await deleteDoc(doc(db,'users',uid,type,id));
}

function karpReadMarkerId(type,collectionName,id){
  let s=String(type)+'|'+String(collectionName)+'|'+String(id),h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16);
}
async function karpReadCollection(type,sourceType){
  if(type==='problem'){
    if(sourceType==='custom')return 'problems';
    try{
      if(typeof mathnetRuntimeCollections==='function'){
        const {db}=await fb();
        const {getDoc,doc}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
        return (await mathnetRuntimeCollections(db,getDoc,doc)).problems;
      }
    }catch{}
    return 'mathnetProblemsV2';
  }
  if(type==='contest')return 'contests';
  if(type==='article')return 'articles';
  return String(type);
}
async function markKarpRead(type,id,sourceType=''){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid||!id)return false;
  const collectionName=await karpReadCollection(type,sourceType);
  const {doc,runTransaction}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const markerRef=doc(db,'users',uid,'readMarks',karpReadMarkerId(type,collectionName,id));
  const contentRef=doc(db,collectionName,String(id));
  try{
    return await runTransaction(db,async tx=>{
      const marker=await tx.get(markerRef);
      if(marker.exists())return false;
      const content=await tx.get(contentRef);
      if(!content.exists())return false;
      const count=Number(content.data()?.readCount||0);
      tx.set(markerRef,{type:String(type),contentId:String(id),collection:String(collectionName),readAt:new Date().toISOString()});
      tx.update(contentRef,{readCount:count+1});
      return true;
    });
  }catch(e){console.warn('KARP read tracking failed:',e);return false}
}
async function getKarpReadCounts(type,items=[]){
  const list=Array.isArray(items)?items:[],result={};
  if(!list.length)return result;
  const grouped={};
  for(const item of list){
    const sourceType=item.sourceType==='custom'?'custom':'mathnet';
    const id=String(sourceType==='custom'?(item.customId??item.id):item.id||'');
    if(!id)continue;
    const key=await karpReadCollection(type,sourceType);
    (grouped[key] ||= []).push({id,item,sourceType});
  }
  try{
    const {db}=await fb();
    const {collection,getDocs,query,where,documentId}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    for(const [collectionName,entries] of Object.entries(grouped)){
      for(let i=0;i<entries.length;i+=30){
        const chunk=entries.slice(i,i+30),ids=chunk.map(x=>x.id);
        try{
          const snap=await getDocs(query(collection(db,collectionName),where(documentId(),'in',ids)));
          snap.forEach(s=>{
            const n=Number(s.data()?.readCount||0);
            result[collectionName+'|'+s.id]=n;
            result[String(type)+'|'+s.id]=n;
          });
        }catch(e){
          for(const x of chunk){
            try{
              const snap=await getDocs(query(collection(db,collectionName),where(documentId(),'==',x.id)));
              snap.forEach(s=>{
                const n=Number(s.data()?.readCount||0);
                result[collectionName+'|'+s.id]=n;
                result[String(type)+'|'+s.id]=n;
              });
            }catch{}
          }
        }
      }
    }
  }catch(e){console.warn('KARP read counts unavailable:',e)}
  return result;
}
async function markKarpExamEntry(examId){
  const {db,auth}=await fb();
  await authReady();
  const uid=auth.currentUser?.uid;
  if(!uid||!examId)return false;
  const {doc,runTransaction}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const examRef=doc(db,'exams',String(examId));
  const markerRef=doc(db,'users',uid,'examEntries',String(examId));
  try{
    return await runTransaction(db,async tx=>{
      const exam=await tx.get(examRef);
      const marker=await tx.get(markerRef);
      if(!exam.exists()||marker.exists())return false;
      const count=Number(exam.data()?.entryCount||0);
      tx.set(markerRef,{examId:String(examId),enteredAt:new Date().toISOString()},{merge:true});
      tx.update(examRef,{entryCount:count+1});
      return true;
    });
  }catch(e){console.warn('KARP exam entry tracking failed:',e);return false}
}
let __karpPresence=null;
async function __writeKarpPresence(online=true){
  try{
    if(!__karpPresence)return;
    const {setDoc,doc,Timestamp}=__karpPresence.fs;
    const u=__karpPresence.user;
    await setDoc(doc(__karpPresence.db,'presence',u.uid),{
      uid:u.uid,
      name:u.displayName||u.email?.split('@')[0]||'KARP Member',
      photoURL:u.photoURL||'',
      online:!!online,
      visible:!document.hidden,
      lastSeen:Timestamp.now(),
      expiresAt:Timestamp.fromMillis(online?Date.now()+70000:0),
      activity:__karpPresence.activity||{page:'KARP',label:'Browsing'}
    },{merge:true});
  }catch(e){console.warn('KARP presence update failed:',e)}
}
function setKarpActivity(activity={}){
  const next={page:String(activity.page||'KARP'),label:String(activity.label||activity.page||'Browsing'),detail:String(activity.detail||''),question:activity.question==null?null:Number(activity.question)};
  if(__karpPresence){
    const prev=__karpPresence.activity||{};
    if(JSON.stringify(prev)===JSON.stringify(next))return;
    __karpPresence.activity=next;
    __writeKarpPresence(true);
  }else{
    window.__karpPendingActivity=next;
  }
}
async function startKarpPresence(){
  if(window.__karpPresenceStarted)return;
  window.__karpPresenceStarted=true;
  try{
    const {db,auth}=await fb();
    await authReady();
    if(!auth.currentUser)return;
    const fs=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    __karpPresence={db,user:auth.currentUser,fs,activity:window.__karpPendingActivity||{page:'KARP',label:'Browsing',detail:'',question:null}};
    await __writeKarpPresence(true);
    __karpPresence.timer=setInterval(()=>__writeKarpPresence(true),30000);
    document.addEventListener('visibilitychange',()=>__writeKarpPresence(true));
    window.addEventListener('beforeunload',()=>{try{const {setDoc,doc,Timestamp}=__karpPresence.fs;setDoc(doc(__karpPresence.db,'presence',__karpPresence.user.uid),{online:false,visible:false,lastSeen:Timestamp.now(),expiresAt:Timestamp.fromMillis(0)},{merge:true})}catch{}});
  }catch(e){console.warn('KARP presence could not start:',e)}
}
async function me(){try{return(await api('/api/me')).user}catch{return null}}
async function logout(){try{await api('/api/logout',{method:'POST'})}finally{location.href='/'}}
async function requireUser(){const u=await me();if(!u){location.href='/login.html';return null}return u}
async function requireAdmin(){const u=await me();if(!u||u.role!=='admin'){location.href='/login.html';return null}return u}
function escapeHtml(x=''){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalizeMathMarkdown(value=''){
  let s=String(value??'').replace(/\r\n?/g,'\n');

  // MathNet/admin exports can contain repeated escaping from JSON/Markdown.
  s=s.replace(/\\{2,}(?=[()[\]])/g,'\\');
  s=s.replace(/\\{2,}(?=[A-Za-z@])/g,'\\');

  // Common MathNet/source-booklet aliases.
  const aliases={
    Vangle:'angle',VAngle:'angle',vangle:'angle',
    vect:'vec',vector:'vec',
    Bbb:'mathbb',bbb:'mathbb',
    mbf:'mathbf',bf:'mathbf',rm:'mathrm',scr:'mathcal'
  };
  Object.entries(aliases).forEach(([from,to])=>{
    s=s.replace(new RegExp('\\\\'+from+'\\b','g'),()=> '\\'+to);
  });

  // Common one-letter blackboard macros.
  ['R','N','Z','Q','C','F','P'].forEach(cmd=>{
    s=s.replace(new RegExp('\\\\'+cmd+'\\b','g'),()=> '\\mathbb{'+cmd+'}');
  });

  // Degree symbols should never be parsed as a separate TeX command.
  s=s.replace(/\^\\circ\b/g,'°');
  s=s.replace(/\\circ\b/g,'°');
  s=s.replace(/\\deg\b/g,'°');

  // Standard display / inline TeX delimiters.
  s=s.replace(/\$\$([\s\S]*?)\$\$/g,'\\[$1\\]');
  s=s.replace(/(^|[^\\])\$([^$\n]+)\$/g,'$1\\($2\\)');

  // Normalize raw booklet-style display blocks:
  // [
  //   formula / aligned equations
  // ]
  const rawLines=s.split('\n');
  const normalizedLines=[];
  let rawDisplay=false;
  for(let i=0;i<rawLines.length;i++){
    const line=rawLines[i],trim=line.trim();
    if(trim==='['){
      if(!rawDisplay){normalizedLines.push('\\[');rawDisplay=true;}
      else normalizedLines.push(line);
      continue;
    }
    if(trim===']'){
      if(rawDisplay){normalizedLines.push('\\]');rawDisplay=false;}
      else normalizedLines.push(line);
      continue;
    }
    if(!rawDisplay && /^\s*\[(.+)\]\s*$/.test(line)){
      const body=line.replace(/^\s*\[|\]\s*$/g,'');
      if(/[=^_{}<>]|\\[A-Za-z@]+/.test(body)){
        normalizedLines.push('\\['+body+'\\]');
        continue;
      }
    }
    normalizedLines.push(line);
  }
  if(rawDisplay){
    normalizedLines.push('\\]');
    rawDisplay=false;
  }
  s=normalizedLines.join('\n');

  // TeX environments are display math.
  s=s.replace(/(^|\n)([ \t]*\\begin\{[^}\n]+\}[\s\S]*?\\end\{[^}\n]+\})(?=\n|$)/g,'$1\\[$2\\]');

  // Repair multiline display blocks copied from align/array source. MathNet
  // often gives '&=' plus a single trailing '\' per line instead of '\\'.
  s=s.replace(/(^|\n)\\\[([\s\S]*?)\\\](?=\n|$)/g,(all,prefix,body)=>{
    let b=String(body).replace(/\\[ \t]*\n/g,'\\\\\n').trim();
    const isAligned=/&(?=\s*[^&\n]*=)|&=/.test(b) && /\n/.test(b);
    if(isAligned && !/\\begin\{(?:aligned|alignedat|array|gathered|cases|split)\}/.test(b)){
      b='\\begin{aligned}\n'+b+'\n\\end{aligned}';
    }
    return prefix+'\\[\n'+b+'\n\\]';
  });

  const commandSet=new Set([
    'frac','dfrac','tfrac','cfrac','binom','dbinom','tbinom','sqrt','root',
    'sum','prod','int','iint','iiint','lim','sin','cos','tan','cot','sec','csc',
    'arcsin','arccos','arctan','log','ln','exp','max','min','sup','inf',
    'mathbb','mathcal','mathfrak','mathrm','mathbf','boldsymbol','operatorname',
    'overline','underline','overrightarrow','overleftarrow','vec','widehat','widetilde',
    'text','textbf','textrm','textit','emph','mbox',
    'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta',
    'iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma',
    'tau','upsilon','phi','varphi','chi','psi','omega',
    'le','leq','ge','geq','neq','equiv','cong','sim','simeq','approx','asymp',
    'in','notin','subset','subseteq','supset','supseteq','ni','notni',
    'parallel','nparallel','perp','angle','measuredangle','sphericalangle','triangle',
    'cdot','times','pm','mp','ast','star','circ','bullet','oplus','otimes',
    'forall','exists','to','mapsto','rightarrow','leftarrow','leftrightarrow',
    'Rightarrow','Leftarrow','Leftrightarrow','implies','iff','infty',
    'left','right','big','Big','bigl','Bigl','bigr','Bigr',
    'lvert','rvert','lVert','rVert','Vert','vert','langle','rangle',
    'lceil','rceil','lfloor','rfloor','dots','ldots','cdots','vdots','ddots',
    'pmod','mod','not','overbrace','underbrace','partial','nabla','doteq','propto',
    'simultaneously','stackrel','overset','underset'
  ]);

  const argumentCommands=new Set([
    'frac','dfrac','tfrac','cfrac','binom','dbinom','tbinom',
    'sqrt','overline','underline','overrightarrow','overleftarrow','vec',
    'widehat','widetilde','mathbb','mathcal','mathfrak','mathrm','mathbf',
    'boldsymbol','operatorname','text','textbf','textrm','textit','emph','mbox',
    'overbrace','underbrace','stackrel','overset','underset'
  ]);

  const knownZeroArg=new Set([
    'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta',
    'iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma',
    'tau','upsilon','phi','varphi','chi','psi','omega','le','leq','ge','geq','neq','equiv',
    'cong','sim','simeq','approx','asymp','in','notin','subset','subseteq','supset',
    'supseteq','ni','notni','parallel','nparallel','perp','cdot','times','pm','mp','ast',
    'star','circ','bullet','oplus','otimes','forall','exists','to','mapsto','rightarrow',
    'leftarrow','leftrightarrow','Rightarrow','Leftarrow','Leftrightarrow','implies','iff',
    'infty','lvert','rvert','lVert','rVert','Vert','vert','langle','rangle','lceil','rceil',
    'lfloor','rfloor','dots','ldots','cdots','vdots','ddots','partial','nabla','doteq','propto'
  ]);

  const anyCommand=/\\([A-Za-z@]+)/;
  const texCommand=/\\(?:[A-Za-z@]+)/;
  const formulaPunctuation=/[=^_{}<>]|\\(?:frac|dfrac|tfrac|cfrac|sqrt|sum|prod|int|binom|angle|Vangle|vec|overline|mathbb)\b/;
  const formulaChars=/^[\\0-9A-Za-z{}()\[\]\s=+*^_<>.,;:|/\\\-]+$/;
  const proseStart=/^(?:let|find|prove|show|suppose|given|assume|determine|consider|if|there|for|we|the|where|hence|thus|then|clearly|and)\b/i;

  function skipSpaces(line,pos){
    while(pos<line.length&&/\s/.test(line[pos]))pos++;
    return pos;
  }
  function consumeBalanced(line,pos,open='{',close='}'){
    pos=skipSpaces(line,pos);
    if(pos>=line.length||line[pos]!==open)return pos;
    let depth=0;
    for(let j=pos;j<line.length;j++){
      if(line[j]===open)depth++;
      else if(line[j]===close){
        depth--;
        if(depth===0)return j+1;
      }
    }
    return line.length;
  }
  function consumeWord(line,pos){
    pos=skipSpaces(line,pos);
    const m=line.slice(pos).match(/^[A-Za-z0-9]+/);
    return m?pos+m[0].length:pos;
  }
  function consumeArgument(line,pos){
    pos=skipSpaces(line,pos);
    if(pos<line.length&&line[pos]==='{')return consumeBalanced(line,pos,'{','}');
    return consumeWord(line,pos);
  }
  function consumeAtom(line,pos){
    pos=skipSpaces(line,pos);
    if(pos>=line.length)return pos;
    if(line[pos]==='{')return consumeBalanced(line,pos,'{','}');
    if(line[pos]==='[')return consumeBalanced(line,pos,'[',']');
    if(line[pos]==='(')return consumeBalanced(line,pos,'(',')');
    if(line[pos]==='\\'){
      const cm=line.slice(pos).match(anyCommand);
      if(cm)return pos+cm[0].length;
    }
    return pos+1;
  }
  function findClosingDelimiter(line,start){
    const re=/\\(?:right|bigr|Bigr|bigl|Bigl)\s*(?:\\[A-Za-z]+|[^A-Za-z\s])?/g;
    re.lastIndex=start;
    const m=re.exec(line);
    return m?m.index+m[0].length:-1;
  }

  function looksLikeFormula(text){
    const t=String(text).trim();
    if(!t)return false;
    const command=texCommand.test(t);
    const punct=formulaPunctuation.test(t);
    const words=(t.match(/\b[A-Za-z]{3,}\b/g)||[]).length;
    return command || (formulaChars.test(t)&&punct&&words<=10);
  }

  function wrapBareTexInline(line){
    let cursor=0,pos=0,out='';
    while((pos=line.indexOf('\\',pos))>=0){
      const m=line.slice(pos).match(anyCommand);
      if(!m){pos++;continue;}
      const cmd=m[1];
      if(!commandSet.has(cmd)){pos+=m[0].length;continue;}
      if(cmd==='begin'||cmd==='end'){pos+=m[0].length;continue;}

      let end=pos+m[0].length;
      if(argumentCommands.has(cmd)){
        if(cmd==='frac'||cmd==='dfrac'||cmd==='tfrac'||cmd==='cfrac'||cmd==='binom'||cmd==='dbinom'||cmd==='tbinom'){
          end=consumeArgument(line,end);
          end=consumeArgument(line,end);
        }else{
          end=consumeArgument(line,end);
        }
      }else if(cmd==='sum'||cmd==='prod'||cmd==='int'||cmd==='iint'||cmd==='iiint'||cmd==='lim'){
        while(true){
          const p=skipSpaces(line,end);
          if(line[p]==='_'||line[p]==='^')end=consumeAtom(line,p+1);
          else break;
        }
        end=consumeArgument(line,end);
      }else if(cmd==='sin'||cmd==='cos'||cmd==='tan'||cmd==='cot'||cmd==='sec'||cmd==='csc'||
               cmd==='arcsin'||cmd==='arccos'||cmd==='arctan'||cmd==='log'||cmd==='ln'||cmd==='exp'||
               cmd==='max'||cmd==='min'||cmd==='sup'||cmd==='inf'||cmd==='angle'||cmd==='measuredangle'||
               cmd==='sphericalangle'||cmd==='triangle'||cmd==='vec'){
        end=consumeWord(line,end);
      }else if(cmd==='left'||cmd==='big'||cmd==='Big'||cmd==='bigl'||cmd==='Bigl'||cmd==='bigr'||cmd==='Bigr'){
        const found=findClosingDelimiter(line,end);
        end=found>=0?found:line.length;
      }else if(cmd==='right'){
        end=skipSpaces(line,end);
        if(end<line.length)end++;
      }else if(!knownZeroArg.has(cmd)){
        const next=skipSpaces(line,end);
        if(line[next]==='{')end=consumeAtom(line,next);
      }

      out+=line.slice(cursor,pos)+'\\('+line.slice(pos,end)+'\\)';
      cursor=end;
      pos=end;
    }
    return out+line.slice(cursor);
  }

  const processed=[];
  let insideDisplay=false;
  s.split('\n').forEach(rawLine=>{
    let line=rawLine;
    let t=line.trim();
    if(!t){processed.push(line);return;}

    // Keep every canonical display block intact, including multiline blocks
    // and malformed source where the closing delimiter appears later.
    const hasOpen=line.includes('\\['),hasClose=line.includes('\\]');
    if(hasOpen){
      processed.push(line);
      insideDisplay=!hasClose;
      return;
    }
    if(insideDisplay){
      processed.push(line);
      if(hasClose)insideDisplay=false;
      return;
    }

    // A stray closing delimiter is treated as the end of the formula, not
    // as literal Markdown punctuation.
    if(hasClose){
      line=line.replace(/\\\]/g,'');
      t=line.trim();
      if(!t){processed.push('');return;}
    }

    // Already-canonical inline math on one line.
    if(/\\\([^\n]*\\\)/.test(t)){processed.push(line);return;}

    const hasAnyCommand=texCommand.test(t);
    const punct=formulaPunctuation.test(t);
    const words=(t.match(/\b[A-Za-z]{3,}\b/g)||[]).length;
    const startsLikeProse=proseStart.test(t);
    const symbolOnly=formulaChars.test(t);

    const formulaOnly=
      (hasAnyCommand&&punct&&(t.startsWith('\\')||(!startsLikeProse&&words<=12))) ||
      (symbolOnly&&punct&&words<=12&&!startsLikeProse) ||
      (/&=?/.test(t)&&(/[=^_{}]/.test(t)||/\\\\/.test(t)));

    if(formulaOnly){
      processed.push('\\['+t+'\\]');
      return;
    }
    processed.push(wrapBareTexInline(line));
  });
  s=processed.join('\n');

  // One last pass catches malformed/unbalanced display delimiters.
  const opens=(s.match(/\\\[/g)||[]).length;
  const closes=(s.match(/\\\]/g)||[]).length;
  if(opens>closes)s+='\\]'.repeat(opens-closes);
  else if(closes>opens){
    let extra=closes-opens;
    s=s.replace(/\\\]/g,match=>{
      if(extra>0){extra--;return '';}
      return match;
    });
  }
  return s;
}
function richMarkdown(value=''){
  const source=normalizeMathMarkdown(value);
  if(window.marked&&window.DOMPurify){
    // Protect TeX while Markdown is parsed so underscores/braces do not
    // become Markdown formatting before MathJax gets the text.
    const math=[];
    const tokenFor=i=>'KARPMATHSLOT'+i+'KARP';
    const protectedSource=source.replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,m=>{
      const i=math.push(m)-1;
      return tokenFor(i);
    });
    let html=marked.parse(protectedSource,{breaks:true});
    html=DOMPurify.sanitize(html);
    math.forEach((m,i)=>{
      const safe=m.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html=html.split(tokenFor(i)).join(safe);
    });
    return html;
  }
  return escapeHtml(source).replace(/\n/g,'<br>');
}

function nav(active){const links=[['Problems','/problems.html'],['Contests','/contests.html'],['Articles','/articles.html'],['Exams','/exams.html'],['Mocks','/mock.html'],['Videos','/videos.html'],['Journal','/journal.html']];const toolsMenu='<div class="nav-tool"><span class="nav-tool-label">Tools</span><div class="tools-menu"><a href="/geogebra.html"><span>GeoGebra</span><small>Dynamic Mathematics</small></a></div></div>';return `<header class="top"><div class="wrap nav"><a class="brand" href="/">KARP</a><nav class="navlinks">${links.map(x=>`<a class="${active===x[0]?'active':''}" href="${x[1]}">${x[0]}</a>`).join('')}${toolsMenu}<a class="${active==='About'?'active':''}" href="/about.html">About</a></nav><div class="actions" id="nav-actions"><a class="btn ghost" href="/login.html">Login</a><a class="btn primary" href="/signup.html">Join Us</a></div></div></header>`}
async function updateNavUser(){const box=document.getElementById('nav-actions');if(!box)return;const u=await me();if(!u)return;const avatar=u.photoURL?`<img src="${escapeHtml(u.photoURL)}" alt="" class="nav-profile-img">`:`<span class="nav-profile-initial">${escapeHtml((u.name||'K').charAt(0).toUpperCase())}</span>`;box.innerHTML=`<a class="nav-profile" href="/account.html" aria-label="Account" title="Account">${avatar}</a>${u.role==='admin'?'<a class="btn nav-admin" href="/admin.html">Admin</a>':''}<button class="nav-logout" onclick="logout()">Log out</button>`}
function shell(active,title,body){document.title=`KARP — ${title}`;document.body.innerHTML=nav(active)+body+footer();updateNavUser()}
function footer(){return `<footer class="footer"><div class="wrap footgrid"><div><div class="brand">KARP</div><div class="small">Olympiad mathematics for serious problem solvers.</div></div><div class="footlinks"><a href="/problems.html">Problems</a><a href="/contests.html">Contests</a><a href="/articles.html">Articles</a><a href="/exams.html">Exams</a><a href="/mock.html">Mocks</a><a href="/videos.html">Videos</a><a href="/journal.html">Journal</a><a href="/about.html">About Us</a></div></div></footer>`}
function currentLanguage(){return localStorage.getItem('able_lang')==='az'?'az':'en'}
function setLanguage(lang){localStorage.setItem('able_lang',lang);return lang}
function localized(item,field,lang=currentLanguage()){const az=item?.[`${field}Az`],en=item?.[`${field}En`],old=item?.[field];return lang==='az'?(az||en||old||''):(en||az||old||'')}
function languageSwitch(){const lang=currentLanguage();return `<div class="language-switch" role="group" aria-label="Language"><button type="button" class="${lang==='az'?'active':''}" data-lang="az">AZE</button><button type="button" class="${lang==='en'?'active':''}" data-lang="en">ENG</button></div>`}
function bindLanguageSwitch(renderFn){document.querySelectorAll('.language-switch button').forEach(b=>b.onclick=()=>{setLanguage(b.dataset.lang);renderFn()})}
async function typesetMath(root,retries=40){
  if(!root)return false;
  const run=async()=>{
    if(window.MathJax?.startup?.promise){
      try{await window.MathJax.startup.promise}catch{}
    }
    if(!window.MathJax?.typesetPromise)return false;
    try{
      if(window.MathJax.typesetClear)window.MathJax.typesetClear([root]);
      await window.MathJax.typesetPromise([root]);
      return true;
    }catch(e){
      if(retries<=1)console.error('KARP MathJax typeset error',e);
      return false;
    }
  };
  const ok=await run();
  if(ok)return true;
  if(retries>0){
    setTimeout(()=>typesetMath(root,retries-1),250);
  }
  return false;
}
function formatDuration(m){m=Number(m||60);const h=Math.floor(m/60),mm=m%60;return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`}

startKarpPresence();
