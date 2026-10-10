export type ReviewSource = 'google' | 'whatsapp' | 'in_store' | 'other'

export interface ReviewPhoto {
  src: string
  alt: string
}

export interface ReviewOwnerReply {
  text: string
  date: string
}

export interface Review {
  id: string // stable slug
  name: string // customer name
  area?: string // e.g. "Gachibowli", "Jubilee Hills"
  rating: 1 | 2 | 3 | 4 | 5
  title?: string // max 80
  body: string // verbatim English review text
  date: string // ISO date
  productName?: string
  productId?: string // links to product if present
  photos?: ReviewPhoto[] // max 3
  source: ReviewSource
  sourceUrl?: string // optional / required only for non-demo google reviews
  verified?: boolean
  consent?: boolean
  demo?: boolean
  ownerReply?: ReviewOwnerReply
  featured?: boolean
}

/**
 * Toggle demo notice line under the section header.
 * When true and demo reviews are present, displays "Sample reviews for demonstration".
 */
export const SHOW_DEMO_NOTE: boolean = true

/**
 * Optional Google Reviews link. Leave empty if not configured.
 */
export const GOOGLE_REVIEWS_URL: string = ''

/**
 * 7 English Sample Reviews
 * Rating distribution: 5★ (4), 4★ (2), 3★ (1) => Sum 31 / 7 = 4.4 average
 * Owner replies provided for r-001, r-003, and r-007
 */
export const reviews: Review[] = [
  {
    id: 'r-001',
    name: 'Rajesh & Priya V.',
    area: 'Jubilee Hills',
    rating: 5,
    title: 'Exceptional craftsmanship on our custom teak dining set',
    body: 'We ordered a 6-seater dining set in solid Burma teak. The joinery is immaculate, with buttery smooth edges and sturdy mortise-and-tenon joints. Delivery team assembled it carefully on site in Jubilee Hills.',
    date: '2026-03-15T10:30:00Z',
    productName: 'Royal Teak Dining Set',
    source: 'in_store',
    demo: true,
    consent: true,
    featured: true,
    ownerReply: {
      text: 'Thank you Rajesh and Priya! It was an absolute pleasure crafting this centerpiece for your family home.',
      date: '2026-03-16T14:00:00Z',
    },
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80',
        alt: 'Teak dining table in living room',
      },
    ],
  },
  {
    id: 'r-002',
    name: 'Ananya Sharma',
    area: 'Gachibowli',
    rating: 5,
    title: 'The velvet recliner is sheer luxury',
    body: 'The ergonomic design and deep emerald velvet finish exceeded my expectations. Extremely comfortable for long reading sessions and the delivery was prompt.',
    date: '2026-02-28T09:00:00Z',
    productName: 'Artisanal Velvet Recliner',
    source: 'whatsapp',
    demo: true,
    consent: true,
    featured: false,
  },
  {
    id: 'r-003',
    name: 'Vikram Reddy',
    area: 'Financial District',
    rating: 4,
    title: 'Solid build quality with thoughtful wire management',
    body: 'Solid build quality on the minimalist TV console. Cable management channels in the back are well thought through. Took two days longer than estimated for delivery due to rain, but customer service kept me informed throughout.',
    date: '2026-01-20T12:00:00Z',
    productName: 'Minimalist Teak TV Console',
    source: 'google',
    demo: true,
    consent: true,
    featured: false,
    ownerReply: {
      text: 'Thank you Vikram! We apologize for the weather delay and appreciate your kind words regarding our design detailing.',
      date: '2026-01-21T10:00:00Z',
    },
  },
  {
    id: 'r-004',
    name: 'Divya & Sandeep',
    area: 'Madhapur',
    rating: 5,
    title: 'Master canopy bed is pure poetry in wood',
    body: 'We visited the showroom in Gachibowli after seeing the catalog online. The headboard grain matching is simply breathtaking. Sturdy, silent, and wonderfully finished with natural oil.',
    date: '2025-12-10T15:30:00Z',
    productName: 'Master Canopy Bed',
    source: 'in_store',
    demo: true,
    consent: true,
    featured: false,
  },
  {
    id: 'r-005',
    name: 'Karthik Rao',
    area: 'Banjara Hills',
    rating: 4,
    body: 'Purchased a pair of accent lounge chairs for our study room. The joinery is very clean and the proportions fit our room perfectly. High quality craftsmanship.',
    date: '2025-11-25T11:15:00Z',
    productName: 'Lounge Accent Chair',
    source: 'in_store',
    demo: true,
    consent: true,
    featured: false,
  },
  {
    id: 'r-006',
    name: 'Sneha Patel',
    area: 'Kondapur',
    rating: 5,
    title: 'Timeless aesthetic and durable materials',
    body: 'From the initial consultation to final placement, the Atelier team was attentive to our specific dimensions. The natural wood grain and matte finish feel wonderfully organic.',
    date: '2025-10-14T16:45:00Z',
    productName: 'Custom Teak Bookshelf',
    source: 'whatsapp',
    demo: true,
    consent: true,
    featured: false,
  },
  {
    id: 'r-007',
    name: 'Arjun Mehta',
    area: 'Hitec City',
    rating: 3,
    title: 'Beautiful wood finish, but chair cushion is quite firm',
    body: 'The dining table craftsmanship is top notch, but the accompanying chair cushions are firmer than what we experienced at the showroom. Still very well made overall.',
    date: '2025-09-08T14:20:00Z',
    productName: 'Teak Dining Chairs',
    source: 'google',
    demo: true,
    consent: true,
    featured: false,
    ownerReply: {
      text: 'Thank you Arjun for the honest review. High-density foam softens naturally after a few weeks of use, but please reach out if you would like us to adjust cushion density.',
      date: '2025-09-09T09:30:00Z',
    },
  },
]

/**
 * Runtime validator for reviews.
 * - Demo entries skip consent & Google sourceUrl requirements.
 * - Enforces integer rating 1..5, body length >= 20 chars, max 3 photos, non-empty id & name.
 */
export function validateReviews(rawList: unknown[]): Review[] {
  if (!Array.isArray(rawList)) {
    if (import.meta.env.DEV) {
      console.warn('[Atelier Reviews] Expected an array of reviews, received:', rawList)
    }
    return []
  }

  return rawList.filter((item): item is Review => {
    if (!item || typeof item !== 'object') {
      if (import.meta.env.DEV) console.warn('[Atelier Reviews] Dropping non-object review item:', item)
      return false
    }

    const r = item as Partial<Review>

    // Real reviews require explicit consent
    if (!r.demo && r.consent !== true) {
      if (import.meta.env.DEV) {
        console.warn(`[Atelier Reviews] Dropping review "${r.id || r.name}": Missing explicit customer consent.`)
      }
      return false
    }

    if (typeof r.id !== 'string' || !r.id.trim()) {
      if (import.meta.env.DEV) console.warn('[Atelier Reviews] Dropping review without valid id:', r)
      return false
    }

    if (typeof r.name !== 'string' || !r.name.trim()) {
      if (import.meta.env.DEV) console.warn(`[Atelier Reviews] Dropping review "${r.id}": Missing customer name.`)
      return false
    }

    if (typeof r.rating !== 'number' || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) {
      if (import.meta.env.DEV) {
        console.warn(`[Atelier Reviews] Dropping review "${r.id}": Rating must be integer between 1 and 5, received:`, r.rating)
      }
      return false
    }

    if (typeof r.body !== 'string' || r.body.trim().length < 20) {
      if (import.meta.env.DEV) {
        console.warn(`[Atelier Reviews] Dropping review "${r.id}": Body must be at least 20 characters long.`)
      }
      return false
    }

    // Google source reviews require sourceUrl only when not a demo review
    if (!r.demo && r.source === 'google' && (!r.sourceUrl || typeof r.sourceUrl !== 'string' || !r.sourceUrl.startsWith('http'))) {
      if (import.meta.env.DEV) {
        console.warn(`[Atelier Reviews] Dropping review "${r.id}": Google source reviews require a valid sourceUrl.`)
      }
      return false
    }

    if (r.photos && (!Array.isArray(r.photos) || r.photos.length > 3)) {
      if (import.meta.env.DEV) {
        console.warn(`[Atelier Reviews] Dropping review "${r.id}": Maximum of 3 photos allowed.`)
      }
      return false
    }

    return true
  })
}
