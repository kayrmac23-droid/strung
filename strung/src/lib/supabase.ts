import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type BeadItem = {
  id?: string
  name: string
  type: 'gemstone' | 'crystal' | 'glass' | 'seed' | 'metal' | 'pearl' | 'resin' | 'other'
  colour: string
  hex: string
  size: string
  quantity: number
  shape?: string
  notes?: string
  created_at?: string
}

export type FindingItem = {
  id?: string
  name: string
  type: 'ear_wire' | 'head_pin' | 'eye_pin' | 'jump_ring' | 'clasp' | 'chain' | 'wire' | 'crimp' | 'connector' | 'statement_component' | 'other'
  metal: 'silver' | 'gold_filled' | 'gold' | 'copper' | 'brass' | 'oxidised' | 'other'
  size?: string
  quantity: number
  notes?: string
  created_at?: string
}

export type DesignItem = {
  id?: string
  title: string
  type?: string
  difficulty?: string
  source: 'inspire' | 'codesign' | 'design'
  blueprint: Record<string, unknown>
  notes?: string
  status: 'saved' | 'in_progress' | 'complete'
  created_at?: string
}
