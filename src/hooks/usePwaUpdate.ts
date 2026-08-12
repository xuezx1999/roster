import { useState, useEffect, useCallback } from 'react'

export interface PwaUpdateState {
  // 新 SW 已安装就绪（prompt 模式）：true 时由 App 显示「新版本可用」提示
  needRefresh: boolean
  // 手动应用更新：通知新 SW skipWaiting 并重载页面
  applyUpdate: () => void
}

// PWA 版本更新管理（prompt 模式）。
// 仅生产环境注册 SW（dev 由 vite 热更新接管，无需 SW）；注册与状态都在此集中处理，
// App 只消费 needRefresh / applyUpdate，不关心 SW 细节。
export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null)

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
          if (r) console.log('SW Registered')
        },
        onRegisterError(error) {
          console.error('SW registration error', error)
        },
      })
      if (active) setUpdateSW(() => sw)
    })
    return () => {
      active = false
    }
  }, [])

  const applyUpdate = useCallback(() => {
    void updateSW?.(true)
  }, [updateSW])

  return { needRefresh, applyUpdate }
}
