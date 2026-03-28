import { Inbox } from 'lucide-react'

export function EmptyState({
  icon: Icon = Inbox,
  title = '暂无数据',
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-400">
      <Icon className="w-12 h-12 mb-4 opacity-50" />
      <p className="font-medium text-ink-500">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
    </div>
  )
}
