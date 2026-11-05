(() => {
  const menu=document.getElementById('siteMenu');
  const toggle=document.getElementById('menuToggle');
  const nav=document.getElementById('mainNav');
  const links=[...nav.querySelectorAll('a')];
  const mobile=matchMedia('(max-width:700px)');
  function close(restoreFocus=false){
    menu.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded','false');
    document.getElementById('menuAction').textContent='메뉴 ▾';
    if(restoreFocus)toggle.focus();
  }
  function highlight(id){
    const active=links.find(a=>a.hash==='#'+id)||links[0];
    links.forEach(a=>{a.classList.toggle('active',a===active);if(a===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    document.getElementById('currentSection').textContent=active.textContent.trim().replace(/^\S+\s/,'');
  }
  toggle.onclick=()=>{
    const open=!menu.classList.contains('menu-open');
    menu.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open));
    document.getElementById('menuAction').textContent=open?'닫기 ▴':'메뉴 ▾';
  };
  links.forEach(a=>a.addEventListener('click',()=>{
    if(mobile.matches){close();const target=document.querySelector(a.hash);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
    highlight(a.hash.slice(1));
  }));
  menu.querySelector('.brand').addEventListener('click',()=>close());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('menu-open'))close(true);});
  document.addEventListener('click',e=>{if(mobile.matches&&!menu.contains(e.target))close();});
  mobile.addEventListener('change',()=>close());
  let scheduled=false;
  function update(){
    scheduled=false;
    const offset=mobile.matches?160:60;
    let id='overview';
    links.forEach(a=>{const section=document.querySelector(a.hash);if(section.getBoundingClientRect().top<=offset)id=section.id;});
    highlight(id);
  }
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});
  update();
})();
