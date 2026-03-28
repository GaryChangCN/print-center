import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Layout } from './components/layout/Layout'
import { PrintTab } from './components/print/PrintTab'
import { ScanTab } from './components/scan/ScanTab'
import { IdCardTab } from './components/idcard/IdCardTab'
import { PdfToolsTab } from './components/pdf/PdfToolsTab'
import { HistoryTab } from './components/history/HistoryTab'
import type { TabId } from './lib/types'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('print')

  const renderTab = () => {
    switch (activeTab) {
      case 'print': return <PrintTab />
      case 'scan': return <ScanTab />
      case 'idcard': return <IdCardTab />
      case 'pdf-tools': return <PdfToolsTab />
      case 'history': return <HistoryTab />
    }
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className: '!bg-white !text-ink-800 !shadow-lg !border !border-paper-200 !rounded-xl',
          duration: 3000,
        }}
      />
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTab()}
      </Layout>
    </>
  )
}
