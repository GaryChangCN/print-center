import { useState, useRef, useEffect, useCallback } from 'react'
import {
  RotateCw, FlipHorizontal, FlipVertical, Crop, Sun, Contrast,
  Save, X, RotateCcw, Check
} from 'lucide-react'
import { drawTransformedImage, cropCanvas, canvasToBlob } from '../../lib/canvas-utils'

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export function ImageEditor({
  imageUrl,
  onSave,
  onCancel,
}: {
  imageUrl: string
  onSave: (blob: Blob) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [cropping, setCropping] = useState(false)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [saving, setSaving] = useState(false)

  // 拖拽裁剪状态
  const dragState = useRef<{ startX: number; startY: number; dragging: boolean }>({
    startX: 0, startY: 0, dragging: false,
  })

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    drawTransformedImage(ctx, img, canvas, rotation, flipH, flipV, brightness, contrast)
  }, [rotation, flipH, flipV, brightness, contrast])

  // 加载图片
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      redraw()
    }
    img.src = imageUrl
  }, [imageUrl])

  // 重绘
  useEffect(() => {
    if (imgRef.current) redraw()
  }, [redraw])

  // 绘制裁剪覆盖层
  useEffect(() => {
    const overlay = overlayRef.current
    const canvas = canvasRef.current
    if (!overlay || !canvas) return

    overlay.width = canvas.width
    overlay.height = canvas.height
    const ctx = overlay.getContext('2d')!
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    if (cropping && cropRect) {
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, overlay.width, overlay.height)
      // 清除裁剪区域
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      // 裁剪框边框
      ctx.strokeStyle = '#c45d3e'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
    }
  }, [cropping, cropRect])

  // 裁剪拖拽处理
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const overlay = overlayRef.current
    if (!overlay) return { x: 0, y: 0 }
    const rect = overlay.getBoundingClientRect()
    const scaleX = overlay.width / rect.width
    const scaleY = overlay.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cropping) return
    const { x, y } = getCanvasCoords(e)
    dragState.current = { startX: x, startY: y, dragging: true }
    setCropRect({ x, y, w: 0, h: 0 })
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.current.dragging) return
    const { x, y } = getCanvasCoords(e)
    const { startX, startY } = dragState.current
    setCropRect({
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    })
  }

  const handlePointerUp = () => {
    dragState.current.dragging = false
  }

  const applyCrop = async () => {
    if (!cropRect || !canvasRef.current) return
    const cropped = cropCanvas(canvasRef.current, cropRect)
    // 用裁剪结果替换原图
    const blob = await canvasToBlob(cropped)
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setRotation(0)
      setFlipH(false)
      setFlipV(false)
      setBrightness(0)
      setContrast(0)
      setCropping(false)
      setCropRect(null)
      redraw()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const handleSave = async () => {
    if (!canvasRef.current) return
    setSaving(true)
    try {
      const blob = await canvasToBlob(canvasRef.current)
      onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/95 flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-ink-800">
        <button onClick={onCancel} className="text-white flex items-center gap-1.5 text-sm">
          <X className="w-5 h-5" />
          取消
        </button>
        <h3 className="text-white font-semibold">图片编辑</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-accent flex items-center gap-1.5 text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* Canvas 区域 */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div className="relative inline-block max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[60vh] object-contain"
          />
          {cropping && (
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-ink-800 px-4 py-3 space-y-3">
        {/* 裁剪模式工具 */}
        {cropping && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => { setCropping(false); setCropRect(null) }}
              className="text-white/70 text-sm flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              取消裁剪
            </button>
            {cropRect && cropRect.w > 10 && cropRect.h > 10 && (
              <button
                onClick={applyCrop}
                className="text-accent text-sm flex items-center gap-1 font-medium"
              >
                <Check className="w-4 h-4" />
                应用裁剪
              </button>
            )}
          </div>
        )}

        {/* 主工具栏 */}
        {!cropping && (
          <>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setCropping(true)}
                className="text-white/80 flex flex-col items-center gap-1 text-xs"
              >
                <Crop className="w-5 h-5" />
                裁剪
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="text-white/80 flex flex-col items-center gap-1 text-xs"
              >
                <RotateCw className="w-5 h-5" />
                顺时针
              </button>
              <button
                onClick={() => setRotation((r) => (r + 270) % 360)}
                className="text-white/80 flex flex-col items-center gap-1 text-xs"
              >
                <RotateCcw className="w-5 h-5" />
                逆时针
              </button>
              <button
                onClick={() => setFlipH((f) => !f)}
                className={`flex flex-col items-center gap-1 text-xs ${flipH ? 'text-accent' : 'text-white/80'}`}
              >
                <FlipHorizontal className="w-5 h-5" />
                水平翻转
              </button>
              <button
                onClick={() => setFlipV((f) => !f)}
                className={`flex flex-col items-center gap-1 text-xs ${flipV ? 'text-accent' : 'text-white/80'}`}
              >
                <FlipVertical className="w-5 h-5" />
                垂直翻转
              </button>
            </div>

            {/* 亮度/对比度 */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-white/60 shrink-0" />
                <span className="text-xs text-white/60 w-8 shrink-0">亮度</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-white/60 w-8 text-right">{brightness}</span>
              </div>
              <div className="flex items-center gap-3">
                <Contrast className="w-4 h-4 text-white/60 shrink-0" />
                <span className="text-xs text-white/60 w-8 shrink-0">对比</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-white/60 w-8 text-right">{contrast}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
