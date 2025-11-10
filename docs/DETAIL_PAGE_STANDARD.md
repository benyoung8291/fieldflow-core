# Document Detail Page Standard Layout

## Overview

All document detail pages (projects, service orders, invoices, quotes, customers, etc.) now use a standardized layout component (`DocumentDetailLayout`) that provides:

1. **Consistent Toolbar** with back button, title, status badges, File menu, and action buttons
2. **Key Information Section** for metrics and summary cards
3. **Tabbed Content Area** for detailed information and related documents
4. **Integrated Audit History Tab** - audit history is displayed in a dedicated tab (no floating drawer)

## Benefits

- **Consistency**: All detail pages have the same structure and UX
- **Maintainability**: Changes to layout apply to all detail pages
- **Efficiency**: New detail pages can be created faster
- **User Experience**: Familiar navigation patterns across modules

## Usage

### Basic Example

```tsx
import DocumentDetailLayout, { 
  DocumentAction, 
  FileMenuAction, 
  StatusBadge, 
  TabConfig 
} from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";

export default function MyDocumentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Fetch your data...
  const { data: document, isLoading } = useQuery({...});
  
  // Configure status badges
  const statusBadges: StatusBadge[] = [
    {
      label: document?.status,
      variant: "outline",
      className: statusColors[document?.status],
    },
  ];
  
  // Configure primary actions
  const primaryActions: DocumentAction[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setEditDialogOpen(true),
      variant: "default",
    },
  ];
  
  // Configure File menu
  const fileMenuActions: FileMenuAction[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => {/* edit */},
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () => {/* duplicate */},
    },
    {
      label: "Change Status",
      onClick: () => {/* change status */},
      separator: true, // adds separator before this item
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => {/* delete */},
      destructive: true, // red text
      separator: true,
    },
  ];
  
  // Key info section with metrics
  const keyInfoSection = (
    <div className="grid gap-4 md:grid-cols-4">
      <KeyInfoCard
        icon={DollarSign}
        label="Total Value"
        value={`$${document?.total.toLocaleString()}`}
        description="Incl. tax"
      />
      <KeyInfoCard
        icon={Calendar}
        label="Due Date"
        value={format(document?.dueDate, "MMM dd")}
        iconColor="text-blue-500"
      />
    </div>
  );
  
  // Configure tabs
  const tabs: TabConfig[] = [
    {
      value: "overview",
      label: "Overview",
      content: <OverviewContent />,
    },
    {
      value: "line-items",
      label: "Line Items",
      icon: <List className="h-4 w-4" />,
      badge: lineItems?.length, // optional badge with count
      content: <LineItemsTab />,
    },
    {
      value: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline tableName="my_table" recordId={id!} />
          </CardContent>
        </Card>
      ),
    },
  ];
  
  return (
    <DocumentDetailLayout
      title={document?.name}
      subtitle={document?.customer?.name}
      backPath="/my-documents"
      statusBadges={statusBadges}
      primaryActions={primaryActions}
      fileMenuActions={fileMenuActions}
      keyInfoSection={keyInfoSection}
      tabs={tabs}
      defaultTab="overview"
      isLoading={isLoading}
      notFoundMessage={!document ? "Document not found" : undefined}
    />
  );
}
```

## Component Props

### DocumentDetailLayout Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Document title (e.g., project name) |
| `subtitle` | `string` | No | Subtitle text (e.g., customer name) |
| `backPath` | `string` | Yes | Path to navigate back to list |
| `statusBadges` | `StatusBadge[]` | No | Array of status badges to display |
| `primaryActions` | `DocumentAction[]` | No | Primary action buttons |
| `fileMenuActions` | `FileMenuAction[]` | No | File dropdown menu items |
| `auditTableName` | `string` | No | *(Deprecated - kept for compatibility)* |
| `auditRecordId` | `string` | No | *(Deprecated - kept for compatibility)* |
| `keyInfoSection` | `ReactNode` | No | Key metrics/info cards section |
| `tabs` | `TabConfig[]` | Yes | Tab configuration array |
| `defaultTab` | `string` | No | Default active tab value |
| `isLoading` | `boolean` | No | Show loading state |
| `notFoundMessage` | `string` | No | Message when document not found |

### StatusBadge Type

```tsx
interface StatusBadge {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string; // for custom colors
}
```

### DocumentAction Type

```tsx
interface DocumentAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "ghost";
  show?: boolean; // conditionally show/hide action
}
```

### FileMenuAction Type

```tsx
interface FileMenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  separator?: boolean; // add separator before item
  destructive?: boolean; // red text for delete
}
```

### TabConfig Type

```tsx
interface TabConfig {
  value: string; // unique tab identifier
  label: string; // tab label text
  icon?: ReactNode; // optional icon
  content: ReactNode; // tab content
  badge?: string | number; // optional badge (e.g., count)
}
```

## KeyInfoCard Component

Use `KeyInfoCard` for consistent metric cards in the key info section:

```tsx
<KeyInfoCard
  icon={DollarSign}
  label="Revenue"
  value="$125,000"
  description="Year to date"
  iconColor="text-green-500" // optional custom color
/>
```

## Migration Guide

### Steps to Migrate Existing Detail Pages

1. **Import the new components**:
   ```tsx
   import DocumentDetailLayout, { DocumentAction, FileMenuAction, StatusBadge, TabConfig } from "@/components/layout/DocumentDetailLayout";
   import KeyInfoCard from "@/components/layout/KeyInfoCard";
   ```

2. **Remove old layout imports**:
   - Remove `DashboardLayout` wrapper
   - Remove `Button`, `Badge`, `Tabs` related imports (still needed for content)
   - Remove `AuditDrawer` import (audit history is now in a tab, not a floating drawer)

3. **Configure the layout props**:
   - Define `statusBadges` array
   - Define `primaryActions` array
   - Define `fileMenuActions` array
   - Create `keyInfoSection` JSX
   - Convert tabs to `TabConfig[]` array

4. **Replace return statement**:
   - Remove `<DashboardLayout>` wrapper
   - Remove `<AuditDrawer>` component
   - Remove manual toolbar/header JSX
   - Remove manual tabs JSX
   - Return `<DocumentDetailLayout />` with all props

5. **Test**:
   - Verify all actions work
   - Check tab navigation
   - Test file menu dropdowns
   - Verify audit history displays in the History tab (no floating drawer button)

### Example Migration: Before & After

**Before:**
```tsx
return (
  <DashboardLayout>
    <AuditDrawer tableName="projects" recordId={id!} />
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate("/projects")}>Back</Button>
        <h1>{project.name}</h1>
        <Badge>{project.status}</Badge>
        <Button onClick={handleEdit}>Edit</Button>
      </div>
      <div>...key info cards...</div>
      <Tabs>
        <TabsList>...</TabsList>
        <TabsContent>...</TabsContent>
      </Tabs>
    </div>
  </DashboardLayout>
);
```

**After:**
```tsx
// Note: auditTableName and auditRecordId are optional (kept for backward compatibility)
return (
  <DocumentDetailLayout
    title={project.name}
    backPath="/projects"
    statusBadges={statusBadges}
    primaryActions={primaryActions}
    fileMenuActions={fileMenuActions}
    keyInfoSection={keyInfoSection}
    tabs={tabs} // Include a History tab with AuditTimeline component
  />
);
```

## Pages to Migrate

- [x] ProjectDetails ✅ (reference implementation)
- [ ] ServiceOrderDetails
- [ ] ServiceContractDetails
- [ ] InvoiceDetails
- [ ] RecurringInvoiceDetails
- [ ] QuoteDetails
- [ ] CustomerDetails
- [ ] CustomerLocationDetails
- [ ] LeadDetails
- [ ] WorkerDetails
- [ ] AppointmentDetails

## Best Practices

1. **Keep File Menu Consistent**: Use standard actions (Edit, Duplicate, Change Status, Delete) in the same order
2. **Use KeyInfoCard**: For consistency in metric displays
3. **Badge Counts**: Add badge counts to tabs showing lists (e.g., "Tasks (5)")
4. **Conditional Actions**: Use `show` property to conditionally display actions
5. **History Tab**: Always include a History tab with `AuditTimeline` component - this is the only way to view audit history
6. **Loading States**: Pass `isLoading` and `notFoundMessage` for proper state handling
