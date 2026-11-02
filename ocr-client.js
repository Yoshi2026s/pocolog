import { createWorker, PSM } from 'tesseract.js';

const assets = new URL('ocr-assets/', document.currentScript.src).href;
const aborted = () => new DOMException('読み取りを中止しました。', 'AbortError');
async function readImage(file, { signal, month, onProgress = () => {} } = {}) {
  if (!file || file.size > 20 * 1024 * 1024) throw Error('20MB以下の画像を選択してください。');
  if (file.type && !/^image\/(png|jpeg|webp|gif|bmp|avif|heic|heif)$/i.test(file.type)) throw Error('JPEG・PNGなどの画像ファイルを選択してください。');
  if (signal?.aborted) throw aborted();
  const objectUrl = URL.createObjectURL(file); let worker, stopped = false, rejectAbort;
  const cancellation = new Promise((_,reject) => { rejectAbort=reject; });
  const stop = () => { stopped = true; if (worker) worker.terminate().catch(() => {}); rejectAbort(aborted()); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const image = new Image(); image.src = objectUrl;
    await Promise.race([image.decode(),cancellation]).catch(() => { throw Error('画像を開けません。JPEG・PNG・WebPなどの画像を選択してください。'); });
    if (stopped) throw aborted();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60000000) throw Error('画像が大きすぎます。小さく保存した画像を選択してください。');
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longest < 1600 ? Math.min(2, 1600 / longest) : Math.min(1, 2600 / longest);
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
    onProgress({ status: '準備中', progress: 0 });
    const creation = createWorker(['jpn','eng'], 1, {
      workerPath: assets + 'worker.min.js', corePath: assets + 'core', langPath: assets + 'lang',
      cachePath: 'pocolog-ocr-v1', workerBlobURL: false,
      logger: event => { if (!stopped) onProgress(event); }
    });
    creation.then(value=>{if(stopped)value.terminate().catch(()=>{});}).catch(()=>{});
    worker=await Promise.race([creation,cancellation]);
    if (stopped) throw aborted();
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }),cancellation]);
    const recognize = () => Promise.race([worker.recognize(canvas, {}, { text: true, blocks: true }),cancellation]);
    let result = (await recognize()).data;
    if (stopped) throw aborted();
    if (month && globalThis.PocoImageImport.extract(result,month).entries.length === 0) {
      onProgress({status:'文字の配置を確認中',progress:0});
      await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }),cancellation]);
      const sparse = (await recognize()).data;
      if (globalThis.PocoImageImport.extract(sparse,month).entries.length || sparse.text.length > result.text.length) result=sparse;
    }
    if (stopped) throw aborted();
    return result;
  } catch (error) {
    if (stopped) throw aborted();
    throw error instanceof Error ? error : Error(String(error));
  } finally {
    signal?.removeEventListener('abort', stop); URL.revokeObjectURL(objectUrl);
    if (worker) await worker.terminate().catch(() => {});
  }
}
globalThis.PocoOcr = Object.freeze({ readImage });
