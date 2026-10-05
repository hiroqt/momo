"""Validate motion files as consumers see them, without calling AI providers."""
import base64
import hashlib
import json
import math
import unittest
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DESIGN=ROOT/'design/momo-motion'
META=json.loads((DESIGN/'manifest.json').read_text())['animations']


def walk(value):
    if isinstance(value,dict):
        yield value
        for v in value.values(): yield from walk(v)
    elif isinstance(value,list):
        for v in value: yield from walk(v)


class MotionContract(unittest.TestCase):
    def test_original_artwork_is_intact_and_never_clipped(self):
        for m in META:
            if m['category']!='mascot':continue
            j=json.loads((ROOT/m['json']).read_text())
            l=j['layers'][-1];asset=j['assets'][0]
            self.assertEqual(l['ks']['r']['a'],0,'Body never rotates')
            for part in j['layers']:
                if part is l:continue
                self.assertIn(part['nm'],[p['name'] for p in m['motionParts']])
                self.assertEqual(part['refId'],l['refId'])
                self.assertEqual(part['ks']['r']['a'],1)
                self.assertEqual(part['ks']['s']['a'],0)
            self.assertEqual(l['ty'],2)
            self.assertEqual(base64.b64decode(asset['p'].split(',',1)[1]),(ROOT/m['source']).read_bytes())
            self.assertNotIn('shapes',l)
            for property in ['p','s','a']: self.assertEqual(l['ks'][property]['a'],0)
            # Check all source-image corners throughout the rotation envelope.
            sx,sy,_=l['ks']['s']['k'];ax,ay,_=l['ks']['a']['k'];px,py,_=l['ks']['p']['k']
            for angle in [i/100 for i in range(-100,101)]:
                r=math.radians(angle)
                for x in [0,asset['w']]:
                    for y in [0,asset['h']]:
                        dx,dy=(x-ax)*sx/100,(y-ay)*sy/100
                        xx,yy=px+dx*math.cos(r)-dy*math.sin(r),py+dx*math.sin(r)+dy*math.cos(r)
                        self.assertTrue(0<xx<512 and 0<yy<512,(m['id'],xx,yy))

    def test_anchored_effects(self):
        fire=json.loads((ROOT/'mobile/assets/animations/momo-motion/streak-fire.json').read_text())
        for l in fire['layers']:
            if 'Ember' in l['nm']:continue
            self.assertEqual(l['ks']['s']['a'],0)
            self.assertEqual(l['ks']['p']['a'],0)
            self.assertTrue(any(n.get('ty')=='sh' and n['ks']['a']==1 for n in walk(l)))
        coin=json.loads((ROOT/'mobile/assets/animations/momo-motion/coin-reward.json').read_text())
        face=next(l for l in coin['layers'] if l['nm']=='Coin face')
        self.assertEqual(face['ks']['p']['a'],0)
        self.assertLessEqual(min(k['s'][0] for k in face['ks']['s']['k']),3)

    def test_heart_color_fills_upwards_without_fade(self):
        heart=json.loads((ROOT/'mobile/assets/animations/momo-motion/heart-refill.json').read_text())
        fill=next(l for l in heart['layers'] if l['nm']=='Heart color / rising interior fill')
        self.assertEqual(fill['ks']['o'],{'a':0,'k':100})
        self.assertEqual(fill['ks']['s']['a'],0)
        keys=fill['masksProperties'][0]['pt']['k']
        levels=[k['s'][0]['v'][0][1] for k in keys]
        self.assertEqual(levels,sorted(levels,reverse=True))
        self.assertGreater(levels[0],348)
        self.assertLess(levels[-1],164)

    def test_source_coverage(self):
        expected=list((ROOT/'mobile/assets/onboarding').glob('momo-*.png'))
        expected=[p for p in expected if 'atlas' not in p.name]
        expected+=list((ROOT/'mobile/assets/onboarding/steps').glob('*.png'))
        expected+=[ROOT/'web/public/assets/momo-full-body-cutout.png']
        self.assertEqual({str(p.relative_to(ROOT)) for p in expected},
                         {m['source'] for m in META if m['category']=='mascot'})
        self.assertEqual(len(META),len({m['id'] for m in META}))

    def test_lottie_packages_and_asset_contract(self):
        for m in META:
            with self.subTest(animation=m['id']):
                raw=(ROOT/m['json']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(),m['sha256'])
                j=json.loads(raw)
                self.assertEqual(j['w'],512);self.assertEqual(j['h'],512)
                self.assertEqual(j['op'],m['duration']*m['fps'])
                self.assertTrue(0<=m['stillFrame']<j['op'])
                if m['category']=='mascot':
                    self.assertEqual(len(j['assets']),1)
                    self.assertEqual(j['assets'][0]['e'],1)
                    self.assertTrue(j['assets'][0]['p'].startswith('data:image/png;base64,'))
                else:
                    self.assertFalse(j['assets'])
                    self.assertTrue(all(l['ty']==4 for l in j['layers']))
                self.assertEqual(len(j['layers']),len({l['ind'] for l in j['layers']}))
                with zipfile.ZipFile(ROOT/m['dotLottie']) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(archive.read(f"animations/{m['id']}.json"),raw)
                    zmeta=json.loads(archive.read('manifest.json'))
                    self.assertEqual(zmeta['animations'][0]['loop'],m['loop'])
                self.assertTrue((DESIGN/'svg'/f"{m['id']}.svg").is_file())
                for node in walk(j):
                    if node.get('a')!=1 or not isinstance(node.get('k'),list):continue
                    keys=node['k'];times=[k['t'] for k in keys]
                    self.assertEqual(times,sorted(set(times)))
                    if m['loop'] and times[-1]==j['op']:
                        start,end=keys[0]['s'],keys[-1]['s']
                        if all(isinstance(v,(int,float)) for v in start):
                            for a,b in zip(start,end):
                                self.assertTrue(abs(a-b)<0.05 or abs(abs(a-b)-360)<0.05)
                        else:self.assertEqual(start,end,'Morph loop must match its source pose')
                    if keys and isinstance(keys[0]['s'][0],dict) and 'v' in keys[0]['s'][0]:
                        size=len(keys[0]['s'][0]['v'])
                        for k in keys:
                            q=k['s'][0]
                            self.assertEqual(len(q['v']),size);self.assertEqual(len(q['i']),size);self.assertEqual(len(q['o']),size)
                            self.assertTrue(all(math.isfinite(v) for name in ('v','i','o') for pair in q[name] for v in pair))

    def test_celebrations_are_single_shot_and_fade_out(self):
        for name in ['confetti-burst','confetti-gentle']:
            m=next(x for x in META if x['id']==name)
            self.assertFalse(m['loop'])
            j=json.loads((ROOT/m['json']).read_text())
            self.assertTrue(all(l['ks']['o']['k'][-1]['s']==[0] for l in j['layers']))


if __name__=='__main__': unittest.main()
