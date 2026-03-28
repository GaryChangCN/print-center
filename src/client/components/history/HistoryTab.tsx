import { useState, useEffect } from 'react'
import { History, Printer, ScanLine, Download, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { StatusBadge } from '../shared/StatusBadge'
import { EmptyState } from '../shared/EmptyState'
import { LoadingSpinner } from '../shared/LoadingSpinner'
import { getPrintHistory, getScanHistory, deleteHistory, reprint, getFileUrl } from '../../lib/api'

type HistoryType = 'print' | 'scan'

export function HistoryTab() {
  const [type, setType] = useState<HistoryType>('print')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const data = type === 'print'
        ? await getPrintHistory()
        : await getScanHistory()
      setItems(data.items)
      setTotal(data.total)
    } catch {
      toast.error('获取历史记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [type])

  const handleDelete = async (id: string) => {
    try {
      await deleteHistory(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success('已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleReprint = async (id: string) => {
    try {
      await reprint(id)
      toast.success('已重新提交打印')
    } catch {
      toast.error('重打印失败')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-800 flex items-center gap-2">
        <History className="w-5 h-5" />
        历史记录
      </h2>

      {/* 类型切换 */}
      <div className="flex gap-2">
        <button
          className={`btn flex-1 ${type === 'print' ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
          onClick={() => setType('print')}
        >
          <Printer className="w-4 h-4" />
          打印
        </button>
        <button
          className={`btn flex-1 ${type === 'scan' ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
          onClick={() => setType('scan')}
        >
          <ScanLine className="w-4 h-4" />
          扫描
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="暂无记录"
          description={type === 'print' ? '打印记录将显示在这里' : '扫描记录将显示在这里'}
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="card flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-paper-100 flex items-center justify-center shrink-0">
                {type === 'print' ? (
                  <Printer className="w-4 h-4 text-ink-400" />
                ) : (
                  <ScanLine className="w-4 h-4 text-ink-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-700 truncate">
                  {item.file_name || '未知文件'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-ink-400">{formatDate(item.created_at)}</span>
                  <StatusBadge status={item.status} />
                  {type === 'print' && item.copies > 1 && (
                    <span className="text-xs text-ink-400">{item.copies} 份</span>
                  )}
                </div>
              </div>
              {/* 桌面端显示更多详情 */}
              {type === 'print' && (
                <div className="hidden md:flex items-center gap-3 text-xs text-ink-400 shrink-0">
                  {item.paper_size && <span>{item.paper_size}</span>}
                  {item.orientation && <span>{item.orientation === 'portrait' ? '纵向' : '横向'}</span>}
                  {item.duplex && item.duplex !== 'off' && <span>双面</span>}
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {type === 'print' && (
                  <button
                    onClick={() => handleReprint(item.id)}
                    className="btn-icon text-ink-400 hover:text-accent"
                    title="重新打印"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                {type === 'scan' && item.file_id && (
                  <a
                    href={getFileUrl(item.file_id)}
                    download
                    className="btn-icon text-ink-400 hover:text-accent"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="btn-icon text-ink-400 hover:text-red-500"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
