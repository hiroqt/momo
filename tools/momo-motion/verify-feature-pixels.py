"""Check rendered gesture isolation and rising heart fill after verify-render.mjs."""
from pathlib import Path
import json
from PIL import Image,ImageChops

folder=Path(__file__).resolve().parents[2]/'design/momo-motion/verification'
report={}
manifest=json.loads((folder.parent/'manifest.json').read_text())
for entry in manifest['animations']:
    if entry['category']!='mascot': continue
    name=entry['id']
    original=Image.open(folder/f'{name}-frame0.png').convert('RGB')
    allowed=Image.new('L',original.size,0)
    from PIL import ImageDraw
    draw=ImageDraw.Draw(allowed)
    for part in entry['motionParts']:
        x0,y0,x1,y1=part['region']
        draw.rectangle((int(x0*original.width/512)-2,int(y0*original.height/512)-2,
                        int(x1*original.width/512)+2,int(y1*original.height/512)+2),fill=255)
    outside=ImageChops.invert(allowed)
    frames=[]
    for frame in [12,24,72]:
        rendered=Image.open(folder/f'{name}-frame{frame}.png').convert('RGB')
        diff=ImageChops.difference(original,rendered)
        assert ImageChops.multiply(diff.convert('L'),outside).getbbox() is None,f'{name}: artwork outside gesture moved'
        bounds=diff.getbbox()
        frames.append({'frame':frame,'changedPixelsBounds':bounds})
    assert any(f['changedPixelsBounds'] for f in frames),f'{name}: gesture must move'
    baseline=Image.open(folder/f'{name}-source-baseline.png').convert('RGB')
    delta=ImageChops.difference(original,baseline)
    edge_pixels=sum(max(pixel)>15 for pixel in delta.getdata())
    assert edge_pixels<original.width*original.height*0.001,f'{name}: source artwork changed beyond mask edge tolerance'
    assert ImageChops.multiply(delta.convert('L'),outside).getbbox() is None,f'{name}: original artwork changed outside isolated feature'
    report[name]={'stationaryOutsideGesture':True,'gestureFrames':frames,
                  'sourceMaskEdgePixelsOver15':edge_pixels,'sourceMaskEdgeToleranceFraction':0.001}
counts=[]
for frame in [0,12,24,40]:
    im=Image.open(folder/f'heart-refill-frame{frame}.png').convert('RGB')
    counts.append(sum(238<=r<=241 and 123<=g<=129 and 141<=b<=149 for r,g,b in im.getdata()))
assert counts[0]==0 and all(a<b for a,b in zip(counts,counts[1:])),counts
report['heart-refill']={'solidColorPixelsByFrame':dict(zip([0,12,24,40],counts)),'risingFill':True}
(folder/'feature-pixel-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified all 13 isolated gestures, source artwork fidelity and rising solid heart fill.')
