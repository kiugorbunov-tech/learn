// Local Piper neural speech. Text never leaves this worker.
importScripts('vendor/neural/ort.wasm.min.js', 'vendor/neural/piper.js');
ort.env.wasm.numThreads = 1; // Safari / GitHub Pages: no SharedArrayBuffer required.
ort.env.wasm.wasmPaths = new URL('vendor/neural/', self.location.href).href;

let loading, session, phonemizer, config, phonemeIds;
function progress(message) { self.postMessage({type:'progress', message}); }
async function load() {
  if (loading) return loading;
  loading = (async () => {
    progress('Загружаю естественный голос…');
    const configResponse = await fetch('vendor/neural/voice.json');
    if (!configResponse.ok) throw Error('voice-config');
    config = await configResponse.json();
    const response = await fetch('vendor/neural/voice.onnx');
    if (!response.ok) throw Error('voice-download');
    const total = Number(response.headers.get('Content-Length'));
    const reader = response.body.getReader(), chunks = [];
    let received = 0, lastProgress = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      chunks.push(value); received += value.byteLength;
      if (received - lastProgress > 1048576) {
        lastProgress = received;
        progress(total ? `Загружаю голос: ${Math.round(received/total*100)}%` : `Загружаю голос: ${Math.round(received/1048576)} МБ`);
      }
    }
    let model = new Uint8Array(received), offset = 0;
    for (const chunk of chunks) { model.set(chunk, offset); offset += chunk.byteLength; }
    chunks.length = 0;
    progress('Подготавливаю голос…');
    session = await ort.InferenceSession.create(model, {executionProviders:['wasm'], graphOptimizationLevel:'all'});
    model = null;
    phonemizer = await createPiperPhonemize({
      noInitialRun:true,
      print: data => { const result=JSON.parse(data); if(result.phoneme_ids) phonemeIds=result.phoneme_ids; },
      printErr: message => console.warn(message),
      locateFile: name => new URL('vendor/neural/'+name, self.location.href).href
    });
  })();
  return loading;
}
function wav(pcm, sampleRate) {
  const buffer = new ArrayBuffer(44+pcm.length*2), v = new DataView(buffer);
  v.setUint32(0,0x46464952,true); v.setUint32(4,buffer.byteLength-8,true); v.setUint32(8,0x45564157,true);
  v.setUint32(12,0x20746d66,true); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sampleRate,true); v.setUint32(28,sampleRate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  v.setUint32(36,0x61746164,true); v.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++) { const value=Math.max(-1,Math.min(1,pcm[i])); v.setInt16(44+i*2,value<0?value*32768:value*32767,true); }
  return buffer;
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.then(async () => {
    try {
      await load(); progress('Готовлю озвучивание…'); phonemeIds = null;
      phonemizer.callMain(['-l',config.espeak.voice,'--input',JSON.stringify([{text:data.text}]),'--espeak_data','/espeak-ng-data']);
      if (!phonemeIds?.length) throw Error('phonemes-empty');
      const feeds = {
        input:new ort.Tensor('int64',BigInt64Array.from(phonemeIds.map(BigInt)),[1,phonemeIds.length]),
        input_lengths:new ort.Tensor('int64',BigInt64Array.from([BigInt(phonemeIds.length)]),[1]),
        scales:new ort.Tensor('float32',Float32Array.from([config.inference.noise_scale,config.inference.length_scale,config.inference.noise_w]),[3])
      };
      const output = await session.run(feeds);
      const buffer = wav(output.output.data,config.audio.sample_rate);
      for (const tensor of [...Object.values(feeds),...Object.values(output)]) tensor.dispose?.();
      self.postMessage({type:'result',id:data.id,buffer},[buffer]);
    } catch (e) { self.postMessage({type:'error',id:data.id,message:e.message || 'voice-failed'}); }
  });
};
