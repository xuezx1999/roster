import type { RosterExport } from './types'

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11)
}

// 导出 JSON 为下载文件（ROSTER-YYYYMMDD-HHMMSS.json）
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 解析导入文本：校验 `app === 'ROSTER'` 且 `lists` 为数组；
 * 兼容 v1 旧格式（`{ title, tasks }`，包装为单列表）。
 * 返回合法的 RosterExport；非法返回 null。
 */
export function parseRosterImport(text: string): RosterExport | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  // 先识别 v1 旧格式（无 app 字段：{ title, tasks }），再校验 v2
  if (Array.isArray(obj.tasks) && typeof obj.title === 'string') {
    // Legacy v1 format: single list
    const legacyId = generateId()
    return {
      app: 'ROSTER',
      version: 2,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
      activeListId: legacyId,
      lists: [{ id: legacyId, title: obj.title, tasks: obj.tasks }],
    }
  }
  if (obj.app !== 'ROSTER') return null
  if (Array.isArray(obj.lists)) {
    return obj as unknown as RosterExport
  }
  return null
}
