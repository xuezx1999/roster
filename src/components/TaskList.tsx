import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AnimatePresence } from 'framer-motion'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  tasks: Task[]
  actionModeId: string | null
  suppressLayout: boolean
  onToggle: (id: string) => void
  onToggleInProgress: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onLongPress: (task: Task) => void
}

export function TaskList({
  tasks,
  actionModeId,
  suppressLayout,
  onToggle,
  onToggleInProgress,
  onUpdate,
  onLongPress,
}: TaskListProps) {
  return (
    <SortableContext
      items={tasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isActionMode={actionModeId === task.id}
              suppressLayout={suppressLayout}
              onToggle={onToggle}
              onToggleInProgress={onToggleInProgress}
              onUpdate={onUpdate}
              onLongPress={onLongPress}
            />
          ))}
        </AnimatePresence>
      </div>
    </SortableContext>
  )
}
