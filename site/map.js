(() => {
  let map,geocoder,ready=false,generation=0,overlays=[];
  const coords=new Map();
  const centers={jinju:[35.180,128.108],geoje:[34.880,128.621]};
  const host=$('kakaoMap');
  function clear(){overlays.forEach(o=>o.setMap(null));overlays=[];}
  function select(){
    const u=state.selected;
    $('mapSelection').textContent=u?`${u.name} · ${u.dong} · ${money(latest(u).amount)}`:'단지를 선택하세요.';
    $('kakaoExternal').href='https://map.kakao.com/link/search/'+encodeURIComponent(u?u.address+' '+u.name:cityNames[state.city]+'시 아파트');
    if(ready&&u&&coords.has(u.id))map.panTo(coords.get(u.id));
  }
  async function render(){
    const token=++generation;clear();select();if(!ready)return;
    const [lat,lng]=centers[state.city];map.setCenter(new kakao.maps.LatLng(lat,lng));map.setLevel(8);
    const visible=[...state.visible],bounds=new kakao.maps.LatLngBounds();let located=0;
    $('mapStatus').textContent=visible.length?'단지 주소 확인 중':'표시할 수집 단지가 없습니다.';
    for(const u of visible){
      if(token!==generation)return;
      let position=coords.get(u.id);
      if(!position&&u.hasLot){
        position=await new Promise(resolve=>{
          const timeout=setTimeout(()=>resolve(null),5000);
          geocoder.addressSearch(u.address,(results,status)=>{
            clearTimeout(timeout);
            // Do not place markers using an approximate administrative-district centroid.
            const found=results?.find(r=>r.address?.address_name===u.address);
            resolve(status===kakao.maps.services.Status.OK&&found?new kakao.maps.LatLng(+found.y,+found.x):null);
          });
        });
        if(position)coords.set(u.id,position);
      }
      if(token!==generation)return;
      if(!position)continue;
      const button=document.createElement('button');button.className='map-marker';button.type='button';button.textContent=`${u.name} ${money(latest(u).amount)}`;button.onclick=()=>selectUnit(u.id);
      const overlay=new kakao.maps.CustomOverlay({map,position,content:button,yAnchor:1.1});overlays.push(overlay);bounds.extend(position);located++;
    }
    if(token!==generation)return;
    if(located){map.relayout();map.setBounds(bounds,70,70,70,70);}
    $('mapStatus').textContent=`${located}/${visible.length}개 주소 확인 · 나머지는 위치 미확인`;
  }
  function fail(message){$('mapStatus').textContent=message;host.replaceChildren();const box=document.createElement('div');box.className='map-placeholder';box.innerHTML='<strong>지도를 불러오지 못했습니다.</strong><p>아래 카카오맵 링크와 단지 목록은 이용할 수 있습니다.</p>';host.append(box);$('mapFit').disabled=true;$('mapType').disabled=true;}
  document.addEventListener('units-rendered',render);document.addEventListener('unit-selected',select);
  $('mapFit').onclick=render;$('mapType').onchange=e=>{if(ready)map.setMapTypeId(e.target.value==='sky'?kakao.maps.MapTypeId.HYBRID:kakao.maps.MapTypeId.ROADMAP);};
  const key=window.KAKAO_MAP_APP_KEY?.trim();
  if(!key){fail('카카오 JavaScript 키 미설정');return;}
  let done=false;const timeout=setTimeout(()=>{done=true;fail('지도 연결 시간 초과');},15000);
  const script=document.createElement('script');script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey='+encodeURIComponent(key);
  script.onerror=()=>{done=true;clearTimeout(timeout);fail('카카오 지도 연결 실패 · 키와 허용 도메인 확인 필요');};
  script.onload=()=>{
    if(done)return;
    if(!window.kakao?.maps?.load){clearTimeout(timeout);fail('카카오 지도 설정 확인 필요');return;}
    kakao.maps.load(()=>{if(done)return;try{map=new kakao.maps.Map(host,{center:new kakao.maps.LatLng(...centers[state.city]),level:8});geocoder=new kakao.maps.services.Geocoder();map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);ready=true;clearTimeout(timeout);new ResizeObserver(()=>map.relayout()).observe(host);render();}catch{clearTimeout(timeout);fail('카카오 지도 초기화 실패');}});
  };
  document.head.append(script);
})();
