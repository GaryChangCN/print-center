import fs from 'fs'
import path from 'path'
import { getDb } from '../db'
import { config } from '../env'

/**
 * 清理超过保留期限的历史文件和记录
 * 每天凌晨 3 点自动执行
 */
export function startCleanupScheduler() {
  const runCleanup = () => {
    try {
      const db = getDb()
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - config.historyRetentionDays)
      const cutoffStr = cutoff.toISOString().replace('T', ' ').slice(0, 19)

      // ── 1. 修复卡死的扫描任务（超过 5 分钟还在 scanning 的标记为 failed）──
      const stuckCutoff = new Date(Date.now() - 5 * 60 * 1000)
      const stuckCutoffStr = stuckCutoff.toISOString().replace('T', ' ').slice(0, 19)
      const stuckScans = db.prepare(
        `UPDATE scan_jobs SET status = 'failed' WHERE status = 'scanning' AND created_at < ?`
      ).run(stuckCutoffStr)
      if (stuckScans.changes > 0) {
        console.log(`🔧 修复 ${stuckScans.changes} 个卡死的扫描任务`)
      }

      // ── 2. 清理孤立文件（超过 1 小时且不被任何 job 引用）──
      const orphanCutoff = new Date(Date.now() - 60 * 60 * 1000)
      const orphanCutoffStr = orphanCutoff.toISOString().replace('T', ' ').slice(0, 19)
      const orphanFiles = db.prepare(`
        SELECT id, stored_path FROM files
        WHERE created_at < ?
        AND id NOT IN (
          SELECT file_id FROM print_jobs WHERE file_id IS NOT NULL
          UNION
          SELECT file_id FROM scan_jobs WHERE file_id IS NOT NULL
        )
      `).all(orphanCutoffStr) as { id: string; stored_path: string }[]

      let deletedOrphanCount = 0
      for (const file of orphanFiles) {
        const fullPath = path.join(path.resolve(config.dataDir), file.stored_path)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
          deletedOrphanCount++
        }
        db.prepare('DELETE FROM files WHERE id = ?').run(file.id)
      }
      if (deletedOrphanCount > 0) {
        console.log(`🧹 清理 ${deletedOrphanCount} 个孤立文件`)
      }

      // ── 3. 删除过期的历史记录 ──
      const expiredPrints = db.prepare(
        `DELETE FROM print_jobs WHERE created_at < ? AND status IN ('completed', 'failed')`
      ).run(cutoffStr)

      const expiredScans = db.prepare(
        `DELETE FROM scan_jobs WHERE created_at < ? AND status IN ('completed', 'failed')`
      ).run(cutoffStr)

      const total = expiredPrints.changes + expiredScans.changes
      if (total > 0) {
        console.log(`🧹 自动清理: 删除 ${total} 条过期历史记录 (保留期: ${config.historyRetentionDays} 天)`)
      }
    } catch (err) {
      console.error('自动清理失败:', err)
    }
  }

  // 立即执行一次
  runCleanup()

  // 每小时执行一次轻量清理（孤立文件 + 卡死任务）
  setInterval(runCleanup, 60 * 60 * 1000)

  console.log(`⏰ 自动清理计划: 每小时执行, 保留 ${config.historyRetentionDays} 天内的记录`)
}
