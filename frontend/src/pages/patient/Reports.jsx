import React, { useState, useEffect } from 'react';
import {
  FileText, Search, Filter, Calendar, Download, Eye, RefreshCcw,
  Sparkles, Shield, Check, FlaskConical, Activity, ArrowUpDown,
  LayoutGrid, List, AlertCircle, Clock, FileCheck, CheckCircle
} from 'lucide-react';
import { patientService } from '../../services/api';

export default function Reports() {
  const [patient, setPatient] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search, Filter & View Mode
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Selected report for modal / preview
  const [previewReport, setPreviewReport] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, reportsRes] = await Promise.allSettled([
        patientService.getMe(),
        patientService.getReports()
      ]);

      if (profileRes.status === 'fulfilled') setPatient(profileRes.value);
      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value || []);
    } catch (err) {
      console.error('Failed to load lab reports:', err);
      setError('Unable to fetch diagnostic lab reports. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter & Sort Logic
  const filteredReports = reports.filter(rep => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || (
      (rep.report_name || '').toLowerCase().includes(q) ||
      (rep.report_type || '').toLowerCase().includes(q)
    );

    const matchesType = !typeFilter || rep.report_type === typeFilter;

    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.upload_date || 0) - new Date(a.upload_date || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.upload_date || 0) - new Date(b.upload_date || 0);
    }
    if (sortBy === 'name') {
      return (a.report_name || '').localeCompare(b.report_name || '');
    }
    return 0;
  });

  // Extract unique categories for filter
  const uniqueTypes = Array.from(new Set(reports.map(r => r.report_type).filter(Boolean)));

  // Helper for type icons & colors
  const getTypeBadge = (type = '') => {
    const lower = type.toLowerCase();
    if (lower.includes('blood') || lower.includes('hematology') || lower.includes('panel')) {
      return {
        icon: FlaskConical,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/40',
        badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
      };
    }
    if (lower.includes('radio') || lower.includes('mri') || lower.includes('x-ray') || lower.includes('scan')) {
      return {
        icon: Activity,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900/40',
        badgeBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
      };
    }
    return {
      icon: FileText,
      color: 'text-hospital-600 dark:text-hospital-400 bg-hospital-50 dark:bg-hospital-950/60 border-hospital-200 dark:border-hospital-900/40',
      badgeBg: 'bg-hospital-100 dark:bg-hospital-950 text-hospital-700 dark:text-hospital-300'
    };
  };

  const handleDownload = (reportId) => {
    const pdfUrl = patientService.getReportPdfUrl(reportId);
    window.open(pdfUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-pulse">
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          ))}
        </div>
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
      <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-indigo-600 to-purple-700 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-indigo-500/10 overflow-hidden border border-indigo-400/20 dark:border-slate-800">
        <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 left-1/3 h-48 w-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md border border-white/30 flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Diagnostic Lab & Radiology Portal
              </span>
              <span className="text-xs text-indigo-100 dark:text-slate-300 font-semibold flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Verified Health Records
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Medical Lab Reports & Diagnostics
            </h1>

            <p className="text-xs sm:text-sm text-indigo-50 dark:text-slate-300 leading-relaxed font-normal">
              Review certified blood panel analyses, pathology reports, diagnostic imaging, and clinical test history seamlessly.
            </p>

            {patient && (
              <div className="flex items-center space-x-3 pt-2 text-xs text-indigo-100 dark:text-slate-300 font-medium">
                <span>Patient: <strong className="text-white font-bold">{patient.name}</strong></span>
                <span>•</span>
                <span>ID: <strong className="text-white font-bold">#{patient.id}</strong></span>
                <span>•</span>
                <span>Total Reports: <strong className="text-white font-bold">{reports.length}</strong></span>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto">
            <button
              onClick={fetchData}
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCcw className="h-4 w-4" />
              <span>Refresh Lab Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Reports */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Reports</span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{reports.length}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Uploaded diagnostic files</p>
          </div>
        </div>

        {/* KPI 2: Categories */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categories</span>
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <FlaskConical className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{uniqueTypes.length || 1}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Lab test specialties</p>
          </div>
        </div>

        {/* KPI 3: Recent Uploads */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Activity</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {reports.length > 0 ? new Date(reports[0].upload_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'None'}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Most recent lab upload</p>
          </div>
        </div>

        {/* KPI 4: Verified EHR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Certification</span>
            <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-teal-600 dark:text-teal-400 tracking-tight">EHR Certified</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Hospital verified reports</p>
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
            placeholder="Search report name or test type..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400"
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

        {/* Filter Controls & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Category/Type Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="">All Test Categories</option>
              {uniqueTypes.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>
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
              <option value="name">Report Name A-Z</option>
            </select>
          </div>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-400'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-400'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Reset button */}
          {(searchTerm || typeFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('');
              }}
              className="text-xs font-bold text-rose-500 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}

        </div>

      </div>

      {/* 4. REPORTS LISTING */}
      {filteredReports.length === 0 ? (

        /* EMPTY STATE */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm animate-fadeIn">
          <div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-950/60 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-inner">
            <FileText className="h-10 w-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-lg text-slate-800 dark:text-white">No Lab Reports Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchTerm || typeFilter
                ? 'No diagnostic reports match your current search terms or selected category filter.'
                : 'You have no lab or radiology reports uploaded to your electronic medical records profile yet.'}
            </p>
          </div>
          {(searchTerm || typeFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all inline-flex items-center space-x-1.5"
            >
              <span>Clear Search & Filters</span>
            </button>
          )}
        </div>

      ) : viewMode === 'list' ? (

        /* LIST VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">Report Document Name</th>
                  <th className="py-4 px-5">Category / Type</th>
                  <th className="py-4 px-5">Upload Date</th>
                  <th className="py-4 px-5">EHR Verification</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredReports.map((report) => {
                  const style = getTypeBadge(report.report_type);
                  const Icon = style.icon;

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-5 font-bold text-slate-800 dark:text-white flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${style.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block">{report.report_name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Document ID: #{report.id}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 font-semibold">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${style.badgeBg}`}>
                          {report.report_type}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-slate-600 dark:text-slate-300 font-medium">
                        {new Date(report.upload_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                          <CheckCircle className="h-3 w-3" />
                          <span>Verified</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right space-x-2">
                        <button
                          onClick={() => handleDownload(report.id)}
                          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl transition-all inline-flex items-center space-x-1 hover:scale-105 active:scale-95"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* GRID VIEW (DEFAULT) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fadeIn">
          {filteredReports.map((report) => {
            const style = getTypeBadge(report.report_type);
            const Icon = style.icon;

            return (
              <div
                key={report.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 space-y-4 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl ${style.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${style.badgeBg}`}>
                      {report.report_type}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                      {report.report_name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Report ID: #{report.id}</p>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{new Date(report.upload_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Certified
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewReport(report)}
                    className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-1 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Quick View</span>
                  </button>

                  <button
                    onClick={() => handleDownload(report.id)}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-1 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      )}

      {/* QUICK PREVIEW MODAL */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-white">{previewReport.report_name}</h3>
                  <span className="text-xs text-indigo-500 font-bold">{previewReport.report_type}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewReport(null)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[9px]">Upload Date</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {new Date(previewReport.upload_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[9px]">Report Reference ID</span>
                  <strong className="text-slate-800 dark:text-slate-200">#{previewReport.id}</strong>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-center space-x-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span>Verified by AcuraQueue Pathology & Clinical Laboratories. File format ready for download.</span>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setPreviewReport(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  handleDownload(previewReport.id);
                  setPreviewReport(null);
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download Report PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
