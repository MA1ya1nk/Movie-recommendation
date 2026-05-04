import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Same-origin app path only; blocks open redirects like `//evil.com`. */
export function safeInternalPath(path: unknown): string | undefined {
  if (typeof path !== 'string' || !path.startsWith('/')) return undefined
  if (path.startsWith('//')) return undefined
  if (path.includes('://')) return undefined
  return path
}
