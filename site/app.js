const $=id=>document.getElementById(id);
const cityNames={jinju:'진주',geoje:'거제'};
const state={city:'jinju',data:{},errors:{},page:0,selected:null,filtered:[],visible:[]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const median=arr=>{const v=[...arr].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length?(v.length%2?v[m]:(v[m-1]+v[m])/2):null;};
const money=n=>(n/10000).toFixed(2)+'억';
function relevant(unit){return unit.sales.filter(s=>$('size').value==='all'||($('size').value==='84'?s.area>=80&&s.area<=86:s.area>=55&&s.area<=65));}
function latest(unit){return relevant(unit).at(-1);}
async function load(slug){
  try{const response=await fetch('data/'+slug+'.json',{cache:'no-cache'});if(!response.ok)throw Error();const d=await response.json();if(d.schemaVersion!==1||d.status!=='ready'||!Array.isArray(d.complexes))throw Error();state.data[slug]=d;}
  catch{state.errors[slug]='실거래 자료가 아직 수집되지 않았거나 파일을 불러오지 못했습니다.';}
}
function render(reset=true){
  if(reset)state.page=0;
  const d=state.data[state.city];$('cityTitle').textContent=cityNames[state.city];
  $('dataStatus').textContent=d?`국토교통부 · ${d.period.from.slice(0,4)}.${d.period.from.slice(4)}~${d.period.to.slice(0,4)}.${d.period.to.slice(4)} · ${d.recordCount.toLocaleString()}건 · 수집 ${d.fetchedAt.slice(0,10)} · 최신월 신고 진행 중`:(state.errors[state.city]||'자료 확인 중');
  const query=$('search').value.trim();state.filtered=(d?.complexes||[]).filter(u=>relevant(u).length&&(!$('area').value||u.dong===$('area').value)&&(!query||u.name.includes(query)||u.address.includes(query))).sort((a,b)=>latest(b).date.localeCompare(latest(a).date)||a.name.localeCompare(b.name));
  state.visible=state.filtered.slice(state.page*30,(state.page+1)*30);
  $('unitCount').textContent=state.filtered.length+'개 단지';
  $('units').innerHTML=state.visible.map(u=>{const rows=relevant(u),last=rows.at(-1),peak=Math.max(...rows.map(s=>s.amount));return `<button class="unit" data-unit="${u.id}"><span><strong>${esc(u.name)}</strong><small>${esc(u.dong)} · ${last.area}㎡ · ${esc(last.floor)}층</small></span><span><b>${money(last.amount)}</b><small>${last.date} 신고 거래</small><small>조회 범위 최고 ${money(peak)}</small></span></button>`;}).join('')||'<p class="empty">조건에 맞는 수집 자료가 없습니다. 가상 단지는 표시하지 않습니다.</p>';
  $('pageLabel').textContent=state.filtered.length?`${state.page+1} / ${Math.ceil(state.filtered.length/30)}`:'0 / 0';$('prev').disabled=state.page===0;$('next').disabled=(state.page+1)*30>=state.filtered.length;
  state.selected=null;$('detail').textContent='단지를 선택하면 거래 내역이 표시됩니다.';
  renderAnnual();renderBuy();document.dispatchEvent(new Event('units-rendered'));
}
function changeCity(slug){state.city=slug;document.querySelectorAll('[data-city]').forEach(b=>b.classList.toggle('active',b.dataset.city===slug));$('area').innerHTML='<option value="">전체</option>'+[...new Set((state.data[slug]?.complexes||[]).map(u=>u.dong))].sort().map(d=>`<option>${esc(d)}</option>`).join('');render();}
function selectUnit(id){
  const u=state.filtered.find(u=>u.id===id);if(!u)return;state.selected=u;
  const rows=relevant(u),last=rows.at(-1);
  $('detail').innerHTML=`<h3>${esc(u.name)}</h3><p>${esc(u.address)} · ${esc(u.built)}년 준공</p><p>선택 면적 ${rows.length}건 · 최근 ${money(last.amount)} (${last.date}, ${last.area}㎡, ${esc(last.floor)}층)</p><div class="table-wrap"><table><thead><tr><th>계약일</th><th>전용면적</th><th>층</th><th>거래금액</th></tr></thead><tbody>${rows.slice(-10).reverse().map(s=>`<tr><td>${s.date}</td><td>${s.area}㎡</td><td>${esc(s.floor)}</td><td>${money(s.amount)}</td></tr>`).join('')}</tbody></table></div><button id="useUnit">이 거래금액으로 매도 비교</button><p class="caption">조회 면적 범위 내 비교입니다. 동일 동·층·향 조건의 비교가 아니며 조회 범위 최고가가 역대 최고가라는 뜻은 아닙니다.</p>`;
  $('useUnit').onclick=()=>{$('homeName').value=u.name;$('price').value=(last.amount/10000).toFixed(2);document.getElementById('sell').scrollIntoView({behavior:'smooth'});};
  document.querySelectorAll('[data-unit]').forEach(b=>b.classList.toggle('selected',b.dataset.unit===id));document.dispatchEvent(new Event('unit-selected'));
}
function renderAnnual(){
  const d=state.data[state.city],byYear={};
  (d?.complexes||[]).forEach(u=>relevant(u).forEach(s=>(byYear[s.date.slice(0,4)]??=[]).push(s.amount/s.area)));
  const years=Object.keys(byYear).sort();
  if(!years.length){$('annualChart').innerHTML='<p class="empty">수집된 거래 자료가 없습니다.</p>';$('marketSummary').textContent='한국부동산원 공식 가격지수는 별도 연결이 필요합니다.';return;}
  const max=Math.max(...years.map(y=>median(byYear[y])));
  $('annualChart').innerHTML='<div class="annual-bars">'+years.map(y=>`<div><span>${y}</span><div class="annual-track"><i style="width:${byYear[y].length>=5?median(byYear[y])/max*100:0}%"></i></div><b>${byYear[y].length>=5?Math.round(median(byYear[y])).toLocaleString():'표본 부족'}</b><small>${byYear[y].length.toLocaleString()}건</small></div>`).join('')+'</div>';
  $('marketSummary').textContent=`${cityNames[state.city]} 전체 법정동 기준 · 면적 필터 적용 · ${years[0]}~${years.at(-1)} 거래 표본. 법정동·검색 필터는 단지 목록에만 적용됩니다.`;
}
function renderBuy(){const b=+$('budget').value;const units=(state.data.jinju?.complexes||[]).filter(u=>relevant(u).length&&latest(u).amount<=b*10000).sort((a,b)=>latest(b).date.localeCompare(latest(a).date));$('buyResult').textContent=state.data.jinju?(units.length?`조건에 맞는 단지 ${units.length}곳. 최근 거래 순: `+units.slice(0,5).map(u=>`${u.name} ${money(latest(u).amount)} (${latest(u).date})`).join(' / '):'예산과 면적 조건에 맞는 거래가 없습니다.'):'진주 실거래 자료 미수집';}
function renderScenario(){let p=+$('price').value,r=+$('rate').value,m=+$('months').value;$('monthLabel').textContent=m+'개월';if(!p)return;$('scenarioCards').innerHTML=[-3,0,3].map(delta=>`<div><span>연 ${(r+delta).toFixed(1)}% 가정</span><strong>${(p*Math.pow(1+(r+delta)/100,m/12)).toFixed(2)}억</strong><small>${m}개월 후</small></div>`).join('');}
document.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>changeCity(b.dataset.city));$('area').onchange=()=>render();$('size').onchange=()=>render();$('search').oninput=()=>render();$('prev').onclick=()=>{state.page--;render(false);};$('next').onclick=()=>{state.page++;render(false);};$('units').onclick=e=>{const b=e.target.closest('[data-unit]');if(b)selectUnit(b.dataset.unit);};$('budget').oninput=renderBuy;$('months').oninput=renderScenario;
Promise.all([load('jinju'),load('geoje')]).then(()=>changeCity(state.city));
