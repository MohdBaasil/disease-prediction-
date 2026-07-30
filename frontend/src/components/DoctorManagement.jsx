import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Plus, Edit2, Clock, Calendar, ShieldCheck, 
  CheckCircle2, AlertTriangle, X, Power, Stethoscope, Mail, MapPin, 
  RefreshCw, Check, AlertOctagon, UserX, UserCheck
} from 'lucide-react';
import { doctorService, queueService } from '../services/api';

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DoctorManagement({ onDoctorUpdated }) {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);

  const [showDisableModal, setShowDisableModal] = useState(false);
  const [targetDoctor, setTargetDoctor] = useState(null);
  const [disableWarningMsg, setDisableWarningMsg] = useState('');

  // Doctor Form Fields
  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    department_id: '',
    room_number: '',
    email: '',
    username: '',
    password: '',
    working_days: 'Mon,Tue,Wed,Thu,Fri',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    avg_consultation_time: 15,
    is_available: true,
    status_text: 'Available'
  });

  // Schedule Form Fields
  const [scheduleData, setScheduleData] = useState({
    working_days: 'Mon,Tue,Wed,Thu,Fri',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    avg_consultation_time: 15
  });

  // Load Departments & Doctors list
  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [deptsRes, docsRes] = await Promise.all([
        queueService.getDepartments().catch(() => []),
        doctorService.list({
          search: searchTerm || undefined,
          department_id: selectedDepartment ? parseInt(selectedDepartment) : undefined,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
          is_active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined
        }).catch(() => [])
      ]);

      setDepartments(Array.isArray(deptsRes) ? deptsRes : []);
      setDoctors(Array.isArray(docsRes) ? docsRes : []);
    } catch (err) {
      console.error("Error fetching doctor management datasets:", err);
      setError("Failed to load doctor records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, [searchTerm, selectedDepartment, selectedStatus, activeFilter]);

  // Handle Add Doctor open
  const handleOpenAddModal = () => {
    setEditingDoctor(null);
    setFormData({
      name: '',
      specialization: '',
      department_id: departments.length > 0 ? departments[0].id.toString() : '',
      room_number: '',
      email: '',
      username: '',
      password: '',
      working_days: 'Mon,Tue,Wed,Thu,Fri',
      working_hours_start: '09:00',
      working_hours_end: '17:00',
      avg_consultation_time: 15,
      is_available: true,
      status_text: 'Available'
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Handle Edit Doctor open
  const handleOpenEditModal = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name || '',
      specialization: doctor.specialization || '',
      department_id: doctor.department_id ? doctor.department_id.toString() : '',
      room_number: doctor.room_number || '',
      email: doctor.email || '',
      username: doctor.user?.username || '',
      password: '',
      working_days: doctor.working_days || 'Mon,Tue,Wed,Thu,Fri',
      working_hours_start: doctor.working_hours_start || '09:00',
      working_hours_end: doctor.working_hours_end || '17:00',
      avg_consultation_time: doctor.avg_consultation_time || 15,
      is_available: doctor.is_available ?? true,
      status_text: doctor.status_text || 'Available'
    });
    setError('');
    setShowAddEditModal(true);
  };

  // Save Add/Edit Doctor
  const handleSubmitDoctorForm = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.specialization || !formData.department_id || !formData.room_number) {
      setError("Please complete all required doctor details.");
      return;
    }

    if (!editingDoctor && (!formData.username || !formData.password)) {
      setError("Username and password are required for new doctor accounts.");
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      if (editingDoctor) {
        // Update existing doctor
        await doctorService.update(editingDoctor.id, {
          name: formData.name,
          specialization: formData.specialization,
          department_id: parseInt(formData.department_id),
          room_number: formData.room_number,
          email: formData.email ? formData.email.trim() : null,
          working_days: formData.working_days,
          working_hours_start: formData.working_hours_start,
          working_hours_end: formData.working_hours_end,
          avg_consultation_time: parseInt(formData.avg_consultation_time),
          username: formData.username || undefined,
          password: formData.password || undefined
        });
        setSuccess(`Dr. ${formData.name}'s profile updated successfully.`);
      } else {
        // Create new doctor
        await doctorService.create({
          name: formData.name,
          specialization: formData.specialization,
          department_id: parseInt(formData.department_id),
          room_number: formData.room_number,
          email: formData.email ? formData.email.trim() : null,
          username: formData.username,
          password: formData.password,
          working_days: formData.working_days,
          working_hours_start: formData.working_hours_start,
          working_hours_end: formData.working_hours_end,
          avg_consultation_time: parseInt(formData.avg_consultation_time),
          is_available: true,
          is_active: true,
          status_text: 'Available'
        });
        setSuccess(`Dr. ${formData.name} created successfully.`);
      }

      setShowAddEditModal(false);
      await fetchBaseData();
      if (onDoctorUpdated) onDoctorUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save doctor details.");
    } finally {
      setActionLoading(false);
    }
  };

  // Schedule Modal
  const handleOpenScheduleModal = (doctor) => {
    setScheduleDoctor(doctor);
    setScheduleData({
      working_days: doctor.working_days || 'Mon,Tue,Wed,Thu,Fri',
      working_hours_start: doctor.working_hours_start || '09:00',
      working_hours_end: doctor.working_hours_end || '17:00',
      avg_consultation_time: doctor.avg_consultation_time || 15
    });
    setError('');
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleDoctor) return;

    setActionLoading(true);
    setError('');
    try {
      await doctorService.updateSchedule(scheduleDoctor.id, scheduleData);
      setSuccess(`Schedule updated for Dr. ${scheduleDoctor.name}.`);
      setShowScheduleModal(false);
      await fetchBaseData();
      if (onDoctorUpdated) onDoctorUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update doctor schedule.");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Availability Status Update
  const handleStatusChange = async (doctor, statusText) => {
    setActionLoading(true);
    try {
      let isAvail = true;
      if (statusText === 'Busy' || statusText === 'On Leave' || statusText === 'Inactive') {
        isAvail = false;
      }
      await doctorService.updateAvailability(doctor.id, isAvail, statusText);
      await fetchBaseData();
      if (onDoctorUpdated) onDoctorUpdated();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update doctor availability status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Soft Delete / Disable Toggle
  const handleOpenDisableModal = (doctor) => {
    setTargetDoctor(doctor);
    setDisableWarningMsg('');
    setShowDisableModal(true);
  };

  const handleToggleActiveStatus = async (force = false) => {
    if (!targetDoctor) return;
    setActionLoading(true);
    setDisableWarningMsg('');
    try {
      const nextActiveState = !targetDoctor.is_active;
      await doctorService.setStatus(targetDoctor.id, nextActiveState, force);
      setSuccess(`Dr. ${targetDoctor.name} has been ${nextActiveState ? 'enabled' : 'disabled'}.`);
      setShowDisableModal(false);
      setTargetDoctor(null);
      await fetchBaseData();
      if (onDoctorUpdated) onDoctorUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || "Failed to change doctor status.";
      setDisableWarningMsg(detail);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle day checkbox in working_days CSV
  const toggleWorkingDay = (day, targetStateSetter, currentState) => {
    let daysArray = currentState.working_days ? currentState.working_days.split(',') : [];
    if (daysArray.includes(day)) {
      daysArray = daysArray.filter(d => d !== day);
    } else {
      daysArray.push(day);
    }
    targetStateSetter({ ...currentState, working_days: daysArray.join(',') });
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* Left: Search Input */}
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search doctor by name, specialization, room, or email..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-hospital-500"
            />
          </div>

          {/* Right: Filters & Add Doctor Action */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            
            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Busy">Busy</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* Active Switch Filter */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors ${activeFilter === 'all' ? 'bg-white dark:bg-slate-900 text-hospital-600 dark:text-white shadow-sm' : ''}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('active')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors ${activeFilter === 'active' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : ''}`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveFilter('inactive')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors ${activeFilter === 'inactive' ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm' : ''}`}
              >
                Disabled
              </button>
            </div>

            {/* Add Doctor Button */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Physician</span>
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

      {/* Doctors Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <Stethoscope className="h-5 w-5 text-hospital-500" />
              <span>Physician Directory</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage doctor profiles, schedules, availability statuses, and account access.</p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {doctors.length} Physicians
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 font-semibold animate-pulse">Loading medical staff data...</p>
          </div>
        ) : doctors.length > 0 ? (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Physician Name</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-center">Room</th>
                  <th className="py-3 px-3">Working Schedule</th>
                  <th className="py-3 px-3 text-center">Availability Status</th>
                  <th className="py-3 px-3 text-center">Active</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {doctors.map((doc) => {
                  const isAvailable = doc.is_available && doc.is_active;
                  const statusLabel = !doc.is_active ? 'Inactive' : (doc.status_text || (doc.is_available ? 'Available' : 'Busy'));

                  return (
                    <tr key={doc.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors ${!doc.is_active ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''}`}>
                      
                      {/* Name & Specialization */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                          <span>Dr. {doc.name}</span>
                          {!doc.is_active && <span className="text-[9px] font-bold text-rose-500 uppercase bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">(Disabled)</span>}
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium block">{doc.specialization}</span>
                        {doc.email && <span className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5"><Mail className="h-3 w-3" /><span>{doc.email}</span></span>}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-block">
                          {doc.department?.name || 'General'}
                        </span>
                      </td>

                      {/* Room Number */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {doc.room_number || 'N/A'}
                      </td>

                      {/* Working Schedule */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-semibold">
                            <Clock className="h-3 w-3 text-hospital-500 shrink-0" />
                            <span>{doc.working_hours_start || '09:00'} - {doc.working_hours_end || '17:00'}</span>
                            <span className="text-slate-400 text-[10px]">({doc.avg_consultation_time || 15}m)</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-medium">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>{doc.working_days || 'Mon,Tue,Wed,Thu,Fri'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Availability Status Badge */}
                      <td className="py-3.5 px-3 text-center">
                        <select
                          value={statusLabel}
                          disabled={!doc.is_active || actionLoading}
                          onChange={(e) => handleStatusChange(doc, e.target.value)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer focus:outline-none transition-colors border-0 ${
                            statusLabel === 'Available' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            statusLabel === 'Busy' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            statusLabel === 'On Leave' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                            'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <option value="Available">🟢 Available</option>
                          <option value="Busy">🟡 Busy</option>
                          <option value="On Leave">🟣 On Leave</option>
                          <option value="Inactive" disabled>⚪ Inactive</option>
                        </select>
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleOpenDisableModal(doc)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                            doc.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full bg-white transition-transform ${doc.is_active ? 'translate-x-4' : 'translate-x-0'}`}></span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          
                          {/* Schedule Button */}
                          <button
                            onClick={() => handleOpenScheduleModal(doc)}
                            title="Configure Working Schedule"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(doc)}
                            title="Edit Profile Details"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-hospital-600 dark:text-hospital-400 hover:bg-hospital-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Soft Delete / Power Toggle Button */}
                          <button
                            onClick={() => handleOpenDisableModal(doc)}
                            title={doc.is_active ? "Disable Doctor Account" : "Enable Doctor Account"}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              doc.is_active 
                                ? 'border-rose-200 text-rose-600 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30' 
                                : 'border-emerald-200 text-emerald-600 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No physician records match the specified search and filter criteria.
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT DOCTOR MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 animate-scaleUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Stethoscope className="h-5 w-5 text-hospital-500" />
                <span>{editingDoctor ? `Edit Profile: Dr. ${editingDoctor.name}` : 'Register New Physician'}</span>
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmitDoctorForm} className="space-y-4">
              
              {/* Doctor Name & Specialization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Gregory House"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Specialization *</label>
                  <input
                    type="text"
                    required
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="Diagnostic Medicine"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Department, Room & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department *</label>
                  <select
                    required
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Room Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    placeholder="101"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="house@acura.org"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Working Schedule Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-hospital-600 dark:text-hospital-400 uppercase flex items-center space-x-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Working Schedule & Slots</span>
                </span>

                {/* Working Days */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Working Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map(day => {
                      const selected = (formData.working_days || '').split(',').includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => toggleWorkingDay(day, setFormData, formData)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                            selected 
                              ? 'bg-hospital-500 text-white shadow-sm' 
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Working Hours & Duration */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.working_hours_start}
                      onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End Time</label>
                    <input
                      type="time"
                      value={formData.working_hours_end}
                      onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Consult Duration</label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={formData.avg_consultation_time}
                        onChange={(e) => setFormData({ ...formData, avg_consultation_time: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Authentication Credentials */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-hospital-500" />
                  <span>Portal Credentials</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Username {editingDoctor ? '(Optional Change)' : '*'}
                    </label>
                    <input
                      type="text"
                      required={!editingDoctor}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="drhouse"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Password {editingDoctor ? '(Leave blank to retain)' : '*'}
                    </label>
                    <input
                      type="password"
                      required={!editingDoctor}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-2">
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
                      <span>{editingDoctor ? 'Save Changes' : 'Create Physician'}</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE CONFIGURATION MODAL */}
      {showScheduleModal && scheduleDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Clock className="h-5 w-5 text-hospital-500" />
                <span>Schedule: Dr. {scheduleDoctor.name}</span>
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              
              {/* Working Days */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Working Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map(day => {
                    const selected = (scheduleData.working_days || '').split(',').includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleWorkingDay(day, setScheduleData, scheduleData)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          selected 
                            ? 'bg-hospital-500 text-white shadow-sm' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={scheduleData.working_hours_start}
                    onChange={(e) => setScheduleData({ ...scheduleData, working_hours_start: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Time</label>
                  <input
                    type="time"
                    value={scheduleData.working_hours_end}
                    onChange={(e) => setScheduleData({ ...scheduleData, working_hours_end: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                </div>
              </div>

              {/* Consultation Duration */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Avg Consultation Time (mins)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={scheduleData.avg_consultation_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, avg_consultation_time: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
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
                      <span>Save Schedule</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: DISABLE / ENABLE CONFIRMATION DIALOG */}
      {showDisableModal && targetDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-2xl ${targetDoctor.is_active ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/40' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40'}`}>
                {targetDoctor.is_active ? <UserX className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {targetDoctor.is_active ? `Disable Dr. ${targetDoctor.name}?` : `Enable Dr. ${targetDoctor.name}?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetDoctor.is_active 
                    ? 'Disabling this doctor will hide them from appointment booking and prevent new queue logins.' 
                    : 'Re-enabling this physician will restore their portal access and appointment booking availability.'}
                </p>
              </div>
            </div>

            {/* Warning Banner if backend rejected due to active queue */}
            {disableWarningMsg && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-start space-x-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <AlertOctagon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{disableWarningMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActiveStatus(true)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center space-x-1.5"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Force Disable & Keep Current Queue</span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowDisableModal(false); setTargetDoctor(null); setDisableWarningMsg(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleActiveStatus(false)}
                disabled={actionLoading}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 transition-colors ${
                  targetDoctor.is_active 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Confirm {targetDoctor.is_active ? 'Disable' : 'Enable'}</span>
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
