import { Printer, ScanLine, CreditCard, FileText, History } from 'lucide-react'
import type { TabId } from '../../lib/types'
import { TABS } from '../../lib/constants'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Printer,
  ScanLine,
  CreditCard,
  FileText,
  History,
}

export function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-paper-200 safe-area-bottom md:static md:border-t-0 md:border-b md:border-paper-200">
      <div className="flex justify-around md:justify-center md:gap-1 max-w-2xl mx-auto">
        {TABS.map((tab) => {
          const Icon = iconMap[tab.icon]
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 md:flex-row md:gap-2 md:py-2.5 md:px-4 md:rounded-lg transition-colors
                ${active
                  ? 'text-accent md:bg-accent/10'
                  : 'text-ink-400 hover:text-ink-600 md:hover:bg-paper-100'
                }`}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span className="text-[10px] md:text-sm font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
