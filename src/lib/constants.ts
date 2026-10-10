/**
 * Shop operational threshold constants
 */

// Number of hours after which a 'new' customer enquiry is marked as stale/overdue.
export const STALE_ENQUIRY_HOURS = 48

/**
 * Showroom business configuration
 */
export const SHOP_INFO = {
  phone: "+91 90149 96929",
  telPhone: "tel:+919014996929",
  whatsappNumber: "919014996929",
  address: "Sri Vishnu Grand PG, Hostel & Guest House, Gachibowli, Hyderabad, Telangana",
  directionsUrl: "https://maps.google.com/?q=Sri+Vishnu+Grand+PG,+Hostel+%26+Guest+House,+Gachibowli,+Hyderabad,+Telangana",
  hoursMonSat: "Mon–Sat: 10:00 AM – 8:00 PM",
  hoursSunday: "Sunday: Closed",
  gstin: "", // Placeholder: Configure GSTIN when available (rendered in footer only when present)
  social: {
    instagram: "", // Placeholder: Configure Instagram URL when available
    youtube: "",   // Placeholder: Configure YouTube URL when available
  },
}

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
