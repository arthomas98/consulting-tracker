import { useState, useMemo } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { Invoice } from '../../types';
import { formatDate, daysSince } from '../../utils/dateUtils';
import { formatCurrency, formatHours } from '../../utils/formatCurrency';
import Modal from '../shared/Modal';
import Badge from '../shared/Badge';
import CreateInvoice from './CreateInvoice';
import InvoiceDetail from './InvoiceDetail';

const statusColor: Record<string, string> = { draft: 'gray', sent: 'yellow', paid: 'green' };

export default function InvoicesPage() {
  const { companies, invoices, deleteInvoice } = useStorage();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState('');

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (statusFilter) list = list.filter((i) => i.status === statusFilter);
    if (companyFilter) list = list.filter((i) => i.companyId === companyFilter);
    return list.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }, [invoices, statusFilter, companyFilter]);

  // Refresh viewing invoice from latest state
  const currentViewing = viewing ? invoices.find((i) => i.id === viewing.id) || null : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Invoices</h2>
        <div className="flex items-center gap-3">
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">All companies</option>
            {companies.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
          <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Create Invoice
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No invoices yet. Create one to get started.</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-right px-4 py-3 font-medium">Hours</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Aging</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((inv) => {
                const company = companyMap.get(inv.companyId);
                const aging = inv.status === 'sent' ? `${daysSince(inv.invoiceDate)}d` : '';
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewing(inv)}>
                    <td className="px-4 py-3 font-medium">{inv.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3">{company?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-right">{formatHours(inv.totalHours)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                    <td className="px-4 py-3"><Badge color={statusColor[inv.status]}>{inv.status}</Badge></td>
                    <td className="px-4 py-3 text-right text-gray-500">{aging}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'draft' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft invoice?')) deleteInvoice(inv.id); }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create Invoice" wide>
        <CreateInvoice onDone={() => setCreating(false)} />
      </Modal>

      <Modal open={!!currentViewing} onClose={() => setViewing(null)} title="Invoice Details" wide>
        {currentViewing && <InvoiceDetail invoice={currentViewing} onClose={() => setViewing(null)} />}
      </Modal>
    </div>
  );
}
