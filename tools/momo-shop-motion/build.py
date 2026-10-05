"""Build editable, Momo-branded vector shop masters and equivalent Lotties."""
from pathlib import Path
import sys,json,zipfile,hashlib,math,copy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'momo-motion'))
from build import path,ellipse,rect,prop,keyframes,transform,color,stroke
ROOT=Path(__file__).resolve().parents[2];DESIGN=ROOT/'design/momo-shop-motion';OUT=ROOT/'mobile/assets/animations/momo-shop'
BLUE='#2263D8';NAVY='#173D86';GOLD='#FFD052';AMBER='#BC7319';PINK='#EF7E92';ROSE='#A63759';VIOLET='#7859D8';INK='#312B49'
META=[]
def gradient(c1,c2,start,end):
 return {'ty':'gf','o':prop(100),'r':1,'bm':0,'t':1,'g':{'p':2,'k':prop([0,*color(c1)[:3],1,*color(c2)[:3]])},'s':prop(list(start)),'e':prop(list(end))}
class Scene:
 def __init__(self):self.layers=[];self.svg=[];self.defs=[];self.frames=60
 def add(self,name,kind,args,fill=None,line=None,width=2,grad=None,pivot=None,rotation=None,position=None,opacity=100,mask=None):
  shapes=path(args) if kind=='path' else [ellipse(*args)] if kind=='ellipse' else [rect(*args)]
  tag=f'<path d="{args}"' if kind=='path' else f'<ellipse cx="{args[0]}" cy="{args[1]}" rx="{args[2]/2}" ry="{args[3]/2}"' if kind=='ellipse' else f'<rect x="{args[0]-args[2]/2}" y="{args[1]-args[3]/2}" width="{args[2]}" height="{args[3]}" rx="{args[4] if len(args)>4 else 0}"'
  paints=[];svgfill=fill or 'none'
  if grad:
   c1,c2,start,end=grad;ident=f'g{len(self.defs)}';self.defs.append(f'<linearGradient id="{ident}" gradientUnits="userSpaceOnUse" x1="{start[0]}" y1="{start[1]}" x2="{end[0]}" y2="{end[1]}"><stop stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>');svgfill=f'url(#{ident})';paints.append(gradient(*grad))
  elif fill:paints.append({'ty':'fl','c':prop(color(fill)),'o':prop(100),'r':1})
  if line:paints.append(stroke(line,width))
  tr={'ty':'tr',**transform(),'sk':prop(0),'sa':prop(0)};tr['p']=prop([0,0]);tr['a']=prop([0,0]);tr['s']=prop([100,100])
  ks=transform(o=opacity)
  if pivot:ks=transform(p=pivot,a=pivot,o=opacity)
  if rotation:ks['r']=keyframes(rotation)
  if position:ks['p']=keyframes(position)
  layer={'ddd':0,'ty':4,'nm':name,'sr':1,'ks':ks,'ao':0,'ip':0,'op':60,'st':0,'bm':0,'shapes':[{'ty':'gr','nm':name,'it':shapes+paints+[tr]}]}
  if mask:
   x0,y0,x1,y1,delay=mask
   from build import bezier_shapes
   values=[]
   for t,y in [(0,y1+2),(delay,y1+2),(delay+24,y0-2),(60,y0-2)]:
    values.append((t,bezier_shapes(f'M {x0-3} {y} L {x1+3} {y} L {x1+3} {y1+4} L {x0-3} {y1+4} Z')[0]))
   layer['hasMask']=True;layer['masksProperties']=[{'inv':False,'mode':'a','pt':keyframes(values),'o':prop(100),'x':prop(0)}]
  self.layers.append(layer)
  r=rotation[-1][1] if rotation else 0
  shift=''
  if r and pivot:shift=f'transform="rotate({r} {pivot[0]} {pivot[1]})"'
  if position:shift=f'transform="translate({position[-1][1][0]} {position[-1][1][1]})"'
  self.svg.append(f'{tag} fill="{svgfill}" stroke="{line or "none"}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" opacity="{opacity/100}" {shift}/>')
 def p(self,n,d,**kw):self.add(n,'path',d,**kw)
 def e(self,n,x,y,w,h,**kw):self.add(n,'ellipse',(x,y,w,h),**kw)
 def r(self,n,x,y,w,h,rad=0,**kw):self.add(n,'rect',(x,y,w,h,rad),**kw)
 def shadow(self):self.e('Ground shadow',128,225,164,15,fill='#3D3275',opacity=12)
 def export(self,id,title,purpose,motion):
  layers=list(reversed(self.layers))
  for i,l in enumerate(layers):l['ind']=i+1
  a={'v':'5.7.4','fr':30,'ip':0,'op':60,'w':256,'h':256,'nm':title,'ddd':0,'assets':[],'layers':layers,'markers':[{'tm':59,'cm':'reduced-motion-still','dr':0}]}
  raw=json.dumps(a,separators=(',',':')).encode();(OUT/f'{id}.json').write_bytes(raw)
  svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs>'+''.join(self.defs)+'</defs>'+''.join(self.svg)+'</svg>'
  (DESIGN/'svg'/f'{id}.svg').write_text(svg)
  with zipfile.ZipFile(DESIGN/'lottie'/f'{id}.lottie','w',zipfile.ZIP_DEFLATED) as z:
   for n,b in [('manifest.json',json.dumps({'version':'1.0','animations':[{'id':id,'loop':False,'autoplay':True}]}).encode()),(f'animations/{id}.json',raw)]:
    zi=zipfile.ZipInfo(n,(2026,10,5,0,0,0));zi.compress_type=zipfile.ZIP_DEFLATED;z.writestr(zi,b)
  META.append({'id':id,'title':title,'purpose':purpose,'motion':motion,'duration':2,'fps':30,'loop':False,'stillFrame':59,'json':str((OUT/f'{id}.json').relative_to(ROOT)),'svg':str((DESIGN/'svg'/f'{id}.svg').relative_to(ROOT)),'dotLottie':str((DESIGN/'lottie'/f'{id}.lottie').relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest()})

def coin(s,x,y,r=28,glint=False):
 s.e('Coin rim',x,y+3,r*2,r*2,grad=('#FFE492',AMBER,(x-r,y-r),(x+r,y+r)),line=AMBER,width=2)
 s.e('Coin face',x,y-1,r*1.7,r*1.7,grad=('#FFF0A8','#F8BB36',(x-r,y-r),(x+r,y+r)),line='#EDAB25',width=1.4)
 d=f'M {x-r*.36} {y+r*.28} L {x-r*.36} {y-r*.28} L {x} {y+r*.04} L {x+r*.36} {y-r*.28} L {x+r*.36} {y+r*.28}'
 s.p('Embossed Momo M',d,line=AMBER,width=max(2,r*.13))
 if glint:s.p('Metal glint',f'M {x-r*.45} {y-r*.36} C {x-r*.3} {y-r*.5} {x-r*.1} {y-r*.55} {x+r*.13} {y-r*.5}',line='#FFF7CF',width=3,pivot=(x,y),rotation=[(0,0),(18,18),(36,-10),(60,0)])

def heart_d(x,y,k):
 return f'M {x} {y+31*k} C {x-65*k} {y-6*k} {x-31*k} {y-58*k} {x} {y-30*k} C {x+31*k} {y-58*k} {x+65*k} {y-6*k} {x} {y+31*k} Z'
def heart(s,x,y,k=1,delay=0):
 d=heart_d(x,y,k);s.p('Heart underlay',d,fill='#E6D7DA',line=ROSE,width=2.5)
 s.p('Solid heart color',d,fill=PINK,mask=(x-50*k,y-50*k,x+50*k,y+35*k,delay))
 s.p('Heart contour',d,line=ROSE,width=2.5)
 s.p('Heart highlight',f'M {x-27*k} {y-23*k} C {x-23*k} {y-31*k} {x-14*k} {y-31*k} {x-10*k} {y-26*k}',line='#FFC4D0',width=5*k,mask=(x-50*k,y-50*k,x+50*k,y+35*k,delay))

def star_d(x,y,r):
 pts=[]
 for i in range(10):
  a=-math.pi/2+i*math.pi/5;rr=r if i%2==0 else r*.49;pts.append((x+math.cos(a)*rr,y+math.sin(a)*rr))
 return 'M '+' L '.join(f'{a:.2f} {b:.2f}' for a,b in pts)+' Z'
def xp(s,x=128,y=125,r=68,glint=True):
 s.p('XP badge depth',star_d(x,y+5,r),fill='#4F3695',line='#4F3695',width=5)
 s.p('XP badge face',star_d(x,y,r),grad=('#C4ABFF',VIOLET,(x-r,y-r),(x+r,y+r)),line='#584399',width=3)
 s.p('Earned star',star_d(x,y,r*.52),grad=('#FFF3B8',GOLD,(x-r/2,y-r/2),(x+r/2,y+r/2)),line='#B79042',width=1.5)
 if glint:s.p('Badge glint',f'M {x-r*.22} {y-r*.58} L {x} {y-r*.86} L {x+r*.17} {y-r*.35}',line='#EFE5FF',width=3,pivot=(x,y),rotation=[(0,0),(16,-5),(38,4),(60,0)])

def book(s,x=128,y=176,w=132):
 s.r('Notebook lower cover',x,y+9,w,67,12,fill=NAVY)
 s.r('Notebook cover',x,y,w,67,12,grad=('#4488EB',BLUE,(x-w/2,y-34),(x+w/2,y+34)),line=NAVY,width=2)
 s.r('Paper edge',x+3,y+26,w-20,12,4,fill='#FFF0CC',line='#CAA86C',width=1)
 s.p('Notebook spine',f'M {x-w/2+17} {y-25} L {x-w/2+17} {y+24}',line='#72A6F0',width=3)

s=Scene();s.shadow();coin(s,101,80,30);coin(s,149,76,31);coin(s,177,95,26)
s.p('Pouch silhouette','M 75 103 C 90 94 98 116 128 116 C 156 116 169 96 181 107 C 167 126 200 149 201 178 C 202 211 164 224 125 221 C 77 224 51 208 55 176 C 59 146 86 129 75 103 Z',grad=('#65A0F3',BLUE,(65,119),(190,220)),line=NAVY,width=3)
s.p('Pouch fold','M 81 141 C 68 168 66 187 82 204',line='#8AB8F7',width=5)
s.p('Right fold','M 170 147 C 183 170 184 192 173 207',line='#184FAC',width=4)
s.r('Golden collar',128,123,104,18,8,grad=('#FFF0A3',GOLD,(78,117),(176,135)),line=AMBER,width=2)
s.p('Drawstring ends','M 143 126 C 160 118 169 143 153 141 M 142 126 C 128 112 122 139 136 136 M 141 134 L 146 154',line=AMBER,width=4,pivot=(141,129),rotation=[(0,0),(18,8),(38,-4),(60,0)])
coin(s,126,175,24,True);s.export('shop-credit-pouch','Little Pouch','100-credit preview pack','Drawstring knot turns; coin glint travels. Pouch stays fixed.')

s=Scene();s.shadow();s.p('Backpack straps','M 76 201 C 38 145 47 66 91 66 M 174 64 C 210 63 221 146 188 204',line=NAVY,width=15)
s.p('Carry handle','M 101 64 C 99 26 153 26 155 64',line=NAVY,width=13)
s.p('Handle highlight','M 104 54 C 107 31 143 32 150 53',line='#70A5F5',width=5)
s.r('Backpack body',129,145,137,155,30,grad=('#70A5F5',BLUE,(62,70),(180,220)),line=NAVY,width=3)
s.r('Golden notebook',180,144,23,89,5,fill=GOLD,line=AMBER,width=2)
s.r('Front pocket',127,176,103,65,16,grad=('#4389EE','#1B51B2',(85,145),(164,207)),line=NAVY,width=2)
s.p('Pocket zipper','M 88 158 L 167 158',line='#F8CF68',width=3)
s.r('Zipper pull',166,166,9,17,3,fill=GOLD,line=AMBER,width=1.5,pivot=(166,158),rotation=[(0,0),(15,20),(35,-10),(60,0)])
s.p('Backpack flap','M 64 102 C 61 64 82 59 127 61 C 173 59 198 66 193 103 C 192 135 69 135 64 102 Z',grad=('#5899F4',BLUE,(70,61),(184,128)),line=NAVY,width=3)
coin(s,128,97,22,True);s.export('shop-credit-backpack',"Momo's Backpack",'500-credit preview pack','Zipper pull and embossed coin glint move; bag stays fixed.')

s=Scene();s.shadow();s.r('Vault depth',135,147,174,153,27,fill='#14366C',line=NAVY,width=3)
s.r('Vault frame',125,139,170,155,27,grad=('#6CA9F5',BLUE,(41,63),(206,213)),line=NAVY,width=3)
s.r('Vault door inset',127,143,137,122,16,fill='#163F86',line='#86B8F6',width=3)
s.r('Vault golden door',126,138,125,113,15,grad=('#FFE89D','#DCA23B',(65,82),(185,198)),line=AMBER,width=2)
for yy in [99,175]:s.r('Vault hinge',61,yy,14,27,4,fill=NAVY,line='#75A8ED',width=1)
coin(s,129,135,33,True)
s.p('Vault handle','M 160 124 L 177 124 L 177 148 L 160 148',line=AMBER,width=6,pivot=(166,136),rotation=[(0,0),(18,12),(42,-8),(60,0)])
for x,y in [(83,96),(173,96),(83,180),(173,180)]:s.e('Door rivet',x,y,6,6,fill='#FFF1C1')
s.export('shop-credit-vault','Treasure Vault','1,500-credit preview pack','Vault handle turns and coin glints. Fixed vault silhouette.')

s=Scene();s.shadow();heart(s,128,139,1.6);s.export('shop-heart-single','Single Heart','One extra quiz life','Solid pink color fills upward inside a fixed heart contour.')
s=Scene();s.shadow()
for i,(x,y) in enumerate([(84,97),(173,97),(63,155),(194,155),(128,168)]):heart(s,x,y,.78,i*4)
s.export('shop-heart-five','High Five','Five extra quiz lives','Five separate hearts fill upward in sequence; outlines stay fixed.')
s=Scene();s.shadow()
for i,(x,y,k) in enumerate([(75,86,.58),(128,70,.62),(180,89,.58),(65,130,.65),(110,116,.72),(155,117,.72),(198,132,.55)]):heart(s,x,y,k,i*3)
s.p('Bowl depth','M 42 146 L 217 146 C 215 219 186 230 129 230 C 72 231 44 213 42 146 Z',fill=NAVY)
s.p('Bowl body','M 40 138 L 216 138 C 214 211 186 222 128 222 C 71 223 42 205 40 138 Z',grad=('#65A0F3',BLUE,(43,144),(207,224)),line=NAVY,width=3)
s.e('Bowl rim',128,142,177,25,grad=('#BAD5FF','#5A92E0',(42,135),(205,154)),line=NAVY,width=2)
s.p('Bowl highlight','M 57 165 C 64 192 77 204 91 207',line='#99C0FA',width=5)
heart(s,128,182,.43,14);s.export('shop-heart-bowl','Full Bowl','Fifteen extra quiz lives','Hearts rise in color; bowl and rim stay fixed.')

s=Scene();s.shadow();book(s);coin(s,128,112,47,True)
s.p('Helpful lightbulb','M 115 121 L 115 115 C 98 98 115 76 129 82 C 147 78 158 101 141 115 L 141 121 Z',fill='#FFF4BD',line=AMBER,width=2)
s.r('Bulb socket',128,124,26,9,3,fill=AMBER)
s.p('Bulb filament','M 122 110 L 122 100 L 133 107 L 136 96',line='#E4B344',width=2)
s.export('shop-hint-credits','Quick Hint','XP trade for 50 credits usable for study help','Embossed credit glint moves; study notebook and bulb stay fixed.')
s=Scene();s.shadow();book(s,x=121,y=169,w=136);coin(s,145,107,52,True)
s.p('Special blue ribbon','M 179 128 L 198 163 L 179 158 L 169 176 L 154 140 Z',grad=('#70A5F5',BLUE,(165,124),(196,176)),line=NAVY,width=2)
s.p('Ribbon fold','M 172 148 L 179 157',line='#9DBEF4',width=2)
s.export('shop-special-credits',"Momo's Special",'XP trade for 150 credits','Coin glint travels over a Momo-blue study bundle; no body bounce.')
s=Scene();s.shadow();xp(s,y=131,r=87);s.export('shop-xp-badge','Study XP','Earned study XP balance','One small glint on the earned star; badge stays fixed.')

for target in ['credits','hearts']:
 s=Scene();s.e('Diagram shadow',128,207,204,13,fill='#3D3275',opacity=10);xp(s,x=65,y=119,r=43,glint=False)
 s.p('Conversion route','M 109 116 C 128 95 141 98 157 115',line='#BBA5E3',width=5)
 s.p('Conversion arrow','M 145 110 L 157 115 L 149 128',line=VIOLET,width=5)
 s.p('Moving XP chip',star_d(121,109,7),fill=GOLD,line=AMBER,width=1,position=[(0,[0,0,0]),(20,[8,-3,0]),(45,[15,3,0]),(60,[15,3,0])])
 if target=='credits':coin(s,197,126,39,True)
 else:heart(s,197,128,.87,15)
 s.export('shop-exchange-'+target,'XP → '+target.title(),'Trade confirmation diagram for '+target,'XP token follows the route toward the selected reward; silhouettes stay fixed.')
s=Scene();s.shadow();book(s,y=185,w=166);xp(s,y=101,r=55)
s.p('Study page','M 54 169 C 75 152 110 154 128 165 C 146 154 179 152 202 169 L 199 201 C 174 188 148 191 128 204 C 107 192 77 189 58 201 Z',fill='#FFF2D2',line='#BD9D69',width=2)
s.p('Page spine','M 128 166 L 128 201',line='#C4A578',width=2)
s.p('Turning page corner','M 170 167 L 201 170 L 195 188 Z',fill='#FFD776',line='#BD9D69',width=1.5,pivot=(195,171),rotation=[(0,0),(20,-10),(38,4),(60,0)])
s.export('shop-xp-needed','Keep Studying','Insufficient earned XP; continue studying','Only a page corner turns; XP star and notebook stay fixed.')
(DESIGN/'manifest.json').write_text(json.dumps({'version':1,'canvas':256,'brand':{'blue':BLUE,'navy':NAVY,'gold':GOLD,'heart':PINK,'xp':VIOLET},'animations':META},indent=2)+'\n')
print('Built',len(META),'Momo shop assets.')
