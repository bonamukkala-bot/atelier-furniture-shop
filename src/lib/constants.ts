/**
 * Shop operational threshold constants
 */

// Number of hours after which a 'new' customer enquiry is marked as stale/overdue.
export const STALE_ENQUIRY_HOURS = 48

/**
 * Helper to determine if a customer delivery enquiry is stale/overdue.
 * An enquiry is stale if its status is 'new' (or default undefined/empty)
 * and it was created more than STALE_ENQUIRY_HOURS ago.
 */
export function isEnquiryStale(createdAt: string, status?: string | null): boolean {
  if (status && status !== 'new') return false
  const createdTime = new Date(createdAt).getTime()
  if (isNaN(createdTime)) return false
  const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60)
  return diffHours > STALE_ENQUIRY_HOURS
}

/**
 * Returns a concise human-friendly string of elapsed time (e.g. "2d ago", "5h ago")
 */
export function getTimeElapsedString(createdAt: string): string {
  const createdTime = new Date(createdAt).getTime()
  if (isNaN(createdTime)) return ''
  const diffMs = Date.now() - createdTime
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
