import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText } from 'lucide-react'
import { ACCEPTED_PRINT_TYPES } from '../../lib/constants'

export function FileDropzone({
  onFile,
  file,
}: {
  onFile: (file: File) => void
  file: File | null
}) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_PRINT_TYPES,
    maxFiles: 1,
    multiple: false,
  })

  if (file) {
    return (
      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink-800 truncate">{file.name}</p>
          <p className="text-xs text-ink-400">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFile(null as unknown as File) }}
          className="text-xs text-ink-400 hover:text-red-500 shrink-0"
        >
          更换
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`card border-2 border-dashed cursor-pointer transition-colors text-center py-10
        ${isDragActive ? 'border-accent bg-accent/5' : 'border-paper-300 hover:border-accent/50'}`}
    >
      <input {...getInputProps()} />
      <Upload className="w-8 h-8 mx-auto mb-3 text-ink-400" />
      <p className="font-medium text-ink-600">
        {isDragActive ? '松手上传' : '点击或拖拽文件到此处'}
      </p>
      <p className="text-xs text-ink-400 mt-1">
        支持 PDF、图片、Word、Excel
      </p>
    </div>
  )
}
