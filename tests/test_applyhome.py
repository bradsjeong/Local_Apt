import io
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_applyhome import exclusive_area, normalize_model, comparison, fetch_all

class ApplyhomeTests(unittest.TestCase):
    def test_area_does_not_use_supply_area(self):
        self.assertEqual(exclusive_area('084.9500A'),84.95)
        m=normalize_model({'HOUSE_TY':'unknown','SUPLY_AR':'112.4','LTTOT_TOP_AMOUNT':'45,000'},[],'2026-01-01')
        self.assertIsNone(m['exclusiveArea'])
        self.assertEqual(m['topAmount'],45000)
    def test_comparison_excludes_future_and_wrong_size(self):
        sales=[{'date':'2025-08-01','area':84.95,'amount':x} for x in (20000,21000,22000,23000,24000)]
        sales += [{'date':d,'area':a,'amount':99999} for d,a in [('2026-01-01',84.95),('2024-12-31',84.95),('2025-08-01',112)]]
        c=comparison(sales,84.95,'2026-01-01')
        self.assertEqual((c['count'],c['median']),(5,22000))
        self.assertIsNone(comparison(sales[:4],84.95,'2026-01-01')['median'])
    def test_pagination_uses_filtered_count(self):
        pages=iter([{'data':[{'id':1}],'matchCount':2,'totalCount':999,'currentCount':1},
                    {'data':[{'id':2}],'matchCount':2,'totalCount':999,'currentCount':1}])
        def opener(*args,**kwargs):return io.StringIO(json.dumps(next(pages)))
        self.assertEqual(len(fetch_all('test','test',{},opener)),2)

if __name__=='__main__':unittest.main()
