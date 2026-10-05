"""Preserve original Momo artwork and animate vector effects for Lottie.

Run from the repo root with the requirements in this directory installed:
    python tools/momo-motion/build.py

Only writes the new momo-motion pack. Original mascot images are retained as rebuild inputs.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

from PIL import Image
from mascot_parts import PARTS
from svgpathtools import CubicBezier, Line, QuadraticBezier, parse_path

# Figma's SVG importer expects an unprefixed SVG namespace.
ET.register_namespace("", "http://www.w3.org/2000/svg")

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design/momo-motion"
OUT = ROOT / "mobile/assets/animations/momo-motion"
FPS, SIZE = 30, 512
TAU = math.tau
MANIFEST: list[dict] = []
PALETTE = ["#7C5CFC", "#FFB899", "#FFD351", "#2E63EC", "#64C8B0"]


def compact(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def color(value):
    return [round(int(value[i:i + 2], 16) / 255, 4) for i in (1, 3, 5)] + [1]


def prop(value):
    return {"a": 0, "k": value}


def keyframes(samples):
    # Delay-zero particles can contribute two identical start keys. Renderers
    # divide by the frame interval, so retain just the final value at each time.
    samples = sorted(dict(samples).items())
    frames = []
    for i, (t, val) in enumerate(samples):
        item = {"t": t, "s": val if isinstance(val, list) else [val]}
        if i + 1 < len(samples):
            end = samples[i + 1][1]
            item.update(e=end if isinstance(end, list) else [end],
                        o={"x": [0.333], "y": [0.333]},
                        i={"x": [0.667], "y": [0.667]})
        frames.append(item)
    return {"a": 1, "k": frames}


def transform(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    return {"p": prop([*p, 0]), "a": prop([*a, 0]), "s": prop([*s, 100]),
            "r": prop(r), "o": prop(o)}


def fill(hex_color):
    return {"ty": "fl", "c": prop(color(hex_color)), "o": prop(100), "r": 1, "bm": 0}


def stroke(hex_color, width=7):
    return {"ty": "st", "c": prop(color(hex_color)), "o": prop(100),
            "w": prop(width), "lc": 2, "lj": 2, "ml": 4, "bm": 0}


def group(shapes, paint, name="Artwork"):
    tr = {"ty": "tr", **transform(), "sk": prop(0), "sa": prop(0)}
    tr["p"] = prop([0, 0]); tr["a"] = prop([0, 0]); tr["s"] = prop([100, 100])
    return {"ty": "gr", "nm": name, "it": [*shapes, paint, tr]}


def layer(name, shapes, frames, ks=None):
    return {"ddd": 0, "ind": 1, "ty": 4, "nm": name, "sr": 1,
            "ks": ks or transform(), "ao": 0, "ip": 0, "op": frames,
            "st": 0, "bm": 0, "shapes": shapes}


def ellipse(x, y, w, h):
    return {"ty": "el", "d": 1, "p": prop([x, y]), "s": prop([w, h])}


def rect(x, y, w, h, radius=0):
    return {"ty": "rc", "d": 1, "p": prop([x, y]), "s": prop([w, h]), "r": prop(radius)}


def xy(pt):
    return [round(pt.real, 2), round(pt.imag, 2)]


def bezier_shapes(d, offset=0j):
    """Absolute SVG curves -> Lottie relative Bezier handles, including holes."""
    shapes = []
    for contour in parse_path(d).continuous_subpaths():
        if not len(contour):continue
        vertices, incoming, outgoing = [], [], []
        for j, seg in enumerate(contour):
            start, end = seg.start + offset, seg.end + offset
            if isinstance(seg, CubicBezier):
                c1, c2 = seg.control1 + offset, seg.control2 + offset
            elif isinstance(seg, QuadraticBezier):
                q = seg.control + offset
                c1, c2 = start + (q - start) * 2 / 3, end + (q - end) * 2 / 3
            elif isinstance(seg, Line):
                c1, c2 = start, end
            else:
                raise ValueError(f"Unsupported SVG segment: {type(seg).__name__}")
            if j == 0:
                vertices.append(xy(start)); incoming.append([0, 0]); outgoing.append([0, 0])
            outgoing[-1] = xy(c1 - start)
            vertices.append(xy(end)); incoming.append(xy(c2 - end)); outgoing.append([0, 0])
        closed = contour.isclosed()
        if closed and vertices[-1] == vertices[0]:
            incoming[0] = incoming[-1]
            vertices.pop(); incoming.pop(); outgoing.pop()
        shapes.append({"c": closed, "v": vertices, "i": incoming, "o": outgoing})
    return shapes


def path(d):
    return [{"ty": "sh", "d": 1, "ks": prop(s)} for s in bezier_shapes(d)]


def write_animation(name, title, layers, duration, loop, purpose, source=None, still=0, assets=None, motion_parts=None):
    frames = round(duration * FPS)
    for i, entry in enumerate(layers):
        entry["ind"] = i + 1
        if entry.get("masksProperties"): entry["hasMask"] = True
    indices={entry["nm"]:entry["ind"] for entry in layers}
    for entry in layers:
        if "parentName" in entry:entry["parent"]=indices[entry.pop("parentName")]
    markers = [{"tm": 0, "cm": "start", "dr": 0},
               {"tm": still, "cm": "reduced-motion-still", "dr": 0},
               {"tm": frames - 1, "cm": "end", "dr": 0}]
    animation = {"v": "5.7.4", "fr": FPS, "ip": 0, "op": frames,
                 "w": SIZE, "h": SIZE, "nm": title, "ddd": 0,
                 "assets": assets or [], "layers": layers, "markers": markers}
    data = compact(animation).encode()
    (OUT / f"{name}.json").write_bytes(data)
    dot_manifest = {"version": "1.0", "generator": "Momo Motion Studio",
                    "animations": [{"id": name, "loop": loop, "autoplay": True,
                                    "speed": 1, "direction": 1}]}
    with zipfile.ZipFile(DESIGN / "lottie" / f"{name}.lottie", "w", zipfile.ZIP_DEFLATED) as z:
        # Stable ZIP entries make repeated builds byte-identical.
        for filename, content in [("manifest.json", compact(dot_manifest).encode()),
                                  (f"animations/{name}.json", data)]:
            info = zipfile.ZipInfo(filename, (2026, 10, 5, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, content)
    entry = {"id": name, "title": title, "category": "mascot" if source else "app",
             "duration": duration, "fps": FPS, "loop": loop, "stillFrame": still,
             "purpose": purpose, "source": source, "json": f"mobile/assets/animations/momo-motion/{name}.json",
             "dotLottie": f"design/momo-motion/lottie/{name}.lottie", "bytes": len(data),
             "sha256": hashlib.sha256(data).hexdigest()}
    if motion_parts is not None: entry["motionParts"] = motion_parts
    MANIFEST.append(entry)
    print(f"{name:22s} {len(data)/1024:7.1f} KB / dotLottie {(DESIGN/'lottie'/f'{name}.lottie').stat().st_size/1024:6.1f} KB")
    return animation


def image_mask(d,mode='a'):
    return {'inv':False,'mode':mode,'pt':prop(bezier_shapes(d)[0]),'o':prop(100),'x':prop(0)}


def build_mascot(name,source,act,purpose):
    # Embed the exact original file. Never crop, threshold alpha, trace, or cut limbs.
    raw=(ROOT/source).read_bytes()
    with Image.open(ROOT/source) as image: width,height=image.size
    encoded=base64.b64encode(raw).decode()
    uri='data:image/png;base64,'+encoded
    scale=min(412/width,424/height)
    ks=transform(p=(256,470),a=(width/2,height),s=(scale*100,scale*100))
    image_layer={'ddd':0,'ind':1,'ty':2,'nm':'Original artwork / intact full body',
                 'refId':'momo-original','sr':1,'ks':ks,'ao':0,'ip':0,'op':120,'st':0,'bm':0}
    asset={'id':'momo-original','w':width,'h':height,'u':'','p':uri,'e':1}
    layers=[image_layer]
    parts=PARTS.get(act,[])
    if act=='wave':
        parts=[('Waving hand', 'M 506 197 L 620 185 L 620 360 L 523 365 L 456 299 L 479 277 L 478 246 L 485 226 L 502 220 Z', 'M 505 185 L 620 185 L 620 360 L 540 344 L 505 309 Z', (500,315), 4)]
    elif act=='welcome':
        parts=[('Welcome hand', 'M 480 278 L 620 265 L 620 410 L 481 410 L 475 347 Z', 'M 488 282 L 620 265 L 620 395 L 489 389 L 480 347 Z', (514,384), 4)]
    assert parts, f'Every mascot needs a local gesture: {act}'
    motion_parts=[]
    image_layer['masksProperties']=[]
    x0,y0=256-width*scale/2,470-height*scale
    for label,feature_d,remove_d,pivot,amplitude in parts:
        image_layer['masksProperties'].append(image_mask(remove_d,'s'))
        part=dict(image_layer);part['nm']=label
        part['masksProperties']=[image_mask(feature_d)]
        part['ks']=transform(p=(x0+pivot[0]*scale,y0+pivot[1]*scale),a=pivot,s=(scale*100,scale*100))
        if act in ('wave','welcome','hero'):
            samples=[(0,0),(12,-amplitude*.75),(24,amplitude),(36,-amplitude*.75),(48,amplitude),(60,0),(120,0)]
        elif act=='bow': samples=[(0,0),(24,amplitude),(48,0),(80,-amplitude*.35),(100,0),(120,0)]
        else:samples=[(0,0),(24,amplitude),(48,0),(72,-amplitude),(96,0),(120,0)]
        part['ks']['r']=keyframes(samples)
        layers.insert(0,part)
        # Include all curve handles and the full rotation envelope in the region.
        q=bezier_shapes(feature_d)[0];points=q['v']+[[v[0]+d[0],v[1]+d[1]] for k in ('i','o') for v,d in zip(q['v'],q[k])]
        projected=[]
        for angle in [-abs(amplitude),0,abs(amplitude)]:
            radians=math.radians(angle)
            for xx,yy in points:
                dx,dy=xx-pivot[0],yy-pivot[1]
                projected.append((x0+scale*(pivot[0]+dx*math.cos(radians)-dy*math.sin(radians)),y0+scale*(pivot[1]+dx*math.sin(radians)+dy*math.cos(radians))))
        region=[max(0,math.floor(min(x for x,y in projected))-4),max(0,math.floor(min(y for x,y in projected))-4),min(512,math.ceil(max(x for x,y in projected))+4),min(512,math.ceil(max(y for x,y in projected))+4)]
        motion_parts.append({'name':label,'region':region,'pivot':list(pivot),'maxDegrees':abs(amplitude)})
    animation=write_animation(name,f'Momo · {act.title()}',layers,4,True,
        purpose+' · Local gesture: '+', '.join(p[0] for p in parts)+'. Body and feet remain fixed.',source,assets=[asset],motion_parts=motion_parts)
    x,y=256-width*scale/2,470-height*scale
    (DESIGN/'svg'/f'{name}.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
        f'<image x="{x}" y="{y}" width="{width*scale}" height="{height*scale}" href="{uri}"/></svg>')
    return animation


def static_svg(animation, frame=0):
    """Export a compatible layered SVG from the effects' chosen still frame."""
    body = []
    def value(p):
        if not p['a']: return p['k']
        keys=p['k']
        for i in range(len(keys)-1):
            start,end=keys[i],keys[i+1]
            if frame<end['t']:
                u=max(0,min(1,(frame-start['t'])/(end['t']-start['t'])))
                if isinstance(start['s'][0],dict):
                    a,b=start['s'][0],end['s'][0]
                    return [{'c':a['c'],**{k:[[round(x+(y-x)*u,2) for x,y in zip(p,q)] for p,q in zip(a[k],b[k])] for k in ('v','i','o')}}]
                return [a+(b-a)*u for a,b in zip(start['s'],end['s'])]
        return keys[-1]['s']
    def shape_svg(shape):
        ty = shape["ty"]
        if ty == "sh":
            q = value(shape["ks"])
            if isinstance(q, list): q = q[0]
            vertices = q["v"]; d = f'M {vertices[0][0]} {vertices[0][1]}'
            count = len(vertices) if q["c"] else len(vertices) - 1
            for i in range(count):
                j = (i + 1) % len(vertices)
                c1 = [vertices[i][k] + q["o"][i][k] for k in range(2)]
                c2 = [vertices[j][k] + q["i"][j][k] for k in range(2)]
                d += f' C {c1[0]} {c1[1]} {c2[0]} {c2[1]} {vertices[j][0]} {vertices[j][1]}'
            return f'<path d="{d}{" Z" if q["c"] else ""}"/>'
        if ty == "el":
            p, s = value(shape["p"]), value(shape["s"])
            return f'<ellipse cx="{p[0]}" cy="{p[1]}" rx="{s[0]/2}" ry="{s[1]/2}"/>'
        if ty == "rc":
            p, s = value(shape["p"]), value(shape["s"])
            return f'<rect x="{p[0]-s[0]/2}" y="{p[1]-s[1]/2}" width="{s[0]}" height="{s[1]}" rx="{value(shape["r"])}"/>'
        return ""
    by_index={e["ind"]:e for e in animation["layers"]}
    def parent_wrap(entry,content):
        if not entry.get("parent"):return content
        parent=by_index[entry["parent"]];ks=parent["ks"]
        p,a,s=[value(ks[k]) for k in ("p","a","s")];r=value(ks["r"]);r=r[0] if isinstance(r,list) else r
        content=f'<g transform="translate({p[0]} {p[1]}) rotate({r}) scale({s[0]/100} {s[1]/100}) translate({-a[0]} {-a[1]})">{content}</g>'
        return parent_wrap(parent,content)
    for entry in reversed(animation["layers"]):
        ks = entry["ks"]; p, a, s = [value(ks[k]) for k in ("p", "a", "s")]
        r = value(ks["r"]); r = r[0] if isinstance(r, list) else r
        opacity=value(ks['o']);opacity=opacity[0] if isinstance(opacity,list) else opacity
        groups = []
        for g in reversed(entry["shapes"]):
            paint = next((x for x in g["it"] if x["ty"] in ("fl", "st")), None)
            if not paint: continue
            c = value(paint["c"])
            h = "#" + "".join(f"{round(x*255):02x}" for x in c[:3])
            attrs = f'fill="{h}"' if paint["ty"] == "fl" else f'fill="none" stroke="{h}" stroke-width="{value(paint["w"])}" stroke-linecap="round" stroke-linejoin="round"'
            groups.append(f'<g {attrs}>{"".join(shape_svg(x) for x in g["it"])}</g>')
        content=''.join(groups)
        for mi,mask in enumerate(entry.get('masksProperties',[])):
            if mask['mode']!='a':continue
            clip_id=f"clip-{entry['ind']}-{mi}"
            mask_shape={'ty':'sh','ks':mask['pt']}
            content=f'<defs><clipPath id="{clip_id}">{shape_svg(mask_shape)}</clipPath></defs><g clip-path="url(#{clip_id})">{content}</g>'
        body.append(parent_wrap(entry,f'<g id="{entry["nm"]}" opacity="{opacity/100}" transform="translate({p[0]} {p[1]}) rotate({r}) scale({s[0]/100} {s[1]/100}) translate({-a[0]} {-a[1]})">{content}</g>'))

    return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'+"".join(body)+"</svg>"


def export_effect(name, title, layers, duration, loop, purpose, still=0):
    animation = write_animation(name, title, layers, duration, loop, purpose, still=still)
    poster_frame=24 if name.startswith('confetti-') else still
    (DESIGN / "svg" / f"{name}.svg").write_text(static_svg(animation,poster_frame))


def flame_shape(shape,t,frames,core=False,ignite=False):
    phase=TAU*t/frames
    growth=min(1,t/15) if ignite else 1
    def move(p):
        x,y=p;weight=max(0,min(1,(104-y)/220))**1.5
        sway=(8 if core else 14)*(math.sin(phase*3)+0.35*math.sin(phase*5))*weight
        stretch=9*math.sin(phase*4+(0.6 if core else 0))*weight
        return [round(x+sway,2),round(104+(y-104)*growth+stretch*growth,2)]
    q={'c':shape['c'],'v':[],'i':[],'o':[]}
    for i,v in enumerate(shape['v']):
        w=move(v);q['v'].append(w)
        for key in ('i','o'):
            c=move([v[k]+shape[key][i][k] for k in range(2)])
            q[key].append([round(c[k]-w[k],2) for k in range(2)])
    return q


def build_fire():
    flame="M 0 114 C -86 106 -100 36 -74 -12 C -71 19 -53 31 -43 31 C -51 -22 -8 -59 8 -116 C 37 -94 49 -62 36 -31 C 53 -35 67 -54 65 -77 C 117 -24 103 48 64 88 C 44 107 23 114 0 114 Z"
    core="M 0 99 C -38 96 -47 62 -28 30 C -17 15 -9 -5 1 -27 C 26 0 10 25 27 40 C 44 61 30 94 0 99 Z"
    for name,duration,loop,ignite in [('streak-fire',2,True,False),('streak-ignite',1.4,False,True)]:
        frames=round(FPS*duration);layers=[]
        for nm,d,c,is_core in [('Warm core',core,'#FFD351',True),('Living flame',flame,'#FF743D',False)]:
            shapes=[];times=sorted(set([*range(0,frames,3),frames]))
            for q in bezier_shapes(d):
                keys=[]
                for i,t in enumerate(times):
                    k={'t':t,'s':[flame_shape(q,t,frames,is_core,ignite)]}
                    if i+1<len(times):k.update(e=[flame_shape(q,times[i+1],frames,is_core,ignite)],o={'x':0.333,'y':0.333},i={'x':0.667,'y':0.667})
                    keys.append(k)
                shapes.append({'ty':'sh','d':1,'ks':{'a':1,'k':keys}})
            ks=transform(p=(256,310),a=(0,104))
            if ignite:ks['o']=keyframes([(0,0),(6,100),(frames,100)])
            layers.append(layer(nm,[group(shapes,fill(c))],frames,ks))
        for i in range(4):
            ks=transform(p=(220+i*26,210))
            ks['p']=keyframes([(0,[220+i*26,210,0]),(frames-1,[209+i*30,115-i*6,0]),(frames,[220+i*26,210,0])])
            ks['o']=keyframes([(0,0),(6+i,70),(frames-8,0),(frames,0)])
            layers.insert(0,layer(f'Ember {i+1}',[group([ellipse(0,0,4,7)],fill('#FFB342'))],frames,ks))
        export_effect(name,'Streak · Ignite' if ignite else 'Streak · Fire',layers,duration,loop,
            'Anchored flame contour flicker, rising embers; ignition grows once without bounce.',still=34 if ignite else 0)


def build_confetti(name="confetti-burst", gentle=False):
    frames = 84 if gentle else 96; layers = []
    for i in range(24 if gentle else 44):
        # Deterministic fan: both bottom corners, varied launch times and gravity.
        side = -1 if i % 2 else 1
        start_x = 46 if side == -1 else 466
        velocity_x = -side * (105 + (i*37 % 120))
        velocity_y = -(350 + (i*43 % 200)) * (0.72 if gentle else 1)
        delay = i % 9
        samples = []
        for t in range(delay, frames+1, 6):
            sec = (t-delay)/FPS
            samples.append((t, [round(start_x+velocity_x*sec, 2), round(460+velocity_y*sec+220*sec**2, 2), 0]))
        if samples[-1][0] != frames:
            samples.append((frames, samples[-1][1]))
        ks = transform(); ks["p"] = keyframes(samples)
        ks["r"] = keyframes([(delay, i*17), (frames, i*17+side*(280+i*13))])
        ks["s"] = keyframes([(delay, [100, 100, 100]), (delay+18, [100, 35, 100]),
            (delay+36, [100, 100, 100]), (frames, [100, 55, 100])])
        ks["o"] = keyframes([(0, 0), (delay, 0), (delay+2, 100), (frames-18, 100), (frames, 0)])
        shape = ellipse(0, 0, 8, 8) if i % 4 == 0 else rect(0, 0, 7+i%5, 13+i%5, 2)
        layers.append(layer(f"Confetti / {i+1:02d}", [group([shape], fill(PALETTE[i%5]))], frames, ks))
    export_effect(name, "Celebration · Gentle" if gentle else "Celebration · Confetti", layers,
        frames/FPS, False, "One burst for quiz completion, onboarding completion, or level up.")


def icon_layers(kind, frames):
    violet, blue, peach, yellow = "#7C5CFC", "#2E63EC", "#FFB899", "#FFD351"
    layers = []
    def add(nm, shapes, c, stroke_width=None, **kw):
        layers.append(layer(nm, [group(shapes, stroke(c, stroke_width) if stroke_width else fill(c))], frames, transform(**kw)))
        return layers[-1]
    if kind in ("document-upload", "document-scan", "reviewer-ready"):
        add("Document edge", [rect(256, 262, 168, 218, 20)], blue)
        add("Document sheet", [rect(256, 256, 155, 205, 16)], "#FFF9EF")
        for j in range(4): add(f"Text line {j+1}", [rect(248, 208+j*25, 99 if j<3 else 65, 7, 3)], "#BCB1D9")
        if kind == "document-upload":
            a = add("Upload arrow", path("M 256 317 L 256 372 M 234 338 L 256 316 L 278 338"), violet, 10)
            a["ks"]["p"] = keyframes([(0,[0,18,0]),(42,[0,-28,0]),(59,[0,-28,0]),(60,[0,18,0])])
            a["ks"]["o"]=keyframes([(0,0),(8,100),(38,100),(48,0),(60,0)])
        elif kind == "document-scan":
            a = add("Reading beam", [rect(256, 201, 144, 7, 3)], violet)
            a["ks"]["p"] = keyframes([(0,[0,0,0]),(45,[0,105,0]),(59,[0,105,0]),(60,[0,0,0])])
            a["ks"]["o"]=keyframes([(0,0),(8,100),(40,100),(50,0),(60,0)])
        else:
            add("Check badge", [ellipse(316,339,88,88)], "#64B69D")
            a = add("Ready check", path("M -22 1 L -5 18 L 26 -18"), "#FFFFFF", 10, p=(316,339))
            a["ks"]["o"]=keyframes([(0,0),(18,100),(frames,100)])
    elif kind == "book-loading":
        add("Book spine", path("M 256 199 C 219 183 177 185 147 199 L 147 331 C 177 317 220 317 256 334 C 292 317 335 317 365 331 L 365 199 C 335 185 293 183 256 199 Z"), yellow)
        add("Pages", path("M 256 213 C 223 197 186 198 159 209 L 159 317 C 186 308 222 309 256 326 C 290 309 326 308 353 317 L 353 209 C 326 198 289 197 256 213 Z"), "#FFF9EF")
        add("Fold", path("M 256 213 L 256 325"), "#DDBE83", 4)
        for j in range(4): add(f"Page text {j}", path(f"M 174 {230+j*20} Q 207 {220+j*20} 239 {233+j*20} M 274 {233+j*20} Q 307 {220+j*20} 338 {230+j*20}"), "#D6C8AD", 4)
        a = add("Turning page", path("M 0 0 C 25 -17 66 -14 96 -6 L 96 99 C 65 90 28 92 0 113 Z"), "#FFF9EF", p=(256,213))
        a["ks"]["s"] = keyframes([(0,[100,100,100]),(24,[-100,100,100]),(48,[100,100,100]),(72,[100,100,100])])
    elif kind in ("answer-correct", "answer-retry"):
        d = "M 172 258 L 230 315 L 340 194" if kind == "answer-correct" else "M 193 214 C 224 163 306 169 334 224 M 334 224 L 337 184 M 334 224 L 293 226 M 320 305 C 284 350 203 344 180 287 M 180 287 L 178 328 M 180 287 L 219 285"
        a=add("Correct check" if kind=="answer-correct" else "Try again arrows", path(d), "#64B69D" if kind=="answer-correct" else peach, 16)
        a["ks"]["o"] = keyframes([(0,0),(8,100),(frames,100)])
        a["ks"]["a"] = prop([256,256,0]); a["ks"]["p"] = prop([256,256,0])
        if kind=="answer-correct":
            a["shapes"][0]["it"].insert(-1,{"ty":"tm","s":prop(0),"e":keyframes([(0,0),(20,100),(frames,100)]),"o":prop(0),"m":1})
        else:a["ks"]["r"]=keyframes([(0,-70),(20,0),(frames,0)])
    elif kind == "xp-reward":
        star = "M 0 -89 L 27 -30 L 89 -26 L 44 17 L 55 81 L 0 49 L -55 81 L -44 17 L -89 -26 L -27 -30 Z"
        a=add("XP star", path(star), yellow, p=(256,256))
        a["ks"]["r"] = keyframes([(0,-45),(25,0),(frames,0)])
        a["ks"]["p"] = keyframes([(0,[256,256,0]),(frames,[256,256,0])])
        add("Star glint", path("M 230 217 L 238 204"), "#FFF9EF", 7)
    elif kind == "coin-reward":
        add('Coin edge / fixed thickness',[ellipse(256,256,25,180)],'#C98B1C')
        face=add('Coin face',[ellipse(256,256,180,180)],yellow)
        inset=add('Coin inset',[ellipse(256,256,145,145)],'#E9AE31',5)
        mark=add('Coin mark',path('M 220 285 L 220 229 L 256 263 L 292 229 L 292 285'),'#FFF9EF',10)
        times=[0,3,6,7.5,9,12,15,18,21,22.5,24,27,30,frames]
        for item in [face,inset,mark]:
            item['ks']['a']=prop([256,256,0]);item['ks']['p']=prop([256,256,0])
            item['ks']['s']=keyframes([(t,[round(max(3,abs(math.cos(TAU*min(t,30)/30))*100),2),100,100]) for t in times])
        # Hide the front stamp on the back half of a full turn.
        mark['ks']['o']=keyframes([(0,100),(5,100),(8,0),(22,0),(25,100),(frames,100)])
        shine=add('Metallic moving reflection',path('M 0 -61 Q -18 -20 -18 42'),'#FFF3BE',8,p=(218,256))
        shine['ks']['p']=keyframes([(0,[211,256,0]),(7,[277,256,0]),(15,[294,256,0]),(23,[212,256,0]),(30,[281,256,0]),(frames,[281,256,0])])
        shine['ks']['o']=keyframes([(0,0),(3,85),(8,0),(23,0),(27,90),(33,0),(frames,0)])
    elif kind == "heart-refill":
        heart = "M 256 348 C 236 330 155 278 156 221 C 157 164 223 150 256 197 C 289 150 355 164 356 221 C 357 278 276 330 256 348 Z"
        add('Empty heart interior',path(heart),'#EDE3E7')
        filling=add('Heart color / rising interior fill',path(heart),'#F07E91')
        fill_mask=image_mask('M 140 356 L 372 356 L 372 365 L 140 365 Z')
        samples=[]
        for t,level in [(0,356),(8,356),(40,155),(frames,155)]:
            samples.append((t,[bezier_shapes(f'M 140 {level} L 372 {level} L 372 365 L 140 365 Z')[0]]))
        fill_mask['pt']=keyframes(samples)
        filling['masksProperties']=[fill_mask]
        add('Heart outline',path(heart),'#D45873',5)
        highlight=add('Heart highlight',path('M 183 224 Q 182 194 209 192'),'#FFE3DE',9)
        highlight['masksProperties']=[fill_mask]
    elif kind == "offline-saved":
        add("Offline tray", path("M 166 286 L 166 332 L 346 332 L 346 286"), violet, 12)
        add("Download", path("M 256 166 L 256 276 M 224 244 L 256 276 L 288 244"), violet, 12)
        a=add("Saved check", path("M -13 0 L -3 10 L 17 -10"), "#64B69D", 8, p=(353,353))
        a["ks"]["o"] = keyframes([(0,0),(14,0),(22,100),(frames,100)])
    elif kind == "sync-working":
        a=add("Sync arrows", path("M 185 208 C 220 159 300 162 335 215 M 335 215 L 335 176 M 335 215 L 296 215 M 327 300 C 292 349 212 346 177 293 M 177 293 L 177 332 M 177 293 L 216 293"), violet, 10)
        a["ks"]["a"] = prop([256,256,0]); a["ks"]["p"] = prop([256,256,0]); a["ks"]["r"] = keyframes([(0,0),(frames,360)])
    return list(reversed(layers))


def build_app_icons():
    configs = [
        ("book-loading",2.4,True,"Preparing study material"),
        ("document-upload",2,True,"Uploading a document"),
        ("document-scan",2,True,"Reading a document"),
        ("reviewer-ready",1.4,False,"Reviewer completed"),
        ("answer-correct",0.8,False,"Correct answer feedback"),
        ("answer-retry",0.8,False,"Supportive retry feedback"),
        ("xp-reward",1.4,False,"XP awarded after a study session"),
        ("coin-reward",1.4,False,"Momo Coins earned"),
        ("heart-refill",2,False,"Heart restored"),
        ("offline-saved",1.4,False,"Study set available offline"),
        ("sync-working",2,True,"Pending study progress syncing"),
    ]
    for name, seconds, loop, purpose in configs:
        frames=round(seconds*FPS)
        export_effect(name, purpose, icon_layers(name,frames), seconds,loop,purpose,still=frames-1 if not loop else 0)


def main():
    for folder in [OUT, DESIGN/"svg", DESIGN/"lottie", DESIGN/"figma"]:
        folder.mkdir(parents=True,exist_ok=True)
    for name, source, act, purpose in [
        ("momo-wave","mobile/assets/onboarding/momo-wave.png","wave","Welcome and greetings"),
        ("momo-welcome","mobile/assets/onboarding/momo-welcome.png","welcome","First launch and sign in"),
        ("momo-ready","mobile/assets/onboarding/momo-ready.png","ready","Study session ready"),
        ("momo-reading","mobile/assets/onboarding/momo-reading.png","reading","Library and studying"),
        ("momo-bow","mobile/assets/onboarding/steps/momo-bow.png","bow","Introduction and thank you"),
        ("momo-cheer","mobile/assets/onboarding/steps/momo-cheer.png","cheer","Quiz completion and milestones"),
        ("momo-listen","mobile/assets/onboarding/steps/momo-listen.png","listen","Tutor listening and learner choices"),
        ("momo-point","mobile/assets/onboarding/steps/momo-point.png","point","Guide to the next action"),
        ("momo-present","mobile/assets/onboarding/steps/momo-present.png","present","Present a generated reviewer"),
        ("momo-proud","mobile/assets/onboarding/steps/momo-proud.png","proud","Achievement and review completion"),
        ("momo-rest","mobile/assets/onboarding/steps/momo-rest.png","rest","Study break and calm empty state"),
        ("momo-thinking","mobile/assets/onboarding/steps/momo-thinking.png","thinking","Tutor thinking and solving"),
        ("momo-hero","web/public/assets/momo-full-body-cutout.png","hero","Marketing hero and app welcome"),
    ]:
        build_mascot(name,source,act,purpose)
    build_fire(); build_confetti(); build_confetti("confetti-gentle",gentle=True); build_app_icons()
    (DESIGN/"manifest.json").write_text(json.dumps({"version":1,"canvas":512,"animations":MANIFEST},indent=2)+"\n")
    print(f"Exported {len(MANIFEST)} animations, SVG masters and dotLottie packages.")


if __name__ == "__main__":
    main()
