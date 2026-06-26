const KEY = 'pdf-studio-recent'
const MAX = 10

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export function addRecentFile(path: string): void {
  const items = getRecentFiles().filter(f => f.path !== path)
  items.unshift({ path, name: path.split(/[\\/]/).pop() ?? path, openedAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
}

export function getRecentFiles(): RecentFile[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

export function removeRecentFile(path: string): void {
  localStorage.setItem(KEY, JSON.stringify(getRecentFiles().filter(f => f.path !== path)))
}

export function clearRecentFiles(): void {
  localStorage.removeItem(KEY)
}
