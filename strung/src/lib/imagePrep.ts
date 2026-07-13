// Client-side image preparation for AI identification.
//
// Phone photos are routinely 3–12MB. Base64 inflates them by ~4/3, and Vercel
// rejects request bodies over 4.5MB at the platform layer — before the API
// route ever runs — which is why raw camera uploads intermittently failed with
// opaque errors. Claude's vision also operates at a maximum long edge of
// ~1568px; anything larger is downscaled server-side anyway. Re-encoding to
// 1568px JPEG here loses nothing for identification, keeps payloads around
// 200–500KB, and converts any browser-decodable format (including HEIC on iOS)
// into a type the vision API accepts.

export const IDENTIFY_MAX_EDGE = 1568
export const IDENTIFY_JPEG_QUALITY = 0.85

export type PreparedImage = { imageData: string; mediaType: 'image/jpeg' }

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
    if (bitmap) return bitmap
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo — try a JPEG or PNG')) }
    img.src = url
  })
}

export async function prepareImageForIdentify(file: File): Promise<PreparedImage> {
  const source = await loadImage(file)
  try {
    const isElement = source instanceof HTMLImageElement
    const srcW = isElement ? source.naturalWidth : source.width
    const srcH = isElement ? source.naturalHeight : source.height
    if (!srcW || !srcH) throw new Error('Could not read that photo — try a different image')

    const scale = Math.min(1, IDENTIFY_MAX_EDGE / Math.max(srcW, srcH))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(srcW * scale))
    canvas.height = Math.max(1, Math.round(srcH * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported on this device')
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', IDENTIFY_JPEG_QUALITY)
    const imageData = dataUrl.split(',')[1]
    if (!imageData) throw new Error('Could not process that photo — try a different image')
    return { imageData, mediaType: 'image/jpeg' }
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close()
  }
}
