export async function logActivity(action: string, target: string, detail?: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    await fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, target, detail: detail ?? '' }),
    })
  } catch {
    // non-critical — silently ignore
  }
}
