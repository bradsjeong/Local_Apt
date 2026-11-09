"""City-level official statistics. Keep every source dimension and missing-value symbol."""
import json
import math
from pathlib import Path
from datetime import datetime, timezone, timedelta
from kosis_client import request

TABLES=[
    ('population','주민등록인구','101','DT_1B040A3','T20'),
    ('households','주민등록세대수','101','DT_1B040B3','T1'),
    ('unsold','미분양주택','116','DT_MLTM_2082','ALL'),
    ('employment','취업자·고용률','101','DT_1ES3A03_A01S','ALL'),
    ('industry','산업별 취업자 · 근무지 기준 · 11차 분류','101','DT_1ES3C06S','ALL'),
]
CITIES={'진주시':'jinju','거제시':'geoje'}

def numeric(raw):
    try:
        value=float(str(raw).replace(',',''))
        return value if math.isfinite(value) else None
    except (ValueError,TypeError):return None

def normalize(rows):
    result={'jinju':{},'geoje':{}}
    seen=set()
    for row in rows:
        city_dims=[i for i in range(1,9) if row.get('C'+str(i)+'_NM') in CITIES]
        if len(city_dims)!=1:raise ValueError('Missing or ambiguous city dimension')
        city=CITIES[row['C'+str(city_dims[0])+'_NM']]
        dims=[(row.get('C'+str(i),''),row.get('C'+str(i)+'_NM','')) for i in range(1,9) if i not in city_dims and row.get('C'+str(i))]
        key='|'.join([row['ITM_ID']]+[d[0] for d in dims])
        identity=(city,key,row['PRD_DE'],row['PRD_SE'])
        if identity in seen:raise ValueError('Duplicate observation')
        seen.add(identity)
        label=' · '.join([row['ITM_NM']]+[d[1] for d in dims])
        unit=row.get('UNIT_NM') or ('호' if row['TBL_ID']=='DT_MLTM_2082' else '')
        # Some mixed-unit tables return the table-wide unit for every item.
        if '(%)' in row['ITM_NM'].replace(' ', ''):unit='%'
        series=result[city].setdefault(key,{'id':key,'label':label,'item':row['ITM_NM'],'dimensions':[d[1] for d in dims], 'unit':unit,'frequency':row['PRD_SE'],'points':[]})
        if series['unit']!=unit or series['frequency']!=row['PRD_SE']:raise ValueError('Inconsistent observation units')
        series['points'].append({'period':row['PRD_DE'],'value':numeric(row.get('DT')),'raw':row.get('DT'),'revised':row.get('LST_CHN_DE')})
    for city,series in result.items():
        if not series:raise ValueError('No city observations')
        for s in series.values():s['points'].sort(key=lambda p:p['period'])
        result[city]=list(series.values())
    return result

def fetch_table(org,tbl,item):
    meta=request('statisticsData.do',method='getMeta',type='ITM',orgId=org,tblId=tbl)
    cities=[r for r in meta if r.get('ITM_NM') in CITIES and r.get('OBJ_ID')!='ITEM']
    if set(r['ITM_NM'] for r in cities)!=set(CITIES) or len(cities)!=2:raise ValueError('City metadata mismatch')
    city_index={str(r['OBJ_ID_SN']) for r in cities}
    if len(city_index)!=1:raise ValueError('City dimension mismatch')
    params={}
    for r in meta:
        if r.get('OBJ_ID_SN'):params['objL'+str(r['OBJ_ID_SN'])]='ALL'
    params['objL'+next(iter(city_index))]='+'.join(r['ITM_ID'] for r in cities)
    periods=request('statisticsData.do',method='getMeta',type='PRD',orgId=org,tblId=tbl)
    selected=next((p for name in ('월','반기','년') for p in periods if p['PRD_SE']==name),None)
    if not selected:raise ValueError('Unknown frequency')
    frequency={'월':'M','반기':'S','년':'Y'}[selected['PRD_SE']]
    rows=request('Param/statisticsParameterData.do',method='getList',orgId=org,tblId=tbl,itmId=item,prdSe=frequency,newEstPrdCnt=60 if frequency=='M' else 12,smblChk='Y',**params)
    print(tbl+': '+str(len(rows))+' observations',flush=True)
    if any(r.get('TBL_ID')!=tbl or r.get('ORG_ID')!=org for r in rows):raise ValueError('Unexpected source')
    return normalize(rows),selected

def main():
    result={'schemaVersion':1,'fetchedAt':datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds'),'cities':{'jinju':{},'geoje':{}}}
    failures=[]
    for slug,title,org,tbl,item in TABLES:
        source='https://kosis.kr/statHtml/statHtml.do?orgId='+org+'&tblId='+tbl
        try:
            values,period=fetch_table(org,tbl,item)
            for city in result['cities']:
                result['cities'][city][slug]={'status':'ready','title':title,'source':source,'table':tbl,'coverage':period,'series':values[city]}
        except Exception as e:
            reason=str(e) if isinstance(e,RuntimeError) else 'Source schema validation failed'
            print(tbl+': '+reason,flush=True)
            failures.append(slug)
            for city in result['cities']:result['cities'][city][slug]={'status':'unavailable','title':title,'source':source,'table':tbl,'series':[]}
    if failures:raise RuntimeError('KOSIS incomplete: '+','.join(failures))
    result['status']='ready'
    target=Path('site/data/kosis.json');temporary=target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temporary.replace(target)

if __name__=='__main__':
    try:main()
    except Exception as e:
        print(str(e) if isinstance(e,RuntimeError) else 'KOSIS collection failed')
        raise SystemExit(1)
