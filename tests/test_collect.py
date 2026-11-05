import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('collect',Path(__file__).parents[1]/'scripts/collect.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class CollectionTests(unittest.TestCase):
    def row(self,**kw):
        return dict(aptNm='테스트',umdNm='테스트동',jibun='1',dealAmount='30,000',excluUseAr='84.9',dealYear='2024',dealMonth='2',dealDay='29',**kw)
    def test_cancelled_excluded(self):
        self.assertIsNone(c.normalize(self.row(cdealDay='2024-03-10'),'진주','48170'))
        self.assertIsNone(c.normalize(self.row(cdealType='O'),'진주','48170'))
    def test_price_units_and_leap_day(self):
        r=c.normalize(self.row(),'진주','48170')
        self.assertEqual(r['amount'],30000);self.assertEqual(r['date'],'2024-02-29')
    def test_identical_sales_are_preserved(self):
        r=c.normalize(self.row(),'진주','48170');s=c.aggregate([r,r],'now','202401','202402','진주')
        self.assertEqual(len(s['complexes'][0]['sales']),2)
    def test_same_name_different_address_is_separate(self):
        a=self.row();b=self.row();b['jibun']='2'
        self.assertNotEqual(c.normalize(a,'진주','48170')['complexId'],c.normalize(b,'진주','48170')['complexId'])
    def test_error_not_empty_success(self):
        with self.assertRaises(ValueError):c.parse_page('<response><header><resultCode>30</resultCode></header></response>')
    def test_zero_and_pagination_metadata(self):
        self.assertEqual(c.parse_page('<response><header><resultCode>000</resultCode></header><body><totalCount>0</totalCount><items/></body></response>'),(0,[]))
    def test_month_range(self):
        self.assertEqual(list(c.months('202412','202502')),['202412','202501','202502'])
if __name__=='__main__':unittest.main()
