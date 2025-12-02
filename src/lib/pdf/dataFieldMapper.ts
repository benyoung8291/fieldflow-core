// Enhanced Data Field Mapper for Unified PDF System

import { format, parseISO } from "date-fns";
import type { DocumentData, CompanySettings, FieldMapping } from "./types";

/**
 * Get a value from a nested object path
 * e.g., "customer.billing_address.city" -> data.customer.billing_address.city
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  
  return value;
}

/**
 * Format a value based on the specified format type
 */
export function formatValue(
  value: any, 
  formatType?: FieldMapping['format'],
  dateFormat?: string
): string {
  if (value === null || value === undefined) return '';
  
  switch (formatType) {
    case 'currency':
      return formatCurrency(Number(value));
    
    case 'date':
      return formatDate(value, dateFormat || 'dd/MM/yyyy');
    
    case 'date_long':
      return formatDate(value, 'MMMM d, yyyy');
    
    case 'number':
      return formatNumber(Number(value));
    
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    
    case 'text':
    default:
      return String(value);
  }
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value || 0);
}

/**
 * Format a date string
 */
export function formatDate(value: string | Date, dateFormat: string = 'dd/MM/yyyy'): string {
  try {
    const date = typeof value === 'string' ? parseISO(value) : value;
    return format(date, dateFormat);
  } catch {
    return String(value);
  }
}

/**
 * Build a comprehensive data mapping object from document data and company settings
 */
export function buildDataMapping(
  documentData: DocumentData,
  companySettings: CompanySettings,
  documentType: 'quote' | 'invoice' | 'purchase_order' | 'field_report'
): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Company fields
  mapping['company.name'] = companySettings.company_name || '';
  mapping['company.address'] = companySettings.address || '';
  mapping['company.city'] = companySettings.city || '';
  mapping['company.state'] = companySettings.state || '';
  mapping['company.postcode'] = companySettings.postcode || '';
  mapping['company.full_address'] = [
    companySettings.address,
    companySettings.city,
    companySettings.state,
    companySettings.postcode
  ].filter(Boolean).join(', ');
  mapping['company.phone'] = companySettings.phone || '';
  mapping['company.email'] = companySettings.email || '';
  mapping['company.website'] = companySettings.website || '';
  mapping['company.abn'] = companySettings.abn || '';
  mapping['company.logo'] = companySettings.logo_url || '';
  
  // Document fields - common
  mapping['document.number'] = documentData.document_number || '';
  mapping['document.date'] = documentData.document_date ? formatDate(documentData.document_date) : '';
  mapping['document.date_long'] = documentData.document_date ? formatDate(documentData.document_date, 'MMMM d, yyyy') : '';
  mapping['document.status'] = documentData.status || '';
  mapping['document.notes'] = documentData.notes || '';
  mapping['document.terms'] = documentData.terms_conditions || '';
  
  // Document type specific labels
  const typeLabels: Record<string, { title: string; numberLabel: string }> = {
    quote: { title: 'Quote', numberLabel: 'Quote #' },
    invoice: { title: 'Tax Invoice', numberLabel: 'Invoice #' },
    purchase_order: { title: 'Purchase Order', numberLabel: 'PO #' },
    field_report: { title: 'Field Report', numberLabel: 'Report #' },
  };
  
  mapping['document.type_title'] = typeLabels[documentType]?.title || 'Document';
  mapping['document.number_label'] = typeLabels[documentType]?.numberLabel || 'Document #';
  
  // Quote specific
  if (documentType === 'quote') {
    mapping['quote.title'] = documentData.title || '';
    mapping['quote.valid_until'] = documentData.valid_until ? formatDate(documentData.valid_until) : '';
    mapping['quote.number'] = documentData.document_number || '';
  }
  
  // Invoice specific
  if (documentType === 'invoice') {
    mapping['invoice.due_date'] = documentData.due_date ? formatDate(documentData.due_date) : '';
    mapping['invoice.payment_terms'] = documentData.payment_terms || '';
    mapping['invoice.amount_paid'] = formatCurrency(documentData.amount_paid || 0);
    mapping['invoice.balance_due'] = formatCurrency(documentData.balance_due || 0);
    mapping['invoice.number'] = documentData.document_number || '';
  }
  
  // Purchase Order specific
  if (documentType === 'purchase_order') {
    mapping['po.delivery_date'] = documentData.delivery_date ? formatDate(documentData.delivery_date) : '';
    mapping['po.shipping_address'] = documentData.shipping_address || '';
    mapping['po.shipping_instructions'] = documentData.shipping_instructions || '';
    mapping['po.number'] = documentData.document_number || '';
  }
  
  // Field Report specific
  if (documentType === 'field_report') {
    mapping['report.site_location'] = documentData.site_location || '';
    mapping['report.technician'] = documentData.technician_name || '';
    mapping['report.weather'] = documentData.weather_conditions || '';
    mapping['report.findings'] = documentData.findings || '';
    mapping['report.work_performed'] = documentData.work_performed || '';
    mapping['report.recommendations'] = documentData.recommendations || '';
    mapping['report.number'] = documentData.document_number || '';
  }
  
  // Customer fields
  if (documentData.customer) {
    mapping['customer.name'] = documentData.customer.name || '';
    mapping['customer.email'] = documentData.customer.email || '';
    mapping['customer.phone'] = documentData.customer.phone || '';
    mapping['customer.address'] = documentData.customer.address || '';
    mapping['customer.city'] = documentData.customer.city || '';
    mapping['customer.state'] = documentData.customer.state || '';
    mapping['customer.postcode'] = documentData.customer.postcode || '';
    mapping['customer.full_address'] = [
      documentData.customer.address,
      documentData.customer.city,
      documentData.customer.state,
      documentData.customer.postcode
    ].filter(Boolean).join(', ');
    mapping['customer.abn'] = documentData.customer.abn || '';
    mapping['customer.contact'] = documentData.customer.contact_name || '';
  }
  
  // Supplier fields (for POs)
  if (documentData.supplier) {
    mapping['supplier.name'] = documentData.supplier.name || '';
    mapping['supplier.email'] = documentData.supplier.email || '';
    mapping['supplier.phone'] = documentData.supplier.phone || '';
    mapping['supplier.address'] = documentData.supplier.address || '';
    mapping['supplier.city'] = documentData.supplier.city || '';
    mapping['supplier.state'] = documentData.supplier.state || '';
    mapping['supplier.postcode'] = documentData.supplier.postcode || '';
    mapping['supplier.full_address'] = [
      documentData.supplier.address,
      documentData.supplier.city,
      documentData.supplier.state,
      documentData.supplier.postcode
    ].filter(Boolean).join(', ');
    mapping['supplier.abn'] = documentData.supplier.abn || '';
    mapping['supplier.contact'] = documentData.supplier.contact_name || '';
  }
  
  // Location fields
  if (documentData.location) {
    mapping['location.name'] = documentData.location.name || '';
    mapping['location.address'] = documentData.location.address || '';
  }
  
  // Totals
  mapping['totals.subtotal'] = formatCurrency(documentData.subtotal || 0);
  mapping['totals.tax'] = formatCurrency(documentData.tax_amount || 0);
  mapping['totals.discount'] = formatCurrency(documentData.discount_amount || 0);
  mapping['totals.total'] = formatCurrency(documentData.total || 0);
  mapping['totals.gst'] = formatCurrency(documentData.tax_amount || 0);
  
  // Current date
  mapping['current.date'] = format(new Date(), 'dd/MM/yyyy');
  mapping['current.date_long'] = format(new Date(), 'MMMM d, yyyy');
  mapping['current.year'] = format(new Date(), 'yyyy');
  
  return mapping;
}

/**
 * Replace placeholders in text with actual values
 * Supports {{field.path}} syntax
 */
export function replacePlaceholders(
  text: string,
  dataMapping: Record<string, string>
): string {
  if (!text) return '';
  
  return text.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
    const trimmedPath = fieldPath.trim();
    
    // Check for format modifiers: {{field|format}}
    const [path, formatModifier] = trimmedPath.split('|').map((s: string) => s.trim());
    
    const value = dataMapping[path];
    
    if (value === undefined || value === null) {
      return ''; // Return empty string for missing values
    }
    
    // Apply format modifier if specified
    if (formatModifier) {
      return formatValue(value, formatModifier as FieldMapping['format']);
    }
    
    return value;
  });
}

/**
 * Get available fields for a document type
 */
export function getAvailableFields(documentType: 'quote' | 'invoice' | 'purchase_order' | 'field_report'): Array<{
  category: string;
  fields: Array<{ path: string; label: string; format?: FieldMapping['format'] }>;
}> {
  const commonFields = [
    {
      category: 'Company',
      fields: [
        { path: 'company.name', label: 'Company Name' },
        { path: 'company.address', label: 'Address' },
        { path: 'company.full_address', label: 'Full Address' },
        { path: 'company.phone', label: 'Phone' },
        { path: 'company.email', label: 'Email' },
        { path: 'company.website', label: 'Website' },
        { path: 'company.abn', label: 'ABN' },
        { path: 'company.logo', label: 'Logo URL' },
      ],
    },
    {
      category: 'Document',
      fields: [
        { path: 'document.number', label: 'Document Number' },
        { path: 'document.date', label: 'Date' },
        { path: 'document.date_long', label: 'Date (Long Format)' },
        { path: 'document.status', label: 'Status' },
        { path: 'document.notes', label: 'Notes' },
        { path: 'document.terms', label: 'Terms & Conditions' },
        { path: 'document.type_title', label: 'Document Type Title' },
        { path: 'document.number_label', label: 'Number Label' },
      ],
    },
    {
      category: 'Customer',
      fields: [
        { path: 'customer.name', label: 'Customer Name' },
        { path: 'customer.email', label: 'Email' },
        { path: 'customer.phone', label: 'Phone' },
        { path: 'customer.address', label: 'Address' },
        { path: 'customer.full_address', label: 'Full Address' },
        { path: 'customer.abn', label: 'ABN' },
        { path: 'customer.contact', label: 'Contact Name' },
      ],
    },
    {
      category: 'Totals',
      fields: [
        { path: 'totals.subtotal', label: 'Subtotal', format: 'currency' },
        { path: 'totals.tax', label: 'Tax/GST', format: 'currency' },
        { path: 'totals.discount', label: 'Discount', format: 'currency' },
        { path: 'totals.total', label: 'Total', format: 'currency' },
      ],
    },
  ];
  
  const typeSpecificFields: Record<string, Array<{ category: string; fields: Array<{ path: string; label: string; format?: FieldMapping['format'] }> }>> = {
    quote: [
      {
        category: 'Quote',
        fields: [
          { path: 'quote.title', label: 'Quote Title' },
          { path: 'quote.valid_until', label: 'Valid Until', format: 'date' },
          { path: 'quote.number', label: 'Quote Number' },
        ],
      },
    ],
    invoice: [
      {
        category: 'Invoice',
        fields: [
          { path: 'invoice.due_date', label: 'Due Date', format: 'date' },
          { path: 'invoice.payment_terms', label: 'Payment Terms' },
          { path: 'invoice.amount_paid', label: 'Amount Paid', format: 'currency' },
          { path: 'invoice.balance_due', label: 'Balance Due', format: 'currency' },
          { path: 'invoice.number', label: 'Invoice Number' },
        ],
      },
    ],
    purchase_order: [
      {
        category: 'Purchase Order',
        fields: [
          { path: 'po.delivery_date', label: 'Delivery Date', format: 'date' },
          { path: 'po.shipping_address', label: 'Shipping Address' },
          { path: 'po.shipping_instructions', label: 'Shipping Instructions' },
          { path: 'po.number', label: 'PO Number' },
        ],
      },
      {
        category: 'Supplier',
        fields: [
          { path: 'supplier.name', label: 'Supplier Name' },
          { path: 'supplier.email', label: 'Email' },
          { path: 'supplier.phone', label: 'Phone' },
          { path: 'supplier.address', label: 'Address' },
          { path: 'supplier.full_address', label: 'Full Address' },
          { path: 'supplier.abn', label: 'ABN' },
          { path: 'supplier.contact', label: 'Contact Name' },
        ],
      },
    ],
    field_report: [
      {
        category: 'Field Report',
        fields: [
          { path: 'report.site_location', label: 'Site Location' },
          { path: 'report.technician', label: 'Technician' },
          { path: 'report.weather', label: 'Weather Conditions' },
          { path: 'report.findings', label: 'Findings' },
          { path: 'report.work_performed', label: 'Work Performed' },
          { path: 'report.recommendations', label: 'Recommendations' },
          { path: 'report.number', label: 'Report Number' },
        ],
      },
      {
        category: 'Location',
        fields: [
          { path: 'location.name', label: 'Location Name' },
          { path: 'location.address', label: 'Location Address' },
        ],
      },
    ],
  };
  
  return [...commonFields, ...(typeSpecificFields[documentType] || [])];
}
