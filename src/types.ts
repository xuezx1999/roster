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
}

export interface RosterExport {
  app: string
  version: number
  exportedAt: number
  activeListId: string
  lists: TodoList[]
}
