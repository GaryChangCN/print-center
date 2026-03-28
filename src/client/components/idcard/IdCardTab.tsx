import { useState } from 'react'
import { CreditCard, ScanLine, Download, RotateCcw, Merge, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { startIdCardScan, composeIdCard, getFileUrl, submitPrint } from '../../lib/api'

type Step = 'ready' | 'front-done' | 'composing' | 'done'

export function IdCardTab() {
  const [step, setStep] = useState<Step>('ready')
  const [scanning, setScanning] = useState(false)
  const [composing, setComposing] = useState(false)
  const [frontFileId, setFrontFileId] = useState<string | null>(null)
  const [backFileId, setBackFileId] = useState<string | null>(null)
  const [composedFileId, setComposedFileId] = useState<string | null>(null)

  const handleScan = async (side: 'front' | 'back') => {
    setScanning(true)
    try {
      const result = await startIdCardScan(side)
      if (side === 'front') {
        setFrontFileId(result.fileId)
        setStep('front-done')
        toast.success('正面扫描完成，请翻转证件')
      } else {
        setBackFileId(result.fileId)
        setStep('composing')
        toast.success('反面扫描完成')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const handleCompose = async () => {
    if (!frontFileId || !backFileId) return
    setComposing(true)
    try {
      const result = await composeIdCard(frontFileId, backFileId)
      setComposedFileId(result.fileId)
      setStep('done')
      toast.success('合成完成！')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '合成失败')
    } finally {
      setComposing(false)
    }
  }

  const handlePrint = async () => {
    if (!composedFileId) return
    try {
      const { jobId } = await submitPrint(composedFileId, { copies: 1, paperSize: 'A4' })
      toast.success('已提交打印')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '打印失败')
    }
  }

  const reset = () => {
    setStep('ready')
    setFrontFileId(null)
    setBackFileId(null)
    setComposedFileId(null)
  }

  const stepIndex = { ready: 0, 'front-done': 1, composing: 2, done: 3 }[step]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <CreditCard className="w-5 h-5" />
        证件扫描
      </h2>

      {/* 步骤指示 */}
      <div className="flex gap-1.5">
        {['扫正面', '扫反面', '合成', '完成'].map((label, i) => (
          <div
            key={label}
            className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-colors
              ${i <= stepIndex ? 'bg-accent text-white' : 'bg-paper-100 text-ink-400'}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Step 1: 准备扫描正面 */}
      {step === 'ready' && (
        <div className="card text-center py-10 space-y-4">
          <CreditCard className="w-14 h-14 mx-auto text-ink-300" />
          <div>
            <p className="font-semibold text-ink-700">将证件正面朝下放在扫描仪上</p>
            <p className="text-sm text-ink-400 mt-1">建议使用彩色 300 DPI</p>
          </div>
          <button className="btn-primary mx-auto" onClick={() => handleScan('front')} disabled={scanning}>
            <ScanLine className="w-4 h-4" />
            {scanning ? '扫描中...' : '扫描正面'}
          </button>
        </div>
      )}

      {/* Step 2: 正面已扫，等待扫反面 */}
      {step === 'front-done' && frontFileId && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <p className="text-sm font-medium text-ink-600">正面预览</p>
            <img
              src={getFileUrl(frontFileId)}
              alt="正面"
              className="w-full max-h-48 lg:max-h-72 object-contain rounded-lg border border-paper-200 bg-paper-50"
            />
          </div>
          <div className="card text-center py-6 space-y-3 bg-amber-50 border-amber-200">
            <p className="font-semibold text-amber-800">
              请将证件翻面，反面朝下放在扫描仪上
            </p>
            <button className="btn-primary" onClick={() => handleScan('back')} disabled={scanning}>
              <ScanLine className="w-4 h-4" />
              {scanning ? '扫描中...' : '扫描反面'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 两面都扫完，等待合成 */}
      {step === 'composing' && frontFileId && backFileId && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 lg:gap-6">
            <div className="card space-y-2">
              <p className="text-xs text-ink-400">正面</p>
              <img src={getFileUrl(frontFileId)} alt="正面"
                className="w-full h-32 lg:h-48 object-contain rounded border border-paper-200 bg-paper-50" />
            </div>
            <div className="card space-y-2">
              <p className="text-xs text-ink-400">反面</p>
              <img src={getFileUrl(backFileId)} alt="反面"
                className="w-full h-32 lg:h-48 object-contain rounded border border-paper-200 bg-paper-50" />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleCompose} disabled={composing}>
            <Merge className="w-4 h-4" />
            {composing ? '合成中...' : '合成到 A4'}
          </button>
        </div>
      )}

      {/* Step 4: 合成完成 */}
      {step === 'done' && composedFileId && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <p className="text-sm font-medium text-ink-600">合成预览（A4）</p>
            <img
              src={getFileUrl(composedFileId)}
              alt="合成结果"
              className="w-full rounded-lg border border-paper-200"
            />
          </div>
          <div className="flex gap-2">
            <a href={getFileUrl(composedFileId)} download className="btn-primary flex-1">
              <Download className="w-4 h-4" />
              下载
            </a>
            <button className="btn-secondary flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              打印
            </button>
            <button className="btn-ghost" onClick={reset}>
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
