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
