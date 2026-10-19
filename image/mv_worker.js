self.window=self;
importScripts("mv_lib.js?v=DDBBS-MV-20261019-06");
let width=1440,height=1080,canvas=null,ctx=null;
async function encodePng(buffer){
  if(!canvas)throw new Error("PNGエンコーダーが初期化されていません");
  const bytes=buffer instanceof ArrayBuffer?new Uint8ClampedArray(buffer):new Uint8ClampedArray(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  const imageData=new ImageData(bytes,width,height);
  ctx.putImageData(imageData,0,0);
  const blob=await canvas.convertToBlob({type:"image/png"});
  return new Uint8Array(await blob.arrayBuffer());
}
self.onmessage=async event=>{
  const data=event.data;
  try{
    if(data.t===0){
      width=data.w;height=data.h;
      if(typeof OffscreenCanvas!=="function")throw new Error("OffscreenCanvas非対応です。PC版Chrome/Edgeをご利用ください。");
      canvas=new OffscreenCanvas(width,height);
      ctx=canvas.getContext("2d",{alpha:true,willReadFrequently:false});
      if(!ctx)throw new Error("Canvasを初期化できません");
      self.postMessage({t:1});
    }else if(data.t===3){
      const png=await encodePng(data.b);
      self.postMessage({t:4,i:data.i,b:png.buffer},[png.buffer]);
    }else if(data.t===6){
      const zip=fflate.zipSync(data.f,{level:0});
      self.postMessage({t:7,b:zip.buffer},[zip.buffer]);
    }
  }catch(error){
    self.postMessage({t:data.t===6?8:5,i:data.i,e:String(error&&error.message||error)});
  }
};
