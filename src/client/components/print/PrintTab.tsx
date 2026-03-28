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

interface FileJobStatus {
  fileName: string
  stage: 'pending' | 'uploading' | 'submitting' | 'printing' | 'completed' | 'failed'
  uploadProgress: number
  printStatus: string | null
}

export function PrintTab() {
  const [files, setFiles] = useState<File[]>([])
  const [options, setOptions] = useState<PrintOptionsType>({
    copies: 1,
    paperSize: 'A4',
    orientation: 'portrait',
    pageRange: '',
    duplex: 'off',
    nup: 1,
  })
  const [loading, setLoading] = useState(false)
  const [fileStatuses, setFileStatuses] = useState<FileJobStatus[]>([])

  const overallStage = () => {
    if (fileStatuses.length === 0) return ''
    if (fileStatuses.some((s) => s.stage === 'uploading')) return 'uploading'
    if (fileStatuses.some((s) => s.stage === 'submitting')) return 'submitting'
    if (fileStatuses.some((s) => s.stage === 'printing')) return 'printing'
    if (fileStatuses.every((s) => s.stage === 'completed' || s.stage === 'failed')) return 'done'
    return 'printing'
  }

  const sendNotification = (title: string, body: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon.svg' })
    }
  }

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  const handlePrint = async () => {
    if (files.length === 0) {
      toast.error('请先选择文件')
      return
    }

    // 请求通知权限
    await requestNotificationPermission()

    setLoading(true)
    const statuses: FileJobStatus[] = files.map((f) => ({
      fileName: f.name,
      stage: 'pending',
      uploadProgress: 0,
      printStatus: null,
    }))
    setFileStatuses([...statuses])

    const printOptions = {
      copies: options.copies,
      paperSize: options.paperSize,
      orientation: options.orientation,
      pageRange: options.pageRange || undefined,
      duplex: options.duplex,
      nup: options.nup,
    }

    let completedCount = 0
    let failedCount = 0
    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        // 上传阶段
        statuses[i] = { ...statuses[i], stage: 'uploading' }
        setFileStatuses([...statuses])

        const uploaded = await uploadFile(file, (p) => {
          statuses[i] = { ...statuses[i], uploadProgress: p }
          setFileStatuses([...statuses])
        })

        // 提交打印阶段
        statuses[i] = { ...statuses[i], stage: 'submitting', uploadProgress: 100 }
        setFileStatuses([...statuses])

        const { jobId } = await submitPrint(uploaded.id, printOptions)

        statuses[i] = { ...statuses[i], stage: 'printing', printStatus: 'queued' }
        setFileStatuses([...statuses])

        // 轮询该任务状态
        await new Promise<void>((resolve) => {
          const poll = setInterval(async () => {
            try {
              const { status } = await getPrintStatus(jobId)
              statuses[i] = { ...statuses[i], printStatus: status }
              setFileStatuses([...statuses])

              if (status === 'completed') {
                clearInterval(poll)
                statuses[i] = { ...statuses[i], stage: 'completed' }
                setFileStatuses([...statuses])
                completedCount++
                resolve()
              } else if (status === 'failed') {
                clearInterval(poll)
                statuses[i] = { ...statuses[i], stage: 'failed' }
                setFileStatuses([...statuses])
                failedCount++
                resolve()
              }
            } catch {
              clearInterval(poll)
              statuses[i] = { ...statuses[i], stage: 'failed' }
              setFileStatuses([...statuses])
              failedCount++
              resolve()
            }
          }, 1000)
        })
      } catch (err) {
        statuses[i] = { ...statuses[i], stage: 'failed' }
        setFileStatuses([...statuses])
        failedCount++
        toast.error(`${file.name}: ${err instanceof Error ? err.message : '打印失败'}`)
      }
    }

    // 所有任务完成
    setLoading(false)
    if (failedCount === 0) {
      toast.success(`全部 ${totalFiles} 个文件打印完成`)
      sendNotification('打印完成', `全部 ${totalFiles} 个文件已完成打印`)
    } else if (completedCount > 0) {
      toast.success(`${completedCount} 个完成，${failedCount} 个失败`)
      sendNotification('打印完成', `${completedCount} 个完成，${failedCount} 个失败`)
    } else {
      toast.error('全部打印失败')
      sendNotification('打印失败', `${totalFiles} 个文件全部打印失败`)
    }
  }

  const overallProgress = () => {
    if (fileStatuses.length === 0) return null
    const total = fileStatuses.length
    const done = fileStatuses.filter((s) => s.stage === 'completed' || s.stage === 'failed').length
    // Include upload progress for current file
    const uploadingIdx = fileStatuses.findIndex((s) => s.stage === 'uploading')
    const partialProgress = uploadingIdx >= 0 ? fileStatuses[uploadingIdx].uploadProgress / 100 : 0
    return Math.round(((done + partialProgress) / total) * 100)
  }

  const currentStage = overallStage()
  const progress = overallProgress()

  // 只预览第一个文件
  const previewFile = files.length === 1 ? files[0] : null

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <Printer className="w-5 h-5" />
        打印
      </h2>

      <PrinterStatus />

      {files.length === 0 ? (
        <FileDropzone files={files} onFiles={setFiles} />
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">
          {/* 左栏：文件上传 + 预览 */}
          <div className="space-y-4">
            <FileDropzone files={files} onFiles={setFiles} />

            {previewFile?.type === 'application/pdf' && <PdfPreview file={previewFile} />}
            {previewFile?.type.startsWith('image/') && (
              <div className="card overflow-auto max-h-[60vh] bg-paper-100 rounded-lg flex justify-center p-2">
                <img
                  src={URL.createObjectURL(previewFile)}
                  alt="预览"
                  className="max-w-full shadow-sm"
                />
              </div>
            )}
          </div>

          {/* 右栏：打印选项 + 按钮 */}
          <div className="space-y-4 mt-4 lg:mt-0">
            <PrintOptions options={options} onChange={setOptions} />

            <button
              className="btn-primary w-full"
              onClick={handlePrint}
              disabled={loading}
            >
              <Send className="w-4 h-4" />
              {loading
                ? currentStage === 'uploading' ? '上传中...'
                : currentStage === 'submitting' ? '提交中...'
                : currentStage === 'printing' ? '打印中...'
                : '处理中...'
                : files.length > 1
                  ? `开始打印 (${files.length} 个文件)`
                  : '开始打印'}
            </button>

            {/* 总体进度条 */}
            {loading && progress !== null && (
              <div className="card space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-600">总体进度</span>
                  <span className="text-ink-500 font-medium">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 每个文件的状态 */}
            {fileStatuses.length > 0 && (
              <div className="space-y-1">
                {fileStatuses.map((fs, idx) => (
                  <div key={idx} className="card flex items-center gap-3 py-2 px-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-700 truncate">{fs.fileName}</p>
                    </div>
                    <div className="shrink-0">
                      {fs.stage === 'pending' && (
                        <span className="text-xs text-ink-400">等待中</span>
                      )}
                      {fs.stage === 'uploading' && (
                        <span className="text-xs text-blue-500">上传 {fs.uploadProgress}%</span>
                      )}
                      {fs.stage === 'submitting' && (
                        <span className="text-xs text-blue-500">提交中</span>
                      )}
                      {fs.stage === 'printing' && fs.printStatus && (
                        <StatusBadge status={fs.printStatus} />
                      )}
                      {fs.stage === 'completed' && (
                        <StatusBadge status="completed" />
                      )}
                      {fs.stage === 'failed' && (
                        <StatusBadge status="failed" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
