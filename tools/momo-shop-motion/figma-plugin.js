figma.showUI(__html__,{width:560,height:780});
const PAGE='Momo · Shop Studio',BOARD='Momo shop / 12 animated asset masters';
async function run(){
 try {
  let page=figma.root.children.find(p=>p.name===PAGE);
  if(!page){page=figma.createPage();page.name=PAGE;}
  await figma.setCurrentPageAsync(page);
  const old=page.children.find(n=>n.name===BOARD);
  if(old && old.children.filter(n=>n.type==='FRAME').length===12){figma.currentPage.selection=[old];figma.viewport.scrollAndZoomIntoView([old]);figma.ui.postMessage({type:'board-built',count:12});return;}
  if(old)old.remove();
  await figma.loadFontAsync({family:'Inter',style:'Regular'});await figma.loadFontAsync({family:'Inter',style:'Bold'});
  const board=figma.createFrame();board.name=BOARD;board.resize(1320,1510);board.fills=[{type:'SOLID',color:{r:0.984,g:0.973,b:0.945}}];page.appendChild(board);
  function text(content,x,y,size,bold=false,color={r:0.192,g:0.169,b:0.286}){const t=figma.createText();t.fontName={family:'Inter',style:bold?'Bold':'Regular'};t.fontSize=size;t.characters=content;t.x=x;t.y=y;t.fills=[{type:'SOLID',color}];board.appendChild(t);return t;}
  text('MOMO / SHOP STUDIO',50,40,14,true);text('Little tools. More chances to learn.',50,76,40,true);text('12 editable assets · transparent Lottie · local detail motion',50,137,17);
  for(let i=0;i<MASTERS.length;i++){
   const a=MASTERS[i],x=50+i%4*312,y=192+Math.floor(i/4)*406;
   const card=figma.createFrame();card.name=a.title;card.resize(288,386);card.x=x;card.y=y;card.cornerRadius=24;card.fills=[{type:'SOLID',color:{r:1,g:0.992,b:0.973}}];board.appendChild(card);
   const master=figma.createComponent();master.name=a.id+' / SVG master';master.resize(256,256);master.fills=[];master.x=16;master.y=6;master.description=a.purpose;master.exportSettings=[{format:'SVG'},{format:'PNG',constraint:{type:'SCALE',value:2}}];card.appendChild(master);
   const art=figma.createNodeFromSvg(a.svg);art.name='Editable paths and gradients';master.appendChild(art);art.x=0;art.y=0;
   const label=figma.createText();label.fontName={family:'Inter',style:'Bold'};label.fontSize=18;label.characters=a.title;label.x=20;label.y=284;card.appendChild(label);
   const purpose=figma.createText();purpose.fontName={family:'Inter',style:'Regular'};purpose.fontSize=12;purpose.characters=a.purpose;purpose.resize(246,40);purpose.x=20;purpose.y=315;card.appendChild(purpose);
  }
  text('Fixed silhouettes. Local motion. Hearts fill upward. Prices and quantities come from app data.',50,1470,13);
  figma.currentPage.selection=[board];figma.viewport.scrollAndZoomIntoView([board]);
  figma.notify('Created 12 editable Momo shop components.');figma.ui.postMessage({type:'board-built',count:12});console.log('Momo Shop Studio: 12 editable component masters created.');
 } catch(error){figma.notify(error.message,{error:true});figma.ui.postMessage({type:'error',message:error.message});}
}
figma.ui.onmessage=message=>{if(message.type==='build-board')run();};run();
