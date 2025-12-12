// Unified PDF Template System Types

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_gst_free?: boolean;
  parent_line_item_id?: string | null;
  sub_items?: LineItem[];
  location_name?: string;
}

export interface CompanySettings {
  company_name?: string;
  company_legal_name?: string;
  logo_url?: string;
  address?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  abn?: string;
  default_tax_rate?: number;
  // Bank details for invoices
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_instructions?: string;
  accounts_email?: string;
  terms_conditions?: string;
}

export interface CustomerInfo {
  name: string;
  legal_name?: string;
  trading_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  abn?: string;
  contact_name?: string;
  billing_email?: string;
  billing_phone?: string;
  // Billing contact details (separate from customer address)
  billing_contact_name?: string;
  billing_contact_address?: string;
  billing_contact_city?: string;
  billing_contact_state?: string;
  billing_contact_postcode?: string;
}

export interface SupplierInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  abn?: string;
  contact_name?: string;
}

export interface DocumentData {
  // Common fields
  document_number: string;
  document_date: string;
  status?: string;
  notes?: string;
  terms_conditions?: string;
  
  // Quote specific
  title?: string;
  valid_until?: string;
  
  // Invoice specific
  due_date?: string;
  payment_terms?: string;
  amount_paid?: number;
  balance_due?: number;
  customer_id?: string;
  invoice_description?: string;
  
  // Ship To (service location)
  ship_to?: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
  
  // Purchase Order specific
  delivery_date?: string;
  shipping_address?: string;
  shipping_instructions?: string;
  
  // Field Report specific
  site_location?: string;
  technician_name?: string;
  weather_conditions?: string;
  findings?: string;
  work_performed?: string;
  recommendations?: string;
  
  // Totals
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total: number;
  
  // Related entities
  customer?: CustomerInfo;
  supplier?: SupplierInfo;
  location?: {
    name: string;
    address?: string;
  };
  
  // Source document references (for invoices from service orders/projects)
  source_service_order?: {
    order_number: string;
    work_order_number?: string;
    purchase_order_number?: string;
  };
  source_project?: {
    name: string;
  };
}

export interface LineItemsConfig {
  columns: ('description' | 'quantity' | 'unit_price' | 'line_total' | 'cost_price' | 'margin')[];
  show_sub_items: boolean;
  column_widths: Record<string, number>;
  header_style: {
    background?: string;
    font_weight?: string;
    font_size?: number;
    text_color?: string;
  };
  row_style: {
    border_bottom?: boolean;
    alternate_background?: string;
    font_size?: number;
  };
  sub_item_indent?: number;
}

export interface PageSettings {
  size: 'A4' | 'LETTER' | 'LEGAL';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ContentZone {
  y: number | 'after_line_items' | 'bottom';
  height: number | 'auto';
}

export interface ContentZones {
  header: ContentZone;
  document_info: ContentZone;
  line_items: ContentZone;
  totals: ContentZone;
  footer: ContentZone;
}

export interface FieldMapping {
  placeholder: string;
  systemField: string;
  format?: 'currency' | 'date' | 'date_long' | 'number' | 'percentage' | 'text';
  dateFormat?: string;
}

export interface UnifiedTemplate {
  id: string;
  name: string;
  document_type: 'quote' | 'invoice' | 'purchase_order' | 'field_report';
  template_json?: any; // Fabric.js canvas JSON for visual elements
  template_image_url?: string;
  field_mappings: Record<string, FieldMapping>;
  line_items_config: LineItemsConfig;
  header_config?: any;
  footer_config?: any;
  content_zones: ContentZones;
  page_settings: PageSettings;
  is_default?: boolean;
}

export interface UnifiedPDFConfig {
  template: UnifiedTemplate;
  documentData: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  documentType: 'quote' | 'invoice' | 'purchase_order' | 'field_report';
}

export type DocumentType = 'quote' | 'invoice' | 'purchase_order' | 'field_report';
