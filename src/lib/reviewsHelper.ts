import type { Review } from '../data/reviews'

/**
 * 6-color warm palette for avatar backgrounds.
 * All colors provide >= 6.5:1 contrast ratio with white (#FFFFFF) text (WCAG AAA/AA).
 */
const AVATAR_PALETTE = [
  '#5C3A21', // Warm Walnut (9.8:1)
  '#7A4B22', // Deep Amber (6.7:1)
  '#4A4036', // Warm Espresso (8.7:1)
  '#634735', // Saddle Bronze (7.7:1)
  '#3D483A', // Deep Forest Olive (8.5:1)
  '#6A3B39', // Terracotta Brick (7.8:1)
]

/**
 * Returns initials from a customer name.
 * Handles single names, multi-word names, and couples (e.g. "Divya & Sandeep" -> "D&S").
 */
export function getInitials(name: string): string {
  if (!name) return 'A'
  const clean = name.trim()

  // Match couples like "Divya & Sandeep" or "Rajesh & Priya"
  const coupleMatch = clean.match(/^([A-Za-z])[^&]*&[^A-Za-z]*([A-Za-z])/i)
  if (coupleMatch) {
    return `${coupleMatch[1].toUpperCase()}&${coupleMatch[2].toUpperCase()}`
  }

  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Deterministically maps an ID or name to one of the 6 accessible background colors.
 */
export function getAvatarColor(idOrName: string): string {
  let hash = 0
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[index]
}

/**
 * Formats an ISO date into relative English time (e.g. "3 weeks ago", "2 months ago")
 * using Intl.RelativeTimeFormat in English unconditionally.
 */
export function formatRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffSeconds = Math.round(diffMs / 1000)
    const diffMinutes = Math.round(diffSeconds / 60)
    const diffHours = Math.round(diffMinutes / 60)
    const diffDays = Math.round(diffHours / 24)
    const diffWeeks = Math.round(diffDays / 7)
    const diffMonths = Math.round(diffDays / 30)
    const diffYears = Math.round(diffDays / 365)

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

    if (Math.abs(diffDays) < 1) return rtf.format(0, 'day')
    if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day')
    if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, 'week')
    if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
    return rtf.format(diffYears, 'year')
  } catch {
    return isoDate
  }
}

/**
 * Formats a full readable English date for title attributes (e.g. "March 15, 2026").
 */
export function formatFullDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export interface ReviewStats {
  totalCount: number
  averageRating: number
  formattedAverage: string
  distribution: Record<1 | 2 | 3 | 4 | 5, { count: number; percentage: number }>
}

/**
 * Computes average rating and 5-star distribution.
 */
export function calculateReviewStats(reviewList: Review[]): ReviewStats {
  const totalCount = reviewList.length
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

  if (totalCount === 0) {
    return {
      totalCount: 0,
      averageRating: 0,
      formattedAverage: '0.0',
      distribution: {
        5: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        1: { count: 0, percentage: 0 },
      },
    }
  }

  let sum = 0
  for (const r of reviewList) {
    sum += r.rating
    counts[r.rating] = (counts[r.rating] || 0) + 1
  }

  const averageRating = sum / totalCount
  const formattedAverage = averageRating.toFixed(1)

  const distribution: Record<1 | 2 | 3 | 4 | 5, { count: number; percentage: number }> = {
    5: { count: counts[5], percentage: Math.round((counts[5] / totalCount) * 100) },
    4: { count: counts[4], percentage: Math.round((counts[4] / totalCount) * 100) },
    3: { count: counts[3], percentage: Math.round((counts[3] / totalCount) * 100) },
    2: { count: counts[2], percentage: Math.round((counts[2] / totalCount) * 100) },
    1: { count: counts[1], percentage: Math.round((counts[1] / totalCount) * 100) },
  }

  return {
    totalCount,
    averageRating,
    formattedAverage,
    distribution,
  }
}
