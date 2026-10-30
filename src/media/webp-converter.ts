/**
 * src/media/webp-converter.ts
 * Conversor WebP Client-Side Sem Perda Visual + Deduplicação SHA-256
 */

export interface WebpConvertResult {
  fullDataUrl: string;
  thumbnailDataUrl: string;
  sha256Hex: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function loadImageElement(source: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Falha ao carregar imagem no navegador: ' + e));
    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Converte qualquer imagem ou blob para WebP com fundo branco (#FFFFFF),
 * gerando versão full (max 1600px, quality 0.96) e thumbnail (max 400px, quality 0.85).
 */
export async function convertBlobToStudioWebp(blob: Blob): Promise<WebpConvertResult> {
  const img = await loadImageElement(blob);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // 1. Render Full High-Res com fundo branco puro
  const maxDimFull = 1600;
  let fullW = origW;
  let fullH = origH;
  if (Math.max(fullW, fullH) > maxDimFull) {
    const scale = maxDimFull / Math.max(fullW, fullH);
    fullW = Math.round(fullW * scale);
    fullH = Math.round(fullH * scale);
  }

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = fullW;
  fullCanvas.height = fullH;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

  // Preenche fundo branco puro
  fullCtx.fillStyle = '#FFFFFF';
  fullCtx.fillRect(0, 0, fullW, fullH);
  fullCtx.drawImage(img, 0, 0, fullW, fullH);

  const fullDataUrl = fullCanvas.toDataURL('image/webp', 0.96);

  // 2. Render Thumbnail
  const maxDimThumb = 400;
  let thumbW = origW;
  let thumbH = origH;
  if (Math.max(thumbW, thumbH) > maxDimThumb) {
    const scale = maxDimThumb / Math.max(thumbW, thumbH);
    thumbW = Math.round(thumbW * scale);
    thumbH = Math.round(thumbH * scale);
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

  thumbCtx.fillStyle = '#FFFFFF';
  thumbCtx.fillRect(0, 0, thumbW, thumbH);
  thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);

  const thumbnailDataUrl = thumbCanvas.toDataURL('image/webp', 0.85);

  // 3. Obter bytes e calcular SHA-256
  const arrayBuffer = await blob.arrayBuffer();
  const sha256Hex = await computeSha256(arrayBuffer);

  return {
    fullDataUrl,
    thumbnailDataUrl,
    sha256Hex,
    width: fullW,
    height: fullH,
    sizeBytes: Math.round(fullDataUrl.length * 0.75),
  };
}

/**
 * Captura imagem da área de transferência (Ctrl+V) ou arquivo do input
 */
export async function extractImageFromClipboardEvent(event: ClipboardEvent): Promise<Blob | null> {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) return blob;
    }
  }
  return null;
}
