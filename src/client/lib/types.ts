// 打印相关
export interface PrintOptions {
  copies: number
  paperSize: 'A4' | 'A5' | 'B5' | 'Letter'
  orientation: 'portrait' | 'landscape'
  pageRange: string // '' = all, '1-3,5' = specific
  duplex: 'off' | 'long-edge' | 'short-edge'
}

export interface PrintJob {
  id: string
  fileId: string
  fileName: string
  status: 'queued' | 'printing' | 'completed' | 'failed'
  copies: number
  paperSize: string
  orientation: string
  pageRange: string | null
  duplex: string
  errorMessage: string | null
  createdAt: string
}

// 扫描相关
export interface ScanOptions {
  dpi: 150 | 300 | 600
  colorMode: 'gray' | 'color'
  paperSize: 'A4' | 'A5' | 'Letter'
  format: 'pdf' | 'jpeg' | 'png'
}

export interface ScanJob {
  id: string
  fileId: string | null
  type: 'single' | 'multi' | 'idcard'
  status: 'scanning' | 'completed' | 'failed'
  dpi: number
  colorMode: string
  format: string
  pageCount: number
  createdAt: string
}

// 文件
export interface UploadedFile {
  id: string
  name: string
  size: number
  mimeType: string
}

// 系统状态
export interface SystemStatus {
  printer: {
    name: string
    status: string
    connected: boolean
  }
  scanner: {
    status: string
    connected: boolean
  }
  mockMode: boolean
}

// Tab
export type TabId = 'print' | 'scan' | 'idcard' | 'pdf-tools' | 'history'
