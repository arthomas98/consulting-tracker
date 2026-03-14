import type { Currency, BillingType } from './company';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type InvoiceDetailLevel = 'weekly' | 'detailed';

export interface LineItem {
  id: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}

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
  paymentNote?: string;
  notes?: string;
  billingType?: BillingType;
  retainerMonth?: string;
  lineItems?: LineItem[];
  detailLevel?: InvoiceDetailLevel;
  exchangeRateToUSD?: number;
  createdAt: string;
  updatedAt: string;
}
