(() => {
  const field=(id,label,value='',step='1',min='0')=>`<label>${label}<input id="${id}" type="number" min="${min}" step="${step}" value="${value}" required></label>`;
  $('sell').innerHTML=`<div class="section-title"><h2>보유주택 매도 전략</h2><span class="tag">임대차·대출·보유비용 조건 비교</span></div>
  <p>현재 임대차가 끝난 뒤 1년 월세, 2년 전세, 4년 전세(2+2)를 운영하고 매도하는 경로를 비교합니다. 가격 경로와 계약 조건은 직접 입력한 가정입니다.</p>
  <div class="grid planner"><article class="card"><form id="holding">
  <label>주택 이름<input id="homeName" placeholder="선택 입력"></label>
  <fieldset><legend>현재 주택·임대차</legend><div class="fields">
  ${field('price','현재 예상 매도가 · 억원','','0.01','0.01')}
  ${field('deposit','현재 임대보증금 · 만원')}${field('rent','현재 월세 · 만원','0')}
  <label>현재 임대차 만기<input id="expiry" type="date" required></label></div>
  <label class="check"><input id="transfer" type="checkbox" checked>임차인 승계를 통한 즉시 매도 검토 가능</label>
  <p class="caption">만기 전 즉시 매도는 승계 조건입니다. 만기·갱신·퇴거는 실제 계약과 협의 여부를 별도로 확인해야 합니다.</p></fieldset>
  <fieldset><legend>대출·보유비용</legend><div class="fields">
  ${field('loan','현재 주담대 잔액 · 만원')}${field('interest','연 대출금리 · %','','0.01')}
  <label>대출 상환 가정<select id="amortization"><option value="interest">이자만 납부 · 잔액 유지</option><option value="principal">원금균등 상환</option></select></label>
  ${field('loanMonths','대출 잔여 상환기간 · 개월','360','1','1')}
  ${field('tax','연 재산세·종부세 합계 · 만원')}${field('other','연 기타 보유비 · 만원','0')}</div>
  <p class="caption">대출 잔액/현재 예상 매도가로 주담대 비율을 계산합니다. 규제상 LTV 판정이 아닙니다. 원리금균등·변동금리·중도 대환은 아직 별도 모델링하지 않습니다.</p></fieldset>
  <fieldset><legend>만기 후 임대 조건</legend><div class="fields">
  ${field('jeonse','예상 전세보증금 · 만원')}${field('monthlyDeposit','월세 전환 시 보증금 · 만원')}
  ${field('conversion','가정 전월세 전환율 · 연 %','','0.01')}
  </div><p class="caption">새 월세 = (예상 전세보증금 − 월세 보증금) × 전환율 ÷ 12. 시장에서 협의할 가정이며 법정 전환율 판정이 아닙니다. 전세/매매 비율과 환산 월세를 결과에 표시합니다. 4년 경로는 2년 뒤 동일 조건으로 갱신하는 가정입니다.</p></fieldset>
  <details><summary>가격·할인율·매도비용</summary><div class="fields">
  ${field('rate','연 매매가격 변동률 가정 · %','0','0.1','-30')}
  ${field('discount','연 기회비용·할인율 · %','0','0.1')}
  ${field('fee','매도 부대비용 · 매도가의 %','0','0.01')}
  ${field('saleTax0','즉시 매도 예상 양도세 등 · 만원','0')}
  ${field('saleTax1','1년 월세 후 예상 양도세 등 · 만원','0')}
  ${field('saleTax2','2년 전세 후 예상 양도세 등 · 만원','0')}
  ${field('saleTax4','4년 전세 후 예상 양도세 등 · 만원','0')}
  </div><p class="caption">양도세·중개비·중도상환수수료는 자동 산정하지 않습니다. 직접 입력해야 반영되며 0이면 제외됩니다. 가격 민감도에서도 입력한 세액은 고정됩니다.</p></details>
  <button class="primary">조건 비교하기</button><button type="button" id="exitExample">가상 예시 입력</button>
  <p id="exitError" role="alert"></p></form></article>
  <article class="card"><h3>매도 시점별 자금 비교</h3><div id="exitResult" aria-live="polite">보유주택 조건을 입력하면 계산합니다. 입력값은 서버에 저장하지 않습니다.</div></article></div>`;
  const amount=n=>`${Math.round(n).toLocaleString('ko-KR')}만원`;
  const pct=n=>n.toFixed(1)+'%';
  const dateAfter=m=>{const d=new Date();d.setMonth(d.getMonth()+m);return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;};
  function calculate(){
    if(!$('holding').reportValidity())return;
    const ids=['price','deposit','rent','loan','interest','loanMonths','tax','other','jeonse','monthlyDeposit','conversion','discount','fee','saleTax0'];
    const a=Object.fromEntries(ids.map(id=>[id,+$(id).value]));a.price*=10000;a.growth=+$('rate').value;a.amortization=$('amortization').value;
    const expiry=new Date($('expiry').value+'T00:00:00'),now=new Date();
    a.wait=Math.max(0,Math.ceil((expiry-now)/86400000/(365.25/12)));
    if(!Object.values(a).every(v=>typeof v!=='number'||Number.isFinite(v))||a.wait>120||a.fee>=100||a.monthlyDeposit>a.jeonse){$('exitError').textContent='만기는 10년 이내, 매도 부대비용은 100% 미만, 월세 보증금은 예상 전세보증금 이하로 입력해 주세요.';return;}
    $('exitError').textContent='';
    const cycles=[{name:'1년 월세',kind:'monthly',months:12,saleTax:+$('saleTax1').value},{name:'2년 전세',kind:'jeonse',months:24,saleTax:+$('saleTax2').value},{name:'4년 전세 · 2+2',kind:'jeonse',months:48,saleTax:+$('saleTax4').value}];
    const rows=cycles.map(c=>({...c,...ExitModel.run(a,c)}));
    const best=rows.reduce((x,y)=>x.npv>=y.npv?x:y),immediate=rows[0].immediate;
    const transfer=$('transfer').checked||a.wait===0;
    const recommendation=transfer&&immediate>=best.npv?'입력한 기본 가정에서는 즉시 매도의 현재가치가 가장 큽니다.':`입력한 기본 가정에서는 ${best.name} 후 매도의 현재가치가 가장 큽니다.${transfer?'':' 즉시 매도는 승계 불가 조건으로 실행 후보에서 제외했습니다.'}`;
    $('exitResult').innerHTML=`<div class="summary"><strong>${esc($('homeName').value||'보유주택')} 조건 비교</strong><p>주담대 비율 ${pct(a.loan/a.price*100)} · 예상 전세/매매 비율 ${pct(a.jeonse/a.price*100)}<br>월세 전환 가정: 보증금 ${amount(a.monthlyDeposit)} / 월 ${amount(rows[0].newRent)}<br>현재 임대차 잔여 ${a.wait}개월 · 만기 이후 각 경로 시작</p></div>
    <p>${recommendation}</p><p class="caption">시장 사이클을 예측한 매도 권고가 아닌, 입력 조건의 계산상 비교입니다. 월별 할인으로 시점 차이를 반영합니다. 만기는 월 단위로 올림하고 보유세는 월할 계산합니다.</p>
    <p>즉시 매도 정산금: <strong>${amount(immediate)}</strong>${transfer?' · 임차인 승계 또는 계약 종료 가정':' · 실행 제외, 비교 기준으로만 사용'}</p>
    <div class="exit-results">${rows.map(r=>`<section class="exit-card"><h4>${r.name}</h4><p>${r.months}개월 후 · 약 ${dateAfter(r.months)} 매도</p><dl>
      <dt>가정 매도가</dt><dd>${amount(r.price)}</dd><dt>매도 시 정산금</dt><dd>${amount(r.net)}</dd>
      <dt>보유 중 누적 현금흐름</dt><dd>${amount(r.cash)}</dd><dt>합산 현금 · 할인 전</dt><dd>${amount(r.total)}</dd>
      <dt>현재가치</dt><dd>${amount(r.npv)}</dd><dt>즉시 매도 대비 현재가치 차이</dt><dd>${amount(r.advantage)}</dd>
      <dt>즉시 매도와 같아지는 매도가</dt><dd>${amount(r.breakEven)}</dd><dt>중간 필요자금 · 최소</dt><dd>${amount(Math.max(0,-r.minCash))}</dd></dl>
      <details><summary>임대수익·은행이자·보유비 상세</summary><dl><dt>수취 월세 합계</dt><dd>${amount(r.rentTotal)}</dd><dt>은행이자 합계</dt><dd>${amount(r.interest)}</dd><dt>원금 상환 합계</dt><dd>${amount(r.principal)}</dd><dt>보유세·기타 비용</dt><dd>${amount(r.costTotal)}</dd><dt>매도 시 대출잔액</dt><dd>${amount(r.debt)}</dd><dt>매도 시 반환 보증금</dt><dd>${amount(r.deposit)}</dd><dt>입력한 양도세 등</dt><dd>${amount(r.saleTax)}</dd></dl></details></section>`).join('')}</div>
    <h4>가격 경로별 현재가치 · 만원</h4><div class="table-wrap"><table><thead><tr><th>경로</th><th>연 ${pct(a.growth-3)}</th><th>연 ${pct(a.growth)}</th><th>연 ${pct(a.growth+3)}</th></tr></thead><tbody>${cycles.map(c=>`<tr><td>${c.name}</td>${[-3,0,3].map(d=>`<td>${Math.round(ExitModel.run(a,c,a.growth+d).npv).toLocaleString('ko-KR')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="caption">정산금 = 매도가 − 매도 부대비용 − 입력 세액 − 대출잔액 − 보증금. 누적 현금흐름에는 월세, 이자, 원금상환, 보유세·기타비용, 임대 전환 시 보증금 증감을 반영합니다. 승계 매도도 매수자가 인수하는 보증금을 차감하므로 보증금을 수익으로 세지 않습니다.</p>
    <p class="caption">추가 보증금은 대출 자동 상환에 사용하지 않으며 운용수익도 가정하지 않습니다. 신규 임차인은 만기 직후 입주하는 가정입니다. 공실·퇴거 지연·보증금 반환 시차·추가 차입 이자는 제외되어 실제 필요자금은 더 클 수 있습니다. 임대 조건과 금리는 경로 내 고정입니다. 매도 시점별 세액이 미입력이라면 세후 우열로 해석하지 마세요.</p>`;
    renderScenario();
  }
  $('holding').onsubmit=e=>{e.preventDefault();calculate();};
  $('exitExample').onclick=()=>{
    const values={homeName:'가상 예시 · 실제 보유주택 아님',price:4,deposit:20000,rent:0,loan:10000,interest:4.5,loanMonths:240,tax:100,other:60,jeonse:24000,monthlyDeposit:5000,conversion:5,rate:0,discount:3,fee:0.5,saleTax0:0,saleTax1:0,saleTax2:0,saleTax4:0};
    Object.entries(values).forEach(([id,v])=>$(id).value=v);const d=new Date();d.setMonth(d.getMonth()+6);$('expiry').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    calculate();
  };
})();
