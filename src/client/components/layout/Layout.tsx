import { TabBar } from './TabBar'
import type { TabId } from '../../lib/types'

export function Layout({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-paper-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🖨️</span>
          <h1 className="text-lg font-bold text-ink-800">打印中心</h1>
        </div>
      </header>

      {/* 桌面端 TabBar */}
      <div className="hidden md:block bg-white">
        <TabBar activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* 移动端底部 TabBar */}
      <div className="md:hidden">
        <TabBar activeTab={activeTab} onTabChange={onTabChange} />
      </div>
    </div>
  )
}
