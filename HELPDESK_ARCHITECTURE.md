# Help Desk & Microsoft Graph Integration Architecture

## Overview
This document outlines the architecture, security measures, and best practices implemented in the Help Desk module with Microsoft Graph API integration.

## System Architecture

### Core Components
1. **Microsoft Graph API Integration** (`_shared/microsoft-graph.ts`)
   - Centralized API access with retry logic
   - Automatic token refresh with race condition prevention
   - Rate limiting and error handling
   - Industry-standard OAuth2 implementation

2. **Email Deduplication** (`_shared/email-deduplication.ts`)
   - Multi-strategy threading detection
   - Prevents duplicate ticket creation
   - Uses email headers (In-Reply-To, References) for reliable threading

3. **Edge Functions**
   - `microsoft-oauth-authorize`: Initiates OAuth flow
   - `microsoft-oauth-callback`: Handles OAuth callback
   - `microsoft-sync-emails`: Syncs emails from Graph API
   - `microsoft-send-email`: Sends emails via Graph API
   - `microsoft-test-email`: Tests email account connection
   - `microsoft-refresh-token`: Refreshes OAuth tokens
   - `microsoft-list-mailboxes`: Lists available mailboxes

## Security Measures

### 1. Authentication & Authorization
- **JWT-based authentication** for all edge functions except OAuth callbacks
- **Tenant isolation**: All queries filtered by tenant_id
- **Row Level Security (RLS)** enabled on all helpdesk tables
- **Service role access** only where necessary with proper validation

### 2. Token Management
- Tokens stored encrypted in database
- Automatic token refresh 5 minutes before expiry
- Atomic token updates to prevent race conditions
- No token logging or exposure in error messages

### 3. Input Validation
- All user inputs validated before processing
- Email addresses validated
- SQL injection prevention through parameterized queries
- XSS prevention through HTML sanitization

### 4. Rate Limiting
- Automatic retry with exponential backoff
- Microsoft Graph API rate limit handling (429 responses)
- Token refresh throttling

### 5. Error Handling
- Comprehensive error handling without exposing sensitive data
- User-friendly error messages
- Detailed logging for debugging (server-side only)
- Graceful degradation

## Performance Optimizations

### 1. Database
- **Indexes** on frequently queried columns:
  - `idx_helpdesk_tickets_microsoft_message_id`
  - `idx_helpdesk_messages_microsoft_message_id`
  - `idx_helpdesk_messages_internet_message_id`
  - `idx_helpdesk_tickets_email_account_id`
- **Batch operations** for email sync
- **Efficient queries** with proper JOINs and filters

### 2. API Calls
- **Retry logic** with exponential backoff
- **Request batching** where possible
- **Caching** of frequently accessed data
- **Parallel processing** for independent operations

### 3. Email Threading
- **Multi-strategy detection**:
  1. In-Reply-To header (most reliable)
  2. References header (fallback)
  3. conversationId (Microsoft-specific)
  4. Subject matching (last resort)
- **Prioritizes active tickets** over archived

## Reliability Features

### 1. Idempotency
- Duplicate message detection by `microsoft_message_id`
- Prevents processing same email multiple times
- Safe to retry sync operations

### 2. Error Recovery
- Automatic token refresh on 401 errors
- Retry logic for transient failures
- Graceful handling of missing data

### 3. Data Integrity
- Foreign key constraints
- NOT NULL constraints on critical fields
- Atomic updates for state changes
- Audit logging for all changes

## Best Practices Implemented

### 1. Code Organization
- **Shared modules** for common functionality
- **Type safety** with TypeScript
- **Clear separation of concerns**
- **Comprehensive error types**

### 2. Logging
- **Structured logging** with context
- **Performance monitoring** markers
- **Error tracking** with stack traces
- **No sensitive data** in logs

### 3. Testing Strategy
- Edge function testing via `microsoft-test-email`
- Account validation before use
- Connection testing for new accounts

### 4. Maintenance
- **Clear documentation** in code
- **Migration scripts** for schema changes
- **Backward compatibility** where possible

## Email Flow

### Inbound Email Flow
1. User sends email to configured mailbox
2. Microsoft Graph delivers to inbox
3. `microsoft-sync-emails` function polls inbox
4. Email deduplication checks for existing ticket
5. Creates new ticket OR adds message to existing
6. Updates ticket status and timestamps

### Outbound Email Flow
1. User composes reply in Help Desk UI
2. `microsoft-send-email` function called
3. Token validated/refreshed
4. Email sent via Graph API
5. Sent message ID retrieved for threading
6. Message saved to database

## Database Schema

### helpdesk_email_accounts
- Stores Microsoft OAuth credentials (encrypted)
- Tracks sync status and errors
- Links to pipeline for routing

### helpdesk_tickets
- Main ticket entity
- Stores threading metadata
- Links to customers/contacts
- Tracks status and assignments

### helpdesk_messages
- Individual email messages
- Maintains threading chain
- Stores attachments metadata
- Tracks direction (inbound/outbound)

## Monitoring & Alerting

### Key Metrics to Monitor
1. **Sync success rate** - % of successful email syncs
2. **Token refresh failures** - indicates OAuth issues
3. **API error rates** - Microsoft Graph API health
4. **Response times** - performance tracking
5. **Duplicate detection rate** - threading accuracy

### Health Checks
- Email account connection tests
- Token validity checks
- API permission validation

## Security Checklist

- [x] RLS policies on all tables
- [x] Tenant isolation enforced
- [x] Tokens encrypted at rest
- [x] No token logging
- [x] Input validation
- [x] XSS prevention
- [x] SQL injection prevention
- [x] Rate limiting
- [x] Error message sanitization
- [x] Audit logging
- [x] Least privilege access

## Future Enhancements

### Planned
1. **Webhook subscriptions** for real-time email delivery
2. **Attachment optimization** with CDN
3. **Full-text search** for emails
4. **AI-powered categorization**
5. **Advanced threading** with ML

### Under Consideration
1. Multi-mailbox support per account
2. Email templates with variables
3. Automated responses
4. SLA tracking
5. Reporting dashboard

## Troubleshooting Guide

### Common Issues

**Token Expired Errors**
- Cause: Refresh token invalid
- Solution: Reconnect email account
- Prevention: Monitor token expiry

**Duplicate Tickets**
- Cause: Threading detection failed
- Solution: Improve email headers
- Prevention: Better subject matching

**Slow Sync**
- Cause: Large inbox
- Solution: Increase polling limit
- Prevention: Archive old emails

**Missing Emails**
- Cause: Mailbox permissions
- Solution: Validate scopes
- Prevention: Regular permission checks

## Support & Maintenance

### Regular Tasks
- Monitor sync errors
- Review failed authentications
- Clean up old temp tokens
- Verify RLS policies
- Update dependencies

### Emergency Procedures
1. Disable affected email account
2. Check error logs
3. Validate tokens
4. Test connection
5. Re-enable account

## Compliance

### Data Retention
- Email messages: Retained per tenant policy
- Audit logs: 90 days minimum
- Temp tokens: Cleaned up after 24 hours

### Privacy
- PII encrypted at rest
- Access logged
- Tenant isolation enforced
- GDPR compliant

---

**Last Updated**: 2025-11-25
**Version**: 2.0
**Maintained By**: Development Team
