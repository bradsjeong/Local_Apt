"""Reuse the verified public snapshot on UI pushes; scheduled runs still refresh fully."""
import json
import os
from pathlib import Path
import urllib.request

def main():
    snapshots = {}
    try:
        for name in ('jinju', 'geoje', 'status'):
            with urllib.request.urlopen('https://bradsjeong.github.io/Local_Apt/data/'+name+'.json', timeout=30) as response:
                snapshots[name] = json.load(response)
        assert snapshots['status']['status'] == 'ready'
        for name in ('jinju', 'geoje'):
            data = snapshots[name]
            assert data['status'] == 'ready' and data['schemaVersion'] == 1
            assert data['recordCount'] == sum(len(u['sales']) for u in data['complexes']) > 0
            assert snapshots['status']['cities'][name]['records'] == data['recordCount']
            assert snapshots['status']['updatedAt'] == data['fetchedAt']
    except Exception:
        print('No complete published snapshot; collect fresh official data.')
        return
    output = Path('site/data')
    output.mkdir(parents=True, exist_ok=True)
    for name, data in snapshots.items():
        (output/(name+'.json')).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
        stream.write('ready=true\n')
    print('Reused official snapshot: '+snapshots['status']['updatedAt'])

if __name__ == '__main__':
    main()
