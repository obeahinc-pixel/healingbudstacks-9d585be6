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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          author: string | null
          category: string | null
          content: string
          created_at: string | null
          featured_image: string | null
          id: string
          is_featured: boolean | null
          published_at: string | null
          slug: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          published_at?: string | null
          slug: string
          source_url?: string | null
          summary: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          published_at?: string | null
          slug?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dosage_logs: {
        Row: {
          consumption_method: string
          created_at: string
          dosage_amount: number
          dosage_unit: string
          effects_noted: string | null
          id: string
          logged_at: string
          notes: string | null
          side_effects: string | null
          strain_name: string
          symptom_relief: number | null
          user_id: string
        }
        Insert: {
          consumption_method?: string
          created_at?: string
          dosage_amount: number
          dosage_unit?: string
          effects_noted?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          side_effects?: string | null
          strain_name: string
          symptom_relief?: number | null
          user_id: string
        }
        Update: {
          consumption_method?: string
          created_at?: string
          dosage_amount?: number
          dosage_unit?: string
          effects_noted?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          side_effects?: string | null
          strain_name?: string
          symptom_relief?: number | null
          user_id?: string
        }
        Relationships: []
      }
      drgreen_cart: {
        Row: {
          created_at: string
          id: string
          quantity: number
          strain_id: string
          strain_name: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          strain_id: string
          strain_name: string
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          strain_id?: string
          strain_name?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drgreen_clients: {
        Row: {
          admin_approval: string | null
          country_code: string
          created_at: string
          drgreen_client_id: string
          email: string | null
          full_name: string | null
          id: string
          is_kyc_verified: boolean | null
          kyc_link: string | null
          shipping_address: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_approval?: string | null
          country_code?: string
          created_at?: string
          drgreen_client_id: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_kyc_verified?: boolean | null
          kyc_link?: string | null
          shipping_address?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_approval?: string | null
          country_code?: string
          created_at?: string
          drgreen_client_id?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_kyc_verified?: boolean | null
          kyc_link?: string | null
          shipping_address?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drgreen_orders: {
        Row: {
          client_id: string | null
          country_code: string | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          drgreen_order_id: string
          id: string
          items: Json
          payment_status: string
          shipping_address: Json | null
          status: string
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          drgreen_order_id: string
          id?: string
          items?: Json
          payment_status?: string
          shipping_address?: Json | null
          status?: string
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          drgreen_order_id?: string
          id?: string
          items?: Json
          payment_status?: string
          shipping_address?: Json | null
          status?: string
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          html_body: string | null
          id: string
          metadata: Json | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
          template_slug: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
          template_slug?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_slug?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string | null
          html_body: string
          id: string
          is_active: boolean | null
          name: string
          slug: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          html_body: string
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          html_body?: string
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      generated_product_images: {
        Row: {
          created_at: string
          generated_at: string
          generated_image_url: string
          id: string
          original_image_url: string | null
          product_id: string
          product_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          generated_image_url: string
          id?: string
          original_image_url?: string | null
          product_id: string
          product_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          generated_image_url?: string
          id?: string
          original_image_url?: string | null
          product_id?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_journey_logs: {
        Row: {
          client_id: string
          created_at: string | null
          event_data: Json | null
          event_source: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          event_data?: Json | null
          event_source: string
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_source?: string
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      launch_interest: {
        Row: {
          country_code: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          interested_region: string
          language: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          country_code: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          interested_region: string
          language?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          interested_region?: string
          language?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      prescription_documents: {
        Row: {
          created_at: string
          document_type: string
          expiry_date: string | null
          expiry_notification_sent: boolean | null
          expiry_notification_sent_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          upload_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          expiry_notification_sent?: boolean | null
          expiry_notification_sent_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          expiry_notification_sent?: boolean | null
          expiry_notification_sent_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      strain_knowledge: {
        Row: {
          category: string
          country_code: string
          created_at: string
          effects: string[] | null
          id: string
          last_scraped_at: string
          medical_conditions: string[] | null
          patient_reviews: string | null
          product_info: Json | null
          scraped_content: string | null
          source_name: string
          source_url: string
          strain_name: string
          updated_at: string
        }
        Insert: {
          category?: string
          country_code?: string
          created_at?: string
          effects?: string[] | null
          id?: string
          last_scraped_at?: string
          medical_conditions?: string[] | null
          patient_reviews?: string | null
          product_info?: Json | null
          scraped_content?: string | null
          source_name: string
          source_url: string
          strain_name: string
          updated_at?: string
        }
        Update: {
          category?: string
          country_code?: string
          created_at?: string
          effects?: string[] | null
          id?: string
          last_scraped_at?: string
          medical_conditions?: string[] | null
          patient_reviews?: string | null
          product_info?: Json | null
          scraped_content?: string | null
          source_name?: string
          source_url?: string
          strain_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      strains: {
        Row: {
          availability: boolean
          brand_name: string | null
          cbd_content: number
          cbg_content: number
          client_url: string | null
          created_at: string
          description: string | null
          feelings: string[] | null
          flavors: string[] | null
          helps_with: string[] | null
          id: string
          image_url: string | null
          is_archived: boolean
          name: string
          retail_price: number
          sku: string
          stock: number
          thc_content: number
          type: string
          updated_at: string
        }
        Insert: {
          availability?: boolean
          brand_name?: string | null
          cbd_content?: number
          cbg_content?: number
          client_url?: string | null
          created_at?: string
          description?: string | null
          feelings?: string[] | null
          flavors?: string[] | null
          helps_with?: string[] | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          name: string
          retail_price?: number
          sku: string
          stock?: number
          thc_content?: number
          type?: string
          updated_at?: string
        }
        Update: {
          availability?: boolean
          brand_name?: string | null
          cbd_content?: number
          cbg_content?: number
          client_url?: string | null
          created_at?: string
          description?: string | null
          feelings?: string[] | null
          flavors?: string[] | null
          helps_with?: string[] | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          name?: string
          retail_price?: number
          sku?: string
          stock?: number
          thc_content?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_auth_nonces: {
        Row: {
          address: string
          expires_at: string
          id: string
          issued_at: string
          nonce: string
          purpose: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          address: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce: string
          purpose: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          address?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
          purpose?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      wallet_email_mappings: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
