/** 应用亮度和对比度到 ImageData */
export function applyBrightnessContrast(
  imageData: ImageData,
  brightness: number, // -100 ~ 100
  contrast: number    // -100 ~ 100
): ImageData {
  const data = imageData.data
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c]
      // 亮度
      val += brightness * 2.55
      // 对比度
      val = factor * (val - 128) + 128
      data[i + c] = Math.max(0, Math.min(255, val))
    }
  }

  return imageData
}

/** 在 Canvas 上绘制图片并应用变换 */
export function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  rotation: number,  // 0, 90, 180, 270
  flipH: boolean,
  flipV: boolean,
  brightness: number,
  contrast: number,
) {
  const isRotated = rotation === 90 || rotation === 270
  const w = isRotated ? img.height : img.width
  const h = isRotated ? img.width : img.height

  canvas.width = w
  canvas.height = h

  ctx.clearRect(0, 0, w, h)
  ctx.save()

  // 移动到中心
  ctx.translate(w / 2, h / 2)

  // 旋转
  ctx.rotate((rotation * Math.PI) / 180)

  // 翻转
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)

  // 绘制
  ctx.drawImage(img, -img.width / 2, -img.height / 2)

  ctx.restore()

  // 亮度/对比度
  if (brightness !== 0 || contrast !== 0) {
    const imageData = ctx.getImageData(0, 0, w, h)
    applyBrightnessContrast(imageData, brightness, contrast)
    ctx.putImageData(imageData, 0, 0)
  }
}

/** 裁剪 Canvas 的指定区域到新 Canvas */
export function cropCanvas(
  sourceCanvas: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number }
): HTMLCanvasElement {
  const cropped = document.createElement('canvas')
  cropped.width = rect.w
  cropped.height = rect.h
  const ctx = cropped.getContext('2d')!
  ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return cropped
}

/** Canvas 导出为 Blob */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      },
      type,
      quality
    )
  })
}
