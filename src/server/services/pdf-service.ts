import { PDFDocument } from 'pdf-lib'

/** 重排 PDF 页面 */
export async function reorderPages(pdfBuffer: Buffer, pageOrder: number[]): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const newDoc = await PDFDocument.create()

  for (const pageIndex of pageOrder) {
    const [copied] = await newDoc.copyPages(srcDoc, [pageIndex])
    newDoc.addPage(copied)
  }

  const bytes = await newDoc.save()
  return Buffer.from(bytes)
}

/** 删除 PDF 指定页面 */
export async function deletePages(pdfBuffer: Buffer, pagesToDelete: number[]): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = srcDoc.getPageCount()
  const keepPages = Array.from({ length: totalPages }, (_, i) => i)
    .filter((i) => !pagesToDelete.includes(i))

  return reorderPages(pdfBuffer, keepPages)
}

/** 合并多个 PDF */
export async function mergeDocuments(pdfBuffers: Buffer[]): Promise<Buffer> {
  const mergedDoc = await PDFDocument.create()

  for (const buf of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buf)
    const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    pages.forEach((page) => mergedDoc.addPage(page))
  }

  const bytes = await mergedDoc.save()
  return Buffer.from(bytes)
}

/** 拆分 PDF 按范围 (e.g., ["0-2", "3-5"]) */
export async function splitDocument(
  pdfBuffer: Buffer,
  ranges: string[]
): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const results: Buffer[] = []

  for (const range of ranges) {
    const [startStr, endStr] = range.split('-')
    const start = Number(startStr)
    const end = endStr !== undefined ? Number(endStr) : start
    const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i)

    const newDoc = await PDFDocument.create()
    const pages = await newDoc.copyPages(srcDoc, pageIndices)
    pages.forEach((page) => newDoc.addPage(page))

    const bytes = await newDoc.save()
    results.push(Buffer.from(bytes))
  }

  return results
}

/** 裁剪 PDF 页面 (设置 CropBox) */
export async function cropPages(
  pdfBuffer: Buffer,
  crop: { x: number; y: number; w: number; h: number },
  pageIndices?: number[]
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer)
  const pages = doc.getPages()
  const targetPages = pageIndices || pages.map((_, i) => i)

  for (const i of targetPages) {
    if (i >= 0 && i < pages.length) {
      const page = pages[i]
      const { height } = page.getSize()
      // PDF 坐标系：左下角为原点
      page.setCropBox(crop.x, height - crop.y - crop.h, crop.w, crop.h)
    }
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

/** 获取 PDF 页面数 */
export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBuffer)
  return doc.getPageCount()
}
