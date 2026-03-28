import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-ink-400">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
