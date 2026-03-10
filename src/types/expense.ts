import type { Currency } from './company';

export type ExpenseCategory =
  | 'advertising'
  | 'car_transport'
  | 'contract_labor'
  | 'insurance'
  | 'legal_professional'
  | 'meals'
  | 'office_supplies'
  | 'rent_coworking'
  | 'software_subscriptions'
  | 'telephone_internet'
  | 'travel'
  | 'education_training'
  | 'equipment'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  advertising: 'Advertising & Marketing',
  car_transport: 'Car & Transportation',
  contract_labor: 'Contract Labor',
  insurance: 'Insurance',
  legal_professional: 'Legal & Professional Services',
  meals: 'Meals (50% deductible)',
  office_supplies: 'Office Supplies',
  rent_coworking: 'Rent / Coworking',
  software_subscriptions: 'Software & Subscriptions',
  telephone_internet: 'Telephone & Internet',
  travel: 'Travel',
  education_training: 'Education & Training',
  equipment: 'Equipment',
  other: 'Other',
};

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: Currency;
  vendor?: string;
  paymentMethod?: string;
  hasReceipt: boolean;
  companyId?: string;
  recurring: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
