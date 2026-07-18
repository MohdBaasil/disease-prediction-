import React, { useState, useEffect } from 'react';
import { 
  Users, BarChart2, PlusCircle, FileText, Download, 
  Settings, CheckCircle, AlertTriangle, ShieldCheck, HeartPulse,
  Clock, Activity, Calendar, TrendingUp, Layers, RefreshCw, AlertOctagon, ListTodo
} from 'lucide-react';
import { doctorService, queueService, reportsService, analyticsService } from '../services/api';
import { 
  MonthlyRegistrationChart, 
  AppointmentTrendChart, 
  CommonPredictedDiseasesChart,
  DepartmentDistributionChart, 
  DoctorWorkloadChart, 
  RiskDistributionChart 
} from './AnalyticsCharts';

function AdminDashboard() {
  // Navigation & General tab state
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' or 'management'
  const [departments, setDepartments] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);

  // Doctor Creation Form States
  const [docUsername, setDocUsername] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docRoom, setDocRoom] = useState('');
  const [docDept, setDocDept] = useState('');

  // Report Export Form States (for original seeder)
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');

  // Loading, Success & Error states
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Analytics State
  const [dateFilter, setDateFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [kpis, setKpis] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [highRiskPatients, setHighRiskPatients] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // Load static configuration (departments & doctors list)
  const loadBaseConfig = async () => {
    try {
      const depts = await queueService.getDepartments();
      setDepartments(depts);
      if (depts.length > 0 && !docDept) {
        setDocDept(depts[0].id.toString());
      }
      const docs = await doctorService.list();
      setDoctorsList(docs);
    } catch (e) {
      console.error("Error loading base admin config:", e);
      setError("Failed to fetch hospital config.");
    }
  };

  // Load analytics datasets based on filters
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const params = {
        filter_type: dateFilter,
        start: dateFilter === 'custom' ? customStart : undefined,
        end: dateFilter === 'custom' ? customEnd : undefined
      };

      const [kpiRes, chartsRes, highRiskRes, activitiesRes] = await Promise.all([
        analyticsService.getAdminAnalytics(params),
        analyticsService.getAdminCharts(params),
        analyticsService.getHighRiskPatients(),
        analyticsService.getRecentActivities()
      ]);

      setKpis(kpiRes);
      setChartsData(chartsRes);
      setHighRiskPatients(highRiskRes);
      setRecentActivities(activitiesRes);
    } catch (err) {
      console.error("Error retrieving analytics:", err);
      setError("Failed to load hospital analytics datasets.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadBaseConfig();
      await loadAnalytics();
      setLoading(false);
    };
    init();

    // Default export report dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setReportStart(thirtyDaysAgo.toISOString().split('T')[0]);
    setReportEnd(today.toISOString().split('T')[0]);
  }, []);

  // Reload analytics when filter inputs change
  useEffect(() => {
    if (!loading) {
      if (dateFilter !== 'custom' || (customStart && customEnd)) {
        loadAnalytics();
      }
    }
  }, [dateFilter, customStart, customEnd]);

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    if (!docUsername || !docPassword || !docName || !docSpec || !docRoom || !docDept) {
      setError('Please fill in all doctor creation fields.');
      return;
    }

    setError('');
    setSuccess('');
    setFormLoading(true);
    try {
      await doctorService.create(
        docName,
        docSpec,
        docRoom,
        docUsername,
        docPassword,
        parseInt(docDept)
      );
      setSuccess(`Doctor ${docName} created successfully!`);
      setDocUsername('');
      setDocPassword('');
      setDocName('');
      setDocSpec('');
      setDocRoom('');
      await loadBaseConfig();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create doctor.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    let startStr = reportStart;
    let endStr = reportEnd;
    if (activeTab === 'analytics') {
      if (dateFilter === 'custom') {
        startStr = customStart;
        endStr = customEnd;
      } else if (kpis) {
        // Approximate range or standard mapping
        const range = getRangeDates(dateFilter);
        startStr = range.start;
        endStr = range.end;
      }
    }
    const url = reportsService.getExcelUrl(startStr, endStr);
    window.open(url, '_blank');
  };

  const handleDownloadPdf = () => {
    let startStr = reportStart;
    let endStr = reportEnd;
    if (activeTab === 'analytics') {
      if (dateFilter === 'custom') {
        startStr = customStart;
        endStr = customEnd;
      } else if (kpis) {
        const range = getRangeDates(dateFilter);
        startStr = range.start;
        endStr = range.end;
      }
    }
    const url = reportsService.getPdfUrl(startStr, endStr);
    window.open(url, '_blank');
  };

  // Frontend custom CSV downloader for analytics summary data
  const handleExportCSV = () => {
    if (!kpis) return;
    const csvData = [
      { Metric: "Total Patients", Value: kpis.total_patients },
      { Metric: "Total Doctors", Value: kpis.total_doctors },
      { Metric: "Total Receptionists", Value: kpis.total_receptionists },
      { Metric: "Total Appointments", Value: kpis.total_appointments },
      { Metric: "Today's Appointments", Value: kpis.todays_appointments },
      { Metric: "Total Consultations", Value: kpis.total_consultations },
      { Metric: "Total Prescriptions", Value: kpis.total_prescriptions },
      { Metric: "Total AI Predictions", Value: kpis.total_predictions },
      { Metric: "Active Queue Count", Value: kpis.active_queue_count },
      { Metric: "High Risk Patients", Value: kpis.high_risk_patients },
      { Metric: "Average Daily Patients", Value: kpis.avg_daily_patients },
      { Metric: "Average Waiting Time (min)", Value: kpis.avg_waiting_time_minutes }
    ];

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hospital_Analytics_${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRangeDates = (filter) => {
    const now = new Date();
    let start = new Date();
    if (filter === 'today') {
      start.setHours(0,0,0,0);
    } else if (filter === 'week') {
      start.setDate(now.getDate() - now.getDay() + 1); // Monday
    } else if (filter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === '6months') {
      start.setDate(now.getDate() - 180);
    } else if (filter === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start.setDate(now.getDate() - 30);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    }
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Orchestrating executive statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Hospital Administration</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">View real-time operation metrics, configure medical staff, and generate PDF/Excel exports.</p>
        </div>

        {/* Tab Selection Controls */}
        <div className="flex p-1 bg-slate-200/60 dark:bg-slate-900 border border-slate-300/40 dark:border-slate-800 rounded-2xl shadow-inner">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'analytics' 
                ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm' 
                : 'text-slate-550 hover:text-slate-800 dark:hover:text-slate-350'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Executive Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'management' 
                ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm' 
                : 'text-slate-550 hover:text-slate-800 dark:hover:text-slate-350'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Staff Seeding & Config</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ========================================================
          EXECUTIVE ANALYTICS TAB
          ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Filtering & Live Exports Control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-550 uppercase tracking-wider flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-hospital-500" />
                <span>Range Triage:</span>
              </span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {dateFilter === 'custom' && (
                <div className="flex items-center space-x-2 animate-fadeIn">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                </div>
              )}
            </div>

            {/* Live Exports buttons */}
            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3 py-1.5 bg-hospital-500 hover:bg-hospital-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* KPI Analytics Cards Grid */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm animate-pulse h-24 flex items-center justify-between">
                  <div className="space-y-2.5">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-6 w-16 bg-slate-300 dark:bg-slate-750 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Total Patients */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Patients</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_patients}</span>
                </div>
                <div className="bg-blue-50 text-blue-500 dark:bg-blue-950/40 p-3 rounded-xl"><Users className="h-5 w-5" /></div>
              </div>

              {/* Total Doctors */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Doctors</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_doctors}</span>
                </div>
                <div className="bg-purple-50 text-purple-500 dark:bg-purple-950/40 p-3 rounded-xl"><Layers className="h-5 w-5" /></div>
              </div>

              {/* Total Receptionists */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Reception Staff</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_receptionists}</span>
                </div>
                <div className="bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 p-3 rounded-xl"><ShieldCheck className="h-5 w-5" /></div>
              </div>

              {/* Total Appointments */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Appointments</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_appointments}</span>
                </div>
                <div className="bg-teal-50 text-teal-500 dark:bg-teal-950/40 p-3 rounded-xl"><Calendar className="h-5 w-5" /></div>
              </div>

              {/* Today's Appointments */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Today's Appts</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.todays_appointments}</span>
                </div>
                <div className="bg-amber-50 text-amber-500 dark:bg-amber-950/40 p-3 rounded-xl"><Clock className="h-5 w-5" /></div>
              </div>

              {/* Total Consultations */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Consults</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_consultations}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 p-3 rounded-xl"><HeartPulse className="h-5 w-5" /></div>
              </div>

              {/* Total Prescriptions */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Prescriptions Issued</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_prescriptions}</span>
                </div>
                <div className="bg-rose-50 text-rose-500 dark:bg-rose-950/40 p-3 rounded-xl"><FileText className="h-5 w-5" /></div>
              </div>

              {/* Total AI Predictions */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">AI Diagnoses</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.total_predictions}</span>
                </div>
                <div className="bg-cyan-50 text-cyan-500 dark:bg-cyan-950/40 p-3 rounded-xl"><Activity className="h-5 w-5" /></div>
              </div>

              {/* Active Queue Count */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Active Queue Length</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.active_queue_count}</span>
                </div>
                <div className="bg-orange-50 text-orange-500 dark:bg-orange-950/40 p-3 rounded-xl"><RefreshCw className="h-5 w-5" /></div>
              </div>

              {/* High Risk Patients */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">High Risk Patients</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{kpis.high_risk_patients}</span>
                </div>
                <div className="bg-rose-50 text-rose-500 dark:bg-rose-950/40 p-3 rounded-xl"><AlertOctagon className="h-5 w-5" /></div>
              </div>

              {/* Average Daily Patients */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Avg Daily Load</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.avg_daily_patients}</span>
                </div>
                <div className="bg-sky-50 text-sky-500 dark:bg-sky-950/40 p-3 rounded-xl"><TrendingUp className="h-5 w-5" /></div>
              </div>

              {/* Average Waiting Time */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between hover:shadow transition-shadow">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Avg Wait Pace</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{kpis.avg_waiting_time_minutes} min</span>
                </div>
                <div className="bg-yellow-50 text-yellow-500 dark:bg-yellow-950/40 p-3 rounded-xl"><Clock className="h-5 w-5" /></div>
              </div>

            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-3xl text-slate-450 border border-dashed border-slate-200 dark:border-slate-800">
              No metrics available for the chosen filters.
            </div>
          )}

          {/* Interactive Charts Panel */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-72 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 animate-pulse"></div>
              <div className="h-72 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 animate-pulse"></div>
            </div>
          ) : chartsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Line: Monthly Patient Registration */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Patient Registration</h3>
                <div className="h-64">
                  <MonthlyRegistrationChart data={chartsData.monthly_patient_registration} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Donut: Prediction Risk Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prediction Risk Distribution</h3>
                <div className="h-64 flex items-center justify-center">
                  <RiskDistributionChart data={chartsData.prediction_risk_distribution} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Area: Monthly Appointment Trend */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Appointment Volume</h3>
                <div className="h-64">
                  <AppointmentTrendChart data={chartsData.monthly_appointment_trend} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Pie: Department patient distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department Patient Share</h3>
                <div className="h-64 flex items-center justify-center">
                  <DepartmentDistributionChart data={chartsData.department_patient_distribution} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Bar: Most Common Predicted Diseases */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Most Common Predicted Diseases</h3>
                <div className="h-64">
                  <CommonPredictedDiseasesChart data={chartsData.most_common_predicted_diseases} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Queue Analytics Panel Widget */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-hospital-500" />
                  <span>Real-Time Queue Analytics</span>
                </h3>
                
                <div className="grid grid-cols-2 gap-4 py-2 flex-grow">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Avg Waiting</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1">{chartsData.queue_analytics.average_waiting_time_minutes} min</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Avg Consult</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1">{chartsData.queue_analytics.average_consultation_time_minutes} min</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Active Length</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1">{chartsData.queue_analytics.current_queue_length} patients</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Tokens Done Today</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1">{chartsData.queue_analytics.completed_tokens_today}</span>
                  </div>
                </div>
              </div>

              {/* Horizontal Bar: Doctor Workload */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-3">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doctor Workload Load</h3>
                <div className="h-64">
                  <DoctorWorkloadChart data={chartsData.doctor_workload} isDarkMode={isDarkMode} />
                </div>
              </div>

            </div>
          ) : null}

          {/* High Risk Monitor & Recent Activities Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* High Risk Patients Monitor (Span 2) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2 flex flex-col">
              <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <AlertOctagon className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                <span>High-Risk Patients Monitor</span>
              </h3>

              {highRiskPatients && highRiskPatients.length > 0 ? (
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Predicted Pathology</th>
                        <th className="py-2.5 px-3 text-center">Risk Level</th>
                        <th className="py-2.5 px-3">Assigned Physician</th>
                        <th className="py-2.5 px-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {highRiskPatients.map((patient) => {
                        const isCritical = patient.risk_level === 'Critical';
                        const badgeColor = isCritical 
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-400' 
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400';
                        return (
                          <tr key={patient.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{patient.patient_name}</td>
                            <td className="py-3 px-3 font-medium text-slate-500">{patient.predicted_disease}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}`}>
                                {patient.risk_level}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-350">{patient.assigned_doctor}</td>
                            <td className="py-3 px-3 text-right text-slate-400">{new Date(patient.prediction_time).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-450 text-sm">
                  No high-risk patient predictions monitored.
                </div>
              )}
            </div>

            {/* Recent Activities Log */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
              <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <ListTodo className="h-4.5 w-4.5 text-hospital-500" />
                <span>Live Recent Activities Feed</span>
              </h3>

              {recentActivities && recentActivities.length > 0 ? (
                <div className="overflow-y-auto pr-1 space-y-3 flex-grow">
                  {recentActivities.map((act, index) => {
                    let typeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
                    if (act.type.includes('Completed')) {
                      typeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
                    } else if (act.type.includes('Booked')) {
                      typeColor = 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400';
                    } else if (act.type.includes('Prediction')) {
                      typeColor = 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400';
                    } else if (act.type.includes('Prescription')) {
                      typeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
                    }

                    return (
                      <div key={index} className="p-3 border border-slate-100 dark:border-slate-800/40 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10 hover:border-slate-250 dark:hover:border-slate-700 transition-all flex flex-col space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${typeColor}`}>
                            {act.type}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            {new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-350">{act.description}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-450 text-sm">
                  No activity history logged.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          STAFF SEEDING & CONFIG TAB (Original View)
          ======================================================== */}
      {activeTab === 'management' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Left Side: Create Doctor Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
              <PlusCircle className="h-5 w-5 text-hospital-500" />
              <span>Physician Account Seeder</span>
            </h2>

            <form onSubmit={handleCreateDoctor} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">FULL NAME</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  placeholder="Dr. Gregory House"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">SPECIALIZATION</label>
                <input
                  type="text"
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  placeholder="Diagnostic Medicine"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">ROOM NUMBER</label>
                  <input
                    type="text"
                    value={docRoom}
                    onChange={(e) => setDocRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    placeholder="101"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">DEPARTMENT</label>
                  <select
                    value={docDept}
                    onChange={(e) => setDocDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-hospital-500 uppercase">Authentication Credentials</span>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">USERNAME</label>
                  <input
                    type="text"
                    value={docUsername}
                    onChange={(e) => setDocUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    placeholder="drhouse"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">PASSWORD</label>
                  <input
                    type="password"
                    value={docPassword}
                    onChange={(e) => setDocPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full mt-2 bg-hospital-500 text-white font-semibold py-2.5 rounded-xl hover:bg-hospital-600 shadow transition-colors text-xs flex items-center justify-center space-x-2"
              >
                {formLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Create Doctor Profile</span>
                    <PlusCircle className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Side: Directory & Manual Exports */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Manual Report Dispatcher */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
                <FileText className="h-5 w-5 text-hospital-500" />
                <span>Operations Reporting Dispatch</span>
              </h2>

              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-grow">
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">START DATE</label>
                  <input
                    type="date"
                    value={reportStart}
                    onChange={(e) => setReportStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                </div>
                <div className="flex-grow">
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">END DATE</label>
                  <input
                    type="date"
                    value={reportEnd}
                    onChange={(e) => setReportEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Medical Staff Directory */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
                <Users className="h-5 w-5 text-hospital-500" />
                <span>Medical Staff Directory</span>
              </h2>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Specialization</th>
                      <th className="py-2.5 px-3 text-center">Room</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorsList.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{doc.name}</td>
                        <td className="py-3 px-3 text-slate-500">{doc.specialization}</td>
                        <td className="py-3 px-3 text-center font-bold">{doc.room_number}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            doc.is_available 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-550'
                          }`}>
                            {doc.is_available ? 'Available' : 'Busy/Away'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default AdminDashboard;
