/* Complete SVG board is prepended by build-handoff.mjs. No network calls. */
figma.showUI(__html__, { width: 560, height: 780 });
const BOARD_NAME='Momo Motion Studio / v5 local gesture masters';
function build(){
  const page=figma.currentPage;
  const existing=page.children.find(n=>n.name===BOARD_NAME);
  const previous=page.children.filter(n=>n.name.startsWith('Momo Motion Studio /')||n.name==='Momo / Motion System / 28 SVG + Lottie');
  if(existing){figma.currentPage.selection=[existing];figma.viewport.scrollAndZoomIntoView([existing]);return;}
  // One synchronous SVG import avoids waiting on fonts or unrelated pages.
  const board=figma.createNodeFromSvg(BOARD_SVG);
  board.name=BOARD_NAME;page.appendChild(board);board.x=previous.length?Math.max(...previous.map(n=>n.x+n.width))+180:0;board.y=0;
  page.name='Momo · Motion Studio';
  // Remove only this generator's earlier incomplete board after successful import.
  const partial=page.children.find(n=>n.name==='Momo / Motion System / 28 SVG + Lottie'&&n.children&&n.children.length<15);
  if(partial)partial.remove();
  figma.currentPage.selection=[board];figma.viewport.scrollAndZoomIntoView([board]);
  console.log('Momo Motion Studio: 13 intact artwork masters and 15 vector effects created.');
  figma.notify('Momo Motion Studio: 13 intact artwork masters and 15 vector effects created.');
  figma.ui.postMessage({type:'board-built',count:28});
}
function run(){
  try{build()}catch(error){
    console.error('Momo board:',error.message);
    figma.notify('Could not create motion board: '+error.message,{error:true});
    figma.ui.postMessage({type:'error',message:error.message});
  }
}
figma.ui.onmessage=message=>{if(message.type==='build-board')run();};
run();
