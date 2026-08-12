import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 渲染前初始化主题（localStorage 优先，回退系统偏好），避免暗色模式首帧闪烁
const savedTheme = (() => {
  try {
    return localStorage.getItem('roster-theme')
  } catch {
    return null
  }
})()
const initialTheme =
  savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
document.documentElement.dataset.theme = initialTheme
document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', initialTheme === 'dark' ? '#1A1A1A' : '#EFEFEF')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA service worker 注册已移入 hooks/usePwaUpdate（生产环境注册 + 新版本提示状态）
