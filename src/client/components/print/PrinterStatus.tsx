import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, Printer, Clock, FileText, User } from 'lucide-react'

interface MarkerInfo {
  name: string
  level: number
  type: string
  color: string
}

interface PrinterInfo {
  name: string
  model?: string
  state: string
  stateMessage?: string
  stateReasons?: string
  accepting?: boolean
  queuedCount?: number
  connected: boolean
  markers?: MarkerInfo[]
  mediaReady?: string[]
  totalPages?: number | null
  deviceUri?: string
}

interface CupsJob {
  id: number
  name: string
  state: string
  stateReasons: string
  user: string
  sizeKB: number
  createdAt: number
  processedAt: number
  completedAt: number
}

const stateLabels: Record<string, string> = {
  idle: '空闲',
  printing: '打印中',
  stopped: '已停止',
  offline: '离线',
  unknown: '未知',
}

const stateColors: Record<string, string> = {
  idle: 'text-green-600',
  printing: 'text-blue-600',
  stopped: 'text-amber-600',
  offline: 'text-red-500',
  unknown: 'text-ink-400',
}

const stateDots: Record<string, string> = {
  idle: 'bg-green-500',
  printing: 'bg-blue-500 animate-pulse',
  stopped: 'bg-amber-500',
  offline: 'bg-red-500',
  unknown: 'bg-gray-400',
}

const jobStateLabels: Record<string, string> = {
  pending: '等待中',
  held: '已暂停',
  printing: '打印中',
  stopped: '已停止',
  canceled: '已取消',
  aborted: '已中止',
  completed: '已完成',
}

const jobStateColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  held: 'bg-orange-100 text-orange-700',
  printing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  canceled: 'bg-gray-100 text-gray-600',
  aborted: 'bg-red-100 text-red-700',
  stopped: 'bg-amber-100 text-amber-700',
}

const markerNameMap: Record<string, string> = {
  toner: '墨粉',
  drum: '硒鼓',
  opc: '感光鼓',
  'waste toner': '废粉盒',
  fuser: '定影器',
}

function formatMarkerName(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, label] of Object.entries(markerNameMap)) {
    if (lower.includes(key)) return label
  }
  return name
}

const mediaMap: Record<string, string> = {
  'iso_a4_210x297mm': 'A4',
  'na_letter_8.5x11in': 'Letter',
  'iso_a3_297x420mm': 'A3',
  'jis_b5_182x257mm': 'B5',
}

function formatMedia(media: string): string {
  return mediaMap[media] || media.replace(/^(iso|na|jis)_/, '').replace(/_/g, ' ')
}

function formatTime(ts: number): string {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function PrinterStatus() {
  const [printer, setPrinter] = useState<PrinterInfo | null>(null)
  const [jobs, setJobs] = useState<CupsJob[]>([])
  const [showQueue, setShowQueue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [queueTab, setQueueTab] = useState<'active' | 'completed'>('active')

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setPrinter(data.printer)
    } catch {
      setPrinter({ name: '?', state: 'offline', connected: false })
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async (which: string = 'not-completed') => {
    try {
      const res = await fetch(`/api/status/jobs?which=${which}`)
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch {
      setJobs([])
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStatus(), fetchJobs(queueTab === 'active' ? 'not-completed' : 'completed')])
    setRefreshing(false)
  }

  useEffect(() => {
    fetchStatus()
    fetchJobs()
    // 每 10 秒自动刷新状态
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (showQueue) {
      fetchJobs(queueTab === 'active' ? 'not-completed' : 'completed')
    }
  }, [showQueue, queueTab])

  if (loading || !printer) {
    return (
      <div className="card animate-pulse flex items-center gap-3">
        <div className="w-8 h-8 bg-paper-200 rounded-lg" />
        <div className="h-4 w-32 bg-paper-200 rounded" />
      </div>
    )
  }

  return (
    <div className="card !p-0 overflow-hidden">
      {/* 状态栏 */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 连接指示 */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
          ${printer.connected ? 'bg-green-50' : 'bg-red-50'}`}>
          {printer.connected
            ? <Wifi className="w-4.5 h-4.5 text-green-600" />
            : <WifiOff className="w-4.5 h-4.5 text-red-500" />}
        </div>

        {/* 打印机信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-ink-800 truncate">
              {printer.model || printer.name}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium ${stateColors[printer.state]}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${stateDots[printer.state]}`} />
              {stateLabels[printer.state] || printer.state}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {printer.stateMessage && printer.stateMessage !== '' && (
              <span className="text-xs text-ink-400 truncate">{printer.stateMessage}</span>
            )}
            {printer.queuedCount !== undefined && printer.queuedCount > 0 && (
              <span className="text-xs text-ink-400">{printer.queuedCount} 个任务</span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <button onClick={refresh} className="btn-icon text-ink-400 shrink-0" disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setShowQueue(!showQueue)} className="btn-icon text-ink-400 shrink-0">
          {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 展开的详情 */}
      {showQueue && (
        <div className="border-t border-paper-200">
          {/* 耗材信息 */}
          {printer.markers && printer.markers.length > 0 && (
            <div className="px-4 py-3 space-y-2 border-b border-paper-100">
              {printer.markers.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-600">{formatMarkerName(m.name)}</span>
                    <span className={`font-medium ${m.level <= 10 ? 'text-red-500' : m.level <= 30 ? 'text-amber-500' : 'text-ink-500'}`}>
                      {m.level < 0 ? '未知' : `${m.level}%`}
                    </span>
                  </div>
                  {m.level >= 0 && (
                    <div className="w-full h-1.5 bg-paper-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          m.level <= 10 ? 'bg-red-500' : m.level <= 30 ? 'bg-amber-400' : 'bg-green-500'
                        }`}
                        style={{ width: `${m.level}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 设备信息 */}
          <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400 border-b border-paper-100">
            {printer.mediaReady && printer.mediaReady.length > 0 && (
              <span>纸盒: {printer.mediaReady.map(formatMedia).join(', ')}</span>
            )}
            {printer.totalPages != null && (
              <span>累计: {printer.totalPages} 页</span>
            )}
            {printer.deviceUri && (
              <span>连接: {printer.deviceUri.startsWith('usb://') ? 'USB' : printer.deviceUri}</span>
            )}
          </div>

          {/* Tab 切换 */}
          <div className="flex border-b border-paper-100">
            <button
              className={`flex-1 text-xs py-2 font-medium transition-colors
                ${queueTab === 'active' ? 'text-accent border-b-2 border-accent' : 'text-ink-400'}`}
              onClick={() => setQueueTab('active')}
            >
              进行中
            </button>
            <button
              className={`flex-1 text-xs py-2 font-medium transition-colors
                ${queueTab === 'completed' ? 'text-accent border-b-2 border-accent' : 'text-ink-400'}`}
              onClick={() => setQueueTab('completed')}
            >
              已完成
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-6 text-xs text-ink-400">
              {queueTab === 'active' ? '没有进行中的任务' : '没有已完成的任务'}
            </div>
          ) : (
            <div className="divide-y divide-paper-100 max-h-64 overflow-y-auto">
              {jobs.map((job) => (
                <div key={job.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-paper-50 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-ink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink-700 truncate">{job.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink-400">
                      <span className="flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />{job.user || '-'}
                      </span>
                      {job.sizeKB > 0 && <span>{job.sizeKB} KB</span>}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(job.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0
                    ${jobStateColors[job.state] || 'bg-gray-100 text-gray-600'}`}>
                    {jobStateLabels[job.state] || job.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
