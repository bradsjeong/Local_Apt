(() => {
  const host=document.createElement('div');host.id='officialIndicators';
  $('supply').querySelector('.grid').replaceWith(host);
  let data,plans,error;
  const selected={};
  const period=(p,f)=>f==='S'?p.slice(0,4)+'년 '+(p.endsWith('01')?'상반기':'하반기'):p.length===6?p.slice(0,4)+'.'+p.slice(4):p;
  const number=v=>v===null?'미공표':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2});
  function chart(s){
    const points=s.points.slice(-24),valid=points.filter(p=>p.value!==null),max=Math.max(1,...valid.map(p=>Math.abs(p.value)));
    return '<div class="annual-bars">'+points.map(p=>`<div><span>${period(p.period,s.frequency)}</span><div class="annual-track"><i style="width:${p.value===null?0:Math.abs(p.value)/max*100}%"></i></div><b>${number(p.value)}</b><small>${esc(s.unit)}</small></div>`).join('')+'</div>';
  }
  function seriesView(s){
    const latest=s.points.at(-1),previous=s.points.at(-2);
    const difference=latest?.value!==null&&previous?.value!==null&&previous?latest.value-previous.value:null;
    return `<p><strong>${number(latest?.value??null)} ${esc(s.unit)}</strong> · ${period(latest?.period||'',s.frequency)} 기준</p><p class="caption">${previous?`직전 제공 시점 ${period(previous.period,s.frequency)} 대비 ${difference===null?'비교 불가':(difference>0?'+':'')+number(difference)+' '+(s.unit==='%'?'%p':esc(s.unit))}`:'직전 자료 없음'}</p><details><summary>최근 추이와 원자료 값</summary>${chart(s)}</details>`;
  }
  function render(){
    if(!data){host.innerHTML='<article class="card"><h3>미분양·인구·산업 통계</h3><p>'+(error||'KOSIS 자료 확인 중')+'</p></article>';return;}
    const city=data.cities[state.city];
    host.innerHTML=`<div class="section-title"><h3>${cityNames[state.city]} 미분양·인구·고용</h3><span class="tag">KOSIS 공식 자료 · 수집 ${esc(data.fetchedAt.slice(0,10))}</span></div><p class="caption">도시 전체 통계입니다. 상단 면적·법정동·검색 필터는 적용되지 않습니다. 지표마다 발표 주기와 기준 시점이 다릅니다.</p><div class="grid">${Object.entries(city).map(([id,t])=>{
      const list=t.series;if(!list.length)return `<article class="card"><h3>${esc(t.title)}</h3><p>자료 미수집</p></article>`;
      if(!list.some(s=>s.id===selected[id]))selected[id]=(list.find(s=>/고용률/.test(s.item)&&s.dimensions.every(d=>/전체|계|15세이상/.test(d)))||list.find(s=>s.dimensions.every(d=>/전체|계/.test(d)))||list[0]).id;
      const s=list.find(s=>s.id===selected[id]);
      return `<article class="card"><h3>${esc(t.title)}</h3><label>통계 항목<select data-indicator="${id}">${list.map(x=>`<option value="${esc(x.id)}" ${s.id===x.id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label><div id="indicator-${id}">${seriesView(s)}</div><p class="caption">${id==='industry'?'근무지 기준 취업자입니다. 11차 산업분류 제공기간만 표시하며 이전 분류와 합산하지 않습니다. 조선·항공 개별 기업의 실적을 뜻하지 않습니다.':id==='employment'?'거주지 기준 지역별고용조사입니다. 근무지 기준 산업 통계와 집계 범위가 다릅니다.':id==='population'?'주민등록인구 기준으로 외국인 인구는 포함하지 않습니다.':id==='unsold'?'원자료의 구분별 수치입니다. 준공 후 미분양이 별도 제공되지 않으면 임의로 추정하지 않습니다.':'주민등록세대수이며 실제 주택 수나 입주 수요와 같지 않습니다.'}</p><a href="${esc(t.source)}" target="_blank" rel="noopener">KOSIS 원표 ↗</a></article>`;
    }).join('')}</div><article class="card" id="plannedSupply"></article>`;
    host.querySelectorAll('[data-indicator]').forEach(el=>el.onchange=()=>{selected[el.dataset.indicator]=el.value;const s=city[el.dataset.indicator].series.find(s=>s.id===el.value);$('indicator-'+el.dataset.indicator).innerHTML=seriesView(s);});
    renderPlans();
  }
  function renderPlans(){
    const target=$('plannedSupply');if(!target)return;
    if(!plans){target.textContent='입주예정 자료 확인 중';return;}
    const now=new Date(),start=now.getFullYear()*12+now.getMonth(),end=start+36;
    const rows=plans.cities[state.city].announcements.filter(a=>/^\d{6}$/.test(a.moveIn||'')).filter(a=>{const n=+a.moveIn.slice(0,4)*12+(+a.moveIn.slice(4)-1);return n>=start&&n<end;}).sort((a,b)=>a.moveIn.localeCompare(b.moveIn));
    target.innerHTML=`<h3>향후 36개월 입주예정 · 청약홈 수집 공고</h3><p class="caption">모집공고에 기재된 입주예정월과 해당 공고의 공급세대수입니다. 도시 전체 입주물량이 아니며, 일정 변경·임대·무순위 등 제외된 공고는 반영되지 않습니다. 같은 사업의 별도 공고가 중복될 수 있어 합산하지 않습니다.</p><div class="table-wrap"><table><thead><tr><th>입주예정</th><th>공고명</th><th>공고 공급세대</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${period(a.moveIn,'M')}</td><td>${esc(a.name)}</td><td>${number(a.households)}</td></tr>`).join('')||'<tr><td colspan="3">수집 공고 중 해당 기간의 입주예정 자료가 없습니다.</td></tr>'}</tbody></table></div>`;
  }
  document.addEventListener('units-rendered',render);render();
  fetch('data/kosis.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.schemaVersion!==1||d.status!=='ready')throw Error();data=d;render();}).catch(()=>{error='공식 통계 파일을 불러오지 못했습니다. 가상 수치는 표시하지 않습니다.';render();});
  fetch('data/applyhome.json',{cache:'no-cache'}).then(r=>r.json()).then(d=>{plans=d;renderPlans();}).catch(()=>{const p=$('plannedSupply');if(p)p.textContent='입주예정 자료를 불러오지 못했습니다.';});
})();
