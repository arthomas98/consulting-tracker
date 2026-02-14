# Consulting Time Tracker — Requirements

## Overview

A local-first React SPA for tracking consulting work across multiple client companies, managing invoicing status, and reporting on work history and revenue.

> "Local-first React SPA with localStorage + optional Google Sheets sync, deployed on Vercel"

---

## Architecture

Per the standard architecture template:

- **Stack**: React + TypeScript + Vite + Tailwind CSS
- **Storage**: localStorage primary, optional Google Sheets sync (user-owned data)
- **Deploy**: Vercel (static hosting)
- **State**: React Context, debounced sync manager
- **Patterns**: Local-first, data mapper for Sheets, type-safe interfaces

---

## Data Model

### Company

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| name | string | e.g., "Acme Corp" |
| currency | "USD" \| "EUR" | Default: USD. Extensible to other currencies later |
| hourlyRate | number | Rate in the company's currency |
| invoiceRequired | boolean | Whether this company requires a formal invoice to trigger payment |
| paymentTerms | string (optional) | e.g., "Net 30", "Upon receipt", "Monthly auto-pay" |
| contactName | string (optional) | Billing contact |
| contactEmail | string (optional) | Billing contact email |
| notes | string (optional) | |
| isActive | boolean | Soft delete / hide inactive clients |
| createdAt | ISO string | |
| updatedAt | ISO string | |

### TimeEntry

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| companyId | string | FK to Company |
| date | ISO date string | The date the work was performed |
| hours | number | Decimal hours (e.g., 1.5 = 1h 30m). Stored to nearest 0.25 |
| description | string | What was done — this becomes the invoice line item |
| createdAt | ISO string | |
| updatedAt | ISO string | |

### Invoice

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| companyId | string | FK to Company |
| invoiceNumber | string (optional) | User-assigned invoice number |
| invoiceDate | ISO date string | Date the invoice was sent |
| timeEntryIds | string[] | Which time entries are included |
| totalHours | number | Computed from entries, stored for history |
| totalAmount | number | Computed: totalHours × rate at time of invoice |
| currency | "USD" \| "EUR" | Captured at invoice creation (rate could change later) |
| rateUsed | number | Captured at invoice creation |
| status | "draft" \| "sent" \| "paid" | |
| paidDate | ISO date string (optional) | When payment was received |
| notes | string (optional) | |
| createdAt | ISO string | |
| updatedAt | ISO string | |

**Design decisions:**

- **Quarter-hour granularity** (0.25 increments) for time entries. This is standard for consulting. The UI should make it easy to enter in quarter-hour increments but not prevent other values.
- **Rate and currency are captured on the Invoice** at creation time, so historical invoices remain accurate if rates change.
- **Time entries not requiring invoices** still need payment tracking. For companies where `invoiceRequired = false`, work can be marked as paid directly without creating an invoice (see Payment Status below).

---

## Payment Status Logic

Every time entry ultimately has one of these statuses, derived (not stored directly on the entry):

| Status | Condition |
|---|---|
| **Uninvoiced** | Entry is not linked to any invoice AND company requires invoices |
| **No invoice needed** | Entry is not linked to any invoice AND company does NOT require invoices |
| **Invoiced / Awaiting payment** | Entry is linked to an invoice with status "sent" |
| **Paid** | Entry is linked to an invoice with status "paid" OR entry is directly marked paid (for non-invoice companies) |
| **Draft** | Entry is linked to a draft invoice |

For companies that don't require invoices, add a simple `paidDate` field on TimeEntry (optional) so entries can be marked paid individually or in bulk.

---

## Features

### 1. Company Management

- Add / edit / deactivate companies
- Set hourly rate and currency per company
- Flag whether invoicing is required
- Optional: payment terms, billing contact info

### 2. Time Entry

- **Quick entry form**: Select company, date (defaults to today), hours, description
- Hours input: support decimal entry (1.5) and HH:MM entry (1:30), store as decimal rounded to nearest 0.25
- **Inline entry on a daily or weekly view** — not just a modal. Minimize clicks for repeated daily use
- Edit and delete existing entries
- Duplicate an entry (for recurring work patterns)

### 3. Invoice Management

- **Create invoice**: Select a company → see all uninvoiced time entries → select entries to include → generates invoice record
- Invoice captures the rate and currency at creation time
- Assign optional invoice number
- Invoice status workflow: Draft → Sent → Paid
- Mark invoice as paid with payment date
- View/print invoice summary (formatted for PDF or print — not a full invoice generator, but enough to attach to an email or paste into a template)

### 4. Payment Tracking (Non-Invoice Companies)

- For companies where `invoiceRequired = false`: bulk-select time entries and mark as paid
- Set paid date

### 5. Reporting / History Views

All reports should support filtering by:
- **Time period**: Current month, specific month, current year, custom date range
- **Company**: All companies or a specific company

#### 5a. Work Summary

- Table: Company | Hours | Amount | Currency
- Totals per currency (don't combine USD and EUR into a single total — display separately)
- Drill-down to individual time entries

#### 5b. Invoicing Status

- **Needs invoicing**: Uninvoiced entries grouped by company, with hours and amounts
- **Invoiced / Awaiting payment**: Open invoices with aging (days since sent)
- **Paid**: Paid invoices and directly-paid entries in the period

#### 5c. Revenue Summary

- By company for a period: hours, gross revenue (in original currency)
- Year-to-date totals per currency
- Do NOT attempt currency conversion for combined totals — just show USD total and EUR total separately

### 6. Dashboard (Home View)

- Current month summary: hours worked, amounts by currency
- Action items: entries needing invoicing, invoices awaiting payment
- Quick-entry widget for logging time without navigating away

### 7. CSV Export

- Export time entries for a date range (all companies or filtered by company)
- Export columns: Date, Company, Hours, Rate, Currency, Amount, Description, Invoice #, Invoice Status, Paid Date
- Useful for tax preparation, importing into accounting software, or record-keeping
- Export invoices list: Invoice #, Company, Date, Hours, Amount, Currency, Status, Paid Date

Suggested top-level navigation:

| Tab | Purpose |
|---|---|
| **Dashboard** | Summary + quick entry |
| **Time** | Full time entry list/calendar, add/edit entries |
| **Invoices** | Invoice list, create invoices, track payment status |
| **Companies** | Manage client companies and rates |
| **Reports** | Filtered views of work history and revenue |

---

## Project Structure

```
src/
  components/
    layout/            # Nav, sidebar, page shell
    dashboard/         # Dashboard widgets
    time/              # Time entry forms, list, calendar view
    invoices/          # Invoice list, creation flow, detail view
    companies/         # Company CRUD
    reports/           # Report views and filters
    shared/            # Buttons, modals, date pickers, currency display
  contexts/
    StorageContext.tsx  # localStorage read/write + sync state
    AuthContext.tsx     # Google OAuth (for Sheets sync)
  services/
    sheetsDataMapper.ts
    syncManager.ts
  types/
    company.ts
    timeEntry.ts
    invoice.ts
  utils/
    storage.ts         # Immutable CRUD operations on localStorage
    calculations.ts    # Hours totals, amount calculations, rounding
    dateUtils.ts       # Period filtering, date formatting
    formatCurrency.ts  # Currency display formatting
public/
  app.html
vercel.json
```

---

## Google Sheets Sync (Optional)

If enabled, the following sheets map to the data model:

| Sheet | Columns map to |
|---|---|
| Companies | Company fields |
| TimeEntries | TimeEntry fields |
| Invoices | Invoice fields |

Standard data mapper pattern per the architecture template. Sync is optional and non-blocking.

---

## Out of Scope (for now)

- Full invoice PDF generation (use the summary view + your own template externally)
- Live currency conversion / exchange rates
- Expense tracking (only time-based billing)
- Tax calculations
- Multi-user / team features
- Mobile-native app (responsive web should be sufficient)

---

## Resolved Decisions

1. **No timer** — Manual after-the-fact entry only. No start/stop clock.
2. **Auto-generated invoice numbers** — Format: `YYYY-NNN` (e.g., 2026-001), sequential per calendar year, auto-incrementing. User can override if needed.
3. **Single rate per company** — No need for multiple rate tiers per client.
4. **CSV export** — Supported (see Feature 7 below).
