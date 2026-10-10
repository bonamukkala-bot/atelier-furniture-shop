# Atelier Customer Reviews Management Guide

This document outlines how showroom staff and management publish customer reviews to the website.

---

## 1. Principles & Hard Rules

1. **Explicit Written Consent (`consent: true`)**:
   - Only publish reviews where the customer has explicitly agreed in writing (e.g. over WhatsApp or email) to have their name and review displayed publicly.
   - The runtime validator will **automatically reject** any review without `consent: true`.

2. **Verbatim Text**:
   - Never alter the customer's wording, sentiment, or grammar. Publish exactly what was shared.

3. **Never Fabricate or Edit Ratings**:
   - Do not invent fake reviews, stock photos, or fictional personas.
   - Genuine 3-star or 4-star reviews are authentic and build customer trust.

4. **Real Google Reviews with URLs**:
   - If `source: 'google'`, `sourceUrl` must link directly to the authentic Google Maps review.

5. **Constructive Owner Replies**:
   - If a customer shares constructive feedback or delivery notes, use the `ownerReply` field to acknowledge and thank them professionally.

---

## 2. Where to Add Reviews

Reviews are stored in `src/data/reviews.ts`.

Add new review objects to the `reviews` array:

```typescript
export const reviews: Review[] = [
  {
    id: "rajesh-priya-dining-set",
    name: "Rajesh & Priya V.",
    area: "Jubilee Hills",
    rating: 5,
    title: "Exceptional craftsmanship on our custom teak dining set",
    body: "We ordered a 6-seater dining set in solid Burma teak. The joinery is immaculate, with buttery smooth edges...",
    language: "en",
    date: "2026-03-15T10:30:00Z",
    productName: "Royal Teak Dining Set",
    productId: "optional-product-uuid",
    source: "in_store",
    verified: true,
    consent: true,
    featured: true,
    ownerReply: {
      text: "Thank you Rajesh and Priya! It was a pleasure crafting this centerpiece for your home.",
      date: "2026-03-16T14:00:00Z"
    },
    photos: [
      {
        src: "https://.../photo.jpg",
        alt: "Teak dining table in living room"
      }
    ]
  }
];
```

---

## 3. Field Reference

| Field | Type | Required? | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | Unique stable slug (e.g. `ananya-velvet-recliner`). |
| `name` | `string` | **Yes** | Customer's name as agreed (e.g. `Ananya S.` or `Kiran Reddy`). |
| `area` | `string` | Optional | Locality/City in Hyderabad (e.g. `Gachibowli`, `Jubilee Hills`). |
| `rating` | `1 \| 2 \| 3 \| 4 \| 5` | **Yes** | Star rating between 1 and 5. |
| `title` | `string` | Optional | Short headline (max 80 chars). |
| `body` | `string` | **Yes** | Verbatim feedback text (must be at least 20 characters). |
| `language` | `'en' \| 'te'` | Optional | Language of the review (`en` for English, `te` for Telugu). |
| `date` | `string` | **Yes** | ISO date string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`). |
| `productName`| `string` | Optional | Name of the furniture piece purchased. |
| `productId` | `string` | Optional | UUID matching a product in the catalog to make the name clickable. |
| `source` | `'google' \| 'whatsapp' \| 'in_store' \| 'other'` | **Yes** | Channel where the review was received. |
| `sourceUrl` | `string` | Required if `google` | Direct link to the public Google Maps review. |
| `verified` | `boolean` | Optional | `true` if showroom order/delivery records confirm the purchase. |
| `consent` | `true` | **Yes** | Must be literal `true` to pass validation. |
| `ownerReply` | `{ text, date }` | Optional | Official Atelier response text and date. |
| `photos` | `Array<{ src, alt }>` | Optional | Maximum 3 customer-provided photos with descriptive alt text. |
| `featured` | `boolean` | Optional | Pins the review to the top when sorting by Most Recent. |

---

## 4. Google Reviews Link

To display a `"See all reviews on Google"` button in the summary card, set the URL in `src/data/reviews.ts`:

```typescript
export const GOOGLE_REVIEWS_URL = 'https://g.page/r/your-google-review-link/review'
```
