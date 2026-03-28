const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options)
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// 文件
export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ id: string; name: string; size: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/files/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('响应解析失败')) }
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          reject(new Error(data.error || `HTTP ${xhr.status}`))
        } catch { reject(new Error(`上传失败 HTTP ${xhr.status}`)) }
      }
    }

    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.ontimeout = () => reject(new Error('上传超时'))
    xhr.timeout = 300000 // 5 分钟超时
    xhr.send(form)
  })
}

export function getFileUrl(fileId: string) {
  return `${BASE}/files/${fileId}`
}

export function saveEditedFile(fileId: string, blob: Blob) {
  const form = new FormData()
  form.append('file', blob, 'edited.png')
  return request<{ success: boolean }>(`/files/${fileId}/save-edited`, {
    method: 'POST',
    body: form,
  })
}

// 打印
export function submitPrint(fileId: string, options: Record<string, unknown>) {
  return request<{ jobId: string }>('/print/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, ...options }),
  })
}

export function getPrintStatus(jobId: string) {
  return request<{ status: string; errorMessage?: string }>(`/print/status/${jobId}`)
}

// 扫描
export function startScan(options: Record<string, unknown>) {
  return request<{ jobId: string; fileId: string }>('/scan/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
}

export function mergeScanPages(fileIds: string[]) {
  return request<{ fileId: string }>('/scan/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
}

export function startIdCardScan(side: 'front' | 'back') {
  return request<{ jobId: string; fileId: string }>('/scan/idcard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side }),
  })
}

export function composeIdCard(frontFileId: string, backFileId: string) {
  return request<{ fileId: string }>('/scan/idcard/compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frontFileId, backFileId }),
  })
}

// PDF 工具
export function pdfReorder(fileId: string, pageOrder: number[]) {
  return request<{ fileId: string }>('/pdf/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, pageOrder }),
  })
}

export function pdfDeletePages(fileId: string, pages: number[]) {
  return request<{ fileId: string }>('/pdf/delete-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, pages }),
  })
}

export function pdfMerge(fileIds: string[]) {
  return request<{ fileId: string }>('/pdf/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
}

export function pdfSplit(fileId: string, ranges: string[]) {
  return request<{ fileIds: string[] }>('/pdf/split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, ranges }),
  })
}

export function pdfCrop(fileId: string, crop: { x: number; y: number; w: number; h: number }, pages?: number[]) {
  return request<{ fileId: string }>('/pdf/crop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, crop, pages }),
  })
}

// 历史记录
export function getPrintHistory(page = 1, limit = 20) {
  return request<{ items: unknown[]; total: number }>(`/history/print?page=${page}&limit=${limit}`)
}

export function getScanHistory(page = 1, limit = 20) {
  return request<{ items: unknown[]; total: number }>(`/history/scan?page=${page}&limit=${limit}`)
}

export function deleteHistory(id: string) {
  return request<{ success: boolean }>(`/history/${id}`, { method: 'DELETE' })
}

export function reprint(id: string) {
  return request<{ jobId: string }>(`/history/reprint/${id}`, { method: 'POST' })
}

// 系统状态
export function getStatus() {
  return request<{
    printer: { name: string; status: string; connected: boolean }
    scanner: { status: string; connected: boolean }
    mockMode: boolean
  }>('/status')
}
