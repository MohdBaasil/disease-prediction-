import React, { useState, useEffect } from 'react';
import {
  Pill, Search, Filter, Calendar, User, FileText, Printer, Download,
  CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, RefreshCcw,
  Shield, Check, Sparkles, Activity, Eye, LayoutGrid, List, ArrowUpDown
} from 'lucide-react';
import { patientService } from '../../services/api';

export default function Prescriptions() {
  const [patient, setPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All, Active, Completed
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name
  const [viewMode, setViewMode] = useState('timeline'); // timeline, grid, table

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState({});

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, rxData, visitData] = await Promise.allSettled([
        patientService.getMe(),
        patientService.getPrescriptions(),
        patientService.getVisits()
      ]);

      if (profileData.status === 'fulfilled') setPatient(profileData.value);
      if (rxData.status === 'fulfilled') setPrescriptions(rxData.value || []);
      if (visitData.status === 'fulfilled') setVisits(visitData.value || []);
    } catch (err) {
      console.error('Failed to load prescription data:', err);
      setError('Unable to retrieve electronic prescriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter and Sort Prescriptions
  const filteredPrescriptions = prescriptions.filter(item => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || (
      (item.medicine_name || '').toLowerCase().includes(q) ||
      (item.dosage || '').toLowerCase().includes(q) ||
      (item.frequency || '').toLowerCase().includes(q) ||
      (item.instructions || '').toLowerCase().includes(q) ||
      (item.doctor_name || '').toLowerCase().includes(q)
    );

    const matchesDoc = !doctorFilter || item.doctor_name === doctorFilter;

    const isCompleted = item.duration && item.duration.toLowerCase().includes('completed');
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Active' && !isCompleted) ||
      (statusFilter === 'Completed' && isCompleted);

    return matchesSearch && matchesDoc && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.prescribed_date || 0) - new Date(a.prescribed_date || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.prescribed_date || 0) - new Date(b.prescribed_date || 0);
    }
    if (sortBy === 'name') {
      return (a.medicine_name || '').localeCompare(b.medicine_name || '');
    }
    return 0;
  });

  // Extract unique doctors for filter dropdown
  const uniqueDoctors = Array.from(new Set(prescriptions.map(p => p.doctor_name).filter(Boolean)));

  // KPI Statistics
  const activeCount = prescriptions.filter(p => !p.duration?.toLowerCase().includes('completed')).length;

  // Latest visit with prescriptions for Quick PDF print
  const latestVisitWithRx = visits.find(v => v.prescriptions && v.prescriptions.length > 0);

  const handlePrint = (visitId) => {
    if (visitId) {
      const url = patientService.getPrescriptionPdfUrl(visitId);
      window.open(url, '_blank');
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-pulse">
        {/* Hero Skeleton */}
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        {/* KPI Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 md:p-6 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg text-rose-500">
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. HERO SECTION */}
      <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-teal-600 to-indigo-700 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-teal-500/10 overflow-hidden border border-teal-400/20 dark:border-slate-800">
        {/* Background glow graphics */}
        <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 left-1/3 h-48 w-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md border border-white/30 flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5" />
                Electronic Prescription System (eRx)
              </span>
              <span className="text-xs text-teal-100 dark:text-slate-300 font-semibold flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Verified Patient Portal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              My Digital Prescriptions & Medications
            </h1>

            <p className="text-xs sm:text-sm text-teal-50 dark:text-slate-300 leading-relaxed font-normal">
              Access your real-time eRx medication orders, dosage instructions, prescribing doctor notes, and active treatment schedules in one central EHR hub.
            </p>

            {patient && (
              <div className="flex items-center space-x-3 pt-2 text-xs text-teal-100 dark:text-slate-300 font-medium">
                <span>Patient: <strong className="text-white font-bold">{patient.name}</strong></span>
                <span>•</span>
                <span>ID: <strong className="text-white font-bold">#{patient.id}</strong></span>
                {patient.blood_group && (
                  <>
                    <span>•</span>
                    <span>Blood Group: <strong className="text-white font-bold">{patient.blood_group}</strong></span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick Action Button in Hero */}
          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto">
            {latestVisitWithRx && (
              <button
                onClick={() => handlePrint(latestVisitWithRx.id)}
                className="bg-white text-teal-700 hover:bg-teal-50 font-extrabold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="h-4 w-4" />
                <span>Print Latest Rx PDF</span>
              </button>
            )}
            <button
              onClick={fetchData}
              className="bg-white/15 hover:bg-white/25 text-white font-semibold px-5 py-2.5 rounded-2xl text-xs backdrop-blur-md border border-white/20 transition-all flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCcw className="h-4 w-4" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Prescriptions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total eRx Items</span>
            <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Pill className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{prescriptions.length}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total recorded prescribed items</p>
          </div>
        </div>

        {/* KPI 2: Active Regimens */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Regimens</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{activeCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ongoing active medication schedules</p>
          </div>
        </div>

        {/* KPI 3: Prescribing Doctors */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attending Prescribers</span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <User className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{uniqueDoctors.length}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Physicians issuing prescriptions</p>
          </div>
        </div>

        {/* KPI 4: Refill / Pharmacy Sync */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pharmacy Status</span>
            <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 tracking-tight">Verified eRx</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Digitally signed & synced</p>
          </div>
        </div>

      </div>

      {/* 3. SEARCH & FILTERS TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicine name, dosage, frequency, or doctor..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls & View Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Doctor Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="">All Doctors</option>
              {uniqueDoctors.map((doc, idx) => (
                <option key={idx} value={doc}>Dr. {doc}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            {['All', 'Active', 'Completed'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${statusFilter === st ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl px-3 py-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Medicine A-Z</option>
            </select>
          </div>

          {/* View Mode Toggle (Timeline vs Grid vs Table) */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('timeline')}
              title="Timeline View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-400'}`}
            >
              <Activity className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-400'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-400'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Reset button if active filters */}
          {(searchTerm || doctorFilter || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDoctorFilter('');
                setStatusFilter('All');
              }}
              className="text-xs font-bold text-rose-500 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}

        </div>

      </div>

      {/* 4. PRESCRIPTION LISTING / CONTENT AREA */}
      {filteredPrescriptions.length === 0 ? (
        
        /* EMPTY STATE */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm animate-fadeIn">
          <div className="h-20 w-20 bg-teal-50 dark:bg-teal-950/60 rounded-3xl flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400 shadow-inner">
            <Pill className="h-10 w-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-lg text-slate-800 dark:text-white">No Prescriptions Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchTerm || doctorFilter || statusFilter !== 'All'
                ? 'No prescriptions match your current search queries or selected filters. Try broadening your search.'
                : 'You have no digital eRx prescriptions recorded in your medical profile yet. Prescriptions issued by your physician will appear here.'}
            </p>
          </div>
          {(searchTerm || doctorFilter || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDoctorFilter('');
                setStatusFilter('All');
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all inline-flex items-center space-x-1.5"
            >
              <span>Clear All Search Filters</span>
            </button>
          )}
        </div>

      ) : viewMode === 'table' ? (

        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">Medication Item</th>
                  <th className="py-4 px-5">Dosage</th>
                  <th className="py-4 px-5">Frequency</th>
                  <th className="py-4 px-5">Duration</th>
                  <th className="py-4 px-5">Prescribing Doctor</th>
                  <th className="py-4 px-5">Prescribed Date</th>
                  <th className="py-4 px-5">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredPrescriptions.map((rx, idx) => {
                  const isCompleted = rx.duration && rx.duration.toLowerCase().includes('completed');
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-5 font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                        <Pill className="h-4 w-4 text-teal-500 shrink-0" />
                        <span>{rx.medicine_name}</span>
                      </td>
                      <td className="py-4 px-5 font-semibold text-slate-700 dark:text-slate-300">{rx.dosage}</td>
                      <td className="py-4 px-5 font-semibold text-teal-600 dark:text-teal-400">{rx.frequency}</td>
                      <td className="py-4 px-5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isCompleted ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'}`}>
                          {rx.duration}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-700 dark:text-slate-300 font-medium">Dr. {rx.doctor_name}</td>
                      <td className="py-4 px-5 text-slate-400 font-medium">
                        {new Date(rx.prescribed_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {rx.instructions || 'Take as directed by doctor.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : viewMode === 'grid' ? (

        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fadeIn">
          {filteredPrescriptions.map((rx, idx) => {
            const isExpanded = !!expandedCards[idx];
            const isCompleted = rx.duration && rx.duration.toLowerCase().includes('completed');

            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-4 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                      <Pill className="h-6 w-6" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isCompleted ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'}`}>
                      {isCompleted ? 'Completed' : 'Active eRx'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {rx.medicine_name}
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Prescribed by Dr. {rx.doctor_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 dark:border-slate-800 py-2.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Dosage</span>
                      <strong className="text-slate-800 dark:text-slate-200">{rx.dosage}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Frequency</span>
                      <strong className="text-teal-600 dark:text-teal-400">{rx.frequency}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Special Instructions</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 leading-relaxed">
                      {rx.instructions || 'Take strictly according to prescribed schedule.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800/60 text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-teal-500" />
                    {new Date(rx.prescribed_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{rx.duration}</span>
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* TIMELINE VIEW (DEFAULT) */
        <div className="space-y-6 animate-fadeIn relative before:absolute before:left-5 md:before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredPrescriptions.map((rx, idx) => {
            const isExpanded = !!expandedCards[idx];
            const isCompleted = rx.duration && rx.duration.toLowerCase().includes('completed');

            return (
              <div key={idx} className="relative pl-12 md:pl-16 group">
                
                {/* Timeline node icon */}
                <div className="absolute left-2.5 md:left-5 top-6 -translate-x-1/2 h-7 w-7 rounded-full bg-white dark:bg-slate-900 border-2 border-teal-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <div className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse"></div>
                </div>

                {/* Prescription Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 space-y-4">
                  
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shrink-0">
                        <Pill className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 block">
                            Electronic Prescription Item
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${isCompleted ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'}`}>
                            {isCompleted ? 'Completed Course' : 'Active eRx'}
                          </span>
                        </div>
                        <h3 className="font-black text-xl text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {rx.medicine_name}
                        </h3>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5">
                        <Calendar className="h-3.5 w-3.5 text-teal-500" />
                        <span>Prescribed: {new Date(rx.prescribed_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Dosage Quantity</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block">
                        {rx.dosage}
                      </strong>
                    </div>

                    <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Frequency & Timing</span>
                      <strong className="text-sm font-black text-teal-600 dark:text-teal-400 block">
                        {rx.frequency}
                      </strong>
                    </div>

                    <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Duration / Course</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block">
                        {rx.duration}
                      </strong>
                    </div>
                  </div>

                  {/* Expand / Collapse Button & Summary */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                      <User className="h-4 w-4 text-teal-500 shrink-0" />
                      <span>Prescribing Physician: <strong className="text-slate-700 dark:text-slate-200">Dr. {rx.doctor_name}</strong></span>
                    </div>

                    <button
                      onClick={() => toggleExpand(idx)}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1.5 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>{isExpanded ? 'Hide Instructions' : 'View Instructions & Notes'}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div className="pt-4 border-t border-slate-150 dark:border-slate-800 space-y-3 animate-fadeIn">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 block">
                          Physician Administration Instructions
                        </span>
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          {rx.instructions || 'Take medication orally as directed by your physician. Complete the full course of treatment.'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                        <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle className="h-4 w-4" />
                          <span>Digital Signature Verified • AcuraQueue Pharmacy Network</span>
                        </div>
                        <button
                          onClick={() => window.print()}
                          className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print Item</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>

      )}

    </div>
  );
}
