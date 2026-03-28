import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
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
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    return false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white dark:bg-[#2a2a2a] border-b border-paper-200 dark:border-[#404040] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🖨️</span>
          <h1 className="text-lg font-bold text-ink-800 dark:text-[#e8e4e0]">打印中心</h1>
        </div>
        <button
          onClick={() => setDark(d => !d)}
          className="p-2 rounded-lg text-ink-500 hover:bg-paper-100 dark:text-[#a0a0a0] dark:hover:bg-[#333] transition-colors"
          title={dark ? '切换亮色模式' : '切换暗色模式'}
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* 桌面端 TabBar */}
      <div className="hidden md:block bg-white dark:bg-[#2a2a2a]">
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
