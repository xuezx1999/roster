export interface Task {
  id: string
  content: string
  completed: boolean
  inProgress: boolean
  order: number
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface TodoList {
  id: string
  title: string
  tasks: Task[]
  // 创建时间戳：持久化列表顺序（IndexedDB getAll 按主键 UUID 排序，不持久化则刷新后列表乱序）
  createdAt?: number
}

export interface RosterExport {
  app: string
  version: number
  exportedAt: number
  activeListId: string
  lists: TodoList[]
}
