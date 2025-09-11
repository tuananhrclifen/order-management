export type Event = {
  id: string
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  created_at: string
  created_by?: string | null
}

export type Drink = {
  id: string
  event_id: string
  name: string
  price: number
  category?: string | null
  description?: string | null
  image_url?: string | null
  source_url?: string | null
  is_available: boolean
  created_at: string
}

export type Order = {
  id: string
  event_id: string
  drink_id: string
  person_name: string
  quantity: number
  order_date: string
  status: string
  notes?: string | null
}

