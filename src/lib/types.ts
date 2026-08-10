export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface Order {
  id: string
  customer_id: string
  product_id: string
  quantity: number
  order_date: string | null
  total: number | null
  review_requested: boolean
  created_at: string
}

// What we display in the Orders list — joined with customer + product names
export interface OrderWithDetails extends Order {
  customer_name: string
  customer_phone: string | null
  product_name: string
}

export interface ShopSettings {
  id: number
  review_delay_days: number
  google_place_id: string | null
}

export interface Product {
  id: string
  name: string
  category: string | null
  material: string | null
  description: string | null
  care_instructions: string | null
  dimensions: string | null
  price: number
  compare_at_price?: number | null
  stock_qty: number
  sold: boolean
  image_url: string | null
  created_at: string
}

export interface NewProduct {
  name: string
  category: string | null
  material: string | null
  description: string | null
  care_instructions: string | null
  dimensions: string | null
  price: number
  compare_at_price?: number | null
  stock_qty: number
  sold: boolean
  image_url: string | null
}
