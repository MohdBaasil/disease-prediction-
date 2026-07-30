import React, { useState, useEffect } from 'react';
import { 
  Layers, Search, Filter, Plus, Edit2, Trash2, Power, 
  CheckCircle2, AlertTriangle, X, Check, Stethoscope, AlertOctagon,
  Building2, Hash, FileText
} from 'lucide-react';
import { departmentService } from '../services/api';

export default function DepartmentManagement({ onDepartmentUpdated }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'true', 'false'

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatusDept, setTargetStatusDept] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetDeleteDept, setTargetDeleteDept] = useState(null);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true
  });

  // Fetch Departments
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      let isActParam = undefined;
      if (activeFilter === 'true') isActParam = true;
      if (activeFilter === 'false') isActParam = false;

      const data = await departmentService.getDepartments({
        search: searchTerm || undefined,
        is_active: isActParam
      });
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching departments list:", err);
      setError("Failed to load department records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [searchTerm, activeFilter]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingDepartment(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      is_active: true
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (dept) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
      is_active: dept.is_active ?? true
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.name.trim()) {
      setError("Department name is required.");
      return;
    }
    if (!formData.code || !formData.code.trim()) {
      setError("Department code is required.");
      return;
    }

    setActionLoading(true);
    try {
      if (editingDepartment) {
        // Update department
        await departmentService.updateDepartment(editingDepartment.id, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description ? formData.description.trim() : null,
          is_active: formData.is_active
        });
        setSuccess(`Department '${formData.name}' updated successfully.`);
      } else {
        // Create department
        await departmentService.createDepartment({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          description: formData.description ? formData.description.trim() : null,
          is_active: formData.is_active
        });
        setSuccess(`Department '${formData.name}' created successfully.`);
      }

      setShowAddEditModal(false);
      await fetchDepartments();
      if (onDepartmentUpdated) onDepartmentUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save department details.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status
  const handleOpenStatusModal = (dept) => {
    setTargetStatusDept(dept);
    setShowStatusModal(true);
  };

  const handleToggleStatus = async () => {
    if (!targetStatusDept) return;
    setActionLoading(true);
    try {
      const nextState = !targetStatusDept.is_active;
      await departmentService.updateDepartmentStatus(targetStatusDept.id, nextState);
      setSuccess(`Department '${targetStatusDept.name}' has been ${nextState ? 'enabled' : 'disabled'}.`);
      setShowStatusModal(false);
      setTargetStatusDept(null);
      await fetchDepartments();
      if (onDepartmentUpdated) onDepartmentUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to change department status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Department
  const handleOpenDeleteModal = (dept) => {
    setTargetDeleteDept(dept);
    setDeleteWarningMsg('');
    setShowDeleteModal(true);
  };

  const handleDeleteDepartment = async () => {
    if (!targetDeleteDept) return;
    setActionLoading(true);
    setDeleteWarningMsg('');
    try {
      await departmentService.deleteDepartment(targetDeleteDept.id);
      setSuccess(`Department '${targetDeleteDept.name}' deleted successfully.`);
      setShowDeleteModal(false);
      setTargetDeleteDept(null);
      await fetchDepartments();
      if (onDepartmentUpdated) onDepartmentUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || "Failed to delete department.";
      setDeleteWarningMsg(detail);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Toolbar / Search & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* Left: Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search department by name, code, or description..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-hospital-500"
            />
          </div>

          {/* Right: Filters & Add Button */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            
            {/* Status Filter */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeFilter === 'all' ? 'bg-white dark:bg-slate-900 text-hospital-600 dark:text-white shadow-sm' : ''}`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setActiveFilter('true')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeFilter === 'true' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : ''}`}
              >
                Active Only
              </button>
              <button
                onClick={() => setActiveFilter('false')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeFilter === 'false' ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm' : ''}`}
              >
                Inactive Only
              </button>
            </div>

            {/* Add Department Button */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Department</span>
            </button>

          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Departments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="h-5 w-5 text-hospital-500" />
              <span>Medical Departments</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure clinical departments, codes, assigned physicians, and operational statuses.</p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {departments.length} Departments
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 font-semibold animate-pulse">Loading department datasets...</p>
          </div>
        ) : departments.length > 0 ? (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Department Name</th>
                  <th className="py-3 px-3 text-center">Code</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-center">Assigned Doctors</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Created Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {departments.map((dept) => (
                  <tr key={dept.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors ${!dept.is_active ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''}`}>
                    
                    {/* Department Name */}
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                      {dept.name}
                    </td>

                    {/* Code */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-hospital-50 text-hospital-700 dark:bg-hospital-950/50 dark:text-hospital-300 border border-hospital-200 dark:border-hospital-800/50">
                        {dept.code}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-3 text-slate-500 max-w-xs truncate">
                      {dept.description || <span className="text-slate-400 italic">No description</span>}
                    </td>

                    {/* Number of Doctors */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Stethoscope className="h-3 w-3 text-hospital-500" />
                        <span>{dept.doctor_count ?? 0}</span>
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        dept.is_active 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {dept.is_active ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-3 text-slate-400 font-medium">
                      {dept.created_at ? new Date(dept.created_at).toLocaleDateString() : '--'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(dept)}
                          title="Edit Department"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-hospital-600 dark:text-hospital-400 hover:bg-hospital-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Status Toggle Button */}
                        <button
                          onClick={() => handleOpenStatusModal(dept)}
                          title={dept.is_active ? "Disable Department" : "Enable Department"}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            dept.is_active 
                              ? 'border-amber-200 text-amber-600 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30' 
                              : 'border-emerald-200 text-emerald-600 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleOpenDeleteModal(dept)}
                          title="Delete Department"
                          className="p-1.5 rounded-lg border border-rose-200 text-rose-600 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No medical department records found.
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT DEPARTMENT MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-hospital-500" />
                <span>{editingDepartment ? `Edit Department: ${editingDepartment.name}` : 'Create Department'}</span>
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Cardiology"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="CARD"
                    maxLength="8"
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Description</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Specialized cardiovascular diagnostic and treatment unit..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                ></textarea>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Active Status</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                    formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-4' : 'translate-x-0'}`}></span>
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-hospital-500 hover:bg-hospital-600 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{editingDepartment ? 'Save Changes' : 'Create Department'}</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: STATUS TOGGLE CONFIRMATION */}
      {showStatusModal && targetStatusDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-scaleUp">
            
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-2xl ${targetStatusDept.is_active ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/40' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40'}`}>
                <Power className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {targetStatusDept.is_active ? `Disable ${targetStatusDept.name}?` : `Enable ${targetStatusDept.name}?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetStatusDept.is_active 
                    ? 'Disabling this department will hide it from appointment booking dropdowns.' 
                    : 'Re-enabling this department will restore it to booking and doctor management options.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowStatusModal(false); setTargetStatusDept(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 transition-colors ${
                  targetStatusDept.is_active 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Confirm {targetStatusDept.is_active ? 'Disable' : 'Enable'}</span>
                    <Power className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION DIALOG */}
      {showDeleteModal && targetDeleteDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-950/40">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Delete {targetDeleteDept.name}?
                </h3>
                <p className="text-xs text-slate-500">
                  This action permanently removes the department record from the database.
                </p>
              </div>
            </div>

            {/* Assigned Doctors Warning Box */}
            {deleteWarningMsg && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start space-x-2.5 text-rose-800 dark:text-rose-300 text-xs font-semibold animate-fadeIn">
                <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{deleteWarningMsg}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setTargetDeleteDept(null); setDeleteWarningMsg(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDepartment}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 transition-colors"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Confirm Delete</span>
                    <Trash2 className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
