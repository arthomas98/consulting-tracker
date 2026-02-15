import { useState, useMemo } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import { totalsByCurrency, entryAmount, getEntryPaymentStatus } from '../../utils/calculations';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, isInRange, formatDate, daysSince } from '../../utils/dateUtils';
import { formatCurrency, formatHours } from '../../utils/formatCurrency';
import { exportTimeEntriesCsv, exportInvoicesCsv, downloadCsv } from '../../utils/csv';
import Badge from '../shared/Badge';

type Period = 'month' | 'year' | 'custom';
type Tab = 'summary' | 'invoicing' | 'revenue';

const statusColors: Record<string, string> = {
  'Paid': 'green',
  'Invoiced / Awaiting payment': 'yellow',
  'Draft': 'gray',
  'Uninvoiced': 'orange',
  'Unpaid': 'orange',
};

export default function ReportsPage() {
  const { companies, projects, timeEntries, invoices } = useStorage();
  const [tab, setTab] = useState<Tab>('summary');
  const [period, setPeriod] = useState<Period>('month');
  const [companyFilter, setCompanyFilter] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const now = new Date();
  const year = now.getFullYear();

  const dateRange = useMemo(() => {
    switch (period) {
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year': return { start: startOfYear(year), end: endOfYear(year) };
      case 'custom': return { start: customStart, end: customEnd };
    }
  }, [period, customStart, customEnd, year]);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filteredEntries = useMemo(() => {
    return timeEntries.filter((e) => {
      if (dateRange.start && dateRange.end && !isInRange(e.date, dateRange.start, dateRange.end)) return false;
      if (companyFilter && e.companyId !== companyFilter) return false;
      return true;
    });
  }, [timeEntries, dateRange, companyFilter]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      if (dateRange.start && dateRange.end && !isInRange(i.invoiceDate, dateRange.start, dateRange.end)) return false;
      if (companyFilter && i.companyId !== companyFilter) return false;
      return true;
    });
  }, [invoices, dateRange, companyFilter]);

  // Work Summary
  const workSummary = useMemo(() => {
    const byCompany = new Map<string, { hours: number; amount: number }>();
    for (const e of filteredEntries) {
      const co = companyMap.get(e.companyId);
      if (!co) continue;
      const existing = byCompany.get(e.companyId) || { hours: 0, amount: 0 };
      existing.hours += e.hours;
      existing.amount += entryAmount(e, co.hourlyRate);
      byCompany.set(e.companyId, existing);
    }
    return Array.from(byCompany.entries()).map(([id, data]) => ({
      company: companyMap.get(id)!,
      ...data,
    }));
  }, [filteredEntries, companyMap]);

  const currencyTotals = useMemo(() => totalsByCurrency(filteredEntries, companies), [filteredEntries, companies]);

  // Invoicing status
  const invoicedEntryIds = useMemo(() => new Set(invoices.flatMap((i) => i.timeEntryIds)), [invoices]);

  const needsInvoicing = useMemo(() => {
    return filteredEntries.filter((e) => {
      const co = companyMap.get(e.companyId);
      return co?.invoiceRequired && !invoicedEntryIds.has(e.id) && !e.paidDate;
    });
  }, [filteredEntries, companyMap, invoicedEntryIds]);

  const openInvoices = useMemo(() => filteredInvoices.filter((i) => i.status === 'sent'), [filteredInvoices]);
  const paidInvoices = useMemo(() => filteredInvoices.filter((i) => i.status === 'paid'), [filteredInvoices]);

  // YTD totals
  const ytdEntries = useMemo(() => {
    const s = startOfYear(year);
    const e = endOfYear(year);
    return timeEntries.filter((entry) => isInRange(entry.date, s, e));
  }, [timeEntries, year]);
  const ytdTotals = useMemo(() => totalsByCurrency(ytdEntries, companies), [ytdEntries, companies]);

  function handleExportEntries() {
    const csv = exportTimeEntriesCsv(filteredEntries, companies, invoices, projects);
    downloadCsv(csv, `time-entries-${dateRange.start}-${dateRange.end}.csv`);
  }

  function handleExportInvoices() {
    const csv = exportInvoicesCsv(filteredInvoices, companies);
    downloadCsv(csv, `invoices-${dateRange.start}-${dateRange.end}.csv`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Reports</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExportEntries} className="text-sm text-gray-600 hover:text-gray-800 border px-3 py-1.5 rounded-md">
            Export Entries CSV
          </button>
          <button onClick={handleExportInvoices} className="text-sm text-gray-600 hover:text-gray-800 border px-3 py-1.5 rounded-md">
            Export Invoices CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border rounded-lg p-3">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="border rounded-md px-2 py-1.5 text-sm">
          <option value="month">Current Month</option>
          <option value="year">Current Year</option>
          <option value="custom">Custom Range</option>
        </select>
        {period === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
            <span className="text-gray-400">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          </>
        )}
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
          <option value="">All companies</option>
          {companies.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {(['summary', 'invoicing', 'revenue'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'summary' ? 'Work Summary' : t === 'invoicing' ? 'Invoicing Status' : 'Revenue'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        <div>
          {workSummary.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No entries in this period.</p>
          ) : (
            <div className="space-y-2">
              {workSummary.map(({ company, hours, amount }) => {
                const isExpanded = expandedCompany === company.id;
                const companyEntries = isExpanded
                  ? filteredEntries
                      .filter((e) => e.companyId === company.id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                  : [];
                return (
                  <div key={company.id} className="bg-white border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                      className="w-full flex items-center text-left hover:bg-gray-50 transition-colors text-sm"
                    >
                      <span className="px-4 py-3 flex-1 font-medium">{company.name} <span className="text-gray-400 text-xs ml-1">{isExpanded ? '\u25B2' : '\u25BC'}</span></span>
                      <span className="px-4 py-3 text-right text-gray-500 w-28">{formatHours(hours)}h</span>
                      <span className="px-4 py-3 text-right font-medium w-36">{formatCurrency(amount, company.currency)}</span>
                    </button>
                    {isExpanded && (
                      <div className="bg-gray-50 border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400">
                              <th className="text-left px-6 py-2 font-medium">Date</th>
                              <th className="text-left px-4 py-2 font-medium">Project</th>
                              <th className="text-left px-4 py-2 font-medium">Description</th>
                              <th className="text-left px-4 py-2 font-medium">Status</th>
                              <th className="text-right px-4 py-2 font-medium">Hours</th>
                              <th className="text-right px-4 py-2 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {companyEntries.map((e) => {
                              const proj = e.projectId ? projectMap.get(e.projectId) : undefined;
                              const status = getEntryPaymentStatus(e, company, invoices);
                              return (
                                <tr key={e.id}>
                                  <td className="px-6 py-2 text-gray-500">{formatDate(e.date)}</td>
                                  <td className="px-4 py-2 text-gray-500">{proj?.name ?? ''}</td>
                                  <td className="px-4 py-2 truncate max-w-xs">{e.description}</td>
                                  <td className="px-4 py-2"><Badge color={statusColors[status] || 'gray'}>{status}</Badge></td>
                                  <td className="px-4 py-2 text-right">{e.hours > 0 ? formatHours(e.hours) : ''}</td>
                                  <td className="px-4 py-2 text-right">{formatCurrency(entryAmount(e, company.hourlyRate), company.currency)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-white border rounded-lg">
                {currencyTotals.map((t) => (
                  <div key={t.currency} className="flex items-center text-sm font-semibold">
                    <span className="px-4 py-3 flex-1">Total ({t.currency})</span>
                    <span className="px-4 py-3 text-right text-gray-500 w-28">{formatHours(t.hours)}h</span>
                    <span className="px-4 py-3 text-right w-36">{formatCurrency(t.amount, t.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'invoicing' && (
        <div className="space-y-6">
          {/* Needs invoicing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Needs Invoicing ({needsInvoicing.length} entries)</h3>
            {needsInvoicing.length === 0 ? (
              <p className="text-sm text-gray-400">No uninvoiced entries.</p>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Company</th>
                      <th className="text-left px-4 py-2 font-medium">Project</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-right px-4 py-2 font-medium">Hours</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {needsInvoicing.map((e) => {
                      const co = companyMap.get(e.companyId);
                      const proj = e.projectId ? projectMap.get(e.projectId) : undefined;
                      return (
                        <tr key={e.id}>
                          <td className="px-4 py-2 text-gray-500">{formatDate(e.date)}</td>
                          <td className="px-4 py-2">{co?.name}</td>
                          <td className="px-4 py-2 text-gray-500">{proj?.name ?? ''}</td>
                          <td className="px-4 py-2 truncate max-w-xs">{e.description}</td>
                          <td className="px-4 py-2 text-right">{formatHours(e.hours)}</td>
                          <td className="px-4 py-2 text-right">{co ? formatCurrency(entryAmount(e, co.hourlyRate), co.currency) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Awaiting payment */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Invoiced / Awaiting Payment ({openInvoices.length})</h3>
            {openInvoices.length === 0 ? (
              <p className="text-sm text-gray-400">No open invoices.</p>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Invoice #</th>
                      <th className="text-left px-4 py-2 font-medium">Company</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                      <th className="text-right px-4 py-2 font-medium">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {openInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2">{companyMap.get(inv.companyId)?.name}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{daysSince(inv.invoiceDate)} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Paid ({paidInvoices.length})</h3>
            {paidInvoices.length === 0 ? (
              <p className="text-sm text-gray-400">No paid invoices in this period.</p>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Invoice #</th>
                      <th className="text-left px-4 py-2 font-medium">Company</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 font-medium">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paidInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2">{companyMap.get(inv.companyId)?.name}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                        <td className="px-4 py-2 text-gray-500">{inv.paidDate ? formatDate(inv.paidDate) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="space-y-6">
          {/* Period revenue by company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Revenue by Company (Period)</h3>
            {workSummary.length === 0 ? (
              <p className="text-sm text-gray-400">No revenue in this period.</p>
            ) : (
              <div className="space-y-2">
                {workSummary.map(({ company, hours, amount }) => {
                  const isExpanded = expandedCompany === company.id;
                  const companyEntries = isExpanded
                    ? filteredEntries
                        .filter((e) => e.companyId === company.id)
                        .sort((a, b) => b.date.localeCompare(a.date))
                    : [];
                  return (
                    <div key={company.id} className="bg-white border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                        className="w-full flex items-center text-left hover:bg-gray-50 transition-colors text-sm"
                      >
                        <span className="px-4 py-3 flex-1 font-medium">{company.name} <span className="text-gray-400 text-xs ml-1">{isExpanded ? '\u25B2' : '\u25BC'}</span></span>
                        <span className="px-4 py-3 text-right text-gray-500 w-28">{formatHours(hours)}h</span>
                        <span className="px-4 py-3 text-right font-medium w-36">{formatCurrency(amount, company.currency)}</span>
                      </button>
                      {isExpanded && (
                        <div className="bg-gray-50 border-t">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400">
                                <th className="text-left px-6 py-2 font-medium">Date</th>
                                <th className="text-left px-4 py-2 font-medium">Project</th>
                                <th className="text-left px-4 py-2 font-medium">Description</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-right px-4 py-2 font-medium">Hours</th>
                                <th className="text-right px-4 py-2 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {companyEntries.map((e) => {
                                const proj = e.projectId ? projectMap.get(e.projectId) : undefined;
                                const status = getEntryPaymentStatus(e, company, invoices);
                                return (
                                  <tr key={e.id}>
                                    <td className="px-6 py-2 text-gray-500">{formatDate(e.date)}</td>
                                    <td className="px-4 py-2 text-gray-500">{proj?.name ?? ''}</td>
                                    <td className="px-4 py-2 truncate max-w-xs">{e.description}</td>
                                    <td className="px-4 py-2"><Badge color={statusColors[status] || 'gray'}>{status}</Badge></td>
                                    <td className="px-4 py-2 text-right">{e.hours > 0 ? formatHours(e.hours) : ''}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(entryAmount(e, company.hourlyRate), company.currency)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* YTD totals */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Year-to-Date ({year})</h3>
            <div className="space-y-3">
              {ytdTotals.map((t) => (
                <div key={t.currency} className="bg-white border rounded-lg p-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">{t.currency} Revenue</p>
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(t.amount, t.currency)}</p>
                    <p className="text-sm text-gray-400">{formatHours(t.hours)}h</p>
                  </div>
                </div>
              ))}
              {ytdTotals.length === 0 && (
                <p className="text-sm text-gray-400">No revenue this year.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
