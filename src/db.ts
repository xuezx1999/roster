import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Task, TodoList } from './types'
import { generateId } from './utils'

interface RosterDB extends DBSchema {
  lists: {
    key: string
    value: TodoList
  }
  meta: {
    key: string
    value: string
  }
}

const DB_NAME = 'roster-db'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<RosterDB>> | null = null

function getDB(): Promise<IDBPDatabase<RosterDB>> {
  if (dbPromise) return dbPromise
  dbPromise = openDB<RosterDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('lists')) {
        db.createObjectStore('lists', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }

      // Migrate legacy v1 data (single list stored in `tasks` store + meta `list-title`)
      const storeNames: string[] = Array.from(db.objectStoreNames as unknown as string[])
      if (oldVersion < 2 && storeNames.includes('tasks')) {
        const legacyTx = transaction as unknown as {
          objectStore(name: 'tasks'): { getAll(): Promise<Task[]> }
          objectStore(name: 'meta'): { get(key: string): Promise<string | undefined> }
          objectStore(name: 'lists'): { put(value: TodoList): Promise<unknown> }
        }
        const legacyTasks = await legacyTx.objectStore('tasks').getAll()
        const legacyTitle = (await legacyTx.objectStore('meta').get('list-title')) ?? 'ROSTER'

        if (legacyTasks.length > 0) {
          const normalized = legacyTasks.map((t) => ({
            ...t,
            inProgress: t.inProgress === true,
            completed: t.completed === true,
          }))
          const defaultList: TodoList = {
            id: generateId(),
            title: legacyTitle,
            tasks: normalized,
          }
          await legacyTx.objectStore('lists').put(defaultList)
        }

        // Remove legacy store; tasks now live inside lists
        const rawDb = db as unknown as { deleteObjectStore(name: string): void }
        rawDb.deleteObjectStore('tasks')
      }
    },
  })
  return dbPromise
}

export async function getAllLists(): Promise<TodoList[]> {
  const db = await getDB()
  return db.getAll('lists')
}

export async function saveList(list: TodoList): Promise<void> {
  const db = await getDB()
  await db.put('lists', list)
}

export async function saveAllLists(lists: TodoList[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('lists', 'readwrite')
  await Promise.all(lists.map((l) => tx.store.put(l)))
  await tx.done
}

export async function deleteList(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('lists', id)
}

export async function getActiveListId(): Promise<string | null> {
  const db = await getDB()
  const id = await db.get('meta', 'active-list-id')
  return id ?? null
}

export async function saveActiveListId(id: string): Promise<void> {
  const db = await getDB()
  await db.put('meta', id, 'active-list-id')
}

// ---- 库内备份（防主数据损坏/误删；RosterExport 序列化格式，与导出兼容）----
export async function saveBackup(data: string): Promise<void> {
  const db = await getDB()
  await db.put('meta', data, 'backup')
}

export async function getBackup(): Promise<string | null> {
  const db = await getDB()
  const v = await db.get('meta', 'backup')
  return typeof v === 'string' && v.length > 0 ? v : null
}

// ---- 首次启动演示列表（产品演示 + 使用引导）----
// 纯构建函数（可单测）：1 条「进行中」置顶演示 + 7 条操作引导 + 1 条「已完成」沉底演示。
// 任务顺序与 sortTasks 输出一致（进行中 → 待办 → 已完成），order 连续。
export function buildDemoList(): TodoList {
  const now = Date.now()
  const t = (content: string, extra: Partial<Task> = {}): Task => ({
    id: generateId(),
    content,
    completed: false,
    inProgress: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...extra,
  })
  const tasks = [
    t('单击待办事项标记为“进行中”，该记录会自动置顶。', { inProgress: true }),
    t('强烈建议移动端以 PWA 形式使用，让数据更安全。'),
    t('双击空白区域或点击下方 [+]ADD 按钮添加待办事项。'),
    t('长按（桌面端为右击）某条待办事项，激活排序或删除当条记录。'),
    t('点击右上角菜单按钮，查看更多功能。'),
    t('建议定期手动导出为 JSON 进行备份，导入数据会覆盖现有数据。'),
    t('新增列表后，全屏幕左右滑动切换列表，桌面端用键盘左右键调整视图。'),
    t('清除已完成事项仅对视野内的当前列表有效。'),
    t('双击完成待办事项，该记录会自动沉底。', { completed: true, completedAt: now }),
  ]
  tasks.forEach((task, i) => {
    task.order = i
  })
  return { id: generateId(), title: 'ROSTER（单击此处修改标题）', tasks, createdAt: now }
}

// 全新安装（无任何列表且未播种过）时写入演示列表。
// 幂等：已有列表 / 已播种（demo-seeded 标记）直接返回 null，用户主动清空后不会再次出现。
// 播种写失败向上抛，由调用方静默兜底回空状态。
export async function seedDemoIfEmpty(): Promise<TodoList | null> {
  const db = await getDB()
  const lists = await db.getAll('lists')
  if (lists.length > 0) return null
  const seeded = await db.get('meta', 'demo-seeded')
  if (seeded) return null
  const demo = buildDemoList()
  const tx = db.transaction(['lists', 'meta'], 'readwrite')
  await tx.objectStore('lists').put(demo)
  await tx.objectStore('meta').put('1', 'demo-seeded')
  await tx.done
  return demo
}
