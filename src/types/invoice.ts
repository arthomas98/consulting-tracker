import type { Currency, BillingType } from './company';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  timeEntryIds: string[];
  totalHours: number;
  totalAmount: number;
  currency: Currency;
  rateUsed: number;
  status: InvoiceStatus;
  paidDate?: string;
  notes?: string;
  billingType?: BillingType;
  retainerMonth?: string;
  exchangeRateToUSD?: number;
  createdAt: string;
  updatedAt: string;
}
