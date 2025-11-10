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
      accounting_integrations: {
        Row: {
          acumatica_company_name: string | null
          acumatica_instance_url: string | null
          created_at: string | null
          id: string
          is_enabled: boolean
          last_sync_at: string | null
          provider: string
          sync_error: string | null
          sync_status: string | null
          tenant_id: string
          updated_at: string | null
          xero_tenant_id: string | null
        }
        Insert: {
          acumatica_company_name?: string | null
          acumatica_instance_url?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          provider: string
          sync_error?: string | null
          sync_status?: string | null
          tenant_id: string
          updated_at?: string | null
          xero_tenant_id?: string | null
        }
        Update: {
          acumatica_company_name?: string | null
          acumatica_instance_url?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          provider?: string
          sync_error?: string | null
          sync_status?: string | null
          tenant_id?: string
          updated_at?: string | null
          xero_tenant_id?: string | null
        }
        Relationships: []
      }
      appointment_attachments: {
        Row: {
          appointment_id: string
          category: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          tenant_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          appointment_id: string
          category?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          tenant_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          appointment_id?: string
          category?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          tenant_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "appointment_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
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
            foreignKeyName: "appointment_templates_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "workers"
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
      appointment_workers: {
        Row: {
          appointment_id: string
          created_at: string | null
          id: string
          tenant_id: string
          worker_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          id?: string
          tenant_id: string
          worker_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          id?: string
          tenant_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_workers_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
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
      change_order_line_items: {
        Row: {
          change_order_id: string
          cost_price: number | null
          created_at: string | null
          description: string
          id: string
          is_from_price_book: boolean | null
          item_order: number
          line_total: number
          margin_percentage: number | null
          notes: string | null
          parent_line_item_id: string | null
          price_book_item_id: string | null
          quantity: number
          sell_price: number | null
          tenant_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          change_order_id: string
          cost_price?: number | null
          created_at?: string | null
          description: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number | null
          tenant_id: string
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          change_order_id?: string
          cost_price?: number | null
          created_at?: string | null
          description?: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number | null
          tenant_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_order_line_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "project_change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_line_items_parent_line_item_id_fkey"
            columns: ["parent_line_item_id"]
            isOneToOne: false
            referencedRelation: "change_order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_line_items_price_book_item_id_fkey"
            columns: ["price_book_item_id"]
            isOneToOne: false
            referencedRelation: "price_book_items"
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
      customer_locations: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          latitude: number | null
          location_notes: string | null
          longitude: number | null
          name: string
          postcode: string | null
          state: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          name: string
          postcode?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          latitude?: number | null
          location_notes?: string | null
          longitude?: number | null
          name?: string
          postcode?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_message_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_default: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_default?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_default?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
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
          customer_type: string
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
          customer_type?: string
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
          customer_type?: string
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
      integration_sync_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_reference: string | null
          id: string
          integration_id: string
          invoice_id: string | null
          request_data: Json | null
          response_data: Json | null
          status: string
          sync_type: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          integration_id: string
          invoice_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status: string
          sync_type: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          integration_id?: string
          invoice_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string
          sync_type?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "accounting_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          item_order: number
          line_item_id: string | null
          line_total: number
          quantity: number
          source_id: string | null
          source_type: string | null
          tenant_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          item_order?: number
          line_item_id?: string | null
          line_total?: number
          quantity?: number
          source_id?: string | null
          source_type?: string | null
          tenant_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          item_order?: number
          line_item_id?: string | null
          line_total?: number
          quantity?: number
          source_id?: string | null
          source_type?: string | null
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          created_by: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_progress_invoice: boolean | null
          notes: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          tenant_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          is_progress_invoice?: boolean | null
          notes?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_progress_invoice?: boolean | null
          notes?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_date: string
          activity_type: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          lead_id: string
          subject: string
          tenant_id: string
        }
        Insert: {
          activity_date?: string
          activity_type: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          lead_id: string
          subject: string
          tenant_id: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          lead_id?: string
          subject?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          lead_id: string
          mobile: string | null
          notes: string | null
          phone: string | null
          position: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          lead_id: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          lead_id?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          company_name: string | null
          converted_at: string | null
          converted_by: string | null
          converted_to_customer_id: string | null
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          is_active: boolean | null
          mobile: string | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          rating: string | null
          source: string | null
          state: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_customer_id?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          rating?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_customer_id?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          mobile?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          rating?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string
          id: string
          is_folder: boolean | null
          is_system: boolean | null
          is_visible: boolean | null
          item_order: number
          label: string
          parent_id: string | null
          path: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon: string
          id?: string
          is_folder?: boolean | null
          is_system?: boolean | null
          is_visible?: boolean | null
          item_order?: number
          label: string
          parent_id?: string | null
          path?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string
          id?: string
          is_folder?: boolean | null
          is_system?: boolean | null
          is_visible?: boolean | null
          item_order?: number
          label?: string
          parent_id?: string | null
          path?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
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
      price_book_assemblies: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      price_book_assembly_items: {
        Row: {
          assembly_id: string
          cost_price: number
          created_at: string | null
          description: string
          id: string
          item_order: number
          margin_percentage: number
          price_book_item_id: string | null
          quantity: number
          sell_price: number
        }
        Insert: {
          assembly_id: string
          cost_price?: number
          created_at?: string | null
          description: string
          id?: string
          item_order?: number
          margin_percentage?: number
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number
        }
        Update: {
          assembly_id?: string
          cost_price?: number
          created_at?: string | null
          description?: string
          id?: string
          item_order?: number
          margin_percentage?: number
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_book_assembly_items_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "price_book_assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_book_assembly_items_price_book_item_id_fkey"
            columns: ["price_book_item_id"]
            isOneToOne: false
            referencedRelation: "price_book_items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_book_items: {
        Row: {
          category: string | null
          code: string
          cost_price: number
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          margin_percentage: number
          notes: string | null
          sell_price: number
          tenant_id: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          cost_price?: number
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          margin_percentage?: number
          notes?: string | null
          sell_price?: number
          tenant_id: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          cost_price?: number
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          margin_percentage?: number
          notes?: string | null
          sell_price?: number
          tenant_id?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          abn: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
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
          projects_enabled: boolean | null
          service_orders_enabled: boolean | null
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
          email?: string | null
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
          projects_enabled?: boolean | null
          service_orders_enabled?: boolean | null
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
          email?: string | null
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
          projects_enabled?: boolean | null
          service_orders_enabled?: boolean | null
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
      project_attachments: {
        Row: {
          category: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          project_id: string
          tenant_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          project_id: string
          tenant_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          category?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          project_id?: string
          tenant_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_change_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_impact: number
          change_order_number: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          project_id: string
          reason: string | null
          requested_at: string | null
          requested_by: string
          schedule_impact_days: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          tenant_id: string
          title: string
          total_amount: number | null
          total_cost: number | null
          total_margin: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_impact?: number
          change_order_number: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          project_id: string
          reason?: string | null
          requested_at?: string | null
          requested_by: string
          schedule_impact_days?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id: string
          title: string
          total_amount?: number | null
          total_cost?: number | null
          total_margin?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_impact?: number
          change_order_number?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          reason?: string | null
          requested_at?: string | null
          requested_by?: string
          schedule_impact_days?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          title?: string
          total_amount?: number | null
          total_cost?: number | null
          total_margin?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contracts: {
        Row: {
          attachment_id: string | null
          builder_abn: string | null
          builder_contact: string | null
          builder_name: string | null
          contract_number: string | null
          contract_value: number | null
          created_at: string | null
          end_date: string | null
          extracted_data: Json | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          project_id: string
          retention_percentage: number | null
          start_date: string | null
          tenant_id: string
          updated_at: string | null
          variations_allowed: boolean | null
        }
        Insert: {
          attachment_id?: string | null
          builder_abn?: string | null
          builder_contact?: string | null
          builder_name?: string | null
          contract_number?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id: string
          retention_percentage?: number | null
          start_date?: string | null
          tenant_id: string
          updated_at?: string | null
          variations_allowed?: boolean | null
        }
        Update: {
          attachment_id?: string | null
          builder_abn?: string | null
          builder_contact?: string | null
          builder_name?: string | null
          contract_number?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id?: string
          retention_percentage?: number | null
          start_date?: string | null
          tenant_id?: string
          updated_at?: string | null
          variations_allowed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "project_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_line_items: {
        Row: {
          cost_price: number | null
          created_at: string | null
          description: string
          id: string
          is_from_price_book: boolean | null
          item_order: number
          line_total: number
          margin_percentage: number | null
          notes: string | null
          parent_line_item_id: string | null
          price_book_item_id: string | null
          project_id: string
          quantity: number
          sell_price: number | null
          tenant_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          description: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          project_id: string
          quantity?: number
          sell_price?: number | null
          tenant_id: string
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          description?: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          project_id?: string
          quantity?: number
          sell_price?: number | null
          tenant_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      project_task_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string | null
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string | null
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          dependency_type?: string | null
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_line_items: {
        Row: {
          created_at: string | null
          id: string
          line_item_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          line_item_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          line_item_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_line_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "project_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_line_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          progress_percentage: number | null
          project_id: string
          start_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          progress_percentage?: number | null
          project_id: string
          start_date?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          progress_percentage?: number | null
          project_id?: string
          start_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workers: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          created_at: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          notes: string | null
          project_id: string
          role: string
          tenant_id: string
          worker_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          project_id: string
          role?: string
          tenant_id: string
          worker_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          project_id?: string
          role?: string
          tenant_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number | null
          billing_status: Database["public"]["Enums"]["billing_status"] | null
          budget: number | null
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          end_date: string | null
          id: string
          invoiced_to_date: number | null
          labour_cost_total: number | null
          name: string
          notes: string | null
          original_budget: number | null
          progress: number | null
          revised_budget: number | null
          start_date: string | null
          status: string
          tenant_id: string
          total_change_orders: number | null
          updated_at: string | null
          wip_total: number | null
        }
        Insert: {
          actual_cost?: number | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          budget?: number | null
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          invoiced_to_date?: number | null
          labour_cost_total?: number | null
          name: string
          notes?: string | null
          original_budget?: number | null
          progress?: number | null
          revised_budget?: number | null
          start_date?: string | null
          status?: string
          tenant_id: string
          total_change_orders?: number | null
          updated_at?: string | null
          wip_total?: number | null
        }
        Update: {
          actual_cost?: number | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          budget?: number | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          invoiced_to_date?: number | null
          labour_cost_total?: number | null
          name?: string
          notes?: string | null
          original_budget?: number | null
          progress?: number | null
          revised_budget?: number | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          total_change_orders?: number | null
          updated_at?: string | null
          wip_total?: number | null
        }
        Relationships: []
      }
      quote_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_internal: boolean | null
          quote_id: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_internal?: boolean | null
          quote_id: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_internal?: boolean | null
          quote_id?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_emails: {
        Row: {
          clicked_at: string | null
          id: string
          message: string | null
          opened_at: string | null
          quote_id: string
          sent_at: string | null
          sent_by: string
          sent_to: string
          subject: string | null
          tenant_id: string
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          quote_id: string
          sent_at?: string | null
          sent_by: string
          sent_to: string
          subject?: string | null
          tenant_id: string
        }
        Update: {
          clicked_at?: string | null
          id?: string
          message?: string | null
          opened_at?: string | null
          quote_id?: string
          sent_at?: string | null
          sent_by?: string
          sent_to?: string
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_emails_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_item_template_lines: {
        Row: {
          cost_price: number | null
          created_at: string | null
          description: string
          id: string
          is_from_price_book: boolean | null
          item_order: number
          margin_percentage: number | null
          notes: string | null
          parent_line_item_id: string | null
          price_book_item_id: string | null
          quantity: number
          sell_price: number
          template_id: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          description: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number
          template_id: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          description?: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          sell_price?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_template_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_item_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          quote_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          quote_type?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          quote_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_line_items: {
        Row: {
          cost_price: number | null
          created_at: string | null
          description: string
          id: string
          is_from_price_book: boolean | null
          item_order: number
          line_total: number
          margin_percentage: number | null
          notes: string | null
          parent_line_item_id: string | null
          price_book_item_id: string | null
          quantity: number
          quote_id: string
          sell_price: number | null
          tenant_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          description: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          quote_id: string
          sell_price?: number | null
          tenant_id: string
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          description?: string
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          margin_percentage?: number | null
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          quote_id?: string
          sell_price?: number | null
          tenant_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_parent_line_item_id_fkey"
            columns: ["parent_line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          created_at: string | null
          created_by: string
          footer_text: string | null
          header_logo_url: string | null
          header_text: string | null
          id: string
          is_default: boolean | null
          name: string
          show_cost_analysis: boolean | null
          show_margins: boolean | null
          show_sub_items: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          footer_text?: string | null
          header_logo_url?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          show_cost_analysis?: boolean | null
          show_margins?: boolean | null
          show_sub_items?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          footer_text?: string | null
          header_logo_url?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          show_cost_analysis?: boolean | null
          show_margins?: boolean | null
          show_sub_items?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_versions: {
        Row: {
          change_description: string | null
          changed_by: string
          created_at: string | null
          description: string | null
          discount_amount: number
          id: string
          line_items: Json
          notes: string | null
          quote_id: string
          quote_type: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          tenant_id: string
          terms_conditions: string | null
          title: string
          total_amount: number
          version_number: number
        }
        Insert: {
          change_description?: string | null
          changed_by: string
          created_at?: string | null
          description?: string | null
          discount_amount: number
          id?: string
          line_items: Json
          notes?: string | null
          quote_id: string
          quote_type: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          tenant_id: string
          terms_conditions?: string | null
          title: string
          total_amount: number
          version_number: number
        }
        Update: {
          change_description?: string | null
          changed_by?: string
          created_at?: string | null
          description?: string | null
          discount_amount?: number
          id?: string
          line_items?: Json
          notes?: string | null
          quote_id?: string
          quote_type?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id?: string
          terms_conditions?: string | null
          title?: string
          total_amount?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          archived_at: string | null
          archived_by: string | null
          converted_to_contract_id: string | null
          converted_to_project_id: string | null
          converted_to_service_order_id: string | null
          created_at: string | null
          created_by: string
          customer_id: string
          customer_message: string | null
          description: string | null
          duplicated_from_quote_id: string | null
          id: string
          internal_notes: string | null
          is_archived: boolean | null
          is_for_lead: boolean | null
          lead_id: string | null
          notes: string | null
          quote_number: string
          quote_type: string | null
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
          archived_at?: string | null
          archived_by?: string | null
          converted_to_contract_id?: string | null
          converted_to_project_id?: string | null
          converted_to_service_order_id?: string | null
          created_at?: string | null
          created_by: string
          customer_id: string
          customer_message?: string | null
          description?: string | null
          duplicated_from_quote_id?: string | null
          id?: string
          internal_notes?: string | null
          is_archived?: boolean | null
          is_for_lead?: boolean | null
          lead_id?: string | null
          notes?: string | null
          quote_number: string
          quote_type?: string | null
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
          archived_at?: string | null
          archived_by?: string | null
          converted_to_contract_id?: string | null
          converted_to_project_id?: string | null
          converted_to_service_order_id?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          customer_message?: string | null
          description?: string | null
          duplicated_from_quote_id?: string | null
          id?: string
          internal_notes?: string | null
          is_archived?: boolean | null
          is_for_lead?: boolean | null
          lead_id?: string | null
          notes?: string | null
          quote_number?: string
          quote_type?: string | null
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
        Relationships: [
          {
            foreignKeyName: "quotes_converted_to_contract_id_fkey"
            columns: ["converted_to_contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_duplicated_from_quote_id_fkey"
            columns: ["duplicated_from_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          permission: Database["public"]["Enums"]["permission_type"]
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          permission: Database["public"]["Enums"]["permission_type"]
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          permission?: Database["public"]["Enums"]["permission_type"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sequential_number_settings: {
        Row: {
          created_at: string | null
          entity_type: string
          id: string
          next_number: number
          number_length: number
          prefix: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          id?: string
          next_number?: number
          number_length?: number
          prefix?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          id?: string
          next_number?: number
          number_length?: number
          prefix?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      service_contract_attachments: {
        Row: {
          contract_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_internal: boolean | null
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_internal?: boolean | null
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_internal?: boolean | null
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_line_items: {
        Row: {
          contract_id: string
          created_at: string | null
          description: string
          first_generation_date: string
          generation_day_of_month: number | null
          generation_day_of_week: number | null
          id: string
          is_active: boolean | null
          item_order: number
          last_generated_date: string | null
          line_total: number
          location_id: string | null
          next_generation_date: string | null
          notes: string | null
          quantity: number
          recurrence_frequency: Database["public"]["Enums"]["recurrence_frequency"]
          unit_price: number
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          description: string
          first_generation_date: string
          generation_day_of_month?: number | null
          generation_day_of_week?: number | null
          id?: string
          is_active?: boolean | null
          item_order?: number
          last_generated_date?: string | null
          line_total?: number
          location_id?: string | null
          next_generation_date?: string | null
          notes?: string | null
          quantity?: number
          recurrence_frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          unit_price?: number
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          description?: string
          first_generation_date?: string
          generation_day_of_month?: number | null
          generation_day_of_week?: number | null
          id?: string
          is_active?: boolean | null
          item_order?: number
          last_generated_date?: string | null
          line_total?: number
          location_id?: string | null
          next_generation_date?: string | null
          notes?: string | null
          quantity?: number
          recurrence_frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_line_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_line_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "customer_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          auto_generate: boolean | null
          billing_frequency: string | null
          contract_number: string
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          quote_id: string | null
          start_date: string
          status: string
          tenant_id: string
          title: string
          total_contract_value: number
          updated_at: string | null
        }
        Insert: {
          auto_generate?: boolean | null
          billing_frequency?: string | null
          contract_number: string
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          start_date: string
          status?: string
          tenant_id: string
          title: string
          total_contract_value?: number
          updated_at?: string | null
        }
        Update: {
          auto_generate?: boolean | null
          billing_frequency?: string | null
          contract_number?: string
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          title?: string
          total_contract_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_internal: boolean | null
          service_order_id: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_internal?: boolean | null
          service_order_id: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_internal?: boolean | null
          service_order_id?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_attachments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_line_items: {
        Row: {
          created_at: string | null
          description: string
          estimated_hours: number
          id: string
          is_from_price_book: boolean | null
          item_order: number
          line_total: number
          notes: string | null
          parent_line_item_id: string | null
          price_book_item_id: string | null
          quantity: number
          service_order_id: string
          tenant_id: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          estimated_hours?: number
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          service_order_id: string
          tenant_id: string
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          estimated_hours?: number
          id?: string
          is_from_price_book?: boolean | null
          item_order?: number
          line_total?: number
          notes?: string | null
          parent_line_item_id?: string | null
          price_book_item_id?: string | null
          quantity?: number
          service_order_id?: string
          tenant_id?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_line_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_skills: {
        Row: {
          created_at: string | null
          id: string
          service_order_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          service_order_id: string
          skill_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          service_order_id?: string
          skill_id?: string
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
            foreignKeyName: "service_order_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workers"
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
            foreignKeyName: "service_order_templates_default_assigned_to_fkey"
            columns: ["default_assigned_to"]
            isOneToOne: false
            referencedRelation: "workers"
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
          allow_bidding: boolean | null
          billing_status: Database["public"]["Enums"]["billing_status"] | null
          billing_type: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string
          customer_contact_id: string | null
          customer_id: string
          customer_location_id: string | null
          date_range_end: string | null
          description: string | null
          estimated_hours: number | null
          fixed_amount: number | null
          id: string
          is_recurring: boolean | null
          location_id: string | null
          order_number: string
          parent_service_order_id: string | null
          preferred_date: string | null
          preferred_date_end: string | null
          preferred_date_start: string | null
          priority: string | null
          project_id: string | null
          purchase_order_number: string | null
          ready_for_billing: boolean | null
          recurrence_days_of_week: string[] | null
          recurrence_end_date: string | null
          recurrence_frequency: number | null
          recurrence_pattern: string | null
          skill_required: string | null
          status: Database["public"]["Enums"]["service_order_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          tenant_id: string
          title: string
          total_amount: number | null
          updated_at: string | null
          work_order_number: string | null
        }
        Insert: {
          allow_bidding?: boolean | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          billing_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by: string
          customer_contact_id?: string | null
          customer_id: string
          customer_location_id?: string | null
          date_range_end?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          id?: string
          is_recurring?: boolean | null
          location_id?: string | null
          order_number: string
          parent_service_order_id?: string | null
          preferred_date?: string | null
          preferred_date_end?: string | null
          preferred_date_start?: string | null
          priority?: string | null
          project_id?: string | null
          purchase_order_number?: string | null
          ready_for_billing?: boolean | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          skill_required?: string | null
          status?: Database["public"]["Enums"]["service_order_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id: string
          title: string
          total_amount?: number | null
          updated_at?: string | null
          work_order_number?: string | null
        }
        Update: {
          allow_bidding?: boolean | null
          billing_status?: Database["public"]["Enums"]["billing_status"] | null
          billing_type?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string
          customer_contact_id?: string | null
          customer_id?: string
          customer_location_id?: string | null
          date_range_end?: string | null
          description?: string | null
          estimated_hours?: number | null
          fixed_amount?: number | null
          id?: string
          is_recurring?: boolean | null
          location_id?: string | null
          order_number?: string
          parent_service_order_id?: string | null
          preferred_date?: string | null
          preferred_date_end?: string | null
          preferred_date_start?: string | null
          priority?: string | null
          project_id?: string | null
          purchase_order_number?: string | null
          ready_for_billing?: boolean | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: number | null
          recurrence_pattern?: string | null
          skill_required?: string | null
          status?: Database["public"]["Enums"]["service_order_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          title?: string
          total_amount?: number | null
          updated_at?: string | null
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_location_id_fkey"
            columns: ["customer_location_id"]
            isOneToOne: false
            referencedRelation: "customer_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "customer_locations"
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
            referencedRelation: "projects"
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
      skills: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          item_order: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          item_order?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          item_order?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          created_by: string
          id: string
          task_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          created_by: string
          id?: string
          task_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          created_by?: string
          id?: string
          task_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string
          depends_on_task_id: string
          id: string
          lag_days: number | null
          task_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          lag_days?: number | null
          task_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          lag_days?: number | null
          task_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_checklist_items: {
        Row: {
          created_at: string
          id: string
          item_order: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_order?: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          item_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string
          default_priority: string
          default_status: string
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_priority?: string
          default_status?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_priority?: string
          default_status?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          linked_module: string | null
          linked_record_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress_percentage: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          linked_module?: string | null
          linked_record_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percentage?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          linked_module?: string | null
          linked_record_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percentage?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          abn: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_email: string | null
          company_legal_name: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          country: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          postcode: string | null
          primary_color: string | null
          projects_service_orders_integration: boolean | null
          renewal_notification_email: string | null
          secondary_color: string | null
          state: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          abn?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_email?: string | null
          company_legal_name?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          postcode?: string | null
          primary_color?: string | null
          projects_service_orders_integration?: boolean | null
          renewal_notification_email?: string | null
          secondary_color?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          abn?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_email?: string | null
          company_legal_name?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          postcode?: string | null
          primary_color?: string | null
          projects_service_orders_integration?: boolean | null
          renewal_notification_email?: string | null
          secondary_color?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
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
      terms_conditions_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_default: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_default?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_default?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_logs: {
        Row: {
          appointment_id: string
          clock_in: string
          clock_out: string | null
          created_at: string | null
          hourly_rate: number
          id: string
          notes: string | null
          overhead_percentage: number
          status: string
          tenant_id: string
          total_cost: number | null
          total_hours: number | null
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          appointment_id: string
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          hourly_rate?: number
          id?: string
          notes?: string | null
          overhead_percentage?: number
          status?: string
          tenant_id: string
          total_cost?: number | null
          total_hours?: number | null
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          appointment_id?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          hourly_rate?: number
          id?: string
          notes?: string | null
          overhead_percentage?: number
          status?: string
          tenant_id?: string
          total_cost?: number | null
          total_hours?: number | null
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
      worker_certificates: {
        Row: {
          certificate_name: string
          certificate_number: string | null
          created_at: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          notes: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          certificate_name: string
          certificate_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          notes?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          certificate_name?: string
          certificate_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          notes?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_licenses: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          license_name: string
          license_number: string | null
          notes: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_name: string
          license_number?: string | null
          notes?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_name?: string
          license_number?: string | null
          notes?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_schedule: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_skills: {
        Row: {
          created_at: string | null
          date_acquired: string | null
          id: string
          notes: string | null
          proficiency_level: string | null
          skill_id: string
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          date_acquired?: string | null
          id?: string
          notes?: string | null
          proficiency_level?: string | null
          skill_id: string
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          date_acquired?: string | null
          id?: string
          notes?: string | null
          proficiency_level?: string | null
          skill_id?: string
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_training: {
        Row: {
          completion_date: string | null
          created_at: string | null
          expiry_date: string | null
          hours_completed: number | null
          id: string
          notes: string | null
          status: string | null
          tenant_id: string
          training_name: string
          training_provider: string | null
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string | null
          expiry_date?: string | null
          hours_completed?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          tenant_id: string
          training_name: string
          training_provider?: string | null
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string | null
          expiry_date?: string | null
          hours_completed?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          tenant_id?: string
          training_name?: string
          training_provider?: string | null
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_unavailability: {
        Row: {
          created_at: string | null
          end_date: string
          end_time: string | null
          id: string
          notes: string | null
          reason: string | null
          start_date: string
          start_time: string | null
          tenant_id: string
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          end_time?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date: string
          start_time?: string | null
          tenant_id: string
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          start_time?: string | null
          tenant_id?: string
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      workers: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          pay_rate_category_id: string | null
          phone: string | null
          preferred_days: string[] | null
          preferred_end_time: string | null
          preferred_start_time: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          pay_rate_category_id?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          pay_rate_category_id?: string | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
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
    }
    Functions: {
      get_next_sequential_number: {
        Args: { p_entity_type: string; p_tenant_id: string }
        Returns: string
      }
      get_user_tenant_id: { Args: never; Returns: string }
      has_permission: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _permission: Database["public"]["Enums"]["permission_type"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_module:
        | "customers"
        | "leads"
        | "quotes"
        | "projects"
        | "service_orders"
        | "appointments"
        | "workers"
        | "service_contracts"
        | "analytics"
        | "settings"
        | "price_book"
      appointment_status:
        | "draft"
        | "published"
        | "checked_in"
        | "completed"
        | "cancelled"
      billing_status: "not_billed" | "partially_billed" | "billed"
      permission_type: "view" | "create" | "edit" | "delete"
      recurrence_frequency:
        | "daily"
        | "weekly"
        | "bi_weekly"
        | "monthly"
        | "quarterly"
        | "semi_annually"
        | "annually"
        | "one_time"
      service_order_status:
        | "draft"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      app_module: [
        "customers",
        "leads",
        "quotes",
        "projects",
        "service_orders",
        "appointments",
        "workers",
        "service_contracts",
        "analytics",
        "settings",
        "price_book",
      ],
      appointment_status: [
        "draft",
        "published",
        "checked_in",
        "completed",
        "cancelled",
      ],
      billing_status: ["not_billed", "partially_billed", "billed"],
      permission_type: ["view", "create", "edit", "delete"],
      recurrence_frequency: [
        "daily",
        "weekly",
        "bi_weekly",
        "monthly",
        "quarterly",
        "semi_annually",
        "annually",
        "one_time",
      ],
      service_order_status: [
        "draft",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
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
