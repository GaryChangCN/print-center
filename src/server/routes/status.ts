import { Hono } from 'hono'
import http from 'http'
import { URL } from 'url'
import { config } from '../env'
import { getDb } from '../db'

const app = new Hono()

// ─── IPP 协议工具函数 ───

const TAG_OPERATION = 0x01
const TAG_PRINTER = 0x04
const TAG_END = 0x03
const VALUE_KEYWORD = 0x44
const VALUE_URI = 0x45
const VALUE_CHARSET = 0x47
const VALUE_NATURAL_LANG = 0x48
const VALUE_ENUM = 0x23
const VALUE_INTEGER = 0x21
const VALUE_TEXT = 0x41
const VALUE_NAME = 0x42
const VALUE_DATETIME = 0x31
const VALUE_BOOLEAN = 0x22

const GET_PRINTER_ATTRIBUTES = 0x000b
const GET_JOBS = 0x000a

function writeAttr(parts: Buffer[], tag: number, name: string, value: Buffer) {
  const nameBuf = Buffer.from(name, 'utf-8')
  const buf = Buffer.alloc(1 + 2 + nameBuf.length + 2 + value.length)
  let o = 0
  buf.writeUInt8(tag, o++)
  buf.writeUInt16BE(nameBuf.length, o); o += 2
  nameBuf.copy(buf, o); o += nameBuf.length
  buf.writeUInt16BE(value.length, o)
  value.copy(buf, o + 2)
  parts.push(buf)
}

/** 写多值属性：第一个值带 name，后续值 nameLen=0（IPP 追加语义） */
function writeMultiAttr(parts: Buffer[], tag: number, name: string, values: Buffer[]) {
  values.forEach((val, idx) => {
    if (idx === 0) {
      writeAttr(parts, tag, name, val)
    } else {
      // nameLen = 0 表示追加到前一个属性
      const buf = Buffer.alloc(1 + 2 + 0 + 2 + val.length)
      let o = 0
      buf.writeUInt8(tag, o++)
      buf.writeUInt16BE(0, o); o += 2
      buf.writeUInt16BE(val.length, o)
      val.copy(buf, o + 2)
      parts.push(buf)
    }
  })
}

function strVal(s: string) { return Buffer.from(s, 'utf-8') }

function buildIPPRequest(operation: number, printerUri: string, extraAttrs?: (parts: Buffer[]) => void): Buffer {
  const parts: Buffer[] = []
  const header = Buffer.alloc(8)
  header[0] = 0x02; header[1] = 0x00 // IPP 2.0
  header.writeUInt16BE(operation, 2)
  header.writeInt32BE(1, 4)
  parts.push(header)

  parts.push(Buffer.from([TAG_OPERATION]))
  writeAttr(parts, VALUE_CHARSET, 'attributes-charset', strVal('utf-8'))
  writeAttr(parts, VALUE_NATURAL_LANG, 'attributes-natural-language', strVal('en'))
  writeAttr(parts, VALUE_URI, 'printer-uri', strVal(printerUri))
  writeAttr(parts, VALUE_NAME, 'requesting-user-name', strVal('printer-admin'))

  if (extraAttrs) extraAttrs(parts)

  parts.push(Buffer.from([TAG_END]))
  return Buffer.concat(parts)
}

function sendIPPRequest(printerUri: string, payload: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL(printerUri)
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 631,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/ipp', 'Content-Length': payload.length },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => req.destroy(new Error('超时')))
    req.write(payload)
    req.end()
  })
}

/** 从 IPP 响应中解析所有属性 */
function parseIPPAttributes(buf: Buffer): Record<string, unknown>[] {
  const groups: Record<string, unknown>[] = []
  let current: Record<string, unknown> = {}
  let i = 8 // 跳过 version(2) + status(2) + request-id(4)

  while (i < buf.length) {
    const tag = buf[i++]

    // 分隔标记
    if (tag <= 0x0f) {
      if (tag === TAG_END) break
      // 新组开始
      if (Object.keys(current).length > 0) {
        groups.push(current)
        current = {}
      }
      continue
    }

    if (i + 2 > buf.length) break
    const nameLen = buf.readUInt16BE(i); i += 2
    const name = nameLen > 0 ? buf.toString('utf-8', i, i + nameLen) : ''
    i += nameLen
    if (i + 2 > buf.length) break
    const valLen = buf.readUInt16BE(i); i += 2
    if (i + valLen > buf.length) break

    let value: unknown
    if (tag === VALUE_INTEGER || tag === VALUE_ENUM) {
      value = valLen === 4 ? buf.readInt32BE(i) : buf.readIntBE(i, valLen)
    } else if (tag === VALUE_BOOLEAN) {
      value = buf[i] !== 0
    } else {
      value = buf.toString('utf-8', i, i + valLen)
    }
    i += valLen

    if (name) {
      // 新属性
      if (name in current) {
        // 已有同名属性，转为数组
        const existing = current[name]
        current[name] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        current[name] = value
      }
    } else {
      // nameLen === 0 表示追加值到上一个属性（IPP 多值属性）
      const keys = Object.keys(current)
      if (keys.length > 0) {
        const lastKey = keys[keys.length - 1]
        const existing = current[lastKey]
        current[lastKey] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      }
    }
  }
  if (Object.keys(current).length > 0) groups.push(current)
  return groups
}

// ─── CUPS 状态映射 ───

const PRINTER_STATE_MAP: Record<number, string> = {
  3: 'idle',      // idle
  4: 'printing',  // processing
  5: 'stopped',   // stopped
}

const JOB_STATE_MAP: Record<number, string> = {
  3: 'pending',
  4: 'held',
  5: 'printing',
  6: 'stopped',
  7: 'canceled',
  8: 'aborted',
  9: 'completed',
}

// ─── 路由 ───

// GET /api/status — 打印机详细状态
app.get('/', async (c) => {
  if (config.mockMode) {
    return c.json({
      printer: {
        name: config.printerName,
        state: 'idle',
        stateMessage: '就绪',
        connected: true,
        markers: [
          { name: 'Toner', level: 72, type: 'toner', color: '#000000' },
          { name: 'Drum', level: 85, type: 'opc', color: '#333333' },
        ],
        mediaReady: ['iso_a4_210x297mm'],
        totalPages: 1234,
        deviceUri: 'usb://Brother/DCP-1618W',
      },
      scanner: { status: 'ready', connected: true },
      mockMode: true,
    })
  }

  const printerUri = `${config.cupsServer}/printers/${config.printerName}`

  try {
    const req = buildIPPRequest(GET_PRINTER_ATTRIBUTES, printerUri, (parts) => {
      // 请求的属性（使用多值写法）
      const attrs = [
        'printer-state', 'printer-state-message', 'printer-state-reasons',
        'printer-name', 'printer-info', 'printer-make-and-model',
        'printer-is-accepting-jobs', 'queued-job-count',
        'marker-names', 'marker-levels', 'marker-types', 'marker-colors',
        'media-ready', 'printer-impressions-completed', 'device-uri',
      ]
      writeMultiAttr(parts, VALUE_KEYWORD, 'requested-attributes', attrs.map(a => strVal(a)))
    })

    const resp = await sendIPPRequest(printerUri, req)
    const statusCode = resp.readUInt16BE(2)
    const groups = parseIPPAttributes(resp)
    // groups[0] 是 operation attributes, groups[1+] 是 printer attributes
    const printerAttrs = Object.assign({}, ...groups.slice(1))

    const stateNum = printerAttrs['printer-state'] as number
    const state = PRINTER_STATE_MAP[stateNum] || 'unknown'
    const stateMessage = (printerAttrs['printer-state-message'] as string) || ''
    const stateReasons = (printerAttrs['printer-state-reasons'] as string) || 'none'
    const model = (printerAttrs['printer-make-and-model'] as string) || config.printerName
    const accepting = printerAttrs['printer-is-accepting-jobs'] as boolean ?? true
    const queuedCount = (printerAttrs['queued-job-count'] as number) ?? 0

    // 耗材信息
    const markerNames = printerAttrs['marker-names']
    const markerLevels = printerAttrs['marker-levels']
    const markerTypes = printerAttrs['marker-types']
    const markerColors = printerAttrs['marker-colors']
    const toArr = (v: unknown): unknown[] => v == null ? [] : Array.isArray(v) ? v : [v]
    const names = toArr(markerNames)
    const levels = toArr(markerLevels)
    const types = toArr(markerTypes)
    const colors = toArr(markerColors)
    const markers = names.map((n, i) => ({
      name: n as string,
      level: (levels[i] as number) ?? -1,
      type: (types[i] as string) ?? '',
      color: (colors[i] as string) ?? '',
    }))

    // 纸盒 & 计数
    const mediaReady = printerAttrs['media-ready']
    const totalPages = (printerAttrs['printer-impressions-completed'] as number) ?? null
    const deviceUri = (printerAttrs['device-uri'] as string) ?? ''

    return c.json({
      printer: {
        name: config.printerName,
        model,
        state,
        stateMessage,
        stateReasons,
        accepting,
        queuedCount,
        connected: statusCode <= 0x00ff,
        markers,
        mediaReady: mediaReady ? toArr(mediaReady) : [],
        totalPages,
        deviceUri,
      },
      scanner: { status: 'ready', connected: true },
      mockMode: false,
    })
  } catch (err) {
    return c.json({
      printer: {
        name: config.printerName,
        model: config.printerName,
        state: 'offline',
        stateMessage: err instanceof Error ? err.message : '无法连接',
        stateReasons: 'offline',
        accepting: false,
        queuedCount: 0,
        connected: false,
      },
      scanner: { status: 'unknown', connected: false },
      mockMode: false,
    })
  }
})

// GET /api/status/jobs — 打印队列
app.get('/jobs', async (c) => {
  if (config.mockMode) {
    return c.json({ jobs: [] })
  }

  const printerUri = `${config.cupsServer}/printers/${config.printerName}`

  try {
    const which = c.req.query('which') || 'not-completed' // not-completed | completed | all

    const req = buildIPPRequest(GET_JOBS, printerUri, (parts) => {
      writeAttr(parts, VALUE_KEYWORD, 'which-jobs', strVal(which))
      const attrs = [
        'job-id', 'job-name', 'job-state', 'job-state-reasons',
        'job-originating-user-name', 'job-k-octets',
        'time-at-creation', 'time-at-processing', 'time-at-completed',
      ]
      writeMultiAttr(parts, VALUE_KEYWORD, 'requested-attributes', attrs.map(a => strVal(a)))
    })

    const resp = await sendIPPRequest(printerUri, req)
    const groups = parseIPPAttributes(resp)

    // 第一组是操作属性，后续是 job 属性
    const jobs = groups.slice(1).map((g) => {
      const stateNum = g['job-state'] as number
      return {
        id: g['job-id'] as number,
        name: (g['job-name'] as string) || '未知',
        state: JOB_STATE_MAP[stateNum] || 'unknown',
        stateReasons: (g['job-state-reasons'] as string) || '',
        user: (g['job-originating-user-name'] as string) || '',
        sizeKB: (g['job-k-octets'] as number) || 0,
        createdAt: g['time-at-creation'] as number,
        processedAt: g['time-at-processing'] as number,
        completedAt: g['time-at-completed'] as number,
      }
    })

    return c.json({ jobs })
  } catch (err) {
    return c.json({ jobs: [], error: err instanceof Error ? err.message : '查询失败' })
  }
})

// GET /api/status/history — 从本地数据库查打印历史（补充 CUPS 队列）
app.get('/local-jobs', (c) => {
  const db = getDb()
  const jobs = db.prepare(`
    SELECT p.id, p.status, p.cups_job_id, p.copies, p.paper_size,
           p.error_message, p.created_at, p.updated_at,
           f.original_name as file_name
    FROM print_jobs p
    LEFT JOIN files f ON p.file_id = f.id
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all()
  return c.json({ jobs })
})

export default app
