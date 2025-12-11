import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
  },
  companyInfo: {
    textAlign: 'right',
    maxWidth: 200,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 8,
    color: '#111827',
  },
  reportNumber: {
    fontSize: 12,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 10,
    textAlign: 'center',
    color: '#9ca3af',
    marginBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    color: '#374151',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  infoItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 10,
    color: '#1f2937',
  },
  conditionBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  conditionRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conditionLabel: {
    fontSize: 10,
    color: '#374151',
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontSize: 12,
  },
  workDescription: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 6,
    lineHeight: 1.6,
  },
  photoSection: {
    marginTop: 10,
  },
  photoPair: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  photoContainer: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 8,
    fontWeight: 600,
    textAlign: 'center',
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  beforeLabel: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
  afterLabel: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
  },
  photo: {
    width: '100%',
    height: 180,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
  },
  problemSection: {
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  problemTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#92400e',
    marginBottom: 8,
  },
  signatureSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  signatureImage: {
    width: 200,
    height: 80,
    objectFit: 'contain',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 8,
  },
  signatureName: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
});

interface CompanySettings {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface FieldReportPhoto {
  id: string;
  file_url: string;
  photo_type: 'before' | 'after' | 'problem' | 'other';
  paired_photo_id?: string | null;
  caption?: string | null;
}

interface FieldReportData {
  report_number: string;
  service_date: string;
  arrival_time?: string | null;
  worker_name: string;
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

interface FieldReportPDFDocumentProps {
  report: FieldReportData;
  companySettings: CompanySettings;
}

const renderStars = (rating: number | null | undefined) => {
  const value = rating || 0;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Text key={i} style={styles.star}>
        {i <= value ? '★' : '☆'}
      </Text>
    );
  }
  return <View style={styles.starsContainer}>{stars}</View>;
};

export function FieldReportPDFDocument({ report, companySettings }: FieldReportPDFDocumentProps) {
  const beforePhotos = report.photos?.filter(p => p.photo_type === 'before') || [];
  const afterPhotos = report.photos?.filter(p => p.photo_type === 'after') || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {companySettings.logo_url && (
              <Image src={companySettings.logo_url} style={styles.logo} />
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{companySettings.name}</Text>
            {companySettings.address && (
              <Text style={styles.companyDetail}>{companySettings.address}</Text>
            )}
            {companySettings.phone && (
              <Text style={styles.companyDetail}>{companySettings.phone}</Text>
            )}
            {companySettings.email && (
              <Text style={styles.companyDetail}>{companySettings.email}</Text>
            )}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.reportTitle}>Service Report</Text>
        <Text style={styles.reportNumber}>{report.report_number}</Text>
        <Text style={styles.reportDate}>{formatDate(report.service_date)}</Text>

        {/* Service Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{report.customer?.name || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>
                {report.location?.name || 'N/A'}
                {report.location?.address && `\n${report.location.address}`}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Service Provider</Text>
              <Text style={styles.infoValue}>{report.worker_name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Time of Attendance</Text>
              <Text style={styles.infoValue}>{report.arrival_time || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Condition on Arrival */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condition on Arrival</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.conditionBox, { flex: 1 }]}>
              <View style={styles.conditionRating}>
                <Text style={styles.conditionLabel}>Carpet Condition</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  {renderStars(report.carpet_condition_arrival)}
                  <Text style={styles.conditionValue}>
                    {report.carpet_condition_arrival || 'N/A'}/5
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.conditionBox, { flex: 1 }]}>
              <View style={styles.conditionRating}>
                <Text style={styles.conditionLabel}>Hard Floor Condition</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  {renderStars(report.hard_floor_condition_arrival)}
                  <Text style={styles.conditionValue}>
                    {report.hard_floor_condition_arrival || 'N/A'}/5
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {report.flooring_state_description && (
            <View style={[styles.conditionBox, { marginTop: 8 }]}>
              <Text style={styles.infoLabel}>Overall Condition Notes</Text>
              <Text style={[styles.infoValue, { marginTop: 4 }]}>
                {report.flooring_state_description}
              </Text>
            </View>
          )}
        </View>

        {/* Work Completed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Completed</Text>
          <View style={styles.workDescription}>
            <Text style={styles.infoValue}>
              {report.work_description || 'No description provided.'}
            </Text>
          </View>
        </View>

        {/* Problem Areas (if any) */}
        {report.had_problem_areas && report.problem_areas_description && (
          <View style={styles.section}>
            <View style={styles.problemSection}>
              <Text style={styles.problemTitle}>Problem Areas Identified</Text>
              <Text style={styles.infoValue}>{report.problem_areas_description}</Text>
              {report.methods_attempted && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.infoLabel, { color: '#92400e' }]}>
                    Methods Attempted
                  </Text>
                  <Text style={[styles.infoValue, { marginTop: 4 }]}>
                    {report.methods_attempted}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Customer Signature */}
        {report.customer_signature_data && (
          <View style={styles.signatureSection}>
            <Text style={styles.infoLabel}>Customer Signature</Text>
            <Image src={report.customer_signature_data} style={styles.signatureImage} />
            {report.customer_signature_name && (
              <Text style={styles.signatureName}>
                Signed by: {report.customer_signature_name}
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated on {new Date().toLocaleDateString('en-AU')}</Text>
          <Text>{companySettings.name}</Text>
        </View>
      </Page>

      {/* Photos Page (if there are photos) */}
      {beforePhotos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Before & After Photos</Text>
          <View style={styles.photoSection}>
            {beforePhotos.map((beforePhoto, index) => {
              const pairedAfter = afterPhotos.find(
                a => a.id === beforePhoto.paired_photo_id || a.paired_photo_id === beforePhoto.id
              );
              return (
                <View key={beforePhoto.id} style={styles.photoPair} wrap={false}>
                  <View style={styles.photoContainer}>
                    <Text style={[styles.photoLabel, styles.beforeLabel]}>BEFORE</Text>
                    <Image src={beforePhoto.file_url} style={styles.photo} />
                  </View>
                  {pairedAfter && (
                    <View style={styles.photoContainer}>
                      <Text style={[styles.photoLabel, styles.afterLabel]}>AFTER</Text>
                      <Image src={pairedAfter.file_url} style={styles.photo} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text>Generated on {new Date().toLocaleDateString('en-AU')}</Text>
            <Text>{companySettings.name}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
