import { useState, useMemo } from 'react';
import { useCompanies, useExpenses as useExpensesCtx } from '../../contexts/StorageContext';
import type { Expense, ExpenseCategory, Currency } from '../../types';
import { EXPENSE_CATEGORY_LABELS } from '../../types';
import { formatDate, today, startOfYear, endOfYear, isInRange } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatCurrency';
import Modal from '../shared/Modal';

const PAYMENT_METHODS = ['Credit Card', 'Debit', 'Cash', 'Check', 'PayPal', 'Wire', 'Other'];
const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

const emptyExpense = (): Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> => ({
  date: today(),
  category: 'other',
  description: '',
  amount: 0,
  currency: 'USD',
  vendor: '',
  paymentMethod: '',
  hasReceipt: false,
  companyId: '',
  recurring: false,
  notes: '',
});

export default function ExpensesPage() {
  const { companies } = useCompanies();
  const { expenses, saveExpense, deleteExpense } = useExpensesCtx();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const years = useMemo(() => {
    const set = new Set<string>();
    set.add(String(new Date().getFullYear()));
    for (const e of expenses) {
      set.add(e.date.substring(0, 4));
    }
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const yearNum = parseInt(filterYear, 10);
  const yearStart = startOfYear(yearNum);
  const yearEnd = endOfYear(yearNum);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!isInRange(e.date, yearStart, yearEnd)) return false;
        if (filterCategory && e.category !== filterCategory) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, yearStart, yearEnd, filterCategory]);

  const ytdByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of filteredExpenses) {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const grandTotal = ytdByCategory.reduce((sum, row) => sum + row.total, 0);

  function openNew() {
    setIsNew(true);
    const now = new Date().toISOString();
    setEditing({
      ...emptyExpense(),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as Expense);
  }

  function openEdit(exp: Expense) {
    setIsNew(false);
    setEditing({ ...exp });
  }

  function handleSave() {
    if (!editing || !editing.description.trim() || editing.amount <= 0) return;
    saveExpense({
      ...editing,
      companyId: editing.companyId || undefined,
      vendor: editing.vendor || undefined,
      paymentMethod: editing.paymentMethod || undefined,
      notes: editing.notes || undefined,
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  }

  function duplicate(exp: Expense) {
    const now = new Date().toISOString();
    saveExpense({
      ...exp,
      id: crypto.randomUUID(),
      date: today(),
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <div className="flex items-center gap-3">
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
          </select>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Add Expense
          </button>
        </div>
      </div>

      {/* YTD Summary by Category */}
      {ytdByCategory.length > 0 && (
        <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{filterYear} Totals by Category</h3>
          <div className="space-y-1.5">
            {ytdByCategory.map(({ category, total }) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{EXPENSE_CATEGORY_LABELS[category]}</span>
                <span className="font-medium tabular-nums">{formatCurrency(total, 'USD')}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2 border-t font-semibold bg-emerald-50 -mx-4 px-4 py-2 rounded-b-xl -mb-4">
              <span>Total Deductions</span>
              <span className="tabular-nums">{formatCurrency(grandTotal, 'USD')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-1">
        {filteredExpenses.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No expenses recorded{filterCategory ? ' for this category' : ''} in {filterYear}.</p>
        ) : (
          filteredExpenses.map((exp) => {
            const co = exp.companyId ? companyMap.get(exp.companyId) : undefined;
            return (
              <div key={exp.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded border hover:shadow-sm text-sm">
                <span className="text-gray-400 shrink-0 w-24">{formatDate(exp.date)}</span>
                <span className="text-xs text-gray-400 shrink-0 w-36 truncate">{EXPENSE_CATEGORY_LABELS[exp.category]}</span>
                <span className="font-medium shrink-0 w-28 truncate">{exp.vendor || ''}</span>
                <span className="text-gray-600 flex-1 min-w-0 truncate">
                  {exp.description}
                  {co && <span className="text-xs text-gray-400 ml-2">({co.name})</span>}
                </span>
                {exp.hasReceipt && <span className="text-xs text-green-600 shrink-0" title="Receipt on file">R</span>}
                {exp.recurring && <span className="text-xs text-blue-500 shrink-0" title="Recurring">&#x21bb;</span>}
                <span className="text-right shrink-0 w-24 font-medium tabular-nums">
                  {formatCurrency(exp.amount, exp.currency)}
                </span>
                <div className="flex gap-1 shrink-0 w-24 justify-end">
                  <button onClick={() => openEdit(exp)} className="text-xs text-blue-600 hover:text-blue-800 px-1">Edit</button>
                  <button onClick={() => duplicate(exp)} className="text-xs text-gray-500 hover:text-gray-700 px-1">Dup</button>
                  <button onClick={() => { if (confirm('Delete this expense?')) deleteExpense(exp.id); }} className="text-xs text-red-500 hover:text-red-700 px-1">Del</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Add Expense' : 'Edit Expense'}>
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as ExpenseCategory })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="What was the expense for"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editing.amount || ''}
                  onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={editing.currency}
                  onChange={(e) => setEditing({ ...editing, currency: e.target.value as Currency })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <input
                  type="text"
                  value={editing.vendor || ''}
                  onChange={(e) => setEditing({ ...editing, vendor: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="e.g., Adobe, Delta Airlines"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={editing.paymentMethod || ''}
                  onChange={(e) => setEditing({ ...editing, paymentMethod: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client (optional)</label>
              <select
                value={editing.companyId || ''}
                onChange={(e) => setEditing({ ...editing, companyId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">No client</option>
                {companies.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editing.hasReceipt}
                  onChange={(e) => setEditing({ ...editing, hasReceipt: e.target.checked })}
                  className="rounded"
                />
                Receipt on file
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editing.recurring}
                  onChange={(e) => setEditing({ ...editing, recurring: e.target.checked })}
                  className="rounded"
                />
                Recurring expense
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                {isNew ? 'Add Expense' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
