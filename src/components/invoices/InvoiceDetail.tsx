import { useMemo, useState } from 'react';
import { useCompanies, useProjects, useTimeEntries, useInvoices, useProfile } from '../../contexts/StorageContext';
import type { Invoice, TimeEntry, Currency, LineItem } from '../../types';
import type { Project } from '../../types';
import type { BusinessProfile } from '../../utils/storage';
import { formatDate, today, getMonthLabel, getMondayDate } from '../../utils/dateUtils';
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

interface WeekLine {
  mondayDate: string;
  hours: number;
  amount: number;
}

interface ProjectGroup {
  projectName: string | null;
  weeks: WeekLine[];
  totalHours: number;
  totalAmount: number;
}

function groupEntriesByProjectAndWeek(
  entries: TimeEntry[],
  projectMap: Map<string, Project>,
  rate: number,
): ProjectGroup[] {
  // Group by projectId ('' for no project)
  const byProject = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const key = e.projectId || '';
    const arr = byProject.get(key) || [];
    arr.push(e);
    byProject.set(key, arr);
  }

  const groups: ProjectGroup[] = [];

  // Named projects first (sorted), then no-project group
  const projectIds = Array.from(byProject.keys()).sort((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    const nameA = projectMap.get(a)?.name || '';
    const nameB = projectMap.get(b)?.name || '';
    return nameA.localeCompare(nameB);
  });

  for (const pid of projectIds) {
    const projectEntries = byProject.get(pid)!;
    const projectName = pid ? (projectMap.get(pid)?.name || 'Unknown Project') : null;

    // Group by week (Monday date)
    const byWeek = new Map<string, { hours: number; amount: number }>();
    for (const e of projectEntries) {
      const monday = getMondayDate(e.date);
      const existing = byWeek.get(monday) || { hours: 0, amount: 0 };
      existing.hours += e.hours;
      existing.amount += e.fixedAmount != null ? e.fixedAmount : e.hours * rate;
      byWeek.set(monday, existing);
    }

    const weeks = Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mondayDate, data]) => ({ mondayDate, ...data }));

    const totalHours = weeks.reduce((s, w) => s + w.hours, 0);
    const totalAmount = weeks.reduce((s, w) => s + w.amount, 0);

    groups.push({ projectName, weeks, totalHours, totalAmount });
  }

  return groups;
}

export interface DetailedLine {
  date: string;
  projectName: string | null;
  description: string;
  hours: number;
  amount: number;
}

function buildDetailedLines(
  entries: TimeEntry[],
  projectMap: Map<string, Project>,
  rate: number,
): DetailedLine[] {
  return entries.map((e) => ({
    date: e.date,
    projectName: e.projectId ? (projectMap.get(e.projectId)?.name || null) : null,
    description: e.description,
    hours: e.hours,
    amount: e.fixedAmount != null ? e.fixedAmount : e.hours * rate,
  }));
}

function buildPrintHtml(
  invoice: Invoice,
  companyName: string,
  billingAddress: string | undefined,
  groups: ProjectGroup[],
  totalHoursStr: string,
  totalAmountStr: string,
  rate: string,
  currency: Currency,
  profile: BusinessProfile,
  isRetainer: boolean,
  vatReverseCharge: boolean,
  vatNoticeText: string | undefined,
  retainerLine?: { description: string; amount: string },
  notes?: string,
  lineItems?: LineItem[],
  detailedLines?: DetailedLine[],
) {
  const rateLabel = isRetainer ? 'Monthly Retainer' : `${rate}/hr`;

  const lineItemRows = (lineItems || []).map((li) => {
    const qtyStr = li.quantity ? `${li.quantity}` : '';
    const upStr = li.unitPrice ? formatCurrency(li.unitPrice, currency) : '';
    const detail = qtyStr && upStr ? ` (${qtyStr} × ${upStr})` : '';
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(li.description)}${detail}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(li.amount, currency)}</td>
    </tr>`;
  }).join('');

  let bodyHtml: string;
  if (isRetainer && retainerLine) {
    bodyHtml = `
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(retainerLine.description)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${esc(retainerLine.amount)}</td>
    </tr>
    ${lineItemRows}
  </tbody>
  <tfoot><tr>
    <td style="font-weight:600;border-top:2px solid #ddd;padding:8px">Total</td>
    <td style="font-weight:600;border-top:2px solid #ddd;padding:8px;text-align:right">${esc(totalAmountStr)}</td>
  </tr></tfoot>
</table>`;
  } else {
    const rows: string[] = [];
    if (detailedLines) {
      for (const line of detailedLines) {
        const desc = line.projectName
          ? `${esc(line.projectName)}: ${esc(line.description)}`
          : esc(line.description);
        rows.push(`<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555">${formatDate(line.date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${desc}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatHours(line.hours)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(line.amount, currency)}</td>
        </tr>`);
      }
    } else {
      for (const group of groups) {
        if (group.projectName) {
          rows.push(`<tr><td colspan="3" style="padding:10px 8px 4px;font-weight:600;border-bottom:1px solid #eee">${esc(group.projectName)}</td></tr>`);
        }
        for (const week of group.weeks) {
          const weekLabel = `Week of ${formatDate(week.mondayDate)}`;
          rows.push(`<tr>
            <td style="padding:6px 8px 6px ${group.projectName ? '24px' : '8px'};border-bottom:1px solid #eee;color:#555">${esc(weekLabel)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatHours(week.hours)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(week.amount, currency)}</td>
          </tr>`);
        }
      }
    }
    // Add line items as separate rows
    const liRows = (lineItems || []).map((li) => {
      const qtyStr = li.quantity ? `${li.quantity}` : '';
      const upStr = li.unitPrice ? formatCurrency(li.unitPrice, currency) : '';
      const detail = qtyStr && upStr ? ` (${qtyStr} × ${upStr})` : '';
      if (detailedLines) {
        return `<tr>
          <td colspan="2" style="padding:6px 8px;border-bottom:1px solid #eee">${esc(li.description)}${detail}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right"></td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(li.amount, currency)}</td>
        </tr>`;
      }
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(li.description)}${detail}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right"></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(li.amount, currency)}</td>
      </tr>`;
    }).join('');
    const headerCols = detailedLines
      ? '<th>Date</th><th>Description</th><th style="text-align:right">Hours</th><th style="text-align:right">Amount</th>'
      : '<th>Description</th><th style="text-align:right">Hours</th><th style="text-align:right">Amount</th>';
    const footerCols = detailedLines
      ? `<td colspan="2" style="font-weight:600;border-top:2px solid #ddd;padding:8px">Total</td>
         <td style="font-weight:600;border-top:2px solid #ddd;padding:8px;text-align:right">${esc(totalHoursStr)}</td>
         <td style="font-weight:600;border-top:2px solid #ddd;padding:8px;text-align:right">${esc(totalAmountStr)}</td>`
      : `<td style="font-weight:600;border-top:2px solid #ddd;padding:8px">Total</td>
         <td style="font-weight:600;border-top:2px solid #ddd;padding:8px;text-align:right">${esc(totalHoursStr)}</td>
         <td style="font-weight:600;border-top:2px solid #ddd;padding:8px;text-align:right">${esc(totalAmountStr)}</td>`;
    bodyHtml = `
<table>
  <thead><tr>${headerCols}</tr></thead>
  <tbody>${rows.join('')}${liRows}</tbody>
  <tfoot><tr>${footerCols}</tr></tfoot>
</table>`;
  }

  const hasProfile = profile.name || profile.address || profile.email || profile.phone || profile.ein;

  const profileHtml = hasProfile ? `
    <div class="from">
      ${profile.name ? `<div style="font-weight:600;font-size:16px">${esc(profile.name)}</div>` : ''}
      ${profile.address ? `<div>${esc(profile.address).replace(/\n/g, '<br>')}</div>` : ''}
      ${profile.email ? `<div>${esc(profile.email)}</div>` : ''}
      ${profile.phone ? `<div>${esc(profile.phone)}</div>` : ''}
    </div>` : '';

  const bankFields: string[] = [];
  if (profile.ein) bankFields.push(`<span>EIN: ${esc(profile.ein)}</span>`);
  if (profile.bankName) bankFields.push(`<span>Bank: ${esc(profile.bankName)}</span>`);
  if (profile.accountName) bankFields.push(`<span>Account Name: ${esc(profile.accountName)}</span>`);
  if (profile.routingNumber) bankFields.push(`<span>Routing #: ${esc(profile.routingNumber)}</span>`);
  if (profile.accountNumber) bankFields.push(`<span>Account #: ${esc(profile.accountNumber)}</span>`);
  if (profile.swiftCode) bankFields.push(`<span>SWIFT: ${esc(profile.swiftCode)}</span>`);
  const bankHtml = bankFields.length > 0
    ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #ddd;font-size:13px;color:#555"><strong>Payment Information</strong><div style="margin-top:6px;display:flex;gap:20px;flex-wrap:wrap">${bankFields.join('')}</div></div>`
    : '';

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
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
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
    ${billingAddress && billingAddress.trim() ? `<div style="font-size:13px;color:#555;line-height:1.5;margin-top:2px">${esc(billingAddress).replace(/\n/g, '<br>')}</div>` : ''}
  </div>
  <div class="party" style="text-align:right">
    <div class="label">Invoice Details</div>
    <div><span style="color:#888">Invoice #:</span> ${esc(invoice.invoiceNumber || '\u2014')}</div>
    <div><span style="color:#888">Date:</span> ${formatDate(invoice.invoiceDate)}</div>
    <div><span style="color:#888">Rate:</span> ${rateLabel}</div>
  </div>
</div>
${bodyHtml}
${notes ? `<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>` : ''}
${vatReverseCharge ? `<div style="margin-top:16px;padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;color:#0369a1"><strong>VAT Notice:</strong> ${esc((vatNoticeText && vatNoticeText.trim()) || 'Reverse charge applies — recipient is liable for VAT under Articles 44 and 196 of EU VAT Directive 2006/112/EC.')}${profile.ein ? ` Supplier Tax ID (EIN): ${esc(profile.ein)}` : ''}</div>` : ''}
${bankHtml}
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

export default function InvoiceDetail({ invoice, onClose }: Props) {
  const { companies } = useCompanies();
  const { projects } = useProjects();
  const { timeEntries } = useTimeEntries();
  const { saveInvoice } = useInvoices();
  const { profile } = useProfile();
  const company = companies.find((c) => c.id === invoice.companyId);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const isRetainer = invoice.billingType === 'fixed_monthly';

  const entries = useMemo(
    () => timeEntries.filter((e) => invoice.timeEntryIds.includes(e.id)).sort((a, b) => a.date.localeCompare(b.date)),
    [timeEntries, invoice.timeEntryIds]
  );

  const isDetailed = invoice.detailLevel === 'detailed';

  const grouped = useMemo(
    () => (isRetainer || isDetailed) ? [] : groupEntriesByProjectAndWeek(entries, projectMap, invoice.rateUsed),
    [entries, projectMap, invoice.rateUsed, isRetainer, isDetailed]
  );

  const detailedLines = useMemo(
    () => isDetailed ? buildDetailedLines(entries, projectMap, invoice.rateUsed) : undefined,
    [entries, projectMap, invoice.rateUsed, isDetailed]
  );

  const [sendingRate, setSendingRate] = useState(false);
  const [rateWarning, setRateWarning] = useState('');
  const [showPaidPicker, setShowPaidPicker] = useState(false);
  const [paidDateInput, setPaidDateInput] = useState(today());
  const [paymentNoteInput, setPaymentNoteInput] = useState('');
  const [editingLineItems, setEditingLineItems] = useState(false);
  const [draftLineItems, setDraftLineItems] = useState<LineItem[]>(invoice.lineItems || []);

  function addLineItem() {
    setDraftLineItems((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }]);
    if (!editingLineItems) setEditingLineItems(true);
  }

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setDraftLineItems((prev) => prev.map((li) => li.id === id ? { ...li, [field]: value } : li));
  }

  function removeLineItem(id: string) {
    setDraftLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function saveLineItems() {
    const valid = draftLineItems.filter((li) => li.description.trim() && li.amount);
    const oldLineItemsTotal = (invoice.lineItems || []).reduce((s, li) => s + li.amount, 0);
    const newLineItemsTotal = valid.reduce((s, li) => s + li.amount, 0);
    const newTotal = invoice.totalAmount - oldLineItemsTotal + newLineItemsTotal;
    saveInvoice({
      ...invoice,
      lineItems: valid.length > 0 ? valid : undefined,
      totalAmount: newTotal,
      updatedAt: new Date().toISOString(),
    });
    setEditingLineItems(false);
  }

  function cancelLineItemEdit() {
    setDraftLineItems(invoice.lineItems || []);
    setEditingLineItems(false);
  }

  async function updateStatus(status: Invoice['status'], paidDate?: string, paymentNote?: string) {
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

    saveInvoice({ ...invoice, status, paidDate, paymentNote: paymentNote || undefined, exchangeRateToUSD, updatedAt: new Date().toISOString() });
  }

  function getInvoiceData() {
    const ml = invoice.retainerMonth ? getMonthLabel(invoice.retainerMonth + '-01') : '';
    const retainerLine = isRetainer ? {
      description: `Monthly advisory retainer \u2014 ${ml}`,
      amount: formatCurrency(invoice.totalAmount, invoice.currency),
    } : undefined;

    return {
      companyName: company?.name || 'Unknown',
      totalHoursStr: formatHours(invoice.totalHours),
      totalAmountStr: formatCurrency(invoice.totalAmount, invoice.currency),
      rateStr: formatCurrency(invoice.rateUsed, invoice.currency),
      retainerLine,
    };
  }

  function handlePrint() {
    const { companyName, totalHoursStr, totalAmountStr, rateStr, retainerLine } = getInvoiceData();

    const html = buildPrintHtml(
      invoice,
      companyName,
      company?.billingAddress,
      grouped,
      totalHoursStr,
      totalAmountStr,
      rateStr,
      invoice.currency,
      profile,
      isRetainer,
      !!company?.vatReverseCharge,
      company?.vatNoticeText,
      retainerLine,
      invoice.notes,
      invoice.lineItems,
      detailedLines,
    );

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  async function handleSaveDocx() {
    const { companyName, totalHoursStr, totalAmountStr, rateStr, retainerLine } = getInvoiceData();
    const { generateInvoiceDocx } = await import('../../utils/invoiceDocx');
    await generateInvoiceDocx(
      invoice,
      companyName,
      company?.billingAddress,
      grouped,
      totalHoursStr,
      totalAmountStr,
      rateStr,
      invoice.currency,
      profile,
      isRetainer,
      !!company?.vatReverseCharge,
      company?.vatNoticeText,
      retainerLine,
      invoice.notes,
      invoice.lineItems,
      detailedLines,
    );
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
        {invoice.paymentNote && <div className="col-span-2"><span className="text-gray-500">Payment Note:</span> {invoice.paymentNote}</div>}
      </div>

      {invoice.notes && (
        <div className="text-sm"><span className="text-gray-500">Notes:</span> {invoice.notes}</div>
      )}

      <div className="border rounded-md overflow-hidden">
        {isRetainer ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2">Monthly advisory retainer &mdash; {monthLabel}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(invoice.rateUsed, invoice.currency)}</td>
              </tr>
              {invoice.lineItems?.map((li) => (
                <tr key={li.id}>
                  <td className="px-3 py-2">
                    {li.description}
                    {li.quantity && li.unitPrice ? <span className="text-gray-400 ml-1">({li.quantity} × {formatCurrency(li.unitPrice, invoice.currency)})</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
              </tr>
            </tfoot>
          </table>
        ) : detailedLines ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-24">Date</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium w-20">Hours</th>
                <th className="text-right px-3 py-2 font-medium w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detailedLines.map((line, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-gray-500 tabular-nums">{formatDate(line.date)}</td>
                  <td className="px-3 py-2">
                    {line.projectName ? <span className="text-gray-400 mr-1">{line.projectName}:</span> : null}
                    {line.description}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatHours(line.hours)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.amount, invoice.currency)}</td>
                </tr>
              ))}
              {invoice.lineItems?.map((li) => (
                <tr key={li.id}>
                  <td colSpan={2} className="px-3 py-2">
                    {li.description}
                    {li.quantity && li.unitPrice ? <span className="text-gray-400 ml-1">({li.quantity} × {formatCurrency(li.unitPrice, invoice.currency)})</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(li.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={2} className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{formatHours(invoice.totalHours)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Hours</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grouped.map((group, gi) => (
                <tr key={gi} className="border-0">
                  <td colSpan={3} className="p-0">
                    {group.projectName && (
                      <div className="px-3 pt-3 pb-1 font-semibold text-gray-800 bg-gray-50 border-b">
                        {group.projectName}
                      </div>
                    )}
                    <table className="w-full">
                      <tbody>
                        {group.weeks.map((week) => (
                          <tr key={week.mondayDate} className="border-b border-gray-100">
                            <td className={`py-2 text-gray-600 ${group.projectName ? 'pl-6 pr-3' : 'px-3'}`}>
                              Week of {formatDate(week.mondayDate)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums w-20">{formatHours(week.hours)}</td>
                            <td className="py-2 px-3 text-right tabular-nums w-28">{formatCurrency(week.amount, invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
              {invoice.lineItems?.map((li) => (
                <tr key={li.id} className="border-0">
                  <td colSpan={3} className="p-0">
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-2 px-3">
                            {li.description}
                            {li.quantity && li.unitPrice ? <span className="text-gray-400 ml-1">({li.quantity} × {formatCurrency(li.unitPrice, invoice.currency)})</span> : null}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums w-20"></td>
                          <td className="py-2 px-3 text-right tabular-nums w-28">{formatCurrency(li.amount, invoice.currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{formatHours(invoice.totalHours)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {invoice.status === 'draft' && (editingLineItems || !(invoice.lineItems && invoice.lineItems.length > 0)) && (
        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Additional Line Items</span>
            <button onClick={addLineItem} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add</button>
          </div>
          {draftLineItems.length > 0 && (
            <div className="space-y-2">
              {draftLineItems.map((li) => (
                <div key={li.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={li.description}
                    onChange={(e) => updateLineItem(li.id, 'description', e.target.value)}
                    className="flex-1 border rounded-md px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={li.quantity ?? ''}
                    onChange={(e) => updateLineItem(li.id, 'quantity', e.target.value ? Number(e.target.value) : 0)}
                    className="w-16 border rounded-md px-2 py-1.5 text-sm text-right"
                  />
                  <input
                    type="number"
                    placeholder="Unit price"
                    value={li.unitPrice ?? ''}
                    onChange={(e) => {
                      const up = e.target.value ? Number(e.target.value) : 0;
                      updateLineItem(li.id, 'unitPrice', up);
                      const qty = li.quantity || 1;
                      if (up) updateLineItem(li.id, 'amount', qty * up);
                    }}
                    className="w-24 border rounded-md px-2 py-1.5 text-sm text-right"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={li.amount || ''}
                    onChange={(e) => updateLineItem(li.id, 'amount', e.target.value ? Number(e.target.value) : 0)}
                    className="w-24 border rounded-md px-2 py-1.5 text-sm text-right"
                    step="0.01"
                  />
                  <button onClick={() => removeLineItem(li.id)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                {(invoice.lineItems && invoice.lineItems.length > 0) && (
                  <button onClick={cancelLineItemEdit} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                )}
                <button onClick={saveLineItems} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Save Line Items</button>
              </div>
            </div>
          )}
        </div>
      )}

      {rateWarning && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">{rateWarning}</p>
      )}

      {invoice.status === 'sent' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          {showPaidPicker ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-green-800">Payment date:</label>
                <input
                  type="date"
                  value={paidDateInput}
                  onChange={(e) => setPaidDateInput(e.target.value)}
                  className="border border-green-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-green-800">Note (optional):</label>
                <input
                  type="text"
                  value={paymentNoteInput}
                  onChange={(e) => setPaymentNoteInput(e.target.value)}
                  placeholder="e.g. Check #1234, Wire transfer"
                  className="border border-green-300 rounded-md px-3 py-1.5 text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { updateStatus('paid', paidDateInput, paymentNoteInput); setShowPaidPicker(false); setPaymentNoteInput(''); }}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-green-700"
                >
                  Confirm Paid
                </button>
                <button
                  onClick={() => { setShowPaidPicker(false); setPaymentNoteInput(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-800">Received payment for this invoice?</span>
              <button
                onClick={() => { setPaidDateInput(today()); setPaymentNoteInput(''); setShowPaidPicker(true); }}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
              >
                Mark as Paid
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <button onClick={() => updateStatus('sent')} disabled={sendingRate} className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-md hover:bg-yellow-200 disabled:opacity-50">
              {sendingRate ? 'Fetching rate\u2026' : 'Mark Sent'}
            </button>
          )}
          {invoice.status !== 'draft' && (
            <button onClick={() => updateStatus('draft', undefined)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Revert to Draft
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveDocx} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100">
            Save as Word
          </button>
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
