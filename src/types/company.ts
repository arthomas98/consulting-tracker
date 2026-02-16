export type Currency = 'USD' | 'EUR' | 'GBP';
export type BillingType = 'hourly' | 'fixed_monthly';

export interface Company {
  id: string;
  name: string;
  currency: Currency;
  billingType: BillingType;
  hourlyRate: number;
  monthlyRate?: number;
  invoiceRequired: boolean;
  paymentTerms?: string;
  paymentMethod?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
