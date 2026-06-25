export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'customer' | 'vendomat_staff' | 'super_admin'
          customer_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      customers: {
        Row: {
          id: string
          name: string
          contact_email: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      uploads: {
        Row: {
          id: string
          customer_id: string | null
          user_id: string | null
          filename: string | null
          file_type: string | null
          status: 'processing' | 'done' | 'error'
          report_type: string | null
          year: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['uploads']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['uploads']['Insert']>
      }
      sales: {
        Row: {
          id: string
          customer_id: string | null
          upload_id: string | null
          date: string | null
          total_amount: number | null
          transaction_count: number | null
          average_receipt: number | null
          year: number | null
          month: number | null
          weekday: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
      }
      products: {
        Row: {
          id: string
          customer_id: string | null
          name: string | null
          product_group_id: string | null
          total_revenue: number | null
          total_quantity: number | null
          year: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_groups: {
        Row: {
          id: string
          customer_id: string | null
          name: string | null
          total_revenue: number | null
          year: number | null
        }
        Insert: Omit<Database['public']['Tables']['product_groups']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['product_groups']['Insert']>
      }
      payments: {
        Row: {
          id: string
          customer_id: string | null
          payment_type: string | null
          amount: number | null
          percentage: number | null
          year: number | null
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      employees: {
        Row: {
          id: string
          customer_id: string | null
          name: string | null
          total_revenue: number | null
          transaction_count: number | null
          year: number | null
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      ai_results: {
        Row: {
          id: string
          customer_id: string | null
          type: 'insight' | 'recommendation' | 'summary'
          content: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_results']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ai_results']['Insert']>
      }
      chat_history: {
        Row: {
          id: string
          customer_id: string | null
          user_id: string | null
          role: 'user' | 'assistant'
          content: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['chat_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['chat_history']['Insert']>
      }
      settings: {
        Row: { id: string; customer_id: string | null; key: string | null; value: string | null }
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          customer_id: string | null
          user_id: string | null
          action: string | null
          details: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
    }
  }
}
