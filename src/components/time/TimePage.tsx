import { useState, useMemo } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { TimeEntry } from '../../types';
import { getEntryPaymentStatus, entryAmount } from '../../utils/calculations';
import { formatDate, today, getWeekDates } from '../../utils/dateUtils';
import { formatCurrency, formatHours } from '../../utils/formatCurrency';
import TimeEntryForm from './TimeEntryForm';
import Modal from '../shared/Modal';
import Badge from '../shared/Badge';

const statusColors: Record<string, string> = {
  'Paid': 'green',
  'Invoiced / Awaiting payment': 'yellow',
  'Draft': 'gray',
  'Uninvoiced': 'orange',
  'Unpaid': 'orange',
};

export default function TimePage() {
  const { companies, projects, timeEntries, invoices, saveTimeEntry, deleteTimeEntry } = useStorage();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [weekOf, setWeekOf] = useState(today());
  const [filterCompany, setFilterCompany] = useState('');
  const [view, setView] = useState<'week' | 'list'>('list');

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const weekDates = useMemo(() => getWeekDates(weekOf), [weekOf]);
  const activeCompanies = companies.filter((c) => c.isActive);

  const filteredEntries = useMemo(() => {
    let entries = [...timeEntries];
    if (filterCompany) entries = entries.filter((e) => e.companyId === filterCompany);
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [timeEntries, filterCompany]);

  const weekEntries = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return filteredEntries.filter((e) => e.date >= start && e.date <= end);
  }, [filteredEntries, weekDates]);

  function shiftWeek(delta: number) {
    const d = new Date(weekOf + 'T00:00:00');
    d.setDate(d.getDate() + delta * 7);
    setWeekOf(d.toISOString().split('T')[0]);
  }

  function duplicate(entry: TimeEntry) {
    const now = new Date().toISOString();
    saveTimeEntry({
      ...entry,
      id: crypto.randomUUID(),
      paidDate: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  function markPaid(entry: TimeEntry) {
    saveTimeEntry({ ...entry, paidDate: today(), updatedAt: new Date().toISOString() });
  }

  function markUnpaid(entry: TimeEntry) {
    saveTimeEntry({ ...entry, paidDate: undefined, updatedAt: new Date().toISOString() });
  }

  function renderEntry(entry: TimeEntry, showDate?: boolean) {
    const company = companyMap.get(entry.companyId);
    const project = entry.projectId ? projectMap.get(entry.projectId) : undefined;
    const status = getEntryPaymentStatus(entry, company, invoices);
    const canTogglePaid = company && !company.invoiceRequired && !invoices.find((i) => i.timeEntryIds.includes(entry.id));
    return (
      <div key={entry.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded border hover:shadow-sm group text-sm">
        {showDate && <span className="text-gray-400 shrink-0 w-24">{formatDate(entry.date)}</span>}
        <span className="font-medium shrink-0 w-32 truncate">{company?.name || 'Unknown'}</span>
        <span className="text-xs text-gray-400 shrink-0 w-24 truncate">{project?.name ?? ''}</span>
        <span className="text-gray-600 flex-1 min-w-0 truncate">{entry.description}</span>
        <Badge color={statusColors[status] || 'gray'}>{status}</Badge>
        <span className="text-right shrink-0 w-14 tabular-nums">
          {entry.fixedAmount != null
            ? (entry.hours > 0 ? `${formatHours(entry.hours)}h` : '')
            : `${formatHours(entry.hours)}h`}
        </span>
        <span className="text-right shrink-0 w-22 font-medium tabular-nums">
          {entry.fixedAmount != null
            ? (company ? formatCurrency(entry.fixedAmount, company.currency) : `$${entry.fixedAmount}`)
            : (company ? formatCurrency(entry.hours * company.hourlyRate, company.currency) : '')}
        </span>
        <div className="flex gap-1 shrink-0 w-36 justify-end">
          {canTogglePaid && !entry.paidDate && (
            <button onClick={() => markPaid(entry)} className="text-xs text-green-600 hover:text-green-800 px-1">Paid</button>
          )}
          {canTogglePaid && entry.paidDate && (
            <button onClick={() => markUnpaid(entry)} className="text-xs text-orange-500 hover:text-orange-700 px-1">Unpaid</button>
          )}
          <button onClick={() => setEditing(entry)} className="text-xs text-blue-600 hover:text-blue-800 px-1">Edit</button>
          <button onClick={() => duplicate(entry)} className="text-xs text-gray-500 hover:text-gray-700 px-1">Dup</button>
          <button onClick={() => { if (confirm('Delete this entry?')) deleteTimeEntry(entry.id); }} className="text-xs text-red-500 hover:text-red-700 px-1">Del</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Time Entries</h2>
        <div className="flex items-center gap-3">
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">All companies</option>
            {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex border rounded-md overflow-hidden">
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm ${view === 'week' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Week</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm ${view === 'list' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>List</button>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Add Entry
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => shiftWeek(-1)} className="text-gray-500 hover:text-gray-700 text-sm">&larr; Prev</button>
            <span className="text-sm font-medium">
              {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
            </span>
            <button onClick={() => shiftWeek(1)} className="text-gray-500 hover:text-gray-700 text-sm">Next &rarr;</button>
            <button onClick={() => setWeekOf(today())} className="text-xs text-blue-600 hover:text-blue-800">Today</button>
          </div>
          <div className="space-y-4">
            {weekDates.map((date) => {
              const dayEntries = weekEntries.filter((e) => e.date === date);
              const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0);
              const isToday = date === today();
              return (
                <div key={date} className={`border rounded-lg overflow-hidden ${isToday ? 'border-blue-300' : ''}`}>
                  <div className={`px-4 py-2 flex items-center justify-between ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <span className="text-sm font-medium">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-sm text-gray-500">{dayTotal > 0 ? `${formatHours(dayTotal)}h` : ''}</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {dayEntries.length > 0 ? dayEntries.map((e) => renderEntry(e)) : (
                      <p className="text-xs text-gray-400 py-2 text-center">No entries</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-right text-sm font-medium text-gray-600">
            Week total: {formatHours(weekEntries.reduce((s, e) => s + e.hours, 0))}h
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No time entries yet.</p>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.id}>{renderEntry(entry, true)}</div>
            ))
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Time Entry">
        <TimeEntryForm onDone={() => setShowForm(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Time Entry">
        {editing && <TimeEntryForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
