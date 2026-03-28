import type { TabId } from './types'

export const PAPER_SIZES = [
  { value: 'A4', label: 'A4 (210×297mm)' },
  { value: 'A5', label: 'A5 (148×210mm)' },
  { value: 'B5', label: 'B5 (176×250mm)' },
  { value: 'Letter', label: 'Letter (216×279mm)' },
] as const

export const DPI_OPTIONS = [
  { value: 150, label: '150 DPI (快速)' },
  { value: 300, label: '300 DPI (标准)' },
  { value: 600, label: '600 DPI (高清)' },
] as const

export const COLOR_MODES = [
  { value: 'gray', label: '灰度' },
  { value: 'color', label: '彩色' },
] as const

export const SCAN_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
] as const

export const ORIENTATIONS = [
  { value: 'portrait', label: '纵向' },
  { value: 'landscape', label: '横向' },
] as const

export const NUP_OPTIONS = [
  { value: 1, label: '单页' },
  { value: 2, label: '2合1' },
  { value: 4, label: '4合1' },
] as const

export const DUPLEX_OPTIONS = [
  { value: 'off', label: '单面' },
  { value: 'long-edge', label: '双面 (长边翻转)' },
  { value: 'short-edge', label: '双面 (短边翻转)' },
] as const

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'print', label: '打印', icon: 'Printer' },
  { id: 'scan', label: '扫描', icon: 'ScanLine' },
  { id: 'idcard', label: '证件扫描', icon: 'CreditCard' },
  { id: 'pdf-tools', label: 'PDF工具', icon: 'FileText' },
  { id: 'history', label: '历史', icon: 'History' },
]

export const ACCEPTED_PRINT_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}
