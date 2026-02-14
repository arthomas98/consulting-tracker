import { useState, useMemo } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { Invoice, TimeEntry } from '../../types';
import { totalHours, totalAmount, generateInvoiceNumber, entryAmount } from '../../utils/calculations';
import { formatDate, today } from '../../utils/dateUtils';
import { formatCurrency, formatHours } from '../../utils/formatCurrency';

interface Props {
  onDone: () => void;
}

export default function CreateInvoice({ onDone }: Props) {
  const { companies, projects, timeEntries, invoices, saveInvoice } = useStorage();
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeCompanies = companies.filter((c) => c.isActive && c.invoiceRequired);

  const [companyId, setCompanyId] = useState(activeCompanies[0]?.id || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const company = companies.find((c) => c.id === companyId);

  const invoicedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    invoices.forEach((i) => i.timeEntryIds.forEach((eid) => ids.add(eid)));
    return ids;
  }, [invoices]);

  const uninvoicedEntries = useMemo(() => {
    return timeEntries
      .filter((e) => e.companyId === companyId && !invoicedEntryIds.has(e.id))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [timeEntries, companyId, invoicedEntryIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === uninvoicedEntries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uninvoicedEntries.map((e) => e.id)));
    }
  }

  function handleCreate() {
    if (!company || selected.size === 0) return;
    const entries = uninvoicedEntries.filter((e) => selected.has(e.id));
    const hours = totalHours(entries);
    const amount = totalAmount(entries, company.hourlyRate);
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      companyId,
      invoiceNumber: generateInvoiceNumber(invoices, year),
      invoiceDate: today(),
      timeEntryIds: entries.map((e) => e.id),
      totalHours: hours,
      totalAmount: amount,
      currency: company.currency,
      rateUsed: company.hourlyRate,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    saveInvoice(invoice);
    onDone();
  }

  const selectedEntries = uninvoicedEntries.filter((e) => selected.has(e.id));
  const selHours = totalHours(selectedEntries);
  const selAmount = company ? totalAmount(selectedEntries, company.hourlyRate) : 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <select
          value={companyId}
          onChange={(e) => { setCompanyId(e.target.value); setSelected(new Set()); }}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {uninvoicedEntries.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No uninvoiced entries for this company.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.size === uninvoicedEntries.length} onChange={toggleAll} className="rounded" />
              Select all ({uninvoicedEntries.length} entries)
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {uninvoicedEntries.map((e) => (
              <label key={e.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="rounded" />
                <span className="text-sm text-gray-500 w-24 shrink-0">{formatDate(e.date)}</span>
                {e.projectId && <span className="text-xs text-gray-400 shrink-0">{projectMap.get(e.projectId)?.name}</span>}
                <span className="text-sm flex-1 truncate">{e.description}</span>
                <span className="text-sm font-medium w-16 text-right">{formatHours(e.hours)}h</span>
              </label>
            ))}
          </div>
          {selected.size > 0 && company && (
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <div className="flex justify-between">
                <span>Selected entries:</span>
                <span className="font-medium">{selected.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Total hours:</span>
                <span className="font-medium">{formatHours(selHours)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rate:</span>
                <span>{formatCurrency(company.hourlyRate, company.currency)}/hr</span>
              </div>
              <div className="flex justify-between font-semibold border-t mt-2 pt-2">
                <span>Total amount:</span>
                <span>{formatCurrency(selAmount, company.currency)}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <button onClick={onDone} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button
          onClick={handleCreate}
          disabled={selected.size === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Invoice
        </button>
      </div>
    </div>
  );
}
