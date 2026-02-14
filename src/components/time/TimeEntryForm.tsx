import { useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { TimeEntry } from '../../types';
import { parseHoursInput } from '../../utils/calculations';
import { today } from '../../utils/dateUtils';

interface TimeEntryFormProps {
  initial?: TimeEntry;
  onDone: () => void;
  compact?: boolean;
}

type EntryMode = 'hours' | 'amount';

export default function TimeEntryForm({ initial, onDone, compact }: TimeEntryFormProps) {
  const { companies, projects, saveTimeEntry } = useStorage();
  const activeCompanies = companies.filter((c) => c.isActive);

  const [companyId, setCompanyId] = useState(initial?.companyId || activeCompanies[0]?.id || '');
  const [projectId, setProjectId] = useState(initial?.projectId || '');
  const [date, setDate] = useState(initial?.date || today());
  const [mode, setMode] = useState<EntryMode>(initial?.fixedAmount != null ? 'amount' : 'hours');
  const [hoursInput, setHoursInput] = useState(initial ? String(initial.hours) : '');
  const [amountInput, setAmountInput] = useState(initial?.fixedAmount != null ? String(initial.fixedAmount) : '');
  const [description, setDescription] = useState(initial?.description || '');
  const [error, setError] = useState('');

  const companyProjects = projects.filter((p) => p.companyId === companyId && p.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!companyId) { setError('Select a company'); return; }
    if (!description.trim()) { setError('Enter a description'); return; }

    let hours = 0;
    let fixedAmount: number | undefined;

    if (mode === 'hours') {
      const parsed = parseHoursInput(hoursInput);
      if (parsed === null || parsed <= 0) { setError('Enter valid hours (e.g., 1.5 or 1:30)'); return; }
      hours = parsed;
    } else {
      const amt = parseFloat(amountInput);
      if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
      fixedAmount = amt;
      // Allow optional hours for record-keeping
      if (hoursInput.trim()) {
        const parsed = parseHoursInput(hoursInput);
        if (parsed !== null && parsed > 0) hours = parsed;
      }
    }

    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: initial?.id || crypto.randomUUID(),
      companyId,
      projectId: projectId || undefined,
      date,
      hours,
      fixedAmount,
      description: description.trim(),
      paidDate: initial?.paidDate,
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    };
    saveTimeEntry(entry);
    if (!initial) {
      setHoursInput('');
      setAmountInput('');
      setDescription('');
    }
    onDone();
  }

  const modeToggle = (
    <div className="flex border rounded-md overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setMode('hours')}
        className={`px-2 py-1 ${mode === 'hours' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
      >
        Hours
      </button>
      <button
        type="button"
        onClick={() => setMode('amount')}
        className={`px-2 py-1 ${mode === 'amount' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
      >
        Amount
      </button>
    </div>
  );

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setProjectId(''); }} className="border rounded-md px-2 py-1.5 text-sm">
          <option value="">Company</option>
          {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {companyProjects.length > 0 && (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">Project</option>
            {companyProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
        {modeToggle}
        {mode === 'hours' ? (
          <input
            type="text"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            placeholder="Hours"
            className="border rounded-md px-2 py-1.5 text-sm w-20"
          />
        ) : (
          <>
            <input
              type="text"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="$ Amount"
              className="border rounded-md px-2 py-1.5 text-sm w-24"
            />
            <input
              type="text"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder="Hours (opt)"
              className="border rounded-md px-2 py-1.5 text-sm w-24"
            />
          </>
        )}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="border rounded-md px-2 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700">
          Add
        </button>
        {error && <p className="text-red-600 text-xs w-full">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
        <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setProjectId(''); }} className="w-full border rounded-md px-3 py-2 text-sm">
          <option value="">Select company...</option>
          {activeCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {companyProjects.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">No project</option>
            {companyProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Entry type</label>
          {modeToggle}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        {mode === 'hours' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hours * <span className="text-gray-400 font-normal">(e.g., 1.5 or 1:30)</span></label>
            <input
              type="text"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder="1.5 or 1:30"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="text"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="150.00"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
      {mode === 'amount' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hours <span className="text-gray-400 font-normal">(optional, for your records)</span></label>
          <input
            type="text"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            placeholder="1.5 or 1:30"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="What was done — this becomes the invoice line item"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          {initial ? 'Update' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
}
