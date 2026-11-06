import json
import os
import re
import time
import urllib.request
import urllib.parse
import urllib.error

def request(endpoint, **params):
    key=os.environ.get('KOSIS_API_KEY','').strip()
    if not key:raise RuntimeError('KOSIS_API_KEY missing')
    query={'apiKey':key,'format':'json','jsonVD':'Y',**params}
    url='https://kosis.kr/openapi/'+endpoint+'?'+urllib.parse.urlencode(query)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=60) as response:
                data=json.loads(response.read().decode('utf-8-sig'))
            if not isinstance(data,list):
                code=re.sub('[^0-9A-Za-z_-]','',str(data.get('err','unknown')))[:20]
                raise RuntimeError('KOSIS API error '+code)
            time.sleep(1.1)
            return data
        except Exception as e:
            if attempt==2:
                reason=str(e) if isinstance(e,RuntimeError) else ('HTTP_'+str(e.code) if isinstance(e,urllib.error.HTTPError) else 'network or response')
                raise RuntimeError(reason) from None
            time.sleep(3)

if __name__=='__main__':
    try:
        for query in ['미분양주택현황 시군구','행정구역 세대수','시군구별 주요고용지표','시군구 산업별 취업자']:
            rows=request('statisticsSearch.do',method='getList',searchNm=query,resultCount=8,startCount=1)
            print(query,json.dumps([{k:r.get(k) for k in ['ORG_ID','TBL_ID','TBL_NM','END_PRD_DE']} for r in rows],ensure_ascii=False),flush=True)
        for kind in ['ITM','PRD']:
            rows=request('statisticsData.do',method='getMeta',type=kind,orgId='101',tblId='DT_1B040A3')
            if kind=='ITM':rows=[r for r in rows if r.get('ITM_NM') in ['진주시','거제시','총인구수']]
            print(kind,json.dumps(rows,ensure_ascii=False),flush=True)
    except Exception as e:
        print(str(e) if isinstance(e,RuntimeError) else 'KOSIS schema error')
        raise SystemExit(1)
