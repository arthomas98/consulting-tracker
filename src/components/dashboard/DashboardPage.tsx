import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import { totalsByCurrency, entryAmount, isFixedMonthly } from '../../utils/calculations';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, today, isInRange, getISOWeek, getWeekLabel, getMonthIndex, shortMonthName, formatDate, getMonthLabel, daysSince } from '../../utils/dateUtils';
import { formatCurrency, formatCurrencyShort, formatHours } from '../../utils/formatCurrency';
import { preloadRates, convertToUSD } from '../../utils/exchangeRate';
import type { Currency } from '../../types';
import { Link } from 'react-router-dom';
import TimeEntryForm from '../time/TimeEntryForm';

export default function DashboardPage() {
  const { companies, timeEntries, invoices, saveTimeEntry } = useStorage();
  const [quickEntryKey, setQuickEntryKey] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartMode, setChartMode] = useState<'week' | 'month'>('month');
  const [rates, setRates] = useState<Record<Currency, number | null>>({ USD: 1, EUR: null, GBP: null });
  const [ratesLoaded, setRatesLoaded] = useState(false);

  useEffect(() => {
    preloadRates().then((r) => {
      setRates(r);
      setRatesLoaded(true);
    });
  }, []);

  const allRatesAvailable = rates.EUR != null && rates.GBP != null;

  const now = new Date();
  const year = now.getFullYear();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(year);
  const yearEnd = endOfYear(year);
  const currentMonth = today().substring(0, 7);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  // Filter out fixed-monthly entries from hourly totals
  const monthEntriesHourly = useMemo(
    () => timeEntries.filter((e) => {
      if (e.date < monthStart || e.date > monthEnd) return false;
      const co = companyMap.get(e.companyId);
      return co && !isFixedMonthly(co);
    }),
    [timeEntries, monthStart, monthEnd, companyMap]
  );

  const yearEntriesHourly = useMemo(
    () => timeEntries.filter((e) => {
      if (!isInRange(e.date, yearStart, yearEnd)) return false;
      const co = companyMap.get(e.companyId);
      return co && !isFixedMonthly(co);
    }),
    [timeEntries, yearStart, yearEnd, companyMap]
  );

  // Retainer invoices in period
  const monthRetainerInvoices = useMemo(
    () => invoices.filter((i) => i.billingType === 'fixed_monthly' && i.retainerMonth === currentMonth),
    [invoices, currentMonth]
  );

  const yearRetainerInvoices = useMemo(
    () => invoices.filter((i) => {
      if (i.billingType !== 'fixed_monthly' || !i.retainerMonth) return false;
      return i.retainerMonth >= yearStart.substring(0, 7) && i.retainerMonth <= yearEnd.substring(0, 7);
    }),
    [invoices, yearStart, yearEnd]
  );

  // Month totals: hourly entries + retainer invoices
  const monthTotals = useMemo(() => {
    const hourlyTotals = totalsByCurrency(monthEntriesHourly, companies);
    const totalsMap = new Map<Currency, { hours: number; amount: number }>();
    for (const t of hourlyTotals) {
      totalsMap.set(t.currency, { hours: t.hours, amount: t.amount });
    }
    for (const inv of monthRetainerInvoices) {
      const existing = totalsMap.get(inv.currency) || { hours: 0, amount: 0 };
      existing.amount += inv.totalAmount;
      totalsMap.set(inv.currency, existing);
    }
    return Array.from(totalsMap.entries()).map(([currency, t]) => ({ currency, ...t }));
  }, [monthEntriesHourly, companies, monthRetainerInvoices]);

  // Year totals: hourly entries + retainer invoices
  const yearTotals = useMemo(() => {
    const hourlyTotals = totalsByCurrency(yearEntriesHourly, companies);
    const totalsMap = new Map<Currency, { hours: number; amount: number }>();
    for (const t of hourlyTotals) {
      totalsMap.set(t.currency, { hours: t.hours, amount: t.amount });
    }
    for (const inv of yearRetainerInvoices) {
      const existing = totalsMap.get(inv.currency) || { hours: 0, amount: 0 };
      existing.amount += inv.totalAmount;
      totalsMap.set(inv.currency, existing);
    }
    return Array.from(totalsMap.entries()).map(([currency, t]) => ({ currency, ...t }));
  }, [yearEntriesHourly, companies, yearRetainerInvoices]);

  const monthHours = monthTotals.reduce((s, t) => s + t.hours, 0);
  const yearHours = yearTotals.reduce((s, t) => s + t.hours, 0);

  // Converted USD totals
  const convertedMonthTotal = useMemo(() => {
    let total = 0;
    let hasNull = false;
    for (const t of monthTotals) {
      const usd = convertToUSD(t.amount, t.currency, rates[t.currency]);
      if (usd == null) { hasNull = true; continue; }
      total += usd;
    }
    return hasNull ? null : total;
  }, [monthTotals, rates]);

  const convertedYearTotal = useMemo(() => {
    let total = 0;
    let hasNull = false;
    for (const t of yearTotals) {
      const usd = convertToUSD(t.amount, t.currency, rates[t.currency]);
      if (usd == null) { hasNull = true; continue; }
      total += usd;
    }
    return hasNull ? null : total;
  }, [yearTotals, rates]);

  // Chart data — convert to USD when rates available
  const chartData = useMemo(() => {
    if (!chartOpen) return [];

    if (chartMode === 'month') {
      const buckets: { label: string; amounts: Map<Currency, number> }[] = [];
      for (let m = 0; m < 12; m++) {
        buckets.push({ label: shortMonthName(m), amounts: new Map() });
      }
      // Hourly entries
      for (const e of yearEntriesHourly) {
        const mi = getMonthIndex(e.date);
        const co = companyMap.get(e.companyId);
        if (!co) continue;
        const cur = co.currency;
        const prev = buckets[mi].amounts.get(cur) || 0;
        buckets[mi].amounts.set(cur, prev + entryAmount(e, co.hourlyRate));
      }
      // Retainer invoices by month
      for (const inv of yearRetainerInvoices) {
        if (!inv.retainerMonth) continue;
        const mi = parseInt(inv.retainerMonth.split('-')[1], 10) - 1;
        if (mi >= 0 && mi < 12) {
          const prev = buckets[mi].amounts.get(inv.currency) || 0;
          buckets[mi].amounts.set(inv.currency, prev + inv.totalAmount);
        }
      }
      return buckets;
    } else {
      // Weekly buckets — only hourly entries (retainers are monthly)
      const weekMap = new Map<number, { label: string; amounts: Map<Currency, number> }>();
      for (const e of yearEntriesHourly) {
        const wk = getISOWeek(e.date);
        if (!weekMap.has(wk)) {
          weekMap.set(wk, { label: getWeekLabel(e.date), amounts: new Map() });
        }
        const co = companyMap.get(e.companyId);
        if (!co) continue;
        const bucket = weekMap.get(wk)!;
        const prev = bucket.amounts.get(co.currency) || 0;
        bucket.amounts.set(co.currency, prev + entryAmount(e, co.hourlyRate));
      }
      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v);
    }
  }, [chartOpen, chartMode, yearEntriesHourly, yearRetainerInvoices, companyMap]);

  // Convert chart buckets to USD when all rates available
  const chartDataUSD = useMemo(() => {
    if (!allRatesAvailable) return null;
    return chartData.map((bucket) => {
      let usdTotal = 0;
      bucket.amounts.forEach((val, cur) => {
        const converted = convertToUSD(val, cur, rates[cur]);
        if (converted != null) usdTotal += converted;
      });
      return { label: bucket.label, usdTotal };
    });
  }, [chartData, rates, allRatesAvailable]);

  // Determine all currencies present and max value for scaling (fallback multi-currency)
  const allCurrencies = useMemo(() => {
    const set = new Set<Currency>();
    for (const b of chartData) b.amounts.forEach((_, c) => set.add(c));
    return Array.from(set).sort();
  }, [chartData]);

  const maxVal = useMemo(() => {
    if (chartDataUSD) {
      let max = 0;
      for (const b of chartDataUSD) {
        if (b.usdTotal > max) max = b.usdTotal;
      }
      return max || 1;
    }
    let max = 0;
    for (const b of chartData) {
      let total = 0;
      b.amounts.forEach((v) => { total += v; });
      if (total > max) max = total;
    }
    return max || 1;
  }, [chartData, chartDataUSD]);

  const barColors: Record<Currency, string> = { USD: 'bg-blue-500', EUR: 'bg-emerald-500', GBP: 'bg-purple-500' };

  // Action items — skip fixed-monthly for uninvoiced entries
  const uninvoicedByCompany = useMemo(() => {
    const invoicedIds = new Set(invoices.flatMap((i) => i.timeEntryIds));
    const uninvoiced = timeEntries.filter((e) => {
      const co = companyMap.get(e.companyId);
      return co?.invoiceRequired && !isFixedMonthly(co) && !invoicedIds.has(e.id);
    });
    const grouped = new Map<string, number>();
    for (const e of uninvoiced) {
      grouped.set(e.companyId, (grouped.get(e.companyId) || 0) + e.hours);
    }
    return Array.from(grouped.entries()).map(([companyId, hours]) => ({
      company: companyMap.get(companyId),
      hours,
    })).filter((x) => x.company);
  }, [timeEntries, invoices, companyMap]);

  // Fixed-monthly companies missing a retainer invoice for current month
  const uninvoicedRetainers = useMemo(() => {
    return companies.filter((co) => {
      if (!co.isActive || !isFixedMonthly(co) || !co.invoiceRequired) return false;
      return !invoices.some(
        (i) => i.companyId === co.id && i.billingType === 'fixed_monthly' && i.retainerMonth === currentMonth
      );
    });
  }, [companies, invoices, currentMonth]);

  const awaitingPayment = useMemo(
    () => invoices.filter((i) => i.status === 'sent'),
    [invoices]
  );

  // Outstanding AR total in USD
  const arData = useMemo(() => {
    let totalUSD = 0;
    let hasUnconverted = false;

    // Sent invoices
    const invoiceItems = awaitingPayment.map((inv) => {
      const co = companyMap.get(inv.companyId);
      const usdAmount = inv.exchangeRateToUSD != null
        ? inv.totalAmount * inv.exchangeRateToUSD
        : null;
      if (usdAmount != null) {
        totalUSD += usdAmount;
      } else {
        hasUnconverted = true;
      }
      return {
        type: 'invoice' as const,
        inv,
        companyName: co?.name ?? 'Unknown',
        usdAmount,
        daysOutstanding: daysSince(inv.invoiceDate),
      };
    });

    // IDs already on a sent or paid invoice — those are accounted for above
    const invoicedEntryIds = new Set(
      invoices.filter((i) => i.status === 'sent' || i.status === 'paid').flatMap((i) => i.timeEntryIds)
    );

    // Unpaid entries: non-invoice companies (not paid) + invoice-required companies (not yet on a sent/paid invoice)
    const entryItems = timeEntries
      .filter((e) => {
        const co = companyMap.get(e.companyId);
        if (!co || (co && isFixedMonthly(co))) return false;
        if (co.invoiceRequired) {
          // Include if not on any sent/paid invoice
          return !invoicedEntryIds.has(e.id);
        }
        // Non-invoice company: include if not paid
        return !e.paidDate;
      })
      .map((e) => {
        const co = companyMap.get(e.companyId)!;
        const amount = entryAmount(e, co.hourlyRate);
        const usdAmount = convertToUSD(amount, co.currency, rates[co.currency]);
        if (usdAmount != null) {
          totalUSD += usdAmount;
        } else {
          hasUnconverted = true;
        }
        return {
          type: 'entry' as const,
          entry: e,
          amount,
          currency: co.currency,
          companyName: co.name,
          invoiceRequired: co.invoiceRequired,
          usdAmount,
          daysOutstanding: daysSince(e.date),
        };
      });

    return { totalUSD, hasUnconverted, invoiceItems, entryItems, totalItems: invoiceItems.length + entryItems.length };
  }, [awaitingPayment, companyMap, timeEntries, invoices, rates]);

  const unpaidNonInvoice = arData.entryItems.filter((item) => !item.invoiceRequired);

  function markPaid(entryIds: string[]) {
    const todayStr = today();
    for (const entry of timeEntries) {
      if (entryIds.includes(entry.id)) {
        saveTimeEntry({ ...entry, paidDate: todayStr, updatedAt: new Date().toISOString() });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <span className="text-xs text-gray-400">v1.1</span>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        New here? Check out the <Link to="/getting-started" className="text-blue-600 hover:text-blue-800 font-medium">Getting Started</Link> guide.
      </p>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* This Month */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg shadow-indigo-200">
          <p className="text-xs font-medium text-indigo-200 uppercase tracking-wide mb-2">This Month</p>
          <p className="text-2xl font-bold">{formatHours(monthHours)}<span className="text-sm font-normal text-indigo-200 ml-1">hours</span></p>
          <div className="mt-2 space-y-0.5">
            {convertedMonthTotal != null ? (
              <>
                <p className="text-sm text-indigo-100 font-semibold">{formatCurrency(convertedMonthTotal, 'USD')}</p>
                {monthTotals.filter((t) => t.currency !== 'USD').map((t) => (
                  <p key={t.currency} className="text-xs text-indigo-200">{formatCurrency(t.amount, t.currency)}</p>
                ))}
              </>
            ) : (
              <>
                {monthTotals.map((t) => (
                  <p key={t.currency} className="text-sm text-indigo-100">
                    {formatCurrency(t.amount, t.currency)}
                    {rates[t.currency] == null && <span className="text-xs text-indigo-300 ml-1">(rate unavailable)</span>}
                  </p>
                ))}
                {monthTotals.length === 0 && <p className="text-sm text-indigo-200">No revenue</p>}
              </>
            )}
          </div>
        </div>

        {/* This Year */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200">
          <p className="text-xs font-medium text-blue-200 uppercase tracking-wide mb-2">{year} Year-to-Date</p>
          <p className="text-2xl font-bold">{formatHours(yearHours)}<span className="text-sm font-normal text-blue-200 ml-1">hours</span></p>
          <div className="mt-2 space-y-0.5">
            {convertedYearTotal != null ? (
              <>
                <p className="text-sm text-blue-100 font-semibold">{formatCurrency(convertedYearTotal, 'USD')}</p>
                {yearTotals.filter((t) => t.currency !== 'USD').map((t) => (
                  <p key={t.currency} className="text-xs text-blue-200">{formatCurrency(t.amount, t.currency)}</p>
                ))}
              </>
            ) : (
              <>
                {yearTotals.map((t) => (
                  <p key={t.currency} className="text-sm text-blue-100">
                    {formatCurrency(t.amount, t.currency)}
                    {rates[t.currency] == null && <span className="text-xs text-blue-300 ml-1">(rate unavailable)</span>}
                  </p>
                ))}
                {yearTotals.length === 0 && <p className="text-sm text-blue-200">No revenue</p>}
              </>
            )}
          </div>
        </div>

        {/* Total Revenue (USD) card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg shadow-emerald-200">
          <p className="text-xs font-medium text-emerald-200 uppercase tracking-wide mb-2">Total Revenue (USD)</p>
          {convertedYearTotal != null ? (
            <>
              <p className="text-2xl font-bold">{formatCurrency(convertedYearTotal, 'USD')}</p>
              <p className="text-sm text-emerald-100 mt-1">{formatHours(yearHours)} hours</p>
            </>
          ) : ratesLoaded ? (
            <>
              {yearTotals.map((t) => (
                <p key={t.currency} className="text-lg font-bold">
                  {formatCurrency(t.amount, t.currency)}
                  {rates[t.currency] == null && <span className="text-xs font-normal text-emerald-200 ml-1">(rate unavailable)</span>}
                </p>
              ))}
              <p className="text-sm text-emerald-100 mt-1">{formatHours(yearHours)} hours</p>
            </>
          ) : (
            <p className="text-sm text-emerald-200">Loading rates...</p>
          )}
        </div>

        {/* Outstanding AR card */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg shadow-amber-200">
          <p className="text-xs font-medium text-amber-200 uppercase tracking-wide mb-2">Accounts Receivable</p>
          {arData.totalItems === 0 ? (
            <>
              <p className="text-2xl font-bold">{formatCurrency(0, 'USD')}</p>
              <p className="text-sm text-amber-100 mt-1">Nothing outstanding</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold">{formatCurrency(arData.totalUSD, 'USD')}</p>
              {arData.hasUnconverted && (
                <p className="text-xs text-amber-200 mt-0.5">+ unconverted amounts</p>
              )}
              <div className="text-sm text-amber-100 mt-1 space-y-0.5">
                {arData.invoiceItems.length > 0 && (
                  <p>{arData.invoiceItems.length} sent invoice{arData.invoiceItems.length !== 1 ? 's' : ''}</p>
                )}
                {arData.entryItems.filter((i) => i.invoiceRequired).length > 0 && (
                  <p>{arData.entryItems.filter((i) => i.invoiceRequired).length} uninvoiced entr{arData.entryItems.filter((i) => i.invoiceRequired).length !== 1 ? 'ies' : 'y'}</p>
                )}
                {unpaidNonInvoice.length > 0 && (
                  <p>{unpaidNonInvoice.length} unpaid entr{unpaidNonInvoice.length !== 1 ? 'ies' : 'y'}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart toggle */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setChartOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>Revenue Chart ({year}){chartDataUSD ? ' — USD' : ''}</span>
          <span className="text-gray-400">{chartOpen ? '\u25B2' : '\u25BC'}</span>
        </button>

        {chartOpen && (
          <div className="px-4 pb-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex border rounded-md overflow-hidden text-xs">
                <button
                  onClick={() => setChartMode('month')}
                  className={`px-3 py-1.5 ${chartMode === 'month' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setChartMode('week')}
                  className={`px-3 py-1.5 ${chartMode === 'week' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                >
                  Weekly
                </button>
              </div>
              {!chartDataUSD && allCurrencies.length > 1 && (
                <div className="flex items-center gap-3 ml-4 text-xs">
                  {allCurrencies.map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <span className={`inline-block w-3 h-3 rounded ${barColors[c]}`} />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bar chart */}
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data for {year}</p>
            ) : chartDataUSD ? (
              /* USD-converted single-color chart */
              <div>
                <div className="flex items-end gap-1" style={{ height: '220px' }}>
                  {chartDataUSD.map((bucket, i) => {
                    const barHeight = Math.round((bucket.usdTotal / maxVal) * 184);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-end justify-end group relative min-w-0" style={{ height: '220px' }}>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 left-1/2 -translate-x-1/2">
                          <p className="font-medium">{bucket.label}</p>
                          <p>{formatCurrency(bucket.usdTotal, 'USD')}</p>
                        </div>
                        {/* Dollar label above bar */}
                        {bucket.usdTotal > 0 && (
                          <p className="text-[10px] font-medium text-gray-500 mb-0.5 truncate w-full text-center">
                            {formatCurrencyShort(bucket.usdTotal, 'USD')}
                          </p>
                        )}
                        {/* Single bar */}
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${Math.max(barHeight, bucket.usdTotal > 0 ? 4 : 0)}px` }}
                        />
                        {/* Label */}
                        <p className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">{bucket.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Fallback: multi-currency stacked chart */
              <div>
                <div className="flex items-end gap-1" style={{ height: '220px' }}>
                  {chartData.map((bucket, i) => {
                    let totalForBucket = 0;
                    bucket.amounts.forEach((v) => { totalForBucket += v; });
                    const barHeight = Math.round((totalForBucket / maxVal) * 184);

                    return (
                      <div key={i} className="flex-1 flex flex-col items-end justify-end group relative min-w-0" style={{ height: '220px' }}>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 left-1/2 -translate-x-1/2">
                          <p className="font-medium">{bucket.label}</p>
                          {allCurrencies.map((c) => {
                            const val = bucket.amounts.get(c);
                            return val ? <p key={c}>{formatCurrency(val, c)}</p> : null;
                          })}
                        </div>
                        {/* Dollar label above bar */}
                        {totalForBucket > 0 && (
                          <p className="text-[10px] font-medium text-gray-500 mb-0.5 truncate w-full text-center">
                            {allCurrencies.map((c) => {
                              const val = bucket.amounts.get(c);
                              return val ? formatCurrencyShort(val, c) : null;
                            }).filter(Boolean).join(' ')}
                          </p>
                        )}
                        {/* Stacked bar */}
                        <div
                          className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                          style={{ height: `${Math.max(barHeight, totalForBucket > 0 ? 4 : 0)}px` }}
                        >
                          {allCurrencies.map((c) => {
                            const val = bucket.amounts.get(c) || 0;
                            if (val === 0) return null;
                            const segPct = (val / totalForBucket) * 100;
                            return (
                              <div
                                key={c}
                                className={`${barColors[c]} w-full`}
                                style={{ height: `${segPct}%` }}
                              />
                            );
                          })}
                        </div>
                        {/* Label */}
                        <p className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">{bucket.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outstanding AR detail */}
      {arData.totalItems > 0 && (
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Accounts Receivable</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium text-right">USD Equiv.</th>
                  <th className="pb-2 font-medium text-right">Days Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {arData.invoiceItems.map(({ inv, companyName, usdAmount, daysOutstanding }) => (
                  <tr key={inv.id}>
                    <td className="py-2 font-medium">{companyName}</td>
                    <td className="py-2 text-gray-500">Invoice #{inv.invoiceNumber}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {usdAmount != null ? formatCurrency(usdAmount, 'USD') : <span className="text-gray-400">--</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={daysOutstanding > 30 ? 'text-red-600 font-medium' : daysOutstanding > 14 ? 'text-amber-600' : 'text-gray-600'}>
                        {daysOutstanding}d
                      </span>
                    </td>
                  </tr>
                ))}
                {arData.entryItems.map(({ entry, companyName, amount, currency, invoiceRequired, usdAmount, daysOutstanding }) => (
                  <tr key={entry.id}>
                    <td className="py-2 font-medium">{companyName}</td>
                    <td className="py-2 text-gray-400 truncate max-w-48">
                      {invoiceRequired && <span className="text-xs text-orange-500 mr-1">Uninvoiced</span>}
                      {entry.description || formatDate(entry.date)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(amount, currency)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {usdAmount != null ? formatCurrency(usdAmount, 'USD') : <span className="text-gray-400">--</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span className={daysOutstanding > 30 ? 'text-red-600 font-medium' : daysOutstanding > 14 ? 'text-amber-600' : 'text-gray-600'}>
                        {daysOutstanding}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="pt-2" colSpan={3}>Total</td>
                  <td className="pt-2 text-right tabular-nums">{formatCurrency(arData.totalUSD, 'USD')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Quick entry */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Entry</h3>
        <TimeEntryForm key={quickEntryKey} compact onDone={() => setQuickEntryKey((k) => k + 1)} />
      </div>

      {/* Action items */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Needs invoicing */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Needs Invoicing</h3>
          {uninvoicedByCompany.length === 0 && uninvoicedRetainers.length === 0 ? (
            <p className="text-sm text-gray-400">All caught up!</p>
          ) : (
            <div className="space-y-2">
              {uninvoicedByCompany.map(({ company, hours }) => (
                <div key={company!.id} className="flex items-center justify-between text-sm">
                  <span>{company!.name}</span>
                  <span className="font-medium">{formatHours(hours)}h</span>
                </div>
              ))}
              {uninvoicedRetainers.map((co) => (
                <div key={co.id} className="flex items-center justify-between text-sm">
                  <span>{co.name} <span className="text-xs text-gray-400">(retainer)</span></span>
                  <span className="font-medium text-gray-500">{getMonthLabel(currentMonth + '-01')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Awaiting payment */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Awaiting Payment</h3>
          {awaitingPayment.length === 0 && unpaidNonInvoice.length === 0 ? (
            <p className="text-sm text-gray-400">No outstanding payments</p>
          ) : (
            <div className="space-y-2">
              {awaitingPayment.map((inv) => {
                const co = companyMap.get(inv.companyId);
                const usdEquiv = inv.currency !== 'USD' && inv.exchangeRateToUSD
                  ? convertToUSD(inv.totalAmount, inv.currency, inv.exchangeRateToUSD)
                  : null;
                return (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <span>{co?.name} <span className="text-gray-400">#{inv.invoiceNumber}</span></span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                      {usdEquiv != null && (
                        <span className="text-xs text-gray-400 ml-1">({formatCurrency(usdEquiv, 'USD')})</span>
                      )}
                    </span>
                  </div>
                );
              })}
              {unpaidNonInvoice.length > 0 && (
                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-medium">Unpaid entries (no invoice)</span>
                    <button
                      onClick={() => markPaid(unpaidNonInvoice.map((item) => item.entry.id))}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      Mark all paid
                    </button>
                  </div>
                  {unpaidNonInvoice.map(({ entry, companyName, amount, currency }) => (
                    <div key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 shrink-0 w-20 text-xs">{formatDate(entry.date)}</span>
                      <span className="font-medium shrink-0">{companyName}</span>
                      <span className="text-gray-500 flex-1 min-w-0 truncate">{entry.description}</span>
                      <span className="font-medium shrink-0 tabular-nums">
                        {formatCurrency(amount, currency)}
                      </span>
                      <button
                        onClick={() => markPaid([entry.id])}
                        className="text-xs text-green-600 hover:text-green-800 shrink-0"
                      >
                        Paid
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
