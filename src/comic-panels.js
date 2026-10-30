'use strict';
(async function(){
 const grid=document.getElementById('finalist-grid'),dialog=document.getElementById('comic-reader');
 const get=id=>document.getElementById(id);
 let comics=[],index=-1,returnFocus=null,returnY=0,openedFromGallery=false;
 let cards=[],anchorIndex=0,pageSize=0,pageStart=0,returnPageSize=0;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selected=()=>new URLSearchParams(location.hash.slice(1)).get('comic');
 const previewFor=(url,width)=>url.replace(/\/([^/]+)\.(png|webp)$/, '/previews/$1-'+width+'.webp');
 const galleryTitle=document.title;
 const collectionPath='/guides/comic-panels/';
 const urlFor=id=>collectionPath+'#comic='+encodeURIComponent(id);
 const galleryUrl=i=>i===0?collectionPath:collectionPath+'#start='+encodeURIComponent(comics[i].id);
 const indexFor=id=>comics.findIndex(c=>c.id===id);
 const startFromUrl=()=>Math.max(0,indexFor(new URLSearchParams(location.hash.slice(1)).get('start')));
 function renderGallery(anchor){
  anchorIndex=Math.max(0,Math.min(anchor,comics.length-1));
  const columns=getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
  pageSize=Math.min(3,Math.max(1,columns))*3;
  pageStart=Math.floor(anchorIndex/pageSize)*pageSize;
  cards.forEach((card,i)=>{card.hidden=i<pageStart||i>=pageStart+pageSize;});
  get('collection-pagination').hidden=comics.length<=pageSize;
  get('gallery-prev').hidden=pageStart===0;
  get('gallery-next').hidden=pageStart+pageSize>=comics.length;
  get('gallery-position').textContent=`Page ${Math.floor(pageStart/pageSize)+1} of ${Math.ceil(comics.length/pageSize)}`;
 }
 function turnPage(delta){
  const next=pageStart+delta*pageSize;
  if(next<0||next>=comics.length)return;
  history.replaceState({...history.state,comicGalleryY:scrollY},'',galleryUrl(anchorIndex));
  history.pushState({comicGalleryY:0},'',galleryUrl(next));
  renderGallery(next);
  get('gallery-heading').scrollIntoView({block:'start'});
  grid.querySelector(`[data-comic="${comics[pageStart].id}"]`).focus({preventScroll:true});
 }
 const downloadName=c=>'ben-tan-'+c.title.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.png';
 function show(id){
  index=comics.findIndex(c=>c.id===id);if(index<0)return;
  const c=comics[index];
  get('reader-title').textContent=c.title;get('reader-position').textContent=`${index+1} of ${comics.length}`;
  const image=new Image(2000,1500);
  image.id='reader-image';image.alt=c.alt;image.style.visibility='hidden';image.src=c.display||c.image;
  get('reader-image').replaceWith(image);
  const reveal=()=>{if(get('reader-image')===image)image.style.visibility='visible';};
  image.decode().then(reveal,reveal);
  get('reader-context').textContent=c.note||'Ben’s note for this comic is still being interviewed.';get('reader-context').classList.toggle('pending',!c.note);
  get('reader-download').href=c.image;get('reader-download').download=downloadName(c);
  get('reader-prev').disabled=index===0;get('reader-next').disabled=index===comics.length-1;
  get('reader-message').textContent='';get('copy-fallback').hidden=true;
  document.title=c.title+' · Comic Panels';
  if(!dialog.open)dialog.showModal();
  document.querySelector('.reader-content').scrollTop=0;document.querySelector('.reader-note').scrollTop=0;
 }
 function closeView(){
  if(!dialog.open)return;dialog.close();index=-1;document.title=galleryTitle;
  const focus=returnFocus,focusIndex=indexFor(focus?.dataset?.comic);
  if(focusIndex>=0){renderGallery(focusIndex);history.replaceState(history.state,'',galleryUrl(focusIndex));}
  requestAnimationFrame(()=>{if(returnPageSize!==pageSize)focus?.scrollIntoView({block:'nearest'});else window.scrollTo(0,returnY);focus?.focus({preventScroll:true});});
 }
 function close(){
  if(openedFromGallery&&history.state?.comicReader){history.back();return;}
  renderGallery(Math.max(0,index));
  returnFocus=grid.querySelector(`[data-comic="${comics[anchorIndex].id}"]`);returnY=0;
  history.replaceState(null,'',galleryUrl(anchorIndex));closeView();
 }
 function step(delta){const c=comics[index+delta];if(!c)return;history.replaceState(history.state,'',urlFor(c.id));show(c.id);get('reader-title').focus({preventScroll:true});}
 grid.addEventListener('click',e=>{const a=e.target.closest('[data-comic]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();returnFocus=a;returnY=scrollY;returnPageSize=pageSize;openedFromGallery=true;history.replaceState({...history.state,comicGalleryY:returnY},'',galleryUrl(anchorIndex));history.pushState({comicReader:true},'',urlFor(a.dataset.comic));show(a.dataset.comic);});
 get('gallery-prev').addEventListener('click',()=>turnPage(-1));
 get('gallery-next').addEventListener('click',()=>turnPage(1));
 get('reader-close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
 get('reader-prev').addEventListener('click',()=>step(-1));get('reader-next').addEventListener('click',()=>step(1));
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
   const controls=Array.from(dialog.querySelectorAll('button:not(:disabled),a[href],input')).filter(el=>el.getClientRects().length);
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   return;
  }
  if(e.target.matches('input,textarea'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
  if(e.key==='ArrowRight'){e.preventDefault();step(1);}
 });
 get('reader-copy').addEventListener('click',async()=>{const url=new URL(urlFor(comics[index].id),location.origin).href;try{await navigator.clipboard.writeText(url);get('reader-message').textContent='Link copied.';}catch{get('copy-fallback').hidden=false;get('copy-url').value=url;get('copy-url').focus();get('copy-url').select();get('reader-message').textContent='Select and copy the link below.';}});
 addEventListener('popstate',()=>{
  const id=selected();
  if(id&&indexFor(id)>=0){renderGallery(indexFor(id));show(id);}
  else{
   renderGallery(location.hash==='#top'?anchorIndex:startFromUrl());
   if(dialog.open)closeView();
   else requestAnimationFrame(()=>window.scrollTo(0,history.state?.comicGalleryY||0));
  }
 });
 addEventListener('resize',()=>{
  if(!comics.length)return;
  const previousSize=pageSize;
  const focused=document.activeElement?.dataset?.comic;
  renderGallery(index>=0?index:focused?indexFor(focused):anchorIndex);
  if(pageSize!==previousSize&&!dialog.open)history.replaceState(history.state,'',galleryUrl(anchorIndex));
 });
 try{
  const response=await fetch('/guides/comic-panels/comics.json');if(!response.ok)throw Error('Could not load');comics=await response.json();
  grid.innerHTML=comics.map((c,i)=>`<figure class="finalist-item"><a class="finalist-link" href="${urlFor(c.id)}" data-comic="${c.id}" aria-label="Open ${escape(c.title)}"><img src="${previewFor(c.display||c.image,480)}" srcset="${previewFor(c.display||c.image,480)} 480w, ${previewFor(c.display||c.image,960)} 960w" sizes="(max-width: 600px) 88vw, (max-width: 1000px) 43vw, 450px" alt="${escape(c.alt)}" width="2000" height="1500" loading="${i<2?'eager':'lazy'}" decoding="async"><figcaption class="finalist-caption"><h3>${escape(c.title)}</h3></figcaption></a></figure>`).join('');
  cards=Array.from(grid.children);
  const id=selected();renderGallery(id&&indexFor(id)>=0?indexFor(id):startFromUrl());
  if(id&&indexFor(id)>=0){returnFocus=grid.querySelector(`[data-comic="${id}"]`);show(id);}else if(id){history.replaceState(null,'',galleryUrl(anchorIndex));}
 }catch{grid.innerHTML='<p>The comics could not be loaded. Please reload the page.</p>';}
})();
