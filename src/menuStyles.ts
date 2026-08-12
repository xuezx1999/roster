// 右上角 ≡ 菜单面板的共享样式（桌面 ListPanel / 移动端全局浮层 共用）。
// 通用组件的视觉/对齐参数必须两处同步修改，避免上次只改一处导致的体验割裂（参见 issue：
// 桌面渐变遮罩 60% 实色导致任务文字从透明区透出 / 移动端菜单项未与 ≡ 字符右缘对齐）。

// 渐变幕布：右侧 60% 实色（菜单文字完整落在实色区，可读、不叠字），
// 左侧 40% 向左渐变淡出——底下任务内容被"幕布"逐渐隐去，而非生硬截断或直接透出。
// 与 MENU_PANEL_PADDING 的左 64px 渐变区配套：面板文字区起点在渐变区右侧，保证文字全实色。
export const MENU_PANEL_BACKGROUND =
  'linear-gradient(to left, var(--color-bg) 0%, var(--color-bg) 60%, transparent 100%)'

// 内边距：上下 12/24px（顶部留 mt-2 后的呼吸感），左 64px 给渐变幕布留过渡空间，右 16px 给菜单项缩进
export const MENU_PANEL_PADDING = '12px 16px 24px 64px'

// 右缘微调：菜单项右缘（扣除 16px 右 padding）与 ≡ 字符右缘（忽略右括号 ]）精确对齐。
// 1ch ≈ mono font 单字符宽度 ≈ ] 的宽度。
export const MENU_PANEL_RIGHT = 'calc(1ch - 16px)'