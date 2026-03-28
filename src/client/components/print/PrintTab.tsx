import { useState } from 'react'
import { Printer, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { FileDropzone } from './FileDropzone'
import { PrintOptions } from './PrintOptions'
import { PrinterStatus } from './PrinterStatus'
import { StatusBadge } from '../shared/StatusBadge'
import type { PrintOptions as PrintOptionsType } from '../../lib/types'
import { uploadFile, submitPrint, getPrintStatus } from '../../lib/api'
import { PdfPreview } from '../shared/PdfPreview'

export function PrintTab() {
  const [file, setFile] = useState<File | null>(null)
  const [options, setOptions] = useState<PrintOptionsType>({
    copies: 1,
    paperSize: 'A4',
    orientation: 'portrait',
    pageRange: '',
    duplex: 'off',
  })
  const [loading, setLoading] = useState(false)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [stage, setStage] = useState<string>('')

  const handlePrint = async () => {
    if (!file) {
      toast.error('请先选择文件')
      return
    }

    setLoading(true)
    setJobStatus(null)
    setUploadProgress(0)
    setStage('uploading')

    try {
      // 1. 上传文件
      const uploaded = await uploadFile(file, (p) => setUploadProgress(p))
      setUploadProgress(null)
      setStage('submitting')

      // 2. 提交打印
      const { jobId } = await submitPrint(uploaded.id, {
        copies: options.copies,
        paperSize: options.paperSize,
        orientation: options.orientation,
        pageRange: options.pageRange || undefined,
        duplex: options.duplex,
      })

      setStage('printing')
      setJobStatus('queued')

      // 3. 轮询状态
      const poll = setInterval(async () => {
        try {
          const { status } = await getPrintStatus(jobId)
          setJobStatus(status)
          if (status === 'completed') {
            clearInterval(poll)
            toast.success('打印完成')
            setLoading(false)
            setStage('')
          } else if (status === 'failed') {
            clearInterval(poll)
            toast.error('打印失败')
            setLoading(false)
            setStage('')
          }
        } catch {
          clearInterval(poll)
          setLoading(false)
          setStage('')
        }
      }, 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '打印失败')
      setLoading(false)
      setUploadProgress(null)
      setStage('')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <Printer className="w-5 h-5" />
        打印
      </h2>

      <PrinterStatus />

      <FileDropzone file={file} onFile={setFile} />

      {file && (
        <>
          {file.type === 'application/pdf' && <PdfPreview file={file} />}
          {file.type.startsWith('image/') && (
            <div className="card overflow-auto max-h-[60vh] bg-paper-100 rounded-lg flex justify-center p-2">
              <img
                src={URL.createObjectURL(file)}
                alt="预览"
                className="max-w-full shadow-sm"
              />
            </div>
          )}

          <PrintOptions options={options} onChange={setOptions} />

          <button
            className="btn-primary w-full"
            onClick={handlePrint}
            disabled={loading}
          >
            <Send className="w-4 h-4" />
            {loading
              ? stage === 'uploading' ? '上传中...'
              : stage === 'submitting' ? '提交中...'
              : '打印中...'
              : '开始打印'}
          </button>

          {/* 上传进度条 */}
          {uploadProgress !== null && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-600">上传文件</span>
                <span className="text-ink-500 font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-paper-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {jobStatus && (
            <div className="card flex items-center gap-3">
              <span className="text-sm text-ink-600">打印状态：</span>
              <StatusBadge status={jobStatus} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
