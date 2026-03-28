import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import path from 'path'
import { config } from './env'
import { getDb } from './db'
import filesRoute from './routes/files'
import statusRoute from './routes/status'
import printRoute from './routes/print'
import scanRoute from './routes/scan'
import historyRoute from './routes/history'
import pdfRoute from './routes/pdf'
import { startCleanupScheduler } from './services/cleanup'

const app = new Hono()

// 中间件
app.use('*', logger())
app.use('/api/*', cors())

// 全局错误处理
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: '服务器内部错误', message: err.message }, 500)
})

app.notFound((c) => c.json({ error: '接口不存在' }, 404))

// 初始化数据库
getDb()

// 启动自动清理
startCleanupScheduler()

// 版本信息
app.get('/api/version', (c) => c.json({
  version: process.env.APP_VERSION || 'dev',
  arch: process.arch,
  mockMode: config.mockMode,
}))

// API 路由
app.route('/api/files', filesRoute)
app.route('/api/status', statusRoute)
app.route('/api/print', printRoute)
app.route('/api/scan', scanRoute)
app.route('/api/history', historyRoute)
app.route('/api/pdf', pdfRoute)

// 生产模式下服务静态文件
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: path.join(__dirname, '../client') }))
  app.get('*', serveStatic({ root: path.join(__dirname, '../client'), path: 'index.html' }))
}

console.log(`🖨️  打印中心启动在 http://localhost:${config.port}`)
console.log(`📋 模式: ${config.mockMode ? 'Mock (模拟)' : '生产'}`)
console.log(`🖨️  CUPS: ${config.cupsServer}`)
console.log(`📂 数据目录: ${path.resolve(config.dataDir)}`)

serve({
  fetch: app.fetch,
  port: config.port,
})
