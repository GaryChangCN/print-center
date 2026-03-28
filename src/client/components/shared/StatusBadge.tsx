const statusStyles: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-700',
  scanning: 'bg-blue-100 text-blue-700',
  printing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  idle: 'bg-gray-100 text-gray-600',
  ready: 'bg-green-100 text-green-700',
  offline: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  queued: '排队中',
  scanning: '扫描中',
  printing: '打印中',
  completed: '已完成',
  failed: '失败',
  idle: '空闲',
  ready: '就绪',
  offline: '离线',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  )
}
