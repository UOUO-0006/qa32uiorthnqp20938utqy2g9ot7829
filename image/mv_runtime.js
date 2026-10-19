(()=>{
  const stage=document.getElementById("c60"),content=stage.querySelector(".c12"),panel=document.getElementById("c61");
  const slider=document.getElementById("c62"),value=document.getElementById("c63"),startButton=document.getElementById("c64"),stopButton=document.getElementById("c65");
  const status=document.getElementById("c66"),hint=document.getElementById("c67"),video=document.getElementById("c68"),canvas=document.getElementById("c69");
  const scrollBox=document.getElementById("c39"),feed=document.getElementById("c34");
  const W=1440,H=1080,OUTPUT_FPS=30,REQUEST_MAX_FPS=30,MAX_PNG_BYTES=500000000,BUILD="DDBBS-MV-20261019-06";
  let step=20,workers=[],frames=[],completed=new Map(),frameLog=[],totalPngBytes=0;
  let nextCaptureIndex=0,nextCommitIndex=0,inFlight=0,requestId=0;
  let initializing=false,recording=false,stopping=false,budgetReached=false,encodeFailed=false,controlsHidden=false;
  let stream=null,track=null,trackFps=0,captureSurface="",recordStartedAt=0,captureEndedAt=0,lastStatusAt=0,observedFps=0;
  let captureScaleY=window.devicePixelRatio||1,stageScale=1,stageWidth=0,phaseOutput=0;
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;

  function resizeStage(){
    const usableW=Math.max(1,Math.min(innerHeight*4/3,innerWidth-panel.offsetWidth-15));
    const maxK=Math.min(.85*usableW/(W/2),.924*(usableW*.75)/587);
    const target=(step%10===0?1.2:1)/Math.max(.01,captureScaleY);
    let k=target;
    if(k>maxK){const grid=Math.floor(step*captureScaleY*maxK+1e-8);k=grid>0?grid/(step*captureScaleY):maxK}
    stageScale=k;stageWidth=(W/2)*k/.85;
    stage.style.setProperty("--w",stageWidth+"px");content.style.setProperty("--k",String(k));
  }
  resizeStage();
  new ResizeObserver(resizeStage).observe(stage);
  window.addEventListener("resize",resizeStage);
  slider.addEventListener("input",()=>{step=Number(slider.value);value.value=step+" px/コマ";resizeStage();if(recording)updateStatus(true)});

  function pageError(message){status.textContent=message;}
  function textTransformY(){
    const m=feed.style.transform.match(/translateY\(([-+0-9.eE]+)px\)/);
    return m?Number(m[1]):0;
  }
  function scrollOneStep(){
    const box=stage.getBoundingClientRect();
    const k=parseFloat(getComputedStyle(content).getPropertyValue("--k"))||1;
    const outPerCss=k*W/Math.max(1,box.width);
    const actualOffset=scrollBox.scrollTop*outPerCss-textTransformY()*outPerCss;
    if(Math.abs(actualOffset-phaseOutput)>outPerCss/2+.01)phaseOutput=Math.round(actualOffset);
    const outputStep=Math.max(1,Math.round(step*outPerCss));
    const targetScroll=Math.round((phaseOutput+outputStep)/outPerCss);
    scrollBox.scrollTop=targetScroll;
    if(scrollBox.scrollTop===targetScroll)phaseOutput+=outputStep;
    else phaseOutput=Math.round(scrollBox.scrollTop*outPerCss);
    feed.style.transform=`translateY(${(scrollBox.scrollTop*outPerCss-phaseOutput)/outPerCss}px)`;
  }
  function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>resolve()))}
  function nextVideoFrame(){
    return new Promise(resolve=>{
      if(video.requestVideoFrameCallback)requestId=video.requestVideoFrameCallback((now,metadata)=>resolve({now,metadata}));
      else requestId=requestAnimationFrame(now=>resolve({now,metadata:null}));
    });
  }
  function captureFrame(index){
    const box=stage.getBoundingClientRect();
    const scaleX=video.videoWidth/Math.max(1,innerWidth),scaleY=video.videoHeight/Math.max(1,innerHeight);
    const dimension=video.videoWidth+"x"+video.videoHeight;
    frameLog.push(`${index}@${Math.round(performance.now()-recordStartedAt)}ms ${dimension} bg${getBackgroundIndex()} k${stageScale.toFixed(4)} w${box.width.toFixed(1)}`);
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(video,box.left*scaleX,box.top*scaleY,box.width*scaleX,box.height*scaleY,0,0,W,H);
    return ctx.getImageData(0,0,W,H).data.buffer;
  }
  function getBackgroundIndex(){
    const match=getComputedStyle(document.querySelector(".c50")).getPropertyValue("--b").match(/bbs_back_p([0-3])\.png/);
    return match?Number(match[1]):-1;
  }
  function bindWorker(worker){
    let resolveReady,rejectReady;
    const entry={worker,busy:false,ready:false,readyPromise:new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject})};
    entry.resolveReady=resolveReady;entry.rejectReady=rejectReady;
    worker.onmessage=event=>{
      const message=event.data;
      if(message.t===1){entry.ready=true;entry.resolveReady();return}
      if(message.t===4){
        entry.busy=false;inFlight--;
        completed.set(message.i,new Uint8Array(message.b));
        commitCompletedFrames();
        if(recording)updateStatus(false);
        if(stopping&&inFlight===0)finalizeSequence();
        return;
      }
      if(message.t===5){
        entry.busy=false;inFlight--;encodeFailed=true;pageError("PNG生成エラー: "+message.e);
        requestStop();
        if(stopping&&inFlight===0)finalizeSequence();
        return;
      }
    };
    worker.onerror=event=>{entry.rejectReady(new Error(event.message||"PNG worker error"));encodeFailed=true;pageError("PNG処理を開始できませんでした");requestStop()};
    workers.push(entry);return entry;
  }
  function createWorker(){
    const worker=new Worker(new URL("../image/mv_worker.js?v="+BUILD,location.href));
    const entry=bindWorker(worker);
    worker.postMessage({t:0,w:W,h:H});
    return entry;
  }
  function updateStatus(force){
    if(!recording)return;
    const now=performance.now();
    if(!force&&now-lastStatusAt<750&&frames.length%30!==0)return;
    lastStatusAt=now;
    const elapsed=Math.max(.001,(now-recordStartedAt)/1000);
    observedFps=frames.length/elapsed;
    const speed=observedFps/OUTPUT_FPS;
    const projected=frames.length?totalPngBytes/frames.length*4500:0;
    status.textContent=`実測${observedFps.toFixed(1)}fps（${speed.toFixed(2)}倍） · 30fps連番 · ${step}px/コマ · ${frames.length}枚 · PNG ${(totalPngBytes/1e6).toFixed(1)}MB`;
    hint.textContent=`4500枚換算 約${(projected/1e6).toFixed(0)}MB / 上限500MB · 停止: ボタン・Esc・Chrome共有停止`;
  }
  function stopTrack(){
    if(stream){for(const t of stream.getTracks())try{t.stop()}catch(e){};stream=null}
    video.pause();video.srcObject=null;
  }
  function requestStop(){
    if(!recording&&!initializing)return;
    recording=false;stopping=true;captureEndedAt=performance.now();stopButton.disabled=true;startButton.disabled=true;
    if(requestId){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(requestId);else cancelAnimationFrame(requestId);requestId=0}
    stopTrack();
    restorePageTimers();
    if(!inFlight)finalizeSequence();
  }
  function restorePageTimers(){
    if(controlsHidden){document.body.classList.remove("c70");controlsHidden=false}
  }
  function commitCompletedFrames(){
    while(completed.has(nextCommitIndex)){
      const bytes=completed.get(nextCommitIndex);completed.delete(nextCommitIndex);
      if(totalPngBytes+bytes.length>MAX_PNG_BYTES){
        budgetReached=true;recording=false;stopping=true;captureEndedAt=performance.now();stopButton.disabled=true;startButton.disabled=true;
        restorePageTimers();stopTrack();
        completed.clear();
        status.textContent=`PNG合計500MB上限で停止 · ${frames.length}枚を保存します`;
        break;
      }
      frames.push(bytes);totalPngBytes+=bytes.length;nextCommitIndex++;
    }
    if(stopping&&inFlight===0)finalizeSequence();
  }
  function requestWorker(){return workers.find(item=>item.ready&&!item.busy)}
  async function captureLoop(){
    try{
      while(recording){
        await nextVideoFrame();
        if(!recording)break;
        const entry=requestWorker();
        if(!entry)continue; // backpressure: keep page state fixed; do not skip or duplicate an output frame
        const index=nextCaptureIndex++;
        const pixels=captureFrame(index);
        entry.busy=true;inFlight++;
        entry.worker.postMessage({t:3,i:index,b:pixels},[pixels]);
        scrollOneStep();
        await nextPaint();
      }
    }catch(error){
      encodeFailed=true;pageError("録画中のエラー: "+String(error&&error.message||error));requestStop();
    }
  }
  async function startCapture(){
    if(initializing||recording||stopping)return;
    initializing=true;frames=[];completed.clear();frameLog=[];totalPngBytes=0;nextCaptureIndex=0;nextCommitIndex=0;inFlight=0;budgetReached=false;encodeFailed=false;trackFps=0;captureSurface="";observedFps=0;captureEndedAt=0;
    startButton.disabled=true;stopButton.disabled=true;status.textContent="PNG処理を準備しています…";
    try{
      workers=[];
      const poolSize=Math.min(4,Math.max(2,navigator.hardwareConcurrency||2));
      const ready=Array.from({length:poolSize},()=>createWorker());
      await Promise.all(ready.map(item=>item.readyPromise));
      if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)throw new Error("PC版Chrome/EdgeのHTTPSまたはlocalhostで開いてください");
      status.textContent="Chromeの共有選択で「このタブ」を選んでください";
      stream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:innerWidth},height:{ideal:innerHeight},frameRate:{ideal:REQUEST_MAX_FPS,max:REQUEST_MAX_FPS}},audio:false,preferCurrentTab:true,selfBrowserSurface:"include"});
      track=stream.getVideoTracks()[0];
      try{track.contentHint="detail"}catch(e){}
      const settings=track.getSettings();trackFps=Number(settings.frameRate)||0;captureSurface=settings.displaySurface||"";
      if(captureSurface&&captureSurface!=="browser")throw new Error("共有画面ではなく「このタブ」を選択してください");
      track.addEventListener("ended",()=>{if(recording&&!stopping)requestStop()},{once:true});
      video.srcObject=stream;await video.play();await new Promise(resolve=>{if(video.readyState>=2)resolve();else video.addEventListener("loadeddata",resolve,{once:true})});
      const measured=video.videoHeight/Math.max(1,innerHeight);if(Number.isFinite(measured)&&measured>0)captureScaleY=measured;
      resizeStage();await nextPaint();await nextPaint();
      const panelBox=panel.getBoundingClientRect(),stageBox=stage.getBoundingClientRect();
      if(panelBox.left<stageBox.right&&panelBox.right>stageBox.left&&panelBox.top<stageBox.bottom&&panelBox.bottom>stageBox.top){document.body.classList.add("c70");controlsHidden=true}
      const scale=(parseFloat(getComputedStyle(content).getPropertyValue("--k"))||1)*W/Math.max(1,stage.getBoundingClientRect().width);
      phaseOutput=Math.round(scrollBox.scrollTop*scale-textTransformY()*scale);
      const bgValue=getBackgroundIndex();
      scrollOneStep();await nextPaint();
      initializing=false;recording=true;stopping=false;recordStartedAt=performance.now();lastStatusAt=0;
      stopButton.disabled=false;status.textContent=`録画中 · 30fps連番 · ${step}px/コマ · 30fps要求`;
      hint.textContent=`開始位置を維持し1コマ進めてから記録 · 背景開始 ${bgValue} · 上限500MB`;
      captureLoop();
    }catch(error){
      initializing=false;recording=false;stopping=false;stopTrack();restorePageTimers();workers.forEach(item=>item.worker.terminate());workers=[];startButton.disabled=false;stopButton.disabled=true;
      status.textContent=String(error&&error.message||"録画を開始できませんでした");
    }
  }
  function stopButtonAction(){
    if(!recording&&!initializing)return;
    if(initializing){initializing=false;stopTrack();return}
    requestStop();
  }
  async function finalizeSequence(){
    if(!stopping||inFlight)return;
    stopping=false;recording=false;stopButton.disabled=true;startButton.disabled=true;
    workers.forEach(item=>item.worker.terminate());workers=[];
    if(!frames.length){status.textContent="保存できるPNGフレームがありません";startButton.disabled=false;return}
    frameLog=frameLog.slice(0,frames.length);
    const avg=totalPngBytes/frames.length;
    const elapsed=Math.max(.001,((captureEndedAt||performance.now())-recordStartedAt)/1000);
    const actualFps=frames.length/elapsed;
    const readme=[
      "DDBBS MV PNG sequence",
      `Build ID: ${BUILD}`,
      "Frame size: 1440 x 1080",
      "Sequence import rate: 30 fps (fixed)",
      `Frames: ${frames.length}`,
      `Scroll step: ${step} CSS px per output frame`,
      "Start position: current scroll preserved; one step down before frame 000000",
      `PNG encoding: lossless RGBA, no indexed-palette quantization; image bytes ${totalPngBytes} (${(totalPngBytes/1e6).toFixed(2)} MB decimal)`,
      `Average PNG size: ${Math.round(avg)} bytes/frame`,
      `PNG byte cap: ${MAX_PNG_BYTES} (500 MB decimal)${budgetReached?"; capture stopped at cap":""}`,
      `Capture track reported fps: ${trackFps?trackFps.toFixed(2):"not reported"}`,
      `Observed PNG generation rate: ${actualFps.toFixed(2)} frames/sec (${(actualFps/OUTPUT_FPS).toFixed(2)}x versus 30fps playback)`,
      `Capture surface: ${captureSurface||"not reported"}`,
      `Capture input dimensions observed: ${[...new Set(frameLog.map(line=>line.split(" ")[1]))].join(", ")||"not reported"}`,
      "Sampling: direct crop to 1440 x 1080; canvas smoothing disabled",
      `Per-frame capture log (index@ms input WxH background-index CSS-scale stage-width): ${frameLog.join(" | ")||"not reported"}`,
      "Import numbered PNG files as an image sequence at 30 fps. PNG files contain no individual timestamps.",
      `Status: ${encodeFailed?"some capture/encoding error occurred":"completed"}`
    ].join("\n")+"\n";
    const files={"README.txt":new TextEncoder().encode(readme)};
    for(let i=0;i<frames.length;i++)files[`frame_${String(i).padStart(6,"0")}.png`]=frames[i];
    status.textContent=`ZIPを作成しています · ${frames.length}枚 · PNG合計${(totalPngBytes/1e6).toFixed(1)}MB`;
    const zipWorker=new Worker(new URL("../image/mv_worker.js?v="+BUILD,location.href));
    zipWorker.onmessage=event=>{
      if(event.data.t===7){
        const blob=new Blob([event.data.b],{type:"application/zip"}),url=URL.createObjectURL(blob),link=document.createElement("a");
        link.href=url;link.download=`DDBBS_MV_${BUILD.replace("DDBBS-MV-","")}_${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)}.zip`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);zipWorker.terminate();
        status.textContent=`保存開始 · ${frames.length}枚 · PNG合計${(totalPngBytes/1e6).toFixed(1)}MB${budgetReached?" · 500MB上限":""}`;
        hint.textContent=`実測${actualFps.toFixed(1)}fps / 30fps読み込み · 平均${Math.round(avg)}byte/PNG · Build ${BUILD}`;
        frames=[];completed.clear();totalPngBytes=0;frameLog=[];startButton.disabled=false;
      }else if(event.data.t===8){status.textContent="ZIP作成エラー: "+event.data.e;zipWorker.terminate();startButton.disabled=false}
    };
    zipWorker.onerror=()=>{status.textContent="ZIP作成エラー";zipWorker.terminate();startButton.disabled=false};
    const transfer=Array.from(new Set(Object.values(files).map(value=>value.buffer)));
    zipWorker.postMessage({t:6,f:files},transfer);
  }
  function onKey(event){if(event.key==="Escape"&&recording)requestStop()}
  document.addEventListener("keydown",onKey);
  startButton.addEventListener("click",startCapture);
  stopButton.addEventListener("click",stopButtonAction);
  value.value=step+" px/コマ";
  status.textContent="スクロール量を選び、録画開始を押してください";
  hint.textContent="可逆フルカラーPNG · 1440×1080 · 500MB以内を確認";
})();
