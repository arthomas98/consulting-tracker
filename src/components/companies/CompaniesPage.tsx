import { useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import type { Company, Currency, BillingType } from '../../types';
import { formatCurrency } from '../../utils/formatCurrency';
import Modal from '../shared/Modal';
import Badge from '../shared/Badge';

const emptyCo: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  currency: 'USD',
  billingType: 'hourly',
  hourlyRate: 0,
  monthlyRate: undefined,
  invoiceRequired: true,
  paymentTerms: '',
  paymentMethod: '',
  contactName: '',
  contactEmail: '',
  notes: '',
  isActive: true,
};

export default function CompaniesPage() {
  const { companies, projects, saveCompany, saveProject } = useStorage();
  const [editing, setEditing] = useState<Company | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const displayed = companies.filter((c) => showInactive || c.isActive);

  function openNew() {
    setIsNew(true);
    setEditing({
      ...emptyCo,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Company);
  }

  function openEdit(co: Company) {
    setIsNew(false);
    setEditing({ ...co });
  }

  function handleSave() {
    if (!editing || !editing.name.trim()) return;
    saveCompany({ ...editing, updatedAt: new Date().toISOString() });
    setEditing(null);
  }

  function toggleActive(co: Company) {
    saveCompany({ ...co, isActive: !co.isActive, updatedAt: new Date().toISOString() });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Companies</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            Add Company
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No companies yet. Add one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((co) => (
            <div
              key={co.id}
              className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${!co.isActive ? 'opacity-60' : ''}`}
              onClick={() => openEdit(co)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{co.name}</h3>
                <div className="flex gap-1">
                  {!co.isActive && <Badge color="gray">Inactive</Badge>}
                  {co.billingType === 'fixed_monthly' && <Badge color="purple">Retainer</Badge>}
                  {co.invoiceRequired && <Badge color="blue">Invoice</Badge>}
                </div>
              </div>
              <p className="text-lg font-medium text-gray-700">
                {co.billingType === 'fixed_monthly'
                  ? <>{formatCurrency(co.monthlyRate || 0, co.currency)}<span className="text-sm text-gray-500">/mo</span></>
                  : <>{formatCurrency(co.hourlyRate, co.currency)}<span className="text-sm text-gray-500">/hr</span></>
                }
              </p>
              {(() => {
                const projectCount = projects.filter((p) => p.companyId === co.id && p.isActive).length;
                return projectCount > 0 ? (
                  <p className="text-xs text-gray-400 mt-1">{projectCount} project{projectCount !== 1 ? 's' : ''}</p>
                ) : null;
              })()}
              {(co.paymentTerms || co.paymentMethod) && (
                <p className="text-sm text-gray-500 mt-1">
                  {[co.paymentTerms, co.paymentMethod].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Company' : 'Edit Company'}
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
              <div className="flex border rounded-md overflow-hidden text-sm w-fit">
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, billingType: 'hourly' as BillingType })}
                  className={`px-3 py-1.5 ${editing.billingType === 'hourly' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                >
                  Hourly
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, billingType: 'fixed_monthly' as BillingType, invoiceRequired: true })}
                  className={`px-3 py-1.5 ${editing.billingType === 'fixed_monthly' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                >
                  Fixed Monthly
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing.billingType === 'fixed_monthly' ? 'Monthly Rate *' : 'Hourly Rate *'}
                </label>
                {editing.billingType === 'fixed_monthly' ? (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editing.monthlyRate || ''}
                    onChange={(e) => setEditing({ ...editing, monthlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editing.hourlyRate || ''}
                    onChange={(e) => setEditing({ ...editing, hourlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                )}
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="invoiceRequired"
                checked={editing.invoiceRequired}
                onChange={(e) => setEditing({ ...editing, invoiceRequired: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="invoiceRequired" className="text-sm text-gray-700">Requires formal invoice for payment</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={editing.paymentTerms || ''}
                  onChange={(e) => setEditing({ ...editing, paymentTerms: e.target.value })}
                  placeholder="e.g., Net 30, Upon receipt"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={editing.paymentMethod || ''}
                  onChange={(e) => setEditing({ ...editing, paymentMethod: e.target.value })}
                  placeholder="e.g., Wire, PayPal, Check"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={editing.contactName || ''}
                  onChange={(e) => setEditing({ ...editing, contactName: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={editing.contactEmail || ''}
                  onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
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
            {/* Projects */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Projects</label>
              {(() => {
                const companyProjects = projects.filter((p) => p.companyId === editing.id);
                return (
                  <div className="space-y-2">
                    {companyProjects.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm">
                        <span className={!p.isActive ? 'text-gray-400 line-through' : ''}>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => saveProject({ ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() })}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {p.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="New project name"
                        className="flex-1 border rounded-md px-3 py-1.5 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newProjectName.trim()) {
                              const now = new Date().toISOString();
                              saveProject({
                                id: crypto.randomUUID(),
                                companyId: editing.id,
                                name: newProjectName.trim(),
                                isActive: true,
                                createdAt: now,
                                updatedAt: now,
                              });
                              setNewProjectName('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newProjectName.trim()) {
                            const now = new Date().toISOString();
                            saveProject({
                              id: crypto.randomUUID(),
                              companyId: editing.id,
                              name: newProjectName.trim(),
                              isActive: true,
                              createdAt: now,
                              updatedAt: now,
                            });
                            setNewProjectName('');
                          }
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 px-2"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {!isNew && (
                <button
                  onClick={() => { toggleActive(editing); setEditing(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {editing.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
                <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
