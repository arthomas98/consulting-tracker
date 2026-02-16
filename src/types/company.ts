export type Currency = 'USD' | 'EUR' | 'GBP';

export interface Company {
  id: string;
  name: string;
  currency: Currency;
  hourlyRate: number;
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
