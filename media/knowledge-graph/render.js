const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const b=await chromium.launch({args:['--allow-file-access-from-files']});const p=await b.newPage({viewport:{width:1080,height:1350}});
await p.goto('file://'+__dirname+'/graph.html');await p.evaluate(()=>window.ready);
const FPS=30,D=await p.evaluate(()=>DUR),n=Math.round(D*FPS);
const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-preset','slow','-crf','15','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart','out.mp4'],{stdio:['pipe','ignore','inherit']});
for(let i=0;i<n;i++){await p.evaluate(t=>render(t),i/FPS);const buf=await p.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%300==0)console.error('frame',i,'/',n)}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close()})();
