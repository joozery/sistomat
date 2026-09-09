'use client'

import { useSyncExternalStore } from 'react'

export interface CurrentUser {
  username: string
  role: string
}

const DEFAULT_USER: CurrentUser = { username: 'admin', role: 'Administrator' }

let _cachedRaw = ''
let _cachedUser: CurrentUser = DEFAULT_USER

function readUserFromStorage(): CurrentUser {
  try {
    const raw = localStorage.getItem('user') ?? '{}'
    if (raw === _cachedRaw) return _cachedUser
    _cachedRaw = raw
    const parsed = JSON.parse(raw)
    _cachedUser = {
      username: parsed.username || 'admin',
      role: parsed.role || 'Administrator',
    }
    return _cachedUser
  } catch {
    return DEFAULT_USER
  }
}

function subscribeToStorage(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

export function useCurrentUser() {
  return useSyncExternalStore(subscribeToStorage, readUserFromStorage, () => DEFAULT_USER)
}
