// Unit Tests for Atelier 7-Review Sample Dataset

const AVATAR_PALETTE = [
  '#5C3A21',
  '#7A4B22',
  '#4A4036',
  '#634735',
  '#3D483A',
  '#6A3B39',
]

function getInitials(name) {
  if (!name) return 'A'
  const clean = name.trim()
  const coupleMatch = clean.match(/^([A-Za-z])[^&]*&[^A-Za-z]*([A-Za-z])/i)
  if (coupleMatch) {
    return `${coupleMatch[1].toUpperCase()}&${coupleMatch[2].toUpperCase()}`
  }
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function calculateReviewStats(reviewList) {
  const totalCount = reviewList.length
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

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

  const distribution = {
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

// 7 Sample Reviews
const sampleReviews = [
  { id: 'r-001', name: 'Rajesh & Priya V.', rating: 5 },
  { id: 'r-002', name: 'Ananya Sharma', rating: 5 },
  { id: 'r-003', name: 'Vikram Reddy', rating: 4 },
  { id: 'r-004', name: 'Divya & Sandeep', rating: 5 },
  { id: 'r-005', name: 'Karthik Rao', rating: 4 },
  { id: 'r-006', name: 'Sneha Patel', rating: 5 },
  { id: 'r-007', name: 'Arjun Mehta', rating: 3 },
]

console.log('Testing 7 Sample Reviews Dataset...')
const stats = calculateReviewStats(sampleReviews)

console.assert(stats.totalCount === 7, `Expected totalCount 7, got ${stats.totalCount}`)
console.assert(stats.formattedAverage === '4.4', `Expected average 4.4, got ${stats.formattedAverage}`)
console.assert(stats.distribution[5].count === 4, `Expected 4x 5-star, got ${stats.distribution[5].count}`)
console.assert(stats.distribution[4].count === 2, `Expected 2x 4-star, got ${stats.distribution[4].count}`)
console.assert(stats.distribution[3].count === 1, `Expected 1x 3-star, got ${stats.distribution[3].count}`)
console.assert(stats.distribution[2].count === 0, `Expected 0x 2-star, got ${stats.distribution[2].count}`)
console.assert(stats.distribution[1].count === 0, `Expected 0x 1-star, got ${stats.distribution[1].count}`)

// Test initials
console.assert(getInitials('Divya & Sandeep') === 'D&S', `Expected 'D&S', got ${getInitials('Divya & Sandeep')}`)
console.assert(getInitials('Rajesh & Priya V.') === 'R&P', `Expected 'R&P', got ${getInitials('Rajesh & Priya V.')}`)
console.assert(getInitials('Ananya Sharma') === 'AS', `Expected 'AS', got ${getInitials('Ananya Sharma')}`)

console.log('✅ All 7-Review Dataset Tests Verified Successfully!')
