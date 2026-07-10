export const en = {
  'sidebar.language': 'Language',
  'sidebar.toggleTheme': 'Toggle theme',
  'sidebar.nightMode': 'Night mode',
  'sidebar.exportData': 'Export data',
  'sidebar.importData': 'Import data',
  'sidebar.about': 'About',
} as const

export const zh: Record<keyof typeof en, string> = {
  'sidebar.language': '语言',
  'sidebar.toggleTheme': '切换主题',
  'sidebar.nightMode': '夜间模式',
  'sidebar.exportData': '导出数据',
  'sidebar.importData': '导入数据',
  'sidebar.about': '关于',
}
