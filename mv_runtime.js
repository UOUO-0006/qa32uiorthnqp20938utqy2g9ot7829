(()=>{
  const stage=document.getElementById("c60"),content=stage.querySelector(".c12"),panel=document.getElementById("c61");
  const slider=document.getElementById("c62"),value=document.getElementById("c63"),startButton=document.getElementById("c64"),stopButton=document.getElementById("c65");
  const status=document.getElementById("c66"),hint=document.getElementById("c67"),scrollBox=document.getElementById("c39"),feed=document.getElementById("c34");
  const W=1440,H=1080,OUTPUT_FPS=30,MAX_PNG_BYTES=500000000,BUILD="DDBBS-MV-20261019-07";
  let step=20,recording=false,initializing=false,phaseOutput=0,stageScale=1,stageWidth=0,frames=0,totalPngBytes=0,startTime=0;

  // Runtime-only virtual scroll support: keep the page script's 30-row cleanup,
  // but preserve its removed height as an invisible prefix during capture.
  const historySpacer=document.createElement("div"),triggerSpacer=document.createElement("div");
  for(const spacer of [historySpacer,triggerSpacer]){
    spacer.setAttribute("aria-hidden","true");
    Object.assign(spacer.style,{height:"0px",width:"1px",visibility:"hidden",pointerEvents:"none"});
  }
  feed.parentNode.insertBefore(historySpacer,feed);
  scrollBox.appendChild(triggerSpacer);
  const rowHeights=new WeakMap();
  let virtualScrollActive=false,historyHeight=0,triggerHeight=0,desiredScrollTop=0;
  const originalOverflowAnchor=scrollBox.style.overflowAnchor;
  function cacheRowHeight(node){
    if(!node||node.nodeType!==1||!node.classList.contains("c33"))return 0;
    const h=node.offsetHeight;
    if(h>0)rowHeights.set(node,h);
    return rowHeights.get(node)||0;
  }
  Array.from(feed.children).forEach(cacheRowHeight);
  function ensureScrollCapacity(target){
    let max=scrollBox.scrollHeight-scrollBox.clientHeight;
    if(target>max){
      triggerHeight+=Math.ceil(target-max)+1;
      triggerSpacer.style.height=triggerHeight+"px";
      max=scrollBox.scrollHeight-scrollBox.clientHeight;
      if(target>max){
        triggerHeight+=Math.ceil(target-max)+1;
        triggerSpacer.style.height=triggerHeight+"px";
      }
    }
  }
  const feedObserver=new MutationObserver(records=>{
    let removedHeight=0,added=false;
    for(const record of records){
      for(const node of record.addedNodes){if(node.nodeType===1&&node.classList.contains("c33")){cacheRowHeight(node);added=true}}
      for(const node of record.removedNodes){if(node.nodeType===1&&node.classList.contains("c33"))removedHeight+=rowHeights.get(node)||0}
    }
    if(!virtualScrollActive)return;
    if(removedHeight>0){
      historyHeight+=removedHeight;
      historySpacer.style.height=historyHeight+"px";
    }
    if(added){
      triggerHeight=0;
      triggerSpacer.style.height="0px";
    }
    if(removedHeight>0||added){
      ensureScrollCapacity(desiredScrollTop);
      scrollBox.scrollTop=desiredScrollTop;
      const box=stage.getBoundingClientRect();
      const k=parseFloat(getComputedStyle(content).getPropertyValue("--k"))||1;
      const outPerCss=k*W/Math.max(1,box.width);
      feed.style.transform=`translateY(${(scrollBox.scrollTop*outPerCss-phaseOutput)/outPerCss}px)`;
    }
  });
  feedObserver.observe(feed,{childList:true});
  function startVirtualScroll(){
    historyHeight=0;triggerHeight=0;desiredScrollTop=scrollBox.scrollTop;
    historySpacer.style.height="0px";triggerSpacer.style.height="0px";
    scrollBox.style.overflowAnchor="none";
    virtualScrollActive=true;
  }
  function stopVirtualScroll(){
    if(!virtualScrollActive)return;
    const restoredTop=Math.max(0,scrollBox.scrollTop-historyHeight);
    virtualScrollActive=false;
    historySpacer.style.height="0px";triggerSpacer.style.height="0px";
    historyHeight=0;triggerHeight=0;
    scrollBox.style.overflowAnchor=originalOverflowAnchor;
    scrollBox.scrollTop=restoredTop;
    desiredScrollTop=scrollBox.scrollTop;
  }

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
    if(!virtualScrollActive&&Math.abs(actualOffset-phaseOutput)>outPerCss/2+.01)phaseOutput=Math.round(actualOffset);
    const outputStep=Math.max(1,Math.round(step*outPerCss));
    const nextPhase=phaseOutput+outputStep;
    const targetScroll=Math.round(nextPhase/outPerCss);
    if(virtualScrollActive){desiredScrollTop=targetScroll;ensureScrollCapacity(targetScroll)}
    scrollBox.scrollTop=targetScroll;
    phaseOutput=nextPhase;
    if(virtualScrollActive&&scrollBox.scrollTop!==targetScroll){
      triggerHeight+=Math.ceil(targetScroll-scrollBox.scrollTop)+1;
      triggerSpacer.style.height=triggerHeight+"px";
      scrollBox.scrollTop=targetScroll;
    }
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
    startVirtualScroll();
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
    recording=false;initializing=false;stopVirtualScroll();startButton.disabled=false;stopButton.disabled=true;
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
