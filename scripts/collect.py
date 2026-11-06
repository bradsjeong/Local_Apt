"""MOLIT apartment sales snapshots. No credentials or raw HTTP errors in output."""
import argparse
import calendar
import hashlib
import json
import os
from pathlib import Path
import statistics
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

API = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'
SOURCE = 'https://www.data.go.kr/data/15126469/openapi.do'
CITIES = {'jinju': ('진주', '48170'), 'geoje': ('거제', '48310')}
KST = timezone(timedelta(hours=9))

def months(start, end):
    year, month = int(start[:4]), int(start[4:])
    date(year, month, 1)
    while f'{year:04}{month:02}' <= end:
        yield f'{year:04}{month:02}'
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)

def parse_page(payload):
    root = ET.fromstring(payload)
    code = root.findtext('.//resultCode')
    if code not in ('000', '00', '0000'):
        safe_code=re.sub(r'[^A-Za-z0-9_-]', '', code or root.findtext('.//returnReasonCode') or 'UNKNOWN')[:30]
        raise ValueError('API_CODE_'+safe_code)
    total = root.findtext('.//totalCount')
    if total is None:
        raise ValueError('응답에 totalCount가 없습니다.')
    return int(total), [{child.tag: (child.text or '').strip() for child in item} for item in root.findall('.//item')]

def normalize(row, city, code):
    # Cancellation records are excluded, not treated as new sales.
    if row.get('cdealDay') or row.get('cdealType', '').upper() in ('O', 'Y', '1', '해제'):
        return None
    amount = int(row['dealAmount'].replace(',', ''))
    area = float(row['excluUseAr'])
    deal_date = date(int(row['dealYear']), int(row['dealMonth']), int(row['dealDay'])).isoformat()
    if amount <= 0 or area <= 0 or not row.get('aptNm') or not row.get('umdNm'):
        raise ValueError('실거래 필수 항목이 유효하지 않습니다.')
    address = ' '.join(x for x in ('경상남도', city+'시', row['umdNm'], row.get('jibun', '')) if x)
    identity = '|'.join((code, row.get('aptSeq') or '', row['umdNm'], row.get('jibun', ''), row['aptNm']))
    return {'complexId': hashlib.sha256(identity.encode()).hexdigest()[:16],
            'name': row['aptNm'], 'dong': row['umdNm'], 'address': address,
            'date': deal_date, 'area': area, 'amount': amount,
            'floor': row.get('floor', ''), 'built': row.get('buildYear', ''),
            'tradeType': row.get('dealingGbn', ''), 'hasLot': bool(row.get('jibun'))}

def aggregate(records, fetched_at, start, end, city):
    # Do not deduplicate identical transactions: multiple homes can sell at the same price.
    groups = {}
    for row in records:
        groups.setdefault(row['complexId'], []).append(row)
    complexes = []
    for identity, sales in groups.items():
        sales.sort(key=lambda r: (r['date'], r['area'], r['amount']))
        latest = sales[-1]
        complexes.append({'id': identity, **{k: latest[k] for k in ('name','dong','address','built','hasLot')},
                          'sales': [{k:r[k] for k in ('date','area','amount','floor','tradeType')} for r in sales]})
    return {'schemaVersion': 1, 'status': 'ready', 'city': city, 'source': SOURCE,
            'fetchedAt': fetched_at, 'period': {'from':start,'to':end},
            'recordCount':len(records), 'complexes':complexes,
            'notes':['해제 거래 제외', '금액 단위: 만원', '최근 신고·정정으로 수치가 변경될 수 있음',
                     '동일 가격·면적 거래를 임의 중복 제거하지 않음']}

def diagnose_access(key):
    allowed_errors = ('SERVICE_KEY_IS_NOT_REGISTERED_ERROR','SERVICE_ACCESS_DENIED_ERROR',
        'SERVICE_KEY_IS_NULL','DEADLINE_HAS_EXPIRED_ERROR','LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
        'PERMISSION_DENIED','ACCESS_DENIED','Forbidden','Unauthorized')
    for label, endpoint in [('detailed', API), ('standard', API.replace('TradeDev','Trade'))]:
        params={'serviceKey':urllib.parse.unquote(key),'LAWD_CD':'48170','DEAL_YMD':datetime.now(KST).strftime('%Y%m'),'numOfRows':1,'pageNo':1}
        request=urllib.request.Request(endpoint+'?'+urllib.parse.urlencode(params),headers={'Accept':'application/xml','User-Agent':'LocalApt/1.0'})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:
                body=response.read(65536);status=response.status
        except urllib.error.HTTPError as error:
            status=error.code;body=error.read(65536)
        except Exception:
            print('Access check '+label+': transport failure');continue
        text=body.decode('utf-8',errors='replace')
        indicators=[term for term in allowed_errors if term in text]
        try:
            root=ET.fromstring(body)
            code=root.findtext('.//resultCode') or root.findtext('.//returnReasonCode') or ''
            if re.fullmatch(r'[0-9]{1,4}',code):indicators.append('API_CODE_'+code)
        except ET.ParseError:pass
        print('Access check '+label+': HTTP '+str(status)+'; '+(', '.join(indicators) or 'unclassified response'))

def fetch_month(key, code, month):
    result=[]; page=1; total=None
    while total is None or len(result)<total:
        params={'serviceKey':urllib.parse.unquote(key), 'LAWD_CD':code,'DEAL_YMD':month,'numOfRows':1000,'pageNo':page}
        url=API+'?'+urllib.parse.urlencode(params)
        for attempt in range(3):
            try:
                request=urllib.request.Request(url,headers={'Accept':'application/xml','User-Agent':'LocalApt/1.0'})
                with urllib.request.urlopen(request,timeout=40) as response:
                    count, items=parse_page(response.read())
                break
            except Exception as error:
                reason=('HTTP_'+str(error.code)) if isinstance(error,urllib.error.HTTPError) else (str(error) if isinstance(error,ValueError) and str(error).startswith('API_CODE_') else 'NETWORK_OR_RESPONSE')
                if attempt==2:
                    raise RuntimeError(f'{code} / {month} / {page}페이지 수집 실패 ({reason}). 인증키·활용 승인·서비스 상태를 확인하세요.') from None
                time.sleep(2**attempt)
        if total is not None and total!=count:
            raise RuntimeError('수집 중 총 건수가 변경되었습니다. 다시 실행하세요.')
        total=count
        if not items and len(result)<total:
            raise RuntimeError('누락 페이지 감지. 기존 데이터는 유지됩니다.')
        result.extend(items);page+=1;time.sleep(.12)
        if len(result)>total:
            raise RuntimeError('응답 건수 불일치. 다시 수집하세요.')
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--start',default='201001')
    parser.add_argument('--end',default=datetime.now(KST).strftime('%Y%m'))
    parser.add_argument('--out',default='site/data')
    args=parser.parse_args()
    key=os.environ.get('MOLIT_SERVICE_KEY','').strip()
    if not key:
        raise RuntimeError('MOLIT_SERVICE_KEY가 등록되지 않았습니다. 수집과 배포를 중단합니다.')
    period=list(months(args.start,args.end))
    if not period or len(period)>600:raise ValueError('조회 기간을 확인하세요.')
    fetched=datetime.now(KST).isoformat(timespec='seconds'); snapshots={}
    for slug,(city,code) in CITIES.items():
        records=[];cancelled=0
        for month in period:
            if month.endswith('01'):
                print(f'{city}: {month[:4]}년 수집 중', flush=True)
            for row in fetch_month(key,code,month):
                normalized=normalize(row,city,code)
                if normalized:records.append(normalized)
                else:cancelled+=1
        snapshot=aggregate(records,fetched,args.start,args.end,city)
        snapshot['cancelledExcluded']=cancelled
        snapshots[slug]=snapshot
        print(f'{city}: {len(records)}건 / {len(snapshot["complexes"])}개 단지')
    # Only replace published files after BOTH complete city snapshots are ready.
    output=Path(args.out);output.mkdir(parents=True,exist_ok=True)
    for slug,snapshot in snapshots.items():
        temp=output/(slug+'.json.tmp')
        temp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        temp.replace(output/(slug+'.json'))
    (output/'status.json').write_text(json.dumps({'status':'ready','updatedAt':fetched,'source':SOURCE,
        'cities':{slug:{'records':s['recordCount'],'complexes':len(s['complexes'])} for slug,s in snapshots.items()}},ensure_ascii=False),encoding='utf-8')

if __name__=='__main__':
    try:main()
    except Exception as error:
        # Never print exception objects that may contain a serviceKey URL.
        if isinstance(error,(RuntimeError,ValueError,KeyError,ET.ParseError)):
            print('수집 실패: '+(str(error) if isinstance(error,RuntimeError) else '응답 형식 또는 입력값 확인 필요'),file=sys.stderr)
        else:print('수집 실패: 네트워크 또는 파일 오류',file=sys.stderr)
        sys.exit(1)
