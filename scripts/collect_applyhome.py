"""Collect official APT announcements; credentials never leave the Actions environment."""
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/'
SOURCE = 'https://www.data.go.kr/data/15098547/openapi.do'

def number(value):
    try:
        result = float(str(value).replace(',', '').strip())
        return result if 0 < result < 1e9 else None
    except (ValueError, TypeError):
        return None

def exclusive_area(house_type):
    # HOUSE_TY encodes the exclusive-area type; SUPLY_AR is supply area, never substitute it.
    match = re.fullmatch(r'\s*(\d{2,3}\.\d{2,4})[A-Za-z0-9-]*\s*', str(house_type or ''))
    return number(match.group(1)) if match else None

def fetch_all(endpoint, key, filters, opener=urllib.request.urlopen):
    rows = []
    total = None
    page = 1
    while total is None or len(rows) < total:
        params = {'serviceKey': urllib.parse.unquote(key), 'page': page, 'perPage': 100, **filters}
        request = urllib.request.Request(BASE+endpoint+'?'+urllib.parse.urlencode(params), headers={'Accept':'application/json'})
        for attempt in range(3):
            try:
                with opener(request, timeout=40) as response:
                    payload = json.load(response)
                if not isinstance(payload.get('data'), list) or 'matchCount' not in payload:
                    raise ValueError('invalid response')
                batch, count = payload['data'], int(payload['matchCount'])
                if count < 0 or payload.get('currentCount') != len(batch):
                    raise ValueError('invalid count')
                break
            except Exception as error:
                if attempt == 2:
                    reason = 'HTTP_'+str(error.code) if isinstance(error, urllib.error.HTTPError) else 'NETWORK_OR_RESPONSE'
                    raise RuntimeError('Applyhome '+endpoint+' failed ('+reason+'). Check service approval and key.') from None
                time.sleep(2**attempt)
        if total is not None and count != total:
            raise RuntimeError('Applyhome count changed during pagination')
        total = count
        if not batch and len(rows) < total:
            raise RuntimeError('Applyhome missing page')
        rows.extend(batch)
        if len(rows) > total:
            raise RuntimeError('Applyhome excess rows')
        page += 1
        time.sleep(.15)
    return rows

def comparison(sales, area, announced):
    end = date.fromisoformat(announced)
    start = end-timedelta(days=365)
    values = [s['amount'] for s in sales if area is not None and abs(s['area']-area) <= 1
              and start.isoformat() <= s['date'] < end.isoformat()]
    return {'from':start.isoformat(), 'to':(end-timedelta(days=1)).isoformat(),
            'count':len(values), 'median':statistics.median(values) if len(values) >= 5 else None}

def normalize_model(row, sales, announced):
    area = exclusive_area(row.get('HOUSE_TY'))
    return {'id':str(row.get('MODEL_NO','')), 'type':str(row.get('HOUSE_TY','')),
            'exclusiveArea':area, 'supplyArea':number(row.get('SUPLY_AR')),
            'topAmount':number(row.get('LTTOT_TOP_AMOUNT')),
            'households':row.get('SUPLY_HSHLDCO'), 'specialHouseholds':row.get('SPSPLY_HSHLDCO'),
            'comparison':comparison(sales,area,announced)}

def main():
    key = os.environ.get('APPLYHOME_SERVICE_KEY','').strip()
    if not key:
        raise RuntimeError('APPLYHOME_SERVICE_KEY is missing')
    cities = {}
    for slug, city in [('jinju','진주'),('geoje','거제')]:
        data = json.loads(Path('site/data/'+slug+'.json').read_text(encoding='utf-8'))
        sales = [s for u in data['complexes'] for s in u['sales']]
        rows = fetch_all('getAPTLttotPblancDetail', key, {'cond[HSSPLY_ADRES::LIKE]':city+'시', 'cond[HOUSE_SECD::EQ]':'01'})
        announcements = []
        seen = set()
        excluded = 0
        for row in rows:
            address = str(row.get('HSSPLY_ADRES') or '')
            if not re.match(r'^(경상남도|경남)\s+'+city+r'시\s', address) or str(row.get('RENT_SECD')) != '0':
                excluded += 1
                continue
            identity = (str(row['HOUSE_MANAGE_NO']),str(row['PBLANC_NO']))
            if identity in seen:
                continue
            seen.add(identity)
            announced = date.fromisoformat(row['RCRIT_PBLANC_DE']).isoformat()
            models = fetch_all('getAPTLttotPblancMdl',key,{'cond[HOUSE_MANAGE_NO::EQ]':identity[0],'cond[PBLANC_NO::EQ]':identity[1]})
            if any((str(m['HOUSE_MANAGE_NO']),str(m['PBLANC_NO'])) != identity for m in models):
                raise RuntimeError('Applyhome model association mismatch')
            announcements.append({'id':':'.join(identity), 'name':row['HOUSE_NM'], 'address':address,
                'announced':announced, 'moveIn':row.get('MVN_PREARNGE_YM'), 'households':row.get('TOT_SUPLY_HSHLDCO'),
                'url':row.get('PBLANC_URL'), 'models':[normalize_model(m,sales,announced) for m in models]})
        announcements.sort(key=lambda x:(x['announced'],x['id']),reverse=True)
        cities[slug] = {'announcements':announcements, 'excluded':excluded,'transactionsFetchedAt':data['fetchedAt']}
        print(city+': '+str(len(announcements))+' announcements / '+str(sum(len(a['models']) for a in announcements))+' types',flush=True)
    result = {'schemaVersion':1,'status':'ready','source':SOURCE,
              'fetchedAt':datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds'),'cities':cities}
    path = Path('site/data/applyhome.json')
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    temporary.replace(path)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Applyhome failed: invalid source data or output',file=sys.stderr)
        sys.exit(1)
