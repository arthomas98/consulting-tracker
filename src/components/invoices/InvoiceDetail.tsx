import { useMemo, useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { Invoice } from '../../types';
import type { BusinessProfile } from '../../utils/storage';
import { formatDate, today, getMonthLabel } from '../../utils/dateUtils';
import { formatCurrency, formatHours } from '../../utils/formatCurrency';
import { getExchangeRate } from '../../utils/exchangeRate';
import Badge from '../shared/Badge';

interface Props {
  invoice: Invoice;
  onClose: () => void;
}

const statusColor: Record<string, string> = { draft: 'gray', sent: 'yellow', paid: 'green' };

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPrintHtml(
  invoice: Invoice,
  companyName: string,
  entries: { date: string; project?: string; description: string; hours: number; amount: string }[],
  totalHours: string,
  totalAmount: string,
  rate: string,
  profile: BusinessProfile,
  notes?: string,
) {
  const isRetainer = invoice.billingType === 'fixed_monthly';
  const rateLabel = isRetainer ? 'Monthly Retainer' : `${rate}/hr`;

  const rows = entries.map((e) =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555">${esc(e.date)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${e.project ? `<span style="color:#999;margin-right:4px">[${esc(e.project)}]</span>` : ''}${esc(e.description)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${isRetainer ? '—' : (e.hours > 0 ? formatHours(e.hours) : '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${esc(e.amount)}</td>
    </tr>`
  ).join('');

  const hasProfile = profile.name || profile.address || profile.email || profile.phone || profile.ein;

  const profileHtml = hasProfile ? `
    <div class="from">
      ${profile.name ? `<div style="font-weight:600;font-size:16px">${esc(profile.name)}</div>` : ''}
      ${profile.address ? `<div>${esc(profile.address).replace(/\n/g, '<br>')}</div>` : ''}
      ${profile.email ? `<div>${esc(profile.email)}</div>` : ''}
      ${profile.phone ? `<div>${esc(profile.phone)}</div>` : ''}
      ${profile.ein ? `<div style="margin-top:4px">EIN: ${esc(profile.ein)}</div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html><head>
<title>Invoice ${esc(invoice.invoiceNumber || '')} - ${esc(companyName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #222; max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
  .header h1 { font-size: 28px; margin: 0; }
  .from { font-size: 13px; color: #555; text-align: right; line-height: 1.5; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .party { font-size: 14px; }
  .party .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 14px; margin-bottom: 20px; }
  .meta .label { color: #888; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
  th:nth-child(3), th:nth-child(4) { text-align: right; }
  tfoot td { font-weight: 600; border-top: 2px solid #ddd; padding: 8px; }
  .notes { font-size: 13px; color: #666; margin-top: 16px; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<div class="header">
  <h1>INVOICE</h1>
  ${profileHtml}
</div>
<div class="parties">
  <div class="party">
    <div class="label">Bill To</div>
    <div style="font-weight:600">${esc(companyName)}</div>
  </div>
  <div class="party" style="text-align:right">
    <div class="label">Invoice Details</div>
    <div><span style="color:#888">Invoice #:</span> ${esc(invoice.invoiceNumber || '—')}</div>
    <div><span style="color:#888">Date:</span> ${formatDate(invoice.invoiceDate)}</div>
    <div><span style="color:#888">Rate:</span> ${rateLabel}</div>
  </div>
</div>
<table>
  <thead><tr><th>Date</th><th>Description</th><th>Hours</th><th>Amount</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2">Total</td>
    <td style="text-align:right">${isRetainer ? '—' : totalHours}</td>
    <td style="text-align:right">${totalAmount}</td>
  </tr></tfoot>
</table>
${notes ? `<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>` : ''}
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

export default function InvoiceDetail({ invoice, onClose }: Props) {
  const { companies, projects, timeEntries, saveInvoice, profile } = useStorage();
  const company = companies.find((c) => c.id === invoice.companyId);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const isRetainer = invoice.billingType === 'fixed_monthly';

  const entries = useMemo(
    () => timeEntries.filter((e) => invoice.timeEntryIds.includes(e.id)).sort((a, b) => a.date.localeCompare(b.date)),
    [timeEntries, invoice.timeEntryIds]
  );

  const [sendingRate, setSendingRate] = useState(false);
  const [rateWarning, setRateWarning] = useState('');

  async function updateStatus(status: Invoice['status'], paidDate?: string) {
    let exchangeRateToUSD = invoice.exchangeRateToUSD;

    if (status === 'sent' && exchangeRateToUSD == null) {
      if (invoice.currency === 'USD') {
        exchangeRateToUSD = 1.0;
      } else {
        setSendingRate(true);
        setRateWarning('');
        const rate = await getExchangeRate(invoice.currency);
        setSendingRate(false);
        if (rate != null) {
          exchangeRateToUSD = rate;
        } else {
          setRateWarning(`Could not fetch ${invoice.currency}/USD rate. Invoice marked as sent without exchange rate.`);
        }
      }
    }

    saveInvoice({ ...invoice, status, paidDate, exchangeRateToUSD, updatedAt: new Date().toISOString() });
  }

  function handlePrint() {
    let printEntries: { date: string; project?: string; description: string; hours: number; amount: string }[];

    if (isRetainer && entries.length === 0) {
      const monthLabel = invoice.retainerMonth ? getMonthLabel(invoice.retainerMonth + '-01') : '';
      printEntries = [{
        date: formatDate(invoice.invoiceDate),
        description: `Monthly advisory retainer — ${monthLabel}`,
        hours: 0,
        amount: formatCurrency(invoice.totalAmount, invoice.currency),
      }];
    } else {
      printEntries = entries.map((e) => ({
        date: formatDate(e.date),
        project: e.projectId ? projectMap.get(e.projectId)?.name : undefined,
        description: e.description,
        hours: e.hours,
        amount: formatCurrency(e.fixedAmount != null ? e.fixedAmount : e.hours * invoice.rateUsed, invoice.currency),
      }));
    }

    const html = buildPrintHtml(
      invoice,
      company?.name || 'Unknown',
      printEntries,
      formatHours(invoice.totalHours),
      formatCurrency(invoice.totalAmount, invoice.currency),
      formatCurrency(invoice.rateUsed, invoice.currency),
      profile,
      invoice.notes,
    );

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  const monthLabel = invoice.retainerMonth ? getMonthLabel(invoice.retainerMonth + '-01') : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Invoice #{invoice.invoiceNumber}</p>
          <p className="font-semibold text-lg">{company?.name}</p>
        </div>
        <Badge color={statusColor[invoice.status]}>{invoice.status.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Date:</span> {formatDate(invoice.invoiceDate)}</div>
        <div><span className="text-gray-500">Rate:</span> {isRetainer ? 'Monthly Retainer' : `${formatCurrency(invoice.rateUsed, invoice.currency)}/hr`}</div>
        {!isRetainer && <div><span className="text-gray-500">Total Hours:</span> {formatHours(invoice.totalHours)}</div>}
        <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold">{formatCurrency(invoice.totalAmount, invoice.currency)}</span></div>
        {isRetainer && invoice.retainerMonth && <div><span className="text-gray-500">Retainer Month:</span> {monthLabel}</div>}
        {invoice.paidDate && <div><span className="text-gray-500">Paid:</span> {formatDate(invoice.paidDate)}</div>}
      </div>

      {invoice.notes && (
        <div className="text-sm"><span className="text-gray-500">Notes:</span> {invoice.notes}</div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              {!isRetainer && <th className="text-right px-3 py-2 font-medium">Hours</th>}
              <th className="text-right px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isRetainer && entries.length === 0 ? (
              <tr>
                <td className="px-3 py-2 text-gray-500">{formatDate(invoice.invoiceDate)}</td>
                <td className="px-3 py-2">Monthly advisory retainer — {monthLabel}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-gray-500">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">
                    {e.projectId && <span className="text-xs text-gray-400 mr-1">[{projectMap.get(e.projectId)?.name}]</span>}
                    {e.description}
                  </td>
                  {!isRetainer && <td className="px-3 py-2 text-right">{e.hours > 0 ? formatHours(e.hours) : '—'}</td>}
                  <td className="px-3 py-2 text-right">{formatCurrency(e.fixedAmount != null ? e.fixedAmount : e.hours * invoice.rateUsed, invoice.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td className="px-3 py-2" colSpan={isRetainer ? 1 : 2}>Total</td>
              {!isRetainer && <td className="px-3 py-2 text-right">{formatHours(invoice.totalHours)}</td>}
              <td className="px-3 py-2 text-right">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {rateWarning && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">{rateWarning}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <button onClick={() => updateStatus('sent')} disabled={sendingRate} className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-md hover:bg-yellow-200 disabled:opacity-50">
              {sendingRate ? 'Fetching rate\u2026' : 'Mark Sent'}
            </button>
          )}
          {invoice.status === 'sent' && (
            <button onClick={() => updateStatus('paid', today())} className="text-sm bg-green-100 text-green-800 px-3 py-1.5 rounded-md hover:bg-green-200">
              Mark Paid
            </button>
          )}
          {invoice.status !== 'draft' && (
            <button onClick={() => updateStatus('draft', undefined)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Revert to Draft
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200">
            Print / Save PDF
          </button>
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
