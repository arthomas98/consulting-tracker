import type { BankAccount, BusinessProfile } from './storage';
import type { Company } from '../types';
import type { Invoice } from '../types';

export function getBankById(profile: BusinessProfile, id: string | undefined): BankAccount | undefined {
  if (!id) return undefined;
  return profile.banks?.find((b) => b.id === id);
}

export function getDefaultBank(profile: BusinessProfile): BankAccount | undefined {
  const banks = profile.banks ?? [];
  if (banks.length === 0) return undefined;
  return banks.find((b) => b.id === profile.defaultBankId) ?? banks[0];
}

export function resolveInvoiceBank(
  invoice: Pick<Invoice, 'bankIdOverride'>,
  company: Pick<Company, 'bankId'> | undefined,
  profile: BusinessProfile,
): BankAccount | undefined {
  return (
    getBankById(profile, invoice.bankIdOverride) ??
    getBankById(profile, company?.bankId) ??
    getDefaultBank(profile)
  );
}
