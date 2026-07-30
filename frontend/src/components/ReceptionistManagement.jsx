import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Plus, Edit2, Key, ShieldCheck, 
  CheckCircle2, AlertTriangle, X, Power, Mail, Phone as PhoneIcon, 
  Check, UserCheck, UserX, UserPlus, Lock
} from 'lucide-react';
import { receptionistService } from '../services/api';

export default function ReceptionistManagement({ onReceptionistUpdated }) {
  const [receptionists, setReceptionists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'true', 'false'

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingReceptionist, setEditingReceptionist] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetPasswordRec, setTargetPasswordRec] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatusRec, setTargetStatusRec] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    is_active: true
  });

  // Fetch Receptionists list
  const fetchReceptionists = async () => {
    setLoading(true);
    try {
      let isActParam = undefined;
      if (activeFilter === 'true') isActParam = true;
      if (activeFilter === 'false') isActParam = false;

      const data = await receptionistService.getReceptionists({
        search: searchTerm || undefined,
        is_active: isActParam
      });
      setReceptionists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching receptionist list:", err);
      setError("Failed to load receptionist records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptionists();
  }, [searchTerm, activeFilter]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingReceptionist(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      is_active: true
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rec) => {
    setEditingReceptionist(rec);
    setFormData({
      name: rec.name || '',
      username: rec.username || '',
      email: rec.email || '',
      phone: rec.phone || '',
      password: '',
      confirm_password: '',
      is_active: rec.is_active ?? true
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.name.strip?.() && !formData.name) {
      setError("Full name is required.");
      return;
    }

    if (!formData.username || !formData.username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!editingReceptionist) {
      if (!formData.password) {
        setError("Password is required for new receptionist accounts.");
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setError("Passwords do not match.");
        return;
      }
    } else {
      if (formData.password && formData.password.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }
      if (formData.password && formData.password !== formData.confirm_password) {
        setError("Passwords do not match.");
        return;
      }
    }

    setActionLoading(true);
    try {
      if (editingReceptionist) {
        // Update profile
        await receptionistService.updateReceptionist(editingReceptionist.id, {
          name: formData.name.trim(),
          username: formData.username.trim(),
          email: formData.email ? formData.email.trim() : null,
          phone: formData.phone ? formData.phone.trim() : null,
          is_active: formData.is_active
        });

        // If password was entered during edit, update password
        if (formData.password) {
          await receptionistService.resetReceptionistPassword(editingReceptionist.id, formData.password);
        }

        setSuccess(`Receptionist '${formData.name}' profile updated successfully.`);
      } else {
        // Create new receptionist
        await receptionistService.createReceptionist({
          name: formData.name.trim(),
          username: formData.username.trim(),
          email: formData.email ? formData.email.trim() : null,
          phone: formData.phone ? formData.phone.trim() : null,
          password: formData.password,
          is_active: formData.is_active
        });

        setSuccess(`Receptionist '${formData.name}' created successfully.`);
      }

      setShowAddEditModal(false);
      await fetchReceptionists();
      if (onReceptionistUpdated) onReceptionistUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save receptionist details.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Password Modal
  const handleOpenPasswordModal = (rec) => {
    setTargetPasswordRec(rec);
    setNewPassword('');
    setConfirmNewPassword('');
    setError('');
    setShowPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await receptionistService.resetReceptionistPassword(targetPasswordRec.id, newPassword);
      setSuccess(`Password reset successfully for ${targetPasswordRec.name}.`);
      setShowPasswordModal(false);
      setTargetPasswordRec(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to reset password.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status Confirmation
  const handleOpenStatusModal = (rec) => {
    setTargetStatusRec(rec);
    setShowStatusModal(true);
  };

  const handleToggleStatus = async () => {
    if (!targetStatusRec) return;
    setActionLoading(true);
    try {
      const nextState = !targetStatusRec.is_active;
      await receptionistService.updateReceptionistStatus(targetStatusRec.id, nextState);
      setSuccess(`Receptionist ${targetStatusRec.name} has been ${nextState ? 'enabled' : 'disabled'}.`);
      setShowStatusModal(false);
      setTargetStatusRec(null);
      await fetchReceptionists();
      if (onReceptionistUpdated) onReceptionistUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to change status.");
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
              placeholder="Search by name, username, email, or phone..."
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
                Disabled Only
              </button>
            </div>

            {/* Add Receptionist Button */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Receptionist</span>
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

      {/* Receptionists Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-hospital-500" />
              <span>Reception Staff Roster</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage front-desk reception accounts, active statuses, and portal security credentials.</p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {receptionists.length} Accounts
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 font-semibold animate-pulse">Loading reception staff records...</p>
          </div>
        ) : receptionists.length > 0 ? (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Full Name</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Phone Number</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Created Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {receptionists.map((rec) => (
                  <tr key={rec.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors ${!rec.is_active ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''}`}>
                    
                    {/* Name */}
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                      {rec.name}
                    </td>

                    {/* Username */}
                    <td className="py-3.5 px-3 font-mono font-bold text-hospital-600 dark:text-hospital-400">
                      @{rec.username}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                      {rec.email ? (
                        <span className="flex items-center space-x-1"><Mail className="h-3 w-3 text-slate-400 shrink-0" /><span>{rec.email}</span></span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">
                      {rec.phone ? (
                        <span className="flex items-center space-x-1"><PhoneIcon className="h-3 w-3 text-slate-400 shrink-0" /><span>{rec.phone}</span></span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        rec.is_active 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {rec.is_active ? '🟢 Active' : '🔴 Disabled'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-3 text-slate-400 font-medium">
                      {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '--'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(rec)}
                          title="Edit Receptionist Profile"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-hospital-600 dark:text-hospital-400 hover:bg-hospital-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleOpenPasswordModal(rec)}
                          title="Reset Password"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>

                        {/* Enable/Disable Button */}
                        <button
                          onClick={() => handleOpenStatusModal(rec)}
                          title={rec.is_active ? "Disable Account" : "Enable Account"}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            rec.is_active 
                              ? 'border-rose-200 text-rose-600 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30' 
                              : 'border-emerald-200 text-emerald-600 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
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
            No receptionist staff records found.
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT RECEPTIONIST MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-hospital-500" />
                <span>{editingReceptionist ? `Edit Receptionist: ${editingReceptionist.name}` : 'Add New Receptionist'}</span>
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Sarah Jenkins"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="sjenkins"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sarah@acura.org"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="555-0199"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Password Fields */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  {editingReceptionist ? 'Password (Leave blank to keep existing)' : 'Account Password *'}
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    required={!editingReceptionist}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                  <input
                    type="password"
                    required={!editingReceptionist || !!formData.password}
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    placeholder="Confirm"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Active Account Status</span>
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
                      <span>{editingReceptionist ? 'Save Changes' : 'Create Account'}</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD MODAL */}
      {showPasswordModal && targetPasswordRec && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-scaleUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Key className="h-5 w-5 text-amber-500" />
                <span>Reset Password</span>
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-xs text-slate-500">
              Reset login password for receptionist <span className="font-bold text-slate-900 dark:text-white">{targetPasswordRec.name}</span> (@{targetPasswordRec.username}).
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <Key className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM STATUS TOGGLE DIALOG */}
      {showStatusModal && targetStatusRec && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-scaleUp">
            
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-2xl ${targetStatusRec.is_active ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/40' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40'}`}>
                {targetStatusRec.is_active ? <UserX className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {targetStatusRec.is_active ? `Disable ${targetStatusRec.name}?` : `Enable ${targetStatusRec.name}?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetStatusRec.is_active 
                    ? 'Disabling this receptionist prevents login to front-desk queue management.' 
                    : 'Re-enabling this staff member will restore their reception dashboard access.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowStatusModal(false); setTargetStatusRec(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 transition-colors ${
                  targetStatusRec.is_active 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Confirm {targetStatusRec.is_active ? 'Disable' : 'Enable'}</span>
                    <Power className="h-4 w-4" />
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
