'use strict';
(async function(){
 const grid=document.getElementById('finalist-grid'),dialog=document.getElementById('comic-reader');
 const get=id=>document.getElementById(id);
 let comics=[],index=-1,returnFocus=null,returnY=0,openedFromGallery=false;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selected=()=>new URLSearchParams(location.hash.slice(1)).get('comic');
 const collectionPath='/guides/comic-panels/';
 const urlFor=id=>collectionPath+'#comic='+encodeURIComponent(id);
 const downloadName=c=>'ben-tan-'+c.title.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.png';
 function show(id){
  index=comics.findIndex(c=>c.id===id);if(index<0)return;
  const c=comics[index];
  get('reader-title').textContent=c.title;get('reader-position').textContent=`${index+1} of ${comics.length}`;
  get('reader-image').src=c.image;get('reader-image').alt=c.alt;
  get('reader-context').textContent=c.note||'Ben’s note for this comic is still being interviewed.';get('reader-context').classList.toggle('pending',!c.note);
  get('reader-download').href=c.image;get('reader-download').download=downloadName(c);
  get('reader-prev').disabled=index===0;get('reader-next').disabled=index===comics.length-1;
  get('reader-message').textContent='';get('copy-fallback').hidden=true;
  document.title=c.title+' · Comic Panels';
  if(!dialog.open)dialog.showModal();
  document.querySelector('.reader-content').scrollTop=0;document.querySelector('.reader-note').scrollTop=0;
 }
 function closeView(){
  if(!dialog.open)return;dialog.close();index=-1;document.title='Comic Panels';
  const focus=returnFocus;requestAnimationFrame(()=>{window.scrollTo(0,returnY);focus?.focus({preventScroll:true});});
 }
 function close(){
  if(openedFromGallery&&history.state?.comicReader){history.back();return;}
  history.replaceState(null,'',collectionPath);closeView();
 }
 function step(delta){const c=comics[index+delta];if(!c)return;history.replaceState(history.state,'',urlFor(c.id));show(c.id);get('reader-title').focus({preventScroll:true});}
 grid.addEventListener('click',e=>{const a=e.target.closest('[data-comic]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();returnFocus=a;returnY=scrollY;openedFromGallery=true;history.pushState({comicReader:true},'',urlFor(a.dataset.comic));show(a.dataset.comic);});
 get('reader-close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
 get('reader-prev').addEventListener('click',()=>step(-1));get('reader-next').addEventListener('click',()=>step(1));
 dialog.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
 get('reader-copy').addEventListener('click',async()=>{const url=new URL(urlFor(comics[index].id),location.origin).href;try{await navigator.clipboard.writeText(url);get('reader-message').textContent='Link copied.';}catch{get('copy-fallback').hidden=false;get('copy-url').value=url;get('copy-url').focus();get('copy-url').select();get('reader-message').textContent='Select and copy the link below.';}});
 addEventListener('popstate',()=>{const id=selected();if(id&&comics.some(c=>c.id===id))show(id);else closeView();});
 try{
  const response=await fetch('/guides/comic-panels/comics.json');if(!response.ok)throw Error('Could not load');comics=await response.json();
  grid.innerHTML=comics.map((c,i)=>`<figure class="finalist-item"><a class="finalist-link" href="${urlFor(c.id)}" data-comic="${c.id}" aria-label="Open ${escape(c.title)}"><img src="${c.image}" alt="${escape(c.alt)}" width="2000" height="1500" loading="${i<2?'eager':'lazy'}" decoding="async"><figcaption class="finalist-caption"><h3>${escape(c.title)}</h3><span aria-hidden="true">↗</span></figcaption></a></figure>`).join('');
  const id=selected();if(id&&comics.some(c=>c.id===id)){returnFocus=grid.querySelector(`[data-comic="${id}"]`);show(id);}else if(id){history.replaceState(null,'',collectionPath);}
 }catch{grid.innerHTML='<p>The comics could not be loaded. Please reload the page.</p>';}
})();
