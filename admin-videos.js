/* KARP video administration */
(function(){
  const escV=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const originalRender=window.render;
  const originalNewItem=window.newItem;
  const originalEditItem=window.editItem;
  const originalSaveItem=window.saveItem;
  const originalRemoveItem=window.removeItem;

  function videoList(d){return Array.isArray(d)?d:(d?.videos||[])}
  async function renderVideos(){
    const m=document.getElementById('main'); if(!m)return;
    try{
      const d=await api('/api/admin/videos');
      const items=videoList(d);
      m.innerHTML=`<div class="admin-head"><div><h2>Videos</h2><span class="admin-count">${items.length} items</span></div><button class="btn primary" onclick="newItem()">+ New</button></div><div class="rows">${items.map(x=>`<div class="row"><div><h3>${escV(x.titleEn||x.titleAz||x.title||'Untitled video')}</h3><p>${escV(x.youtubeUrl||'No YouTube link')}</p></div><div>${escV(x.status||'published')}</div><div class="right"><button class="btn" onclick="editItem('${escV(x.id)}')">Edit</button> <button class="btn danger" onclick="removeItem('${escV(x.id)}')">Delete</button></div></div>`).join('')||'<div class="empty">No videos found.</div>'}</div>${state.editing?videoForm(state.editing):''}`;
    }catch(e){m.innerHTML=`<div class="bigcard"><h3>Could not load videos</h3><p>${escV(e.message)}</p></div>`}
  }
  function videoForm(x){return `<div class="editor-card"><div class="tag">${x.id?'EDIT':'CREATE'} VIDEO</div><div class="formgrid"><div class="field"><label>Video title — English</label><input class="input" id="f-titleEn" value="${escV(x.titleEn||'')}"></div><div class="field"><label>Video title — Azərbaycan dili</label><input class="input" id="f-titleAz" value="${escV(x.titleAz||'')}"></div></div><div class="field"><label>YouTube URL</label><input class="input" id="f-youtubeUrl" value="${escV(x.youtubeUrl||'')}" placeholder="https://www.youtube.com/watch?v=..."></div><div class="field"><label>Thumbnail image URL</label><input class="input" id="f-thumbnail" value="${escV(x.thumbnail||'')}" placeholder="https://.../thumbnail.jpg"></div><div class="formgrid"><div class="field"><label>Description — English (optional)</label><textarea class="textarea" id="f-descriptionEn" rows="4">${escV(x.descriptionEn||'')}</textarea></div><div class="field"><label>Description — Azərbaycan dili (optional)</label><textarea class="textarea" id="f-descriptionAz" rows="4">${escV(x.descriptionAz||'')}</textarea></div></div><div class="field"><label>Status</label><select class="select" id="f-status"><option value="published" ${x.status!=='draft'?'selected':''}>published</option><option value="draft" ${x.status==='draft'?'selected':''}>draft</option></select></div><button class="btn primary" onclick="saveItem()">Save video</button> <button class="btn" onclick="syncCurrent();state.editing=null;render()">Cancel</button></div>`}

  window.render=async function(){if(state.type==='videos')return renderVideos();return originalRender()};
  window.newItem=function(){if(state.type!=='videos')return originalNewItem();state.editing={id:null,titleEn:'',titleAz:'',youtubeUrl:'',thumbnail:'',descriptionEn:'',descriptionAz:'',status:'published'};render()};
  window.editItem=async function(id){if(state.type!=='videos')return originalEditItem(id);try{const d=await api('/api/admin/videos');const x=videoList(d).find(v=>v.id===id);state.editing=x?{...x}:null;render()}catch(e){toast(e.message)}};
  window.saveItem=async function(){if(state.type!=='videos')return originalSaveItem();syncCurrent();const data={};document.querySelectorAll('[id^="f-"]').forEach(e=>data[e.id.slice(2)]=e.type==='number'?Number(e.value):e.value);if(!data.youtubeUrl)return toast('YouTube URL is required.');if(!data.thumbnail)return toast('Thumbnail image URL is required.');try{const x=state.editing;if(x.id)await api(`/api/admin/videos/${x.id}`,{method:'PUT',body:JSON.stringify(data)});else await api('/api/admin/videos',{method:'POST',body:JSON.stringify(data)});state.editing=null;toast('Video saved successfully');render()}catch(e){toast(e.message)}};
  window.removeItem=async function(id){if(state.type!=='videos')return originalRemoveItem(id);if(!confirm('Delete this video?'))return;try{await api(`/api/admin/videos/${id}`,{method:'DELETE'});toast('Deleted');render()}catch(e){toast(e.message)}};

  function addButton(){const side=document.querySelector('.admin-side');if(!side||side.querySelector('[data-type="videos"]'))return;const b=document.createElement('button');b.dataset.type='videos';b.textContent='Videos';b.onclick=()=>{syncCurrent();document.querySelectorAll('.admin-side button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.type='videos';state.editing=null;render()};side.insertBefore(b,side.querySelector('[data-type="users"]')||null)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(addButton,0));
})();
