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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointment_templates: {
        Row: {
          created_at: string | null
          created_by: string
          default_assigned_to: string | null
          default_status: string | null
          description: string | null
          duration_hours: number
          gps_check_in_radius: number | null
          id: string
          is_recurring: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          name: string
          notes: string | null
          recurrence_days_of_week: string[] | null
          recurrence_frequency: number | null
          recurrence_pattern: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          default_assigned_to?: string | null
          default_status?: string | null
          description?: string | null
          duration_hours?: number
          gps_check_in_radius?: number | null
          id?: string
          is_recurring?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          notes?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          default_assigned_to?: string | null
          default_status?: string | null
          description?: string | null
          duration_hours?: number
          gps_check_in_radius?: number | null
          id?: string
          is_recurring?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          notes?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_templates_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_time: string
          gps_check_in_radius: number | null
          id: string
          is_recurring: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          parent_appointment_id: string | null
          recurrence_days_of_week: string[] | null
          recurrence_end_date: string | null
          recurrence_frequency: number | null
          recurrence_pattern: string | null
          service_order_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_time: string
          gps_check_in_radius?: number | null
          id?: string
          is_recurring?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          parent_appointment_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          service_order_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_time?: string
          gps_check_in_radius?: number | null
          id?: string
          is_recurring?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          parent_appointment_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          service_order_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          field_name: string | null
          id: string
          ip_address: string | null
          new_value: string | null
          note: string | null
          old_value: string | null
          record_id: string
          table_name: string
          tenant_id: string
          user_agent: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string | null
          customer_id: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          mobile: string | null
          notes: string | null
          phone: string | null
          position: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          abn: string | null
          address: string | null
          billing_address: string | null
          billing_email: string | null
          billing_phone: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          legal_company_name: string | null
          name: string
          notes: string | null
          parent_customer_id: string | null
          payment_terms: number | null
          phone: string | null
          postcode: string | null
          state: string | null
          tax_exempt: boolean | null
          tenant_id: string
          trading_name: string | null
          updated_at: string | null
        }
        Insert: {
          abn?: string | null
          address?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_company_name?: string | null
          name: string
          notes?: string | null
          parent_customer_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          tax_exempt?: boolean | null
          tenant_id: string
          trading_name?: string | null
          updated_at?: string | null
        }
        Update: {
          abn?: string | null
          address?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_company_name?: string | null
          name?: string
          notes?: string | null
          parent_customer_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          tax_exempt?: boolean | null
          tenant_id?: string
          trading_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_parent_customer_id_fkey"
            columns: ["parent_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_rate_categories: {
        Row: {
          created_at: string | null
          description: string | null
          hourly_rate: number
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hourly_rate: number
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_rate_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          abn: string | null
          avatar_url: string | null
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          pay_rate_category_id: string | null
          phone: string | null
          preferred_days: string[] | null
          preferred_end_time: string | null
          preferred_start_time: string | null
          super_fund_name: string | null
          super_fund_number: string | null
          tax_file_number: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          abn?: string | null
          avatar_url?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          pay_rate_category_id?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          super_fund_name?: string | null
          super_fund_number?: string | null
          tax_file_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abn?: string | null
          avatar_url?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          pay_rate_category_id?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          super_fund_name?: string | null
          super_fund_number?: string | null
          tax_file_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pay_rate_category_id_fkey"
            columns: ["pay_rate_category_id"]
            isOneToOne: false
            referencedRelation: "pay_rate_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number | null
          budget: number | null
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          progress: number | null
          start_date: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          budget?: number | null
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          progress?: number | null
          start_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          budget?: number | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          progress?: number | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          item_order: number
          line_total: number
          notes: string | null
          quantity: number
          quote_id: string
          tenant_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          item_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          quote_id: string
          tenant_id: string
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          item_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          quote_id?: string
          tenant_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          approved_at: string | null
          converted_to_project_id: string | null
          converted_to_service_order_id: string | null
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          quote_number: string
          rejected_at: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          tenant_id: string
          terms_conditions: string | null
          title: string
          total_amount: number
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          converted_to_project_id?: string | null
          converted_to_service_order_id?: string | null
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          quote_number: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id: string
          terms_conditions?: string | null
          title: string
          total_amount?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          converted_to_project_id?: string | null
          converted_to_service_order_id?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          quote_number?: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          terms_conditions?: string | null
          title?: string
          total_amount?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      service_order_templates: {
        Row: {
          billing_type: string | null
          created_at: string | null
          created_by: string
          default_assigned_to: string | null
          description: string | null
          estimated_hours: number | null
          fixed_amount: number | null
          hourly_rate: number | null
          id: string
          name: string
          priority: string | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          billing_type?: string | null
          created_at?: string | null
          created_by: string
          default_assigned_to?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          hourly_rate?: number | null
          id?: string
          name: string
          priority?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          billing_type?: string | null
          created_at?: string | null
          created_by?: string
          default_assigned_to?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          hourly_rate?: number | null
          id?: string
          name?: string
          priority?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_templates_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          assigned_to: string | null
          billing_type: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          estimated_hours: number | null
          fixed_amount: number | null
          hourly_rate: number | null
          id: string
          is_recurring: boolean | null
          order_number: string
          parent_service_order_id: string | null
          priority: string | null
          project_id: string | null
          recurrence_days_of_week: string[] | null
          recurrence_end_date: string | null
          recurrence_frequency: number | null
          recurrence_pattern: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["service_order_status"] | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          billing_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          hourly_rate?: number | null
          id?: string
          is_recurring?: boolean | null
          order_number: string
          parent_service_order_id?: string | null
          priority?: string | null
          project_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["service_order_status"] | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          billing_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          hourly_rate?: number | null
          id?: string
          is_recurring?: boolean | null
          order_number?: string
          parent_service_order_id?: string | null
          priority?: string | null
          project_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["service_order_status"] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_parent_service_order_id_fkey"
            columns: ["parent_service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          email_domain: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          status: Database["public"]["Enums"]["tenant_status"] | null
          subdomain: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          status?: Database["public"]["Enums"]["tenant_status"] | null
          subdomain: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          status?: Database["public"]["Enums"]["tenant_status"] | null
          subdomain?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_availability: {
        Row: {
          created_at: string | null
          date: string
          end_time: string
          id: string
          is_available: boolean | null
          notes: string | null
          start_time: string
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time: string
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time?: string
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "draft"
        | "published"
        | "checked_in"
        | "completed"
        | "cancelled"
      service_order_status:
        | "draft"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      tenant_status: "active" | "suspended" | "trial"
      user_role:
        | "super_admin"
        | "tenant_admin"
        | "supervisor"
        | "worker"
        | "accountant"
        | "warehouse_manager"
        | "subcontractor"
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
      appointment_status: [
        "draft",
        "published",
        "checked_in",
        "completed",
        "cancelled",
      ],
      service_order_status: [
        "draft",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      tenant_status: ["active", "suspended", "trial"],
      user_role: [
        "super_admin",
        "tenant_admin",
        "supervisor",
        "worker",
        "accountant",
        "warehouse_manager",
        "subcontractor",
      ],
    },
  },
} as const
