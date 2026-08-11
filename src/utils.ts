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
  if (!Array.isArray(obj.lists)) return null
  // 校验每个列表结构：replaceData 会直接 `l.tasks.map(...)`，缺字段（tasks 非数组/缺失）会抛 TypeError。
  // 这里提前拦截畸形文件，避免导入流程崩溃、菜单卡在确认态。
  const lists = obj.lists
  const shapeOk = lists.every((l) => {
    if (!l || typeof l !== 'object') return false
    const list = l as Record<string, unknown>
    return (
      typeof list.id === 'string' &&
      typeof list.title === 'string' &&
      Array.isArray(list.tasks)
    )
  })
  if (!shapeOk) return null
  // 校验 id 唯一性：列表 id 或列表内任务 id 重复会导致落库时 put 互相覆盖、state 与 DB 失同步（刷新后列表/任务数量变化）。
  const listIds = new Set<string>()
  for (const l of lists) {
    const list = l as { id: string; tasks: { id: string }[] }
    if (listIds.has(list.id)) return null
    listIds.add(list.id)
    const taskIds = new Set<string>()
    for (const t of list.tasks) {
      if (typeof t?.id !== 'string' || taskIds.has(t.id)) return null
      taskIds.add(t.id)
    }
  }
  return obj as unknown as RosterExport
}
