(() => {
  let snapshot, selectedId, error;
  const panel=document.createElement('article');panel.className='card';panel.id='presalePanel';
  const section=$('supply');section.querySelector('.grid').firstElementChild.remove();
  section.insertBefore(panel,section.querySelector('.grid'));
  const safeLink=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='applyhome.co.kr'||u.hostname.endsWith('.applyhome.co.kr'))?u.href:'https://www.applyhome.co.kr/';}catch{return 'https://www.applyhome.co.kr/';}};
  const inRange=m=>m.exclusiveArea!==null&&($('size').value==='all'||($('size').value==='84'?m.exclusiveArea>=80&&m.exclusiveArea<=86:m.exclusiveArea>=55&&m.exclusiveArea<=65));
  function detail(a){
    if(!a)return '<p class="empty">선택한 면적에 해당하는 분양공고가 없습니다.</p>';
    const models=a.models.filter(inRange);
    return `<h3>${esc(a.name)}</h3><p>${esc(a.address)}</p><p>모집공고 ${esc(a.announced)} · 공급 ${esc(a.households??'미제공')}세대 · 공고상 입주예정 ${esc(a.moveIn||'미제공')}</p><a href="${esc(safeLink(a.url))}" target="_blank" rel="noopener">청약홈 원문 확인 ↗</a><div class="table-wrap"><table><thead><tr><th>주택형</th><th>공급면적</th><th>최고 분양가</th><th>기존 거래 중앙값</th><th>차이</th><th>거래 수</th></tr></thead><tbody>${models.map(m=>{const c=m.comparison,ok=m.topAmount&&c.median;return `<tr><td>${esc(m.type)}<small>전용 ${m.exclusiveArea}㎡ 기준</small></td><td>${m.supplyArea??'—'}㎡</td><td>${m.topAmount?money(m.topAmount):'미제공'}</td><td>${c.median?money(c.median):'표본 부족'}</td><td>${ok?((m.topAmount/c.median-1)*100).toFixed(1)+'%':'—'}</td><td>${c.count.toLocaleString()}건</td></tr>`;}).join('')}</tbody></table></div><p class="caption">기존 거래: ${esc(models[0]?.comparison.from||'')}~${esc(models[0]?.comparison.to||'')} · ${cityNames[state.city]} 전체 · 주택형 전용면적 ±1㎡ · 해제 거래 제외 · 5건 미만은 비교하지 않습니다.</p>`;
  }
  function render(){
    if(!snapshot){panel.innerHTML='<h3>신규 분양가와 기존 거래 비교</h3><p>'+(error||'청약홈 자료 확인 중')+'</p>';return;}
    const all=snapshot.cities[state.city].announcements;
    const notices=all.filter(a=>a.models.some(inRange));
    if(!notices.some(a=>a.id===selectedId))selectedId=notices[0]?.id;
    const byYear={};notices.forEach(a=>{const values=a.models.filter(m=>inRange(m)&&m.topAmount).map(m=>m.topAmount);if(values.length)(byYear[a.announced.slice(0,4)]??=[]).push(median(values));});
    panel.innerHTML=`<div class="card-head"><h3>신규 분양가와 기존 거래 비교</h3><span class="tag">청약홈 실제 자료</span></div><p>수집 ${esc(snapshot.fetchedAt.slice(0,10))} · ${cityNames[state.city]} ${all.length}개 공고 중 선택 면적 ${notices.length}개 · 상단 도시·전용면적 선택 적용</p><p class="caption">일반 APT 분양주택 공고만 포함합니다. 사전청약·임대·무순위·임의공급은 제외하며, 현재 청약 가능한 단지만을 뜻하지 않습니다. 법정동·단지 검색은 이 표에 적용되지 않습니다.</p><label>분양공고 선택<select id="presaleSelect">${notices.map(a=>`<option value="${esc(a.id)}" ${a.id===selectedId?'selected':''}>${esc(a.announced+' · '+a.name)}</option>`).join('')}</select></label><div id="presaleDetail">${detail(notices.find(a=>a.id===selectedId))}</div><details><summary>연도별 분양가격 표본 보기</summary><p class="caption">선택 면적의 주택형별 최고 분양가 중앙값을 공고마다 계산한 뒤, 연도별 중앙값으로 집계합니다. 공급세대 가중평균이나 동일 단지 가격지수가 아닙니다. 공고가 없는 연도는 표시하지 않습니다.</p><div class="table-wrap"><table><thead><tr><th>공고연도</th><th>공고별 가격 중앙값</th><th>공고 수</th></tr></thead><tbody>${Object.keys(byYear).sort().map(y=>`<tr><td>${y}</td><td>${money(median(byYear[y]))}</td><td>${byYear[y].length}</td></tr>`).join('')}</tbody></table></div></details><p class="caption">분양가는 주택형별 최고 공급금액이며 평균 계약금액이 아닙니다. 발코니 확장·유상옵션 포함 여부는 원문을 확인하세요. 기존 주택과 입지·연식·층·향이 다르므로 차이를 저평가·고평가 판단으로 해석할 수 없습니다. 전용면적은 주택형 숫자에서 읽은 값이며 공급면적과 구분합니다. 입주예정월은 실제 입주 확인이 아닙니다.</p><a href="${snapshot.source}" target="_blank" rel="noopener">자료 출처: 한국부동산원 청약홈 ↗</a>`;
    $('presaleSelect').onchange=e=>{selectedId=e.target.value;$('presaleDetail').innerHTML=detail(notices.find(a=>a.id===selectedId));};
  }
  document.addEventListener('units-rendered',render);
  render();
  fetch('data/applyhome.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.status!=='ready'||d.schemaVersion!==1)throw Error();snapshot=d;render();}).catch(()=>{error='청약홈 자료를 불러오지 못했습니다. 가상 가격은 표시하지 않습니다.';render();});
})();
