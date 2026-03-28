import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

interface Props {
  file: File
}

export function PdfPreview({ file }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)

    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (cancelled) return
      setPdf(doc)
      setTotal(doc.numPages)
      setPage(1)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false

    pdf.getPage(page).then((p) => {
      if (cancelled) return
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      const viewport = p.getViewport({ scale: scale * 1.5 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      p.render({ canvasContext: ctx, viewport })
    })

    return () => { cancelled = true }
  }, [pdf, page, scale])

  if (loading) {
    return <div className="card text-center py-8 text-ink-400 text-sm">加载预览...</div>
  }

  if (!pdf) return null

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-paper-200 disabled:opacity-30"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-ink-600 min-w-[4rem] text-center">
            {page} / {total}
          </span>
          <button
            className="p-1 rounded hover:bg-paper-200 disabled:opacity-30"
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page >= total}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-paper-200 disabled:opacity-30"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-ink-500 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="p-1 rounded hover:bg-paper-200 disabled:opacity-30"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            disabled={scale >= 3}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="overflow-auto max-h-[60vh] bg-paper-100 rounded-lg flex justify-center p-2">
        <canvas ref={canvasRef} className="shadow-sm" />
      </div>
    </div>
  )
}
