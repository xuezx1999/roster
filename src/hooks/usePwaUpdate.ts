import { useState, useEffect, useCallback, useRef } from 'react'

export interface PwaUpdateState {
  // 新 SW 已安装就绪（prompt 模式）：true 时由 App 显示「新版本可用」提示
  needRefresh: boolean
  // 手动应用更新：通知新 SW skipWaiting 并重载页面
  applyUpdate: () => void
}

// PWA 版本更新管理（prompt 模式）。
// 仅生产环境注册 SW（dev 由 vite 热更新接管，无需 SW）；注册与状态都在此集中处理，
// App 只消费 needRefresh / applyUpdate，不关心 SW 细节。
//
// 更新检查策略（解决 PWA 常驻内存时永远不提示新版本的问题）：
// - 浏览器标签页每次打开都是全新加载，注册时的 immediate 检查即可发现新版本；
// - 已安装 PWA（standalone）从主屏/App Switcher 恢复时**页面不重新加载**，SW 更新
//   检查不会发生，旧 JS 会一直运行（iOS 尤其明显）。故额外挂三路主动检查：
//   ① visibilitychange → visible（覆盖 PWA 从后台切回前台）
//   ② window focus（补充覆盖，双保险）
//   ③ 定时器兜底（前台长期存活场景，60 分钟一次，开销仅一次 sw.js 请求）
// 任一检查发现新 SW → onNeedRefresh → App 显示「新版本可用」→ 用户点击后
// skipWaiting + 重载，下次加载即最新版。
export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  // registerSW 返回的更新函数（向 waiting SW 发 skipWaiting + 重载）
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)
  // SW registration，用于主动触发 update() 检查
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    let active = true
    import('virtual:pwa-register').then(({ registerSW }) => {
      const sw = registerSW({
        immediate: true,
        onNeedRefresh() {
          if (active) setNeedRefresh(true)
        },
        onRegistered(r) {
          if (!r) return
          regRef.current = r
          console.log('SW Registered')
        },
        onRegisterError(error) {
          console.error('SW registration error', error)
        },
      })
      updateSWRef.current = sw
    })
    return () => {
      active = false
    }
  }, [])

  // 主动更新检查：页面重新可见 / 窗口聚焦 / 定时兜底时调用 registration.update()
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    const check = () => {
      if (regRef.current) {
        regRef.current.update().catch(() => {})
      } else {
        // 注册尚未完成时兜底：ready 后补一次检查
        navigator.serviceWorker
          .ready.then((reg) => reg.update())
          .catch(() => {})
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(check, 60 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    void updateSWRef.current?.(true)
  }, [])

  return { needRefresh, applyUpdate }
}
