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
    for query in ['고용률','산업별 취업자','준공후 미분양']:
        try:
            rows=request('statisticsSearch.do',method='getList',searchNm=query,resultCount=12,startCount=1)
            print(query,json.dumps([{k:r.get(k) for k in ['ORG_ID','TBL_ID','TBL_NM','END_PRD_DE']} for r in rows],ensure_ascii=False),flush=True)
        except RuntimeError as e:print(query,str(e),flush=True)
    for org,tbl in [('101','DT_1B040A3'),('101','DT_1B040B3'),('116','DT_MLTM_2082')]:
        for kind in ['ITM','PRD']:
            try:
                rows=request('statisticsData.do',method='getMeta',type=kind,orgId=org,tblId=tbl)
                if kind=='ITM':
                    chosen=[r for r in rows if '진주' in str(r) or '거제' in str(r) or r.get('OBJ_ID') in ('ITM','ITEM')]
                    print(tbl,'OBJECTS',sorted(set(str(r.get('OBJ_ID'))+':'+str(r.get('OBJ_NM')) for r in rows)),flush=True)
                    rows=chosen or rows[:12]
                print(tbl,kind,json.dumps(rows,ensure_ascii=False),flush=True)
            except RuntimeError as e:print(tbl,str(e),flush=True)
