(()=>{
  const stage=document.getElementById("c60"),content=stage.querySelector(".c12"),panel=document.getElementById("c61");
  const slider=document.getElementById("c62"),value=document.getElementById("c63"),startButton=document.getElementById("c64"),stopButton=document.getElementById("c65");
  const status=document.getElementById("c66"),hint=document.getElementById("c67"),scrollBox=document.getElementById("c39"),feed=document.getElementById("c34");
  const W=1440,H=1080,OUTPUT_FPS=30,MAX_PNG_BYTES=500000000,BUILD="DDBBS-MV-20261019-07";
  let step=20,recording=false,initializing=false,phaseOutput=0,stageScale=1,stageWidth=0,frames=0,totalPngBytes=0,startTime=0;

  function resizeStage(){
    const usableW=Math.max(1,Math.min(innerHeight*4/3,innerWidth-panel.offsetWidth-15));
    const maxK=Math.min(.85*usableW/(W/2),.924*(usableW*.75)/587);
    const target=(step%10===0?1.2:1)/Math.max(.01,window.devicePixelRatio||1);
    let k=target;
    if(k>maxK){const grid=Math.floor(step*(window.devicePixelRatio||1)*maxK+1e-8);k=grid>0?grid/(step*(window.devicePixelRatio||1)):maxK}
    stageScale=k;stageWidth=(W/2)*k/.85;
    stage.style.setProperty("--w",stageWidth+"px");content.style.setProperty("--k",String(k));
  }
  resizeStage();
  new ResizeObserver(resizeStage).observe(stage);
  window.addEventListener("resize",resizeStage);
  slider.addEventListener("input",()=>{step=Number(slider.value);value.value=step+" px/コマ";resizeStage()});

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
  function setStatus(message){status.textContent=message}
  function setProgress(info){
    frames=Number(info.frames)||0;totalPngBytes=Number(info.bytes)||0;
    const fps=Number(info.fps)||0;
    status.textContent=`直接スクリーンショット録画中 · ${frames}枚 · PNG合計${(totalPngBytes/1e6).toFixed(1)}MB · ${fps.toFixed(1)}fps`;
    const projected=frames?totalPngBytes/frames*4500:0;
    hint.textContent=`4,500枚換算 約${(projected/1e6).toFixed(0)}MB / 上限500MB · 30fps連番 · ${step}px/コマ`;
  }
  async function beginCapture(){
    if(recording)throw new Error("録画中です");
    const k=parseFloat(getComputedStyle(content).getPropertyValue("--k"))||1;
    const box=stage.getBoundingClientRect();
    const outPerCss=k*W/Math.max(1,box.width);
    const startScrollTop=scrollBox.scrollTop;
    phaseOutput=Math.round(startScrollTop*outPerCss-textTransformY()*outPerCss);
    scrollOneStep();
    await nextPaint();
    recording=true;initializing=false;frames=0;totalPngBytes=0;startTime=performance.now();
    startButton.disabled=true;stopButton.disabled=false;
    status.textContent=`直接スクリーンショット録画中 · ${step}px/コマ · 30fps連番`;
    hint.textContent=`現在位置を保持し、1ステップ進んだ状態をframe_000000.pngに記録 · 可逆PNG`;
    return {step,startScrollTop,firstFrameScrollTop:scrollBox.scrollTop,stageWidth:box.width,stageHeight:box.height};
  }
  function advanceCapture(){
    if(!recording)return {scrollTop:scrollBox.scrollTop,step};
    scrollOneStep();
    return {scrollTop:scrollBox.scrollTop,step};
  }
  function updateCapture(info){
    if(!recording)return;
    setProgress(info);
  }
  function captureAndAdvance(){
    const box=stage.getBoundingClientRect();
    const info={x:box.x,y:box.y,width:box.width,height:box.height,step,scrollTop:scrollBox.scrollTop};
    if(recording){scrollOneStep();info.nextScrollTop=scrollBox.scrollTop}
    else info.nextScrollTop=scrollBox.scrollTop;
    return info;
  }
  function finishCapture(info){
    recording=false;initializing=false;startButton.disabled=false;stopButton.disabled=true;
    frames=Number(info.frames)||frames;totalPngBytes=Number(info.bytes)||totalPngBytes;
    const avg=frames?Math.round(totalPngBytes/frames):0;
    status.textContent=info.error?`撮影停止 · ${info.error}`:`保存完了 · ${frames}枚 · PNG合計${(totalPngBytes/1e6).toFixed(1)}MB${info.budgetReached?" · 500MB上限":""}`;
    hint.textContent=info.path?`${info.path} · 平均${avg}byte/PNG · 1440×1080 · ${BUILD}`:`平均${avg}byte/PNG · 1440×1080 · ${BUILD}`;
  }
  function requestStart(){
    if(initializing||recording)return;
    if(typeof window.__mvHostStart!=="function"){
      setStatus("直接撮影ヘルパーからこのページを開いてください");
      hint.textContent="getDisplayMediaの動画経由撮影は無効です。capture_helper.pyを起動してください。";
      return;
    }
    initializing=true;startButton.disabled=true;stopButton.disabled=true;
    setStatus("直接撮影ヘルパーに接続しています…");
    Promise.resolve(window.__mvHostStart({step,build:BUILD,outputWidth:W,outputHeight:H,fps:OUTPUT_FPS,maxPngBytes:MAX_PNG_BYTES}))
      .then(result=>{if(!result||result.accepted!==true)throw new Error(result&&result.error||"ヘルパーが録画を開始できませんでした")})
      .catch(error=>{initializing=false;startButton.disabled=false;stopButton.disabled=true;setStatus(String(error&&error.message||error))});
  }
  function requestStop(){
    if(!recording&&!initializing)return;
    if(typeof window.__mvHostStop==="function")window.__mvHostStop();
  }
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&(recording||initializing))requestStop()});
  startButton.addEventListener("click",requestStart);
  stopButton.addEventListener("click",requestStop);
  window.__mvDirectCapture={begin:beginCapture,advance:advanceCapture,captureAndAdvance,update:updateCapture,finish:finishCapture,getStep:()=>step,getFrameCount:()=>frames};
  value.value=step+" px/コマ";
  stopButton.disabled=true;
  if(typeof window.__mvHostStart==="function"){
    status.textContent="直接スクリーンショットヘルパー接続済み · 録画開始できます";
    hint.textContent="現在位置を保持 · 1ステップ後に最初のPNG · 1440×1080 · 30fps連番";
  }else{
    status.textContent="直接撮影ヘルパーからこのページを開いてください";
    hint.textContent="ChromeスクリーンショットAPIを使います。getDisplayMedia動画経由撮影は無効です。";
  }
})();
