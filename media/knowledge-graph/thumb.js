const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/graph.html');await p.evaluate(()=>window.ready);
await p.evaluate(()=>{
 const t=40.3;
 CA={x:548,y:905,z:.86};
 const F={n:{},e:{},dim:0,side:1,train:.55,flowA:0,flowB:0,hr:0,roles:new Set()};
 Object.keys(N).forEach(i=>F.n[i]=.45);['nathan','jen','caleb'].forEach(i=>F.n[i]=1);E.forEach(e=>{if(e.type==='reports')F.e[e.id]=.28});
 E.forEach(e=>{if(e.a==='nathan'||e.type==='exchange')F.e[e.id]=.7});
 bg(t);drawEdges(t,F);
 // hide small labels: draw nodes with zoom-based labels off by temporarily marking tiers
 const keep=new Set(['nathan','jen','caleb']);const saved={};
 Object.values(N).forEach(n=>{if(!keep.has(n.id)){saved[n.id]=n.label;n.label=''}});
 drawNodes(t,F);Object.values(N).forEach(n=>{if(saved[n.id]!=null)n.label=saved[n.id]});
 // shading for text
 let g=x.createLinearGradient(0,560,0,H);g.addColorStop(0,'rgba(12,14,17,0)');g.addColorStop(.3,'rgba(12,14,17,.88)');g.addColorStop(.55,'rgba(12,14,17,.97)');g.addColorStop(1,'rgba(12,14,17,1)');x.fillStyle=g;x.fillRect(0,560,W,H-560);
 g=x.createLinearGradient(0,0,0,200);g.addColorStop(0,'rgba(12,14,17,.9)');g.addColorStop(1,'rgba(12,14,17,0)');x.fillStyle=g;x.fillRect(0,0,W,200);
 // logo top-left
 const lw=330,lh=lw*75.2/515.8;x.drawImage(LOGO,64,64,lw,lh);
 // headline
 const L=64,maxW=W-128;
 const fit=(s,max)=>{let fs=max;do{x.font=`700 ${fs}px SG`;fs-=2}while(x.measureText(s).width>maxW);return fs+2};
 x.textAlign='left';x.textBaseline='alphabetic';
 x.fillStyle=C.gold;x.fillRect(L,800,96,6);
 x.font='500 26px PM';x.letterSpacing='4px';x.fillStyle=C.gold;x.fillText('40 AI AGENTS · CLAUDE + CHATGPT · ONE HUMAN',L,852);x.letterSpacing='0px';
 const fs=fit('ABOUT TRAINING',150);
 x.shadowColor='rgba(0,0,0,.9)';x.shadowBlur=24;
 x.font=`700 ${fs}px SG`;x.fillStyle=C.spark;x.fillText('THE ',L,852+fs*.98);
 const w=x.measureText('THE ').width;const gg=x.createLinearGradient(0,852,0,852+fs);gg.addColorStop(0,'#EDC762');gg.addColorStop(.6,'#D9A637');gg.addColorStop(1,'#B8862A');
 x.fillStyle=gg;x.fillText('TRUTH',L+w,852+fs*.98);
 x.fillStyle=C.spark;x.fillText('ABOUT TRAINING',L,852+fs*1.96);x.fillText('AI AGENTS',L,852+fs*2.94);
 x.shadowBlur=0;
 x.font='400 34px IN';x.fillStyle=C.silver;x.fillText('It isn’t plug and play.',L,852+fs*2.94+64);
 const v=x.createRadialGradient(W/2,H/2,H*.4,W/2,H/2,H*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.5)');x.fillStyle=v;x.fillRect(0,0,W,H);
});
await p.screenshot({path:'thumb.png'});await b.close()})();
