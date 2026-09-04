export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_users: {
        Row: {
          added_by: string | null
          business_name: string
          city: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: number
          phone: string | null
          role: string
        }
        Insert: {
          added_by?: string | null
          business_name: string
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          phone?: string | null
          role?: string
        }
        Update: {
          added_by?: string | null
          business_name?: string
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          part_id: string
          qty: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          part_id: string
          qty?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          part_id?: string
          qty?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string | null
          id: number
          name: string
          name_ur: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          icon?: string | null
          id?: number
          name: string
          name_ur?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          icon?: string | null
          id?: number
          name?: string
          name_ur?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      favourites: {
        Row: {
          created_at: string | null
          part_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          part_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          part_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      makes: {
        Row: {
          id: number
          name: string
          name_ur: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          id?: number
          name: string
          name_ur?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          id?: number
          name?: string
          name_ur?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      models: {
        Row: {
          id: number
          make_id: number
          name: string
          name_ur: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          id?: number
          make_id: number
          name: string
          name_ur?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          id?: number
          make_id?: number
          name?: string
          name_ur?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string | null
          error: string | null
          id: number
          quote_request_id: string | null
          succeeded: boolean
          target: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          error?: string | null
          id?: number
          quote_request_id?: string | null
          succeeded: boolean
          target?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error?: string | null
          id?: number
          quote_request_id?: string | null
          succeeded?: boolean
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      part_fitments: {
        Row: {
          id: number
          make_id: number
          model_id: number | null
          part_id: string
          variant_id: number | null
        }
        Insert: {
          id?: number
          make_id: number
          model_id?: number | null
          part_id: string
          variant_id?: number | null
        }
        Update: {
          id?: number
          make_id?: number
          model_id?: number | null
          part_id?: string
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "part_fitments_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "makes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_fitments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          brand: string | null
          category_id: number | null
          created_at: string | null
          description: string | null
          description_ur: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_ur: string | null
          oem_number: string | null
          price_pkr: number
          search_vector: unknown
          sku: string
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          description_ur?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_ur?: string | null
          oem_number?: string | null
          price_pkr: number
          search_vector?: unknown
          sku: string
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          description_ur?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_ur?: string | null
          oem_number?: string | null
          price_pkr?: number
          search_vector?: unknown
          sku?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          city: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          language: string | null
          phone: string | null
          role: string
          status: string
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          language?: string | null
          phone?: string | null
          role?: string
          status?: string
        }
        Update: {
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      quote_request_items: {
        Row: {
          brand_snapshot: string | null
          id: string
          name_snapshot: string
          oem_snapshot: string | null
          part_id: string | null
          price_snapshot: number
          qty: number
          quote_request_id: string
          sku_snapshot: string
        }
        Insert: {
          brand_snapshot?: string | null
          id?: string
          name_snapshot: string
          oem_snapshot?: string | null
          part_id?: string | null
          price_snapshot: number
          qty: number
          quote_request_id: string
          sku_snapshot: string
        }
        Update: {
          brand_snapshot?: string | null
          id?: string
          name_snapshot?: string
          oem_snapshot?: string | null
          part_id?: string | null
          price_snapshot?: number
          qty?: number
          quote_request_id?: string
          sku_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          created_at: string | null
          id: string
          item_count: number
          note: string | null
          reference: string
          total_pkr: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_count?: number
          note?: string | null
          reference?: string
          total_pkr?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_count?: number
          note?: string | null
          reference?: string
          total_pkr?: number
          user_id?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          id: number
          model_id: number
          name: string
          name_ur: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          id?: number
          model_id: number
          name: string
          name_ur?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          id?: number
          model_id?: number
          name?: string
          name_ur?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hook_restrict_signup: { Args: { event: Json }; Returns: Json }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
