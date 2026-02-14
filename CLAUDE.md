# Consulting Tracker

Local-first React SPA for tracking consulting time, invoicing, and payments.

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS v4 (using `@tailwindcss/vite` plugin, `@import "tailwindcss"` syntax)
- React Router v6
- localStorage for persistence (no backend)
- Deployed on Vercel (`vercel.json` handles SPA routing)

## Project Structure
```
src/
  types/           # TypeScript interfaces (Company, Project, TimeEntry, Invoice, Currency)
  utils/           # Pure utility functions
    storage.ts     # localStorage CRUD layer
    calculations.ts # entryAmount(), totalsByCurrency(), parseHoursInput(), getEntryPaymentStatus()
    dateUtils.ts   # Date helpers (ISO string based, format: YYYY-MM-DD)
    formatCurrency.ts # Intl.NumberFormat wrappers, formatCurrencyShort for charts
    csv.ts         # CSV export
  contexts/
    StorageContext.tsx # Global state provider with all CRUD operations
  components/
    layout/AppLayout.tsx   # Header nav (gradient indigo-to-blue) + Outlet
    dashboard/DashboardPage.tsx # Summary cards, revenue chart, quick entry, action items
    time/TimePage.tsx      # List (default) / week view of entries with inline actions
    time/TimeEntryForm.tsx # Shared form (compact mode for dashboard, full mode for modal)
    invoices/InvoicesPage.tsx, CreateInvoice.tsx, InvoiceDetail.tsx
    companies/CompaniesPage.tsx # Company CRUD with inline project management
    reports/ReportsPage.tsx # 3-tab reports with expandable company detail rows
    shared/Modal.tsx, Badge.tsx
```

## Key Patterns

### Dual entry mode (Hours vs Amount)
- TimeEntry has optional `fixedAmount` field for companies that pay a flat amount
- `entryAmount(entry, rate)` in calculations.ts handles both modes everywhere
- Forms toggle between Hours and Amount mode; Amount mode shows optional hours field for record-keeping
- Compact form (dashboard quick entry) also shows both Amount and Hours (opt) inputs in amount mode

### Payment tracking
- Companies with `invoiceRequired: true` go through Invoice workflow (draft -> sent -> paid)
- Companies without invoice requirement: entries have `paidDate` field, toggled via always-visible "Paid"/"Unpaid" buttons on Time page
- Dashboard "Awaiting Payment" section shows:
  - Invoices with status "sent" (company, invoice #, amount)
  - Individual unpaid entries for non-invoice companies (date, company, description, amount, per-entry Paid button, bulk Mark all paid)
- Status values: "Paid" (green), "Unpaid" (orange), "Uninvoiced" (orange), "Invoiced / Awaiting payment" (yellow), "Draft" (gray)

### Companies
- Have `currency` (USD/EUR), `hourlyRate`, `invoiceRequired`, `paymentTerms`, `paymentMethod`, contact info, notes
- Each company has managed Projects (active/inactive)
- Company cards show payment terms and payment method separated by dot

### Reports
- 3 tabs: Work Summary, Invoicing Status, Revenue
- Company rows are stacked vertically (not side-by-side) and clickable to expand
- Expanded detail rows show date, project, description, status badge, hours, amount
- Revenue tab YTD totals also stacked vertically

### Time page
- Defaults to list view (not week view)
- Compact single-line rows with fixed-width columns for alignment
- Project column always takes space (even when empty) so descriptions align
- Action buttons (Paid/Unpaid, Edit, Dup, Del) always visible, right-aligned with fixed width
- Uses `tabular-nums` for number alignment

### UI style
- Gradient header (indigo-to-blue), gradient body background (slate-50 to blue-50)
- Colorful gradient summary cards on dashboard (indigo, blue, emerald, amber)
- Rounded-xl corners and shadows on panels
- Pure CSS/HTML bar charts (no chart library), bar heights in pixels not percentages

### Type imports
- Always use `import type { ... }` for type-only imports (Rollup requires this)

## Running
```bash
npm install   # on new machine, need to install deps
npm run dev   # Vite dev server on localhost:5173
npm run build # Production build
```

## No git repo
This project lives in Dropbox and syncs across machines. No git is configured.
