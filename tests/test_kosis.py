import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_kosis import normalize,numeric

class KosisTests(unittest.TestCase):
    def rows(self):
        return [dict(C1='a',C1_NM='계',C2=city,C2_NM=city,ITM_ID='t',ITM_NM='미분양',TBL_ID='DT_MLTM_2082',PRD_DE='202609',PRD_SE='M',DT=value) for city,value in [('진주시','0'),('거제시','-')]]
    def test_missing_is_not_zero(self):
        result=normalize(self.rows())
        self.assertEqual(result['jinju'][0]['points'][0]['value'],0)
        self.assertIsNone(result['geoje'][0]['points'][0]['value'])
        self.assertIsNone(numeric('NaN'))
    def test_city_dimension_and_units(self):
        result=normalize(self.rows())
        self.assertEqual(result['jinju'][0]['label'],'미분양 · 계')
        self.assertEqual(result['jinju'][0]['unit'],'호')
    def test_duplicate_rejected(self):
        rows=self.rows()
        with self.assertRaises(ValueError):normalize(rows+[rows[0]])

if __name__=='__main__':unittest.main()
