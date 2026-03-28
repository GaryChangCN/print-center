import { useState } from 'react'
import { ScanLine, Download, Merge, Trash2, GripVertical, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { PAPER_SIZES, DPI_OPTIONS, COLOR_MODES, SCAN_FORMATS } from '../../lib/constants'
import { startScan, mergeScanPages, getFileUrl, saveEditedFile } from '../../lib/api'
import { ImageEditor } from '../editor/ImageEditor'

interface ScannedPage {
  fileId: string
  jobId: string
}

export function ScanTab() {
  const [dpi, setDpi] = useState(300)
  const [colorMode, setColorMode] = useState('gray')
  const [paperSize, setPaperSize] = useState('A4')
  const [format, setFormat] = useState('jpeg')
  const [scanning, setScanning] = useState(false)
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [lastScan, setLastScan] = useState<ScannedPage | null>(null)
  const [merging, setMerging] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)

  const handleScan = async () => {
    // 先检查设备是否繁忙
    try {
      const statusRes = await fetch('/api/scan/status')
      const statusData = await statusRes.json()
      if (statusData.busy) {
        toast.error('扫描设备正忙，请稍后再试')
        return
      }
    } catch { /* 忽略检查失败，继续扫描 */ }

    setScanning(true)
    try {
      const result = await startScan({ dpi, colorMode, paperSize, format })
      const page = { fileId: result.fileId, jobId: result.jobId }

      if (mode === 'multi') {
        setPages((prev) => [...prev, page])
      } else {
        setLastScan(page)
      }
      toast.success('扫描完成')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const handleMerge = async () => {
    if (pages.length < 2) {
      toast.error('至少需要两页')
      return
    }
    setMerging(true)
    try {
      const result = await mergeScanPages(pages.map((p) => p.fileId))
      toast.success('合并完成')
      window.open(getFileUrl(result.fileId), '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '合并失败')
    } finally {
      setMerging(false)
    }
  }

  const handleEditorSave = async (blob: Blob) => {
    if (!editingFileId) return
    try {
      await saveEditedFile(editingFileId, blob)
      toast.success('编辑已保存')
      setEditingFileId(null)
      // 强制刷新图片（加时间戳破缓存）
      if (lastScan && lastScan.fileId === editingFileId) {
        setLastScan({ ...lastScan, jobId: lastScan.jobId + '_edited' })
      }
    } catch (err) {
      toast.error('保存失败')
    }
  }

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index))
  }

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const handleDragStart = (index: number) => setDragIndex(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setPages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(index)
  }
  const handleDragEnd = () => setDragIndex(null)

  // 图片编辑器（全屏覆盖）
  if (editingFileId) {
    return (
      <ImageEditor
        imageUrl={getFileUrl(editingFileId)}
        onSave={handleEditorSave}
        onCancel={() => setEditingFileId(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <ScanLine className="w-5 h-5" />
        扫描
      </h2>

      {/* 模式切换 */}
      <div className="flex gap-2">
        <button
          className={`btn flex-1 ${mode === 'single' ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
          onClick={() => setMode('single')}
        >
          单页扫描
        </button>
        <button
          className={`btn flex-1 ${mode === 'multi' ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
          onClick={() => setMode('multi')}
        >
          多页合并
        </button>
      </div>

      {/* 扫描设置 */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-ink-700">扫描设置</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">分辨率</label>
            <select className="select" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              {DPI_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">色彩</label>
            <select className="select" value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
              {COLOR_MODES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">纸张</label>
            <select className="select" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
              {PAPER_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">格式</label>
            <select className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
              {SCAN_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 扫描按钮 */}
      <button className="btn-primary w-full" onClick={handleScan} disabled={scanning}>
        <ScanLine className="w-4 h-4" />
        {scanning ? '扫描中...' : mode === 'multi' ? '添加一页' : '开始扫描'}
      </button>

      {/* 单页结果 */}
      {mode === 'single' && lastScan && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-ink-700">扫描结果</h3>
          <img
            src={getFileUrl(lastScan.fileId) + `?t=${Date.now()}`}
            alt="扫描结果"
            className="w-full rounded-lg border border-paper-200"
          />
          <div className="flex gap-2">
            <button
              className="btn-secondary flex-1"
              onClick={() => setEditingFileId(lastScan.fileId)}
            >
              <Pencil className="w-4 h-4" />
              编辑
            </button>
            <a
              href={getFileUrl(lastScan.fileId)}
              download
              className="btn-primary flex-1"
            >
              <Download className="w-4 h-4" />
              下载
            </a>
          </div>
        </div>
      )}

      {/* 多页列表 */}
      {mode === 'multi' && pages.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-ink-700">已扫描 {pages.length} 页（拖拽排序）</h3>
          <div className="space-y-2">
            {pages.map((page, i) => (
              <div
                key={page.jobId}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-2 rounded-lg border border-paper-200 bg-paper-50 cursor-move
                  ${dragIndex === i ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
                <img
                  src={getFileUrl(page.fileId)}
                  alt={`第 ${i + 1} 页`}
                  className="w-12 h-16 object-cover rounded border border-paper-200"
                />
                <span className="flex-1 text-sm text-ink-600">第 {i + 1} 页</span>
                <button
                  onClick={() => setEditingFileId(page.fileId)}
                  className="btn-icon text-ink-400 hover:text-accent"
                  title="编辑"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => removePage(i)} className="btn-icon text-ink-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={handleMerge} disabled={merging}>
            <Merge className="w-4 h-4" />
            {merging ? '合并中...' : '合并为 PDF'}
          </button>
        </div>
      )}
    </div>
  )
}
