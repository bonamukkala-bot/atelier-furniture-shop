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
  fulfillment_type?: 'pickup' | 'delivery'
  delivery_address?: string | null
  delivery_zone_id?: string | null
  delivery_fee?: number | null
  delivery_status?: string | null
  delivery_partner_name?: string | null
  delivery_partner_phone?: string | null
  tracking_token?: string | null
  created_at: string
  updated_at?: string | null
}

// What we display in the Orders list — joined with customer + product names
export interface OrderWithDetails extends Order {
  customer_name: string
  customer_phone: string | null
  product_name: string
  customers?: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
  products?: {
    id: string
    name: string
    price: number
    image_url: string | null
  } | null
  delivery_zones?: {
    id: string
    zone_name: string
    fee: number
  } | null
}

export interface DeliveryStatusHistory {
  id: string
  order_id: string
  status: string
  note?: string | null
  changed_at: string
}

export interface ShopSettings {
  id: number
  review_delay_days: number
  google_place_id: string | null
  delivery_enabled?: boolean
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

export interface Worker {
  id: string
  name: string
  phone: string | null
  monthly_salary: number
  joining_date: string
  created_at: string
}

export interface NewWorker {
  name: string
  phone: string | null
  monthly_salary: number
  joining_date: string
}

export interface DailyAttendance {
  id: string
  worker_id: string
  attendance_date: string
  present: boolean
  created_at: string
}

export interface Attendance {
  id: string
  worker_id: string
  month: number
  year: number
  days_present: number
  agreed_working_days: number
  created_at: string
}

export interface NewAttendance {
  worker_id: string
  month: number
  year: number
  days_present: number
  agreed_working_days: number
}

export interface DeliveryZone {
  id: string
  zone_name: string
  max_distance_km: number
  fee: number
  area_names?: string[] | null
  pincodes?: string[] | null
  created_at?: string
}

export interface DeliveryEnquiry {
  id: string
  product_id: string
  customer_name: string
  phone: string
  area_text: string
  door_flat_building?: string | null
  street_locality?: string | null
  zone_id: string | null
  is_deliverable: boolean
  status: 'new' | 'contacted' | 'closed'
  created_at: string
  products?: {
    name: string
    price: number
    image_url?: string | null
  } | null
  delivery_zones?: {
    zone_name: string
    fee: number
  } | null
}


