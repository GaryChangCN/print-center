import { useState, useCallback } from 'react'
import { FileText, Upload, Trash2, GripVertical, Download, Merge, Scissors, Crop } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { uploadFile, getFileUrl, pdfReorder, pdfDeletePages, pdfMerge, pdfSplit } from '../../lib/api'
import { EmptyState } from '../shared/EmptyState'

type PdfTool = 'reorder' | 'merge' | 'split'

interface PdfFile {
  id: string
  name: string
  pageCount?: number
}

export function PdfToolsTab() {
  const [tool, setTool] = useState<PdfTool>('reorder')
  const [files, setFiles] = useState<PdfFile[]>([])
  const [loading, setLoading] = useState(false)
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [splitRanges, setSplitRanges] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadingName, setUploadingName] = useState('')

  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} 不是 PDF 文件`)
        continue
      }
      try {
        setUploadingName(file.name)
        setUploadProgress(0)
        const uploaded = await uploadFile(file, (p) => setUploadProgress(p))
        setUploadProgress(null)
        setUploadingName('')
        // 获取页面数
        const res = await fetch(`/api/pdf/info/${uploaded.id}`)
        const info = await res.json()
        setFiles((prev) => [...prev, { id: uploaded.id, name: uploaded.name, pageCount: info.pageCount }])
        // 初始化页面顺序
        if (tool === 'reorder' && info.pageCount) {
          setPageOrder(Array.from({ length: info.pageCount }, (_, i) => i))
        }
        toast.success(`${file.name} 上传成功`)
      } catch (err) {
        setUploadProgress(null)
        setUploadingName('')
        toast.error(`上传失败: ${file.name}`)
      }
    }
  }, [tool])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: tool === 'merge',
  })

  // 拖拽排序
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const handleDragStart = (i: number) => setDragIndex(i)
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    if (tool === 'reorder') {
      setPageOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(i, 0, moved)
        return next
      })
    } else if (tool === 'merge') {
      setFiles((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(i, 0, moved)
        return next
      })
    }
    setDragIndex(i)
  }
  const handleDragEnd = () => setDragIndex(null)

  const handleReorder = async () => {
    if (!files[0]) return
    setLoading(true)
    try {
      const result = await pdfReorder(files[0].id, pageOrder)
      toast.success('重排完成')
      window.open(getFileUrl(result.fileId), '_blank')
    } catch (err) {
      toast.error('重排失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePage = async (pageIndex: number) => {
    if (!files[0]) return
    setLoading(true)
    try {
      const result = await pdfDeletePages(files[0].id, [pageIndex])
      setFiles([{ ...files[0], id: result.fileId, pageCount: (files[0].pageCount || 1) - 1 }])
      setPageOrder((prev) => prev.filter((p) => p !== pageIndex).map((p) => (p > pageIndex ? p - 1 : p)))
      toast.success('页面已删除')
    } catch (err) {
      toast.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('至少需要两个 PDF')
      return
    }
    setLoading(true)
    try {
      const result = await pdfMerge(files.map((f) => f.id))
      toast.success('合并完成')
      window.open(getFileUrl(result.fileId), '_blank')
    } catch (err) {
      toast.error('合并失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSplit = async () => {
    if (!files[0] || !splitRanges.trim()) return
    setLoading(true)
    try {
      const ranges = splitRanges.split(',').map((r) => r.trim())
      const result = await pdfSplit(files[0].id, ranges)
      toast.success(`拆分为 ${result.fileIds.length} 个文件`)
      result.fileIds.forEach((fid, i) => {
        window.open(getFileUrl(fid), '_blank')
      })
    } catch (err) {
      toast.error('拆分失败')
    } finally {
      setLoading(false)
    }
  }

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const reset = () => {
    setFiles([])
    setPageOrder([])
    setSplitRanges('')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        PDF 工具
      </h2>

      {/* 工具切换 */}
      <div className="flex gap-2">
        {([
          { id: 'reorder' as PdfTool, label: '排序/删除', icon: GripVertical },
          { id: 'merge' as PdfTool, label: '合并', icon: Merge },
          { id: 'split' as PdfTool, label: '拆分', icon: Scissors },
        ]).map((t) => (
          <button
            key={t.id}
            className={`btn flex-1 text-sm ${tool === t.id ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
            onClick={() => { setTool(t.id); reset() }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 上传区 */}
      {(files.length === 0 || (tool === 'merge' && files.length < 10)) && (
        <div
          {...getRootProps()}
          className={`card border-2 border-dashed cursor-pointer transition-colors text-center py-8
            ${isDragActive ? 'border-accent bg-accent/5' : 'border-paper-300 hover:border-accent/50'}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-2 text-ink-400" />
          <p className="text-sm text-ink-600">
            {tool === 'merge' ? '上传多个 PDF 文件' : '上传 PDF 文件'}
          </p>
        </div>
      )}

      {/* 上传进度 */}
      {uploadProgress !== null && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-600 truncate flex-1">{uploadingName || '上传中'}</span>
            <span className="text-ink-500 font-medium ml-2">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-paper-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 页面排序/删除 */}
      {tool === 'reorder' && files[0] && pageOrder.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-ink-700">
            {files[0].name} — {pageOrder.length} 页（拖拽排序）
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {pageOrder.map((pageIdx, i) => (
              <div
                key={`${pageIdx}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`relative bg-paper-50 border border-paper-200 rounded-lg p-3 text-center cursor-move
                  ${dragIndex === i ? 'opacity-50' : ''}`}
              >
                <div className="text-2xl font-light text-ink-300 mb-1">{pageIdx + 1}</div>
                <div className="text-xs text-ink-400">第 {pageIdx + 1} 页</div>
                <button
                  onClick={() => handleDeletePage(pageIdx)}
                  className="absolute top-1 right-1 text-ink-300 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={handleReorder} disabled={loading}>
            {loading ? '处理中...' : '应用排序并下载'}
          </button>
        </div>
      )}

      {/* 合并文件列表 */}
      {tool === 'merge' && files.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-ink-700">{files.length} 个文件（拖拽调整顺序）</h3>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-2 rounded-lg border border-paper-200 bg-paper-50 cursor-move
                  ${dragIndex === i ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
                <FileText className="w-5 h-5 text-accent shrink-0" />
                <span className="flex-1 text-sm truncate">{f.name}</span>
                {f.pageCount && <span className="text-xs text-ink-400">{f.pageCount} 页</span>}
                <button onClick={() => removeFile(i)} className="btn-icon text-ink-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={handleMerge} disabled={loading || files.length < 2}>
            <Merge className="w-4 h-4" />
            {loading ? '合并中...' : '合并并下载'}
          </button>
        </div>
      )}

      {/* 拆分设置 */}
      {tool === 'split' && files[0] && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-ink-700">
            {files[0].name} — {files[0].pageCount || '?'} 页
          </h3>
          <div>
            <label className="label">拆分范围（逗号分隔，如 0-2, 3-5）</label>
            <input
              className="input"
              placeholder="0-2, 3-5"
              value={splitRanges}
              onChange={(e) => setSplitRanges(e.target.value)}
            />
            <p className="text-xs text-ink-400 mt-1">页码从 0 开始</p>
          </div>
          <button className="btn-primary w-full" onClick={handleSplit} disabled={loading || !splitRanges.trim()}>
            <Scissors className="w-4 h-4" />
            {loading ? '拆分中...' : '拆分并下载'}
          </button>
        </div>
      )}
    </div>
  )
}
