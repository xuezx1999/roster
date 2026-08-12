import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { seedDemoIfEmpty, getAllLists } from './db'
import { sortTasks } from './hooks/useTodos'

// 集成测试：seedDemoIfEmpty 依赖真实 IndexedDB 事务（fake-indexeddb 模拟浏览器环境）。
// db.ts 的 dbPromise 是模块级单例，同一文件内多例共享同一数据库，故用单用例串行验证完整场景。
describe('seedDemoIfEmpty（集成）', () => {
  it('空库播种一次 → 落库可读 → 二次调用幂等', async () => {
    // 1. 空库首次播种
    const demo = await seedDemoIfEmpty()
    expect(demo).not.toBeNull()
    expect(demo!.tasks).toHaveLength(9)

    // 2. 落库校验
    const stored = await getAllLists()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(demo!.id)
    expect(stored[0].title).toBe('ROSTER（单击此处修改标题）')
    const sorted = sortTasks(stored[0].tasks)
    expect(sorted[0].inProgress).toBe(true) // 进行中置顶
    expect(sorted[sorted.length - 1].completed).toBe(true) // 已完成沉底
    expect(sorted.filter((t) => t.inProgress && !t.completed)).toHaveLength(1)
    expect(sorted.filter((t) => t.completed)).toHaveLength(1)

    // 3. 幂等：已有列表 + demo-seeded 标记 → 不再播种
    expect(await seedDemoIfEmpty()).toBeNull()
    expect(await getAllLists()).toHaveLength(1)
  })
})
