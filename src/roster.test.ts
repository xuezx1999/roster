import { describe, it, expect } from 'vitest'
import { parseRosterImport } from './utils'
import { sortTasks, normalizeTask } from './hooks/useTodos'
import type { Task, TodoList } from './types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    content: 'task',
    completed: false,
    inProgress: false,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('sortTasks', () => {
  it('按 进行中 → 待办 → 已完成 分组', () => {
    const done = makeTask({ completed: true })
    const pending = makeTask()
    const doing = makeTask({ inProgress: true })
    const sorted = sortTasks([done, pending, doing])
    expect(sorted.map((t) => t.id)).toEqual([doing.id, pending.id, done.id])
  })

  it('重写 order 字段为连续索引', () => {
    const sorted = sortTasks([makeTask(), makeTask(), makeTask({ completed: true })])
    sorted.forEach((t, i) => {
      expect(t.order).toBe(i)
    })
  })

  it('进行中且已完成 → 归入已完成（inProgress 不优先）', () => {
    const both = makeTask({ inProgress: true, completed: true })
    const pending = makeTask()
    const sorted = sortTasks([both, pending])
    expect(sorted.map((t) => t.id)).toEqual([pending.id, both.id])
  })
})

describe('normalizeTask', () => {
  it('将旧数据的 truthy 值收紧为布尔', () => {
    const raw = {
      ...makeTask(),
      completed: true as unknown,
      inProgress: 'yes' as unknown,
    }
    const normalized = normalizeTask(raw as Task)
    expect(normalized.completed).toBe(true) // true === true
    expect(normalized.inProgress).toBe(false) // 'yes' !== true，非严格 true 一律收紧为 false
  })

  it('保留 false / undefined 语义', () => {
    const raw = { ...makeTask(), completed: undefined as unknown, inProgress: 0 as unknown }
    const normalized = normalizeTask(raw as Task)
    expect(normalized.completed).toBe(false)
    expect(normalized.inProgress).toBe(false)
  })
})

describe('parseRosterImport', () => {
  const list: TodoList = { id: 'l1', title: 'ROSTER', tasks: [] }
  const exportData = {
    app: 'ROSTER',
    version: 2,
    exportedAt: 1760000000000,
    activeListId: 'l1',
    lists: [list],
  }

  it('解析合法 v2 导出', () => {
    const parsed = parseRosterImport(JSON.stringify(exportData))
    expect(parsed).not.toBeNull()
    expect(parsed?.lists).toHaveLength(1)
    expect(parsed?.activeListId).toBe('l1')
  })

  it('兼容 v1 旧格式（title + tasks 包装为单列表）', () => {
    const v1 = { title: '旧列表', tasks: [{ ...makeTask() }] }
    const parsed = parseRosterImport(JSON.stringify(v1))
    expect(parsed).not.toBeNull()
    expect(parsed?.lists).toHaveLength(1)
    expect(parsed?.lists[0].title).toBe('旧列表')
    expect(parsed?.lists[0].tasks).toHaveLength(1)
  })

  it('拒绝非法 JSON / 非 ROSTER / 结构不符', () => {
    expect(parseRosterImport('not json')).toBeNull()
    expect(parseRosterImport(JSON.stringify({ app: 'OTHER', lists: [] }))).toBeNull()
    expect(parseRosterImport(JSON.stringify({ app: 'ROSTER', lists: 'nope' }))).toBeNull()
    expect(parseRosterImport(JSON.stringify({ app: 'ROSTER' }))).toBeNull()
  })

  it('拒绝列表结构残缺的 v2（tasks 缺失/非数组/元素非对象）', () => {
    expect(parseRosterImport(JSON.stringify({ app: 'ROSTER', lists: [{ id: 'l1', title: 'X' }] }))).toBeNull()
    expect(
      parseRosterImport(JSON.stringify({ app: 'ROSTER', lists: [{ id: 'l1', title: 'X', tasks: 'no' }] }))
    ).toBeNull()
    expect(parseRosterImport(JSON.stringify({ app: 'ROSTER', lists: ['not-an-object'] }))).toBeNull()
  })

  it('接受结构完整的 v2（含空 tasks）', () => {
    const parsed = parseRosterImport(JSON.stringify({ app: 'ROSTER', lists: [{ id: 'l1', title: 'X', tasks: [] }] }))
    expect(parsed).not.toBeNull()
    expect(parsed?.lists[0].tasks).toEqual([])
  })

  it('拒绝列表 id 重复的 v2（落库会互相覆盖，state 与 DB 失同步）', () => {
    const dup = {
      app: 'ROSTER',
      lists: [
        { id: 'l1', title: 'A', tasks: [] },
        { id: 'l1', title: 'B', tasks: [] },
      ],
    }
    expect(parseRosterImport(JSON.stringify(dup))).toBeNull()
  })

  it('拒绝列表内任务 id 重复的 v2', () => {
    const dup = {
      app: 'ROSTER',
      lists: [{ id: 'l1', title: 'X', tasks: [{ id: 't1' }, { id: 't1' }] }],
    }
    expect(parseRosterImport(JSON.stringify(dup))).toBeNull()
  })

  it('拒绝任务缺 id 的 v2', () => {
    const noId = { app: 'ROSTER', lists: [{ id: 'l1', title: 'X', tasks: [{ content: 'no-id' }] }] }
    expect(parseRosterImport(JSON.stringify(noId))).toBeNull()
  })
})
