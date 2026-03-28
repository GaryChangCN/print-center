import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, GripVertical, X } from 'lucide-react'
import { ACCEPTED_PRINT_TYPES } from '../../lib/constants'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({
  onFiles,
  files,
}: {
  onFiles: (files: File[]) => void
  files: File[]
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      onFiles([...files, ...accepted])
    }
  }, [onFiles, files])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_PRINT_TYPES,
    multiple: true,
  })

  const removeFile = (index: number) => {
    onFiles(files.filter((_, i) => i !== index))
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const newFiles = [...files]
    const [moved] = newFiles.splice(dragIndex, 1)
    newFiles.splice(targetIdx, 0, moved)
    onFiles(newFiles)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-2">
      {/* 拖拽上传区域 */}
      <div
        {...getRootProps()}
        className={`card border-2 border-dashed cursor-pointer transition-colors text-center py-8 min-h-[200px] lg:min-h-[300px] flex flex-col items-center justify-center
          ${isDragActive ? 'border-accent bg-accent/5' : 'border-paper-300 hover:border-accent/50'}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-7 h-7 mx-auto mb-2 text-ink-400" />
        <p className="font-medium text-ink-600 text-sm">
          {isDragActive ? '松手上传' : '点击或拖拽文件到此处'}
        </p>
        <p className="text-xs text-ink-400 mt-1">
          支持 PDF、图片、Word、Excel，可多选
        </p>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-ink-400 px-1">
            已选择 {files.length} 个文件（拖拽排序）
          </p>
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${file.size}-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`card flex items-center gap-2 py-2 px-3 cursor-grab active:cursor-grabbing transition-all
                ${dragIndex === idx ? 'opacity-40' : ''}
                ${dragOverIndex === idx && dragIndex !== idx ? 'border-accent border-t-2' : ''}`}
            >
              <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
              <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-700 truncate">{file.name}</p>
                <p className="text-xs text-ink-400">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                className="p-1 rounded hover:bg-red-50 text-ink-400 hover:text-red-500 shrink-0 transition-colors"
                title="移除"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
