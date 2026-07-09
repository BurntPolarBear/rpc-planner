// Browser-side photo helpers. Apple devices default to HEIC, which browsers can't
// draw to a canvas (and the AI grader needs JPEG/PNG), so HEIC is converted first.
// Then the image is downscaled to a compact JPEG to keep uploads and AI payloads small.

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

async function toDecodableBlob(file) {
  const isHeic = /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
  if (!isHeic) return file;
  // heic2any pulls in a large WASM decoder — load it only when a HEIC is picked.
  const heic2any = (await import('heic2any')).default;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

export async function fileToGradeImage(file, maxEdge = 1500, quality = 0.72) {
  const source = await toDecodableBlob(file);
  const dataUrl = await readAsDataURL(source);
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('decode failed'));
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL('image/jpeg', quality);
  return { media_type: 'image/jpeg', data: out.split(',')[1], preview: out };
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
