/**
 * USB 设备互斥锁
 *
 * Brother DCP-1618W 的打印和扫描共享同一个 USB 连接，
 * 同时操作会导致 USB 通信冲突。
 * 这个锁确保打印和扫描不会同时访问 USB 设备。
 */

type LockHolder = 'print' | 'scan'

let currentHolder: LockHolder | null = null
let lockRelease: (() => void) | null = null
let lockPromise: Promise<void> | null = null

/**
 * 获取 USB 设备锁
 * @param holder 谁在请求锁（print / scan）
 * @param timeoutMs 等待超时（毫秒）
 */
export function acquireUSBLock(holder: LockHolder, timeoutMs = 70000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!lockPromise) {
      // 没人占用，直接获取
      currentHolder = holder
      lockPromise = new Promise((r) => { lockRelease = r })
      resolve()
    } else {
      // 有人占用，等待释放
      const waitTimeout = setTimeout(() => {
        reject(new Error(`USB 设备被${currentHolder === 'print' ? '打印' : '扫描'}占用，请稍后再试`))
      }, timeoutMs)

      lockPromise.then(() => {
        clearTimeout(waitTimeout)
        currentHolder = holder
        lockPromise = new Promise((r) => { lockRelease = r })
        resolve()
      })
    }
  })
}

/** 释放 USB 设备锁 */
export function releaseUSBLock() {
  currentHolder = null
  if (lockRelease) {
    lockRelease()
    lockPromise = null
    lockRelease = null
  }
}

/** 查询 USB 设备是否被占用 */
export function isUSBBusy(): { busy: boolean; holder: LockHolder | null } {
  return { busy: lockPromise !== null, holder: currentHolder }
}
