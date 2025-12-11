import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    paddingBottom: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  logoContainer: {
    flex: 1,
  },
  logo: {
    width: 100,
    height: 35,
    objectFit: 'contain',
  },
  textLogo: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#3b82f6',
  },
  headerRight: {
    alignItems: 'flex-end',
    maxWidth: 180,
  },
  reportLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  reportNumberLarge: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 2,
  },
  reportDateHeader: {
    fontSize: 9,
    color: '#374151',
    marginTop: 2,
  },
  // Title section
  titleSection: {
    textAlign: 'center',
    marginBottom: 14,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  mainTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: '#6b7280',
  },
  // Section styles
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textTransform: 'uppercase',
  },
  // Info grid styles
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  infoItem: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  infoItemFull: {
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  infoValueLarge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  // Condition rating styles
  conditionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  conditionCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  conditionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  star: {
    fontSize: 12,
    color: '#fbbf24',
  },
  starEmpty: {
    fontSize: 12,
    color: '#d1d5db',
  },
  conditionScore: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 2,
  },
  // Work description styles
  workBox: {
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  workText: {
    fontSize: 9,
    color: '#166534',
    lineHeight: 1.5,
  },
  // Problem area styles
  problemBox: {
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  problemTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
    marginBottom: 4,
  },
  problemText: {
    fontSize: 9,
    color: '#78350f',
    lineHeight: 1.4,
  },
  problemMethodsLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  // Photo styles
  photoPageTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  photoPairContainer: {
    marginBottom: 14,
  },
  photoPairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoPair: {
    flexDirection: 'row',
    gap: 8,
  },
  photoWrapper: {
    flex: 1,
  },
  photoLabelBefore: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: 3,
    textTransform: 'uppercase',
  },
  photoLabelAfter: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    borderRadius: 3,
    textTransform: 'uppercase',
  },
  photo: {
    width: '100%',
    height: 140,
    objectFit: 'cover',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoCaption: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noPhotoPlaceholder: {
    flex: 1,
    height: 140,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  // Additional photos section
  additionalPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  additionalPhotoWrapper: {
    width: '48%',
  },
  additionalPhotoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 3,
    marginBottom: 3,
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRadius: 3,
    textTransform: 'uppercase',
  },
  additionalPhoto: {
    width: '100%',
    height: 110,
    objectFit: 'cover',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  // Signature styles
  signatureSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  signatureTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  signatureBox: {
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 6,
  },
  signatureImage: {
    width: 160,
    height: 60,
    objectFit: 'contain',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  signatureName: {
    fontSize: 9,
    color: '#374151',
    marginTop: 6,
  },
  signatureDate: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  // Footer styles
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  pageNumber: {
    fontSize: 7,
    color: '#6b7280',
  },
  // Contractor info banner
  contractorBanner: {
    backgroundColor: '#eff6ff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractorLabel: {
    fontSize: 8,
    color: '#1e40af',
  },
  contractorValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },
});

export interface CompanySettings {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface FieldReportPhoto {
  id: string;
  file_url: string;
  photo_type: 'before' | 'after' | 'problem' | 'other';
  paired_photo_id?: string | null;
  caption?: string | null;
}

export interface FieldReportData {
  report_number: string;
  service_date: string;
  arrival_time?: string | null;
  worker_name?: string | null;
  contractor_name?: string | null;
  contractor_phone?: string | null;
  manual_location_entry?: string | null;
  customer?: { name: string } | null;
  location?: { name: string; address?: string | null } | null;
  carpet_condition_arrival?: number | null;
  hard_floor_condition_arrival?: number | null;
  flooring_state_description?: string | null;
  work_description?: string | null;
  had_problem_areas?: boolean | null;
  problem_areas_description?: string | null;
  methods_attempted?: string | null;
  customer_signature_data?: string | null;
  customer_signature_name?: string | null;
  photos?: FieldReportPhoto[];
}

export interface FieldReportPDFDocumentProps {
  report: FieldReportData;
  companySettings: CompanySettings;
}

// Helper function to format time
const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return 'Not recorded';
  
  // Handle HH:MM:SS format
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  return timeStr;
};

// Helper function to format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Helper function to clean report number
const cleanReportNumber = (num: string): string => {
  // Remove DRAFT- prefix for customer-facing PDF
  return num.replace(/^FR-DRAFT-/, 'FR-').replace(/^DRAFT-/, '');
};

// Helper function to render stars
const renderStars = (rating: number | null | undefined) => {
  const value = rating || 0;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Text key={i} style={i <= value ? styles.star : styles.starEmpty}>
        ★
      </Text>
    );
  }
  return <View style={styles.starsContainer}>{stars}</View>;
};

// Helper to get customer display name
const getCustomerName = (report: FieldReportData): string => {
  if (report.customer?.name) return report.customer.name;
  if (report.manual_location_entry) {
    // Try to extract customer name from manual entry
    const parts = report.manual_location_entry.split(/[\/\-,]/);
    return parts[0]?.trim() || report.manual_location_entry;
  }
  return 'Not specified';
};

// Helper to get location display
const getLocationDisplay = (report: FieldReportData): string => {
  if (report.location?.name && report.location?.address) {
    return `${report.location.name}\n${report.location.address}`;
  }
  if (report.location?.name) return report.location.name;
  if (report.location?.address) return report.location.address;
  if (report.manual_location_entry) {
    // Try to extract location from manual entry
    const parts = report.manual_location_entry.split(/[\/\-]/);
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : report.manual_location_entry;
  }
  return 'Not specified';
};

// Helper to get worker/service provider name
const getServiceProvider = (report: FieldReportData): string => {
  return report.worker_name || report.contractor_name || 'Not specified';
};

export function FieldReportPDFDocument({ report, companySettings }: FieldReportPDFDocumentProps) {
  // Separate photos by type
  const beforePhotos = report.photos?.filter(p => p.photo_type === 'before') || [];
  const afterPhotos = report.photos?.filter(p => p.photo_type === 'after') || [];
  const problemPhotos = report.photos?.filter(p => p.photo_type === 'problem') || [];
  const otherPhotos = report.photos?.filter(p => p.photo_type === 'other') || [];
  
  // Create photo pairs with improved bidirectional matching
  const usedAfterIds = new Set<string>();
  const photoPairs: { before: FieldReportPhoto; after?: FieldReportPhoto }[] = [];
  
  beforePhotos.forEach(beforePhoto => {
    // Try to find matching after photo
    let matchingAfter = afterPhotos.find(
      a => !usedAfterIds.has(a.id) && 
           (a.id === beforePhoto.paired_photo_id || a.paired_photo_id === beforePhoto.id)
    );
    
    // If no explicit pairing, try to match by index/position
    if (!matchingAfter) {
      const availableAfter = afterPhotos.find(a => !usedAfterIds.has(a.id));
      if (availableAfter) {
        matchingAfter = availableAfter;
      }
    }
    
    if (matchingAfter) {
      usedAfterIds.add(matchingAfter.id);
    }
    
    photoPairs.push({ before: beforePhoto, after: matchingAfter });
  });
  
  // Get any unpaired after photos
  const unpairedAfterPhotos = afterPhotos.filter(a => !usedAfterIds.has(a.id));
  
  // Combine additional photos
  const additionalPhotos = [...problemPhotos, ...otherPhotos, ...unpairedAfterPhotos];
  
  // Check if we have photos to display
  const hasPhotoPairs = photoPairs.length > 0;
  const hasAdditionalPhotos = additionalPhotos.length > 0;
  const hasAnyPhotos = hasPhotoPairs || hasAdditionalPhotos;
  
  // Check if this was a contractor submission
  const isContractorSubmission = !report.worker_name && report.contractor_name;

  return (
    <Document>
      {/* Page 1: Report Details */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {companySettings.logo_url ? (
              <Image src={companySettings.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.textLogo}>{companySettings.name}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.reportLabel}>Service Report</Text>
            <Text style={styles.reportNumberLarge}>{cleanReportNumber(report.report_number)}</Text>
            <Text style={styles.reportDateHeader}>{formatDate(report.service_date)}</Text>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Field Service Report</Text>
          <Text style={styles.subtitle}>
            Completed by {getServiceProvider(report)}
          </Text>
        </View>

        {/* Contractor Banner (if applicable) */}
        {isContractorSubmission && (
          <View style={styles.contractorBanner}>
            <Text style={styles.contractorLabel}>Submitted by contractor: </Text>
            <Text style={styles.contractorValue}>{report.contractor_name}</Text>
          </View>
        )}

        {/* Service Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Service Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Customer</Text>
                <Text style={styles.infoValueLarge}>{getCustomerName(report)}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Arrival Time</Text>
                <Text style={styles.infoValueLarge}>{formatTime(report.arrival_time)}</Text>
              </View>
            </View>
            <View style={styles.infoItemFull}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Service Location</Text>
                <Text style={styles.infoValue}>{getLocationDisplay(report)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Condition on Arrival */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Condition on Arrival</Text>
          </View>
          <View style={styles.conditionGrid}>
            <View style={styles.conditionCard}>
              <Text style={styles.conditionLabel}>Carpet Condition</Text>
              {renderStars(report.carpet_condition_arrival)}
              <Text style={styles.conditionScore}>
                {report.carpet_condition_arrival ? `${report.carpet_condition_arrival}/5` : 'N/A'}
              </Text>
            </View>
            <View style={styles.conditionCard}>
              <Text style={styles.conditionLabel}>Hard Floor Condition</Text>
              {renderStars(report.hard_floor_condition_arrival)}
              <Text style={styles.conditionScore}>
                {report.hard_floor_condition_arrival ? `${report.hard_floor_condition_arrival}/5` : 'N/A'}
              </Text>
            </View>
          </View>
          {report.flooring_state_description && (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Condition Notes</Text>
              <Text style={styles.infoValue}>{report.flooring_state_description}</Text>
            </View>
          )}
        </View>

        {/* Work Completed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work Completed</Text>
          </View>
          <View style={styles.workBox}>
            <Text style={styles.workText}>
              {report.work_description || 'No work description provided.'}
            </Text>
          </View>
        </View>

        {/* Problem Areas (if any) */}
        {report.had_problem_areas && report.problem_areas_description && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Problem Areas Identified</Text>
            </View>
            <View style={styles.problemBox}>
              <Text style={styles.problemText}>{report.problem_areas_description}</Text>
              {report.methods_attempted && (
                <>
                  <Text style={styles.problemMethodsLabel}>Methods Attempted</Text>
                  <Text style={styles.problemText}>{report.methods_attempted}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Customer Signature */}
        {report.customer_signature_data && (
          <View style={styles.signatureSection}>
            <Text style={styles.signatureTitle}>Customer Acknowledgment</Text>
            <View style={styles.signatureBox}>
              <Image src={report.customer_signature_data} style={styles.signatureImage} />
              {report.customer_signature_name && (
                <Text style={styles.signatureName}>
                  Signed by: {report.customer_signature_name}
                </Text>
              )}
              <Text style={styles.signatureDate}>
                Date: {formatDate(report.service_date)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated on {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <Text style={styles.pageNumber}>Page 1{hasAnyPhotos ? ` of ${hasPhotoPairs && hasAdditionalPhotos ? '3' : '2'}` : ''}</Text>
          <Text>{companySettings.name}</Text>
        </View>
      </Page>

      {/* Page 2: Before & After Photos */}
      {hasPhotoPairs && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.photoPageTitle}>Before & After Documentation</Text>
          
          {photoPairs.map((pair, index) => (
            <View key={pair.before.id} style={styles.photoPairContainer} wrap={false}>
              <View style={styles.photoPair}>
                <View style={styles.photoWrapper}>
                  <Text style={styles.photoLabelBefore}>Before</Text>
                  <Image src={pair.before.file_url} style={styles.photo} />
                  {pair.before.caption && (
                    <Text style={styles.photoCaption}>{pair.before.caption}</Text>
                  )}
                </View>
                {pair.after ? (
                  <View style={styles.photoWrapper}>
                    <Text style={styles.photoLabelAfter}>After</Text>
                    <Image src={pair.after.file_url} style={styles.photo} />
                    {pair.after.caption && (
                      <Text style={styles.photoCaption}>{pair.after.caption}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.photoWrapper}>
                    <Text style={styles.photoLabelAfter}>After</Text>
                    <View style={styles.noPhotoPlaceholder}>
                      <Text style={styles.noPhotoText}>No after photo</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text>Generated on {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Text style={styles.pageNumber}>Page 2{hasAdditionalPhotos ? ' of 3' : ' of 2'}</Text>
            <Text>{companySettings.name}</Text>
          </View>
        </Page>
      )}

      {/* Page 3: Additional Photos (if any) */}
      {hasAdditionalPhotos && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.photoPageTitle}>Additional Documentation</Text>
          
          <View style={styles.additionalPhotosGrid}>
            {additionalPhotos.map((photo) => (
              <View key={photo.id} style={styles.additionalPhotoWrapper} wrap={false}>
                <Text style={styles.additionalPhotoLabel}>
                  {photo.photo_type === 'problem' ? 'Problem Area' : 
                   photo.photo_type === 'after' ? 'After' : 'Documentation'}
                </Text>
                <Image src={photo.file_url} style={styles.additionalPhoto} />
                {photo.caption && (
                  <Text style={styles.photoCaption}>{photo.caption}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text>Generated on {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Text style={styles.pageNumber}>Page {hasPhotoPairs ? '3 of 3' : '2 of 2'}</Text>
            <Text>{companySettings.name}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
