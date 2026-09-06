/** Share concurrent reads only. No response cache: accounting data stays authoritative. */
export function createRequestDeduplicator() {
  const pending = new Map<string, Promise<unknown>>()
  return function request<T>(key: string, method: string, share: boolean, execute: () => Promise<T>): Promise<T> {
    if (method !== 'GET') {
      // Reads started after a write must not join reads from before that write.
      pending.clear()
      return execute()
    }
    if (!share) return execute()
    const existing = pending.get(key)
    if (existing) return existing as Promise<T>
    const promise = execute().finally(() => {
      if (pending.get(key) === promise) pending.delete(key)
    })
    pending.set(key, promise)
    return promise
  }
}
