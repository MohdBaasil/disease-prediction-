import React, { useState, useEffect } from 'react';
import { 
  User, CheckCircle, SkipForward, Play, AlertCircle, 
  Activity, ClipboardList, ToggleLeft, ToggleRight, Clock,
  TrendingUp, Calendar, CalendarDays, RefreshCw, BarChart2, ShieldAlert, Sparkles, AlertOctagon, HeartPulse, Percent
} from 'lucide-react';
import { 
  doctorService, dashboardService, queueService, createQueueWebSocket, patientService, analyticsService 
} from '../services/api';
import {
  DailyConsultationTrendChart,
  WeeklyConsultationTrendChart,
  CommonPredictedDiseasesChart,
  AgeDistributionChart,
  RiskDistributionChart
} from './AnalyticsCharts';
import ClinicalWorkspace from './ClinicalWorkspace';
import ClinicalAIPanel from './ClinicalAIPanel';

function DoctorDashboard() {
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  
  // Consultation form states
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [duration, setDuration] = useState(15);

  // Tab and Analytics state
  const [activeTab, setActiveTab] = useState('worklist'); // 'worklist', 'analytics', 'ai_predictions'
  const [dateFilter, setDateFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Doctor Analytics States
  const [docKpis, setDocKpis] = useState(null);
  const [docCharts, setDocCharts] = useState(null);
  const [docInsights, setDocInsights] = useState(null);

  // AI Prediction Analytics States
  const [predictionAnalytics, setPredictionAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setError('');
      // 1. Get current doctor profile
      const docProfile = await doctorService.getMe();
      setDoctor(docProfile);

      // 2. Get dashboard stats for this doctor
      const docStats = await dashboardService.getDoctorStats(docProfile.id);
      setStats(docStats);
      
      // Auto fill symptoms if current patient exists
      if (docStats.current_patient) {
        setSymptoms(docStats.current_patient.symptoms || '');
        try {
          const history = await patientService.getConsultations(docStats.current_patient.patient_id);
          setPatientHistory(history);
        } catch (err) {
          console.error("Error loading patient history:", err);
          setPatientHistory([]);
        }
      } else {
        setSymptoms('');
        setDiagnosis('');
        setPrescription('');
        setPatientHistory([]);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load doctor dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorAnalytics = async () => {
    if (!doctor) return;
    setAnalyticsLoading(true);
    try {
      const params = {
        filter_type: dateFilter,
        start: dateFilter === 'custom' ? customStart : undefined,
        end: dateFilter === 'custom' ? customEnd : undefined
      };
      
      const [kpisRes, chartsRes, insightsRes] = await Promise.all([
        analyticsService.getDoctorAnalytics(doctor.id, params),
        analyticsService.getDoctorCharts(doctor.id, params),
        analyticsService.getDoctorInsights(doctor.id, params)
      ]);
      
      setDocKpis(kpisRes);
      setDocCharts(chartsRes);
      setDocInsights(insightsRes);
    } catch (err) {
      console.error("Error loading doctor analytics:", err);
      setError("Failed to retrieve workload performance insights.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadPredictionAnalytics = async () => {
    setPredictionsLoading(true);
    try {
      const params = {
        filter_type: dateFilter,
        start: dateFilter === 'custom' ? customStart : undefined,
        end: dateFilter === 'custom' ? customEnd : undefined
      };
      const res = await analyticsService.getPredictionAnalytics(params);
      setPredictionAnalytics(res);
    } catch (err) {
      console.error("Error loading predictions analytics:", err);
      setError("Failed to load global AI prediction analysis.");
    } finally {
      setPredictionsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // WebSockets listener to sync live queue
  useEffect(() => {
    if (!doctor?.id) return;
    const ws = createQueueWebSocket((msg) => {
      if (msg.event === 'queue_update') {
        console.log('Doctor live sync triggered');
        dashboardService.getDoctorStats(doctor.id).then((newStats) => {
          setStats(newStats);
          if (newStats.current_patient) {
            if (!symptoms) {
              setSymptoms(newStats.current_patient.symptoms || '');
            }
            patientService.getConsultations(newStats.current_patient.patient_id)
              .then(setPatientHistory)
              .catch(console.error);
          } else {
            setPatientHistory([]);
          }
        }).catch(console.error);
      }
    });
    return () => ws.close();
  }, [doctor?.id]);

  // Load appropriate analytics tab data
  useEffect(() => {
    if (!loading && doctor) {
      if (activeTab === 'analytics') {
        loadDoctorAnalytics();
      } else if (activeTab === 'ai_predictions') {
        loadPredictionAnalytics();
      }
    }
  }, [activeTab, doctor, dateFilter, customStart, customEnd]);

  const handleToggleAvailability = async () => {
    if (!doctor) return;
    try {
      const nextStatus = !doctor.is_available;
      const updated = await doctorService.updateAvailability(doctor.id, nextStatus);
      setDoctor(updated);
      setSuccess(`Status updated to ${nextStatus ? 'Available' : 'Unavailable'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      setError('Failed to update availability.');
    }
  };

  const handleCallNext = async () => {
    setError('');
    setActionLoading(true);
    try {
      const entry = await queueService.callNext(doctor.id);
      if (entry) {
        setSuccess(`Called Patient Token: ${entry.token_number}`);
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError('No active patients in the queue for your department.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error calling next patient.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!diagnosis || !prescription) {
      setError('Please enter Diagnosis and Prescription before completing.');
      return;
    }

    setError('');
    setActionLoading(true);
    try {
      await queueService.complete(
        stats.current_patient.queue_id,
        symptoms,
        diagnosis,
        prescription,
        parseInt(duration)
      );
      setSuccess('Consultation completed successfully.');
      setDiagnosis('');
      setPrescription('');
      setSymptoms('');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Error completing consultation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!stats.current_patient) return;
    setError('');
    setActionLoading(true);
    try {
      await queueService.skip(stats.current_patient.queue_id);
      setSuccess('Patient marked as skipped.');
      setDiagnosis('');
      setPrescription('');
      setSymptoms('');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Error skipping patient.');
    } finally {
      setActionLoading(false);
    }
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Orchestrating clinical workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Doctor Header Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4">
          <div className="p-3 bg-hospital-50 text-hospital-500 dark:bg-hospital-950/60 rounded-2xl">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">{doctor?.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {doctor?.specialization} | Room: <strong>{doctor?.room_number}</strong> | Dept: {doctor?.department?.name || 'General Medicine'}
            </p>
          </div>
        </div>

        {/* Tab Selector controls */}
        <div className="flex p-1 bg-slate-150/60 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-inner shrink-0">
          <button
            onClick={() => setActiveTab('worklist')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'worklist' 
                ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm' 
                : 'text-slate-550 hover:text-slate-850 dark:hover:text-slate-350'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Consultations</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'analytics' 
                ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm' 
                : 'text-slate-550 hover:text-slate-850 dark:hover:text-slate-350'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('ai_predictions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'ai_predictions' 
                ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm' 
                : 'text-slate-550 hover:text-slate-850 dark:hover:text-slate-350'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Analysis</span>
          </button>
        </div>

        {/* Duty Switcher */}
        <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-6">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Duty Status</span>
            <button
              onClick={handleToggleAvailability}
              className="flex items-center space-x-2 text-xs mt-1 font-bold focus:outline-none"
            >
              {doctor?.is_available ? (
                <>
                  <span className="text-emerald-500">Active</span>
                  <ToggleRight className="h-6 w-6 text-emerald-500 cursor-pointer" />
                </>
              ) : (
                <>
                  <span className="text-slate-400">Away</span>
                  <ToggleLeft className="h-6 w-6 text-slate-400 cursor-pointer" />
                </>
              )}
            </button>
          </div>

          <div className="text-center shrink-0">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Today's Total</span>
            <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block">{stats?.completed_today}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
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
          1. ACTIVE CONSULTATIONS TAB
          ======================================================== */}
      {activeTab === 'worklist' && (
        stats?.current_patient ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fadeIn">
            
            {/* Left Side: Active Consultation Form and Upcoming Queue */}
            <div className="space-y-6">
              
              {/* Consultation details form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800/80 pb-4 mb-6">
                  <div>
                    <span className="text-[10px] font-bold text-hospital-500 uppercase tracking-widest">Active Consultation Session</span>
                    <h2 className="text-lg font-black mt-0.5">{stats.current_patient.name}</h2>
                    <span className="text-xs text-slate-500 font-semibold mt-0.5 block">
                      Age: {stats.current_patient.age} | Gender: {stats.current_patient.gender}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-hospital-500 tracking-tight">{stats.current_patient.token_number}</span>
                    <span className="text-[9px] block text-slate-400 font-extrabold uppercase mt-0.5">
                      Priority Level {stats.current_patient.priority_level}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleComplete} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">SYMPTOMS RECORDED & CLINICAL NOTES</label>
                    <textarea
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm resize-none focus:outline-none focus:border-hospital-500 font-medium"
                      placeholder="Enter patient symptoms and physical exam signs..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">DIAGNOSIS</label>
                    <textarea
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm resize-none focus:outline-none focus:border-hospital-500 font-medium"
                      placeholder="Describe clinical diagnosis..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">PRESCRIPTION</label>
                    <input
                      type="text"
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-hospital-500 font-medium"
                      placeholder="e.g. Paracetamol 500mg, 1 tablet, Once daily, 5 days, After meals"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                      <span>ESTIMATED SESSION DURATION</span>
                      <span className="text-hospital-500 font-extrabold">{duration} minutes</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full accent-hospital-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl shadow transition-all flex items-center justify-center space-x-2 text-sm"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Complete Consultation</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={actionLoading}
                      className="px-6 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm"
                    >
                      <SkipForward className="h-4 w-4" />
                      <span>Skip</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Stacked upcoming queue list */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-hospital-500" />
                  <span>Upcoming Waiting Queue</span>
                </h2>

                {stats && stats.upcoming_patients && stats.upcoming_patients.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {stats.upcoming_patients.map((item) => {
                      const isCritical = item.priority_level === 1;
                      const isUrgent = item.priority_level === 2;
                      let badge = "bg-slate-100 text-slate-550 dark:bg-slate-850 dark:text-slate-450";
                      if (isCritical) {
                        badge = "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-450 font-bold";
                      } else if (isUrgent) {
                        badge = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450";
                      }
                      return (
                        <div 
                          key={item.queue_id}
                          className="p-3 border border-slate-100 dark:border-slate-850 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10 hover:border-slate-200 transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-bold text-slate-400">#{item.position}</span>
                            <div>
                              <span className="text-xs font-black text-hospital-500 block">{item.token_number}</span>
                              <span className="text-xs font-semibold block truncate max-w-[120px]">{item.name}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] block mb-1 font-bold ${badge}`}>
                              {isCritical ? 'Critical' : isUrgent ? 'Urgent' : 'Normal'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">{item.estimated_wait_time.toFixed(0)} min wait</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-450 text-xs">
                    No pending patients waiting.
                  </div>
                )}
              </div>

            </div>

            {/* Right Side: ClinicalWorkspace and ClinicalAIPanel panels */}
            <div className="h-full space-y-6">
              <ClinicalWorkspace
                patientId={stats.current_patient.patient_id}
                currentDiagnosis={diagnosis}
                currentPrescription={prescription}
                onApplyNotes={setSymptoms}
                onApplyDiagnosis={setDiagnosis}
              />
              <ClinicalAIPanel
                patientId={stats.current_patient.patient_id}
              />
            </div>

          </div>
        ) : (
          /* Idle View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            
            {/* Left Side: Fetch patient workflow */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center space-y-4">
                <div className="inline-flex bg-hospital-50 dark:bg-hospital-950 p-5 rounded-full text-hospital-500">
                  <Activity className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-bold">No active patient session</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Fetch the highest priority waiting patient from your department's queue to begin the clinical consultation.
                </p>
                <button
                  onClick={handleCallNext}
                  disabled={actionLoading}
                  className="px-8 py-3.5 bg-hospital-500 hover:bg-hospital-600 text-white font-bold rounded-2xl shadow transition-colors inline-flex items-center space-x-2"
                >
                  {actionLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Call Next Patient</span>
                      <Play className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Side: Waiting queue list */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-hospital-500" />
                  <span>Upcoming Waiting Queue</span>
                </h2>

                {stats && stats.upcoming_patients && stats.upcoming_patients.length > 0 ? (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {stats.upcoming_patients.map((item) => {
                      const isCritical = item.priority_level === 1;
                      const isUrgent = item.priority_level === 2;
                      let badge = "bg-slate-100 text-slate-555 dark:bg-slate-850 dark:text-slate-450";
                      if (isCritical) {
                        badge = "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-450 font-bold";
                      } else if (isUrgent) {
                        badge = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450";
                      }
                      return (
                        <div 
                          key={item.queue_id}
                          className="p-3 border border-slate-100 dark:border-slate-850 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/10 hover:border-slate-200 transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-bold text-slate-400">#{item.position}</span>
                            <div>
                              <span className="text-xs font-black text-hospital-500 block">{item.token_number}</span>
                              <span className="text-xs font-semibold block truncate max-w-[120px]">{item.name}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] block mb-1 font-bold ${badge}`}>
                              {isCritical ? 'Critical' : isUrgent ? 'Urgent' : 'Normal'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">{item.estimated_wait_time.toFixed(0)} min wait</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-450 text-xs">
                    No pending patients waiting.
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      )}

      {/* ========================================================
          2. WORKLOAD & PERFORMANCE ANALYTICS TAB
          ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Filters Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <CalendarDays className="h-4 w-4 text-hospital-500" />
                <span>Filter Workload:</span>
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
                    className="px-2 py-1 bg-transparent border border-slate-300 dark:border-slate-750 text-xs rounded-lg"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2 py-1 bg-transparent border border-slate-300 dark:border-slate-750 text-xs rounded-lg"
                  />
                </div>
              )}
            </div>

            <button
              onClick={loadDoctorAnalytics}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-350 rounded-xl flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Stats</span>
            </button>
          </div>

          {/* Doctor Specific KPI Cards */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm h-24 animate-pulse"></div>
              ))}
            </div>
          ) : docKpis ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Today's Patients</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{docKpis.todays_patients}</span>
                </div>
                <div className="bg-blue-50 text-blue-500 dark:bg-blue-950/40 p-3 rounded-xl"><User className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Today's Consults</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{docKpis.todays_consultations}</span>
                </div>
                <div className="bg-teal-50 text-teal-500 dark:bg-teal-950/40 p-3 rounded-xl"><CheckCircle className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">My Active Queue</span>
                  <span className="text-2xl font-black text-amber-500 mt-1 block">{docKpis.pending_consultations}</span>
                </div>
                <div className="bg-amber-50 text-amber-500 dark:bg-amber-950/40 p-3 rounded-xl"><Clock className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Reviewed Predictions</span>
                  <span className="text-2xl font-black text-purple-500 mt-1 block">{docKpis.ai_predictions_reviewed}</span>
                </div>
                <div className="bg-purple-50 text-purple-500 dark:bg-purple-950/40 p-3 rounded-xl"><Activity className="h-5 w-5" /></div>
              </div>

            </div>
          ) : null}

          {/* Doctor Performance insights & Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Performance Insights Deck */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <TrendingUp className="h-4.5 w-4.5 text-hospital-500" />
                <span>My Performance Metrics</span>
              </h3>

              {analyticsLoading ? (
                <div className="space-y-4 animate-pulse flex-grow justify-center flex flex-col">
                  <div className="h-10 bg-slate-100 dark:bg-slate-850 rounded-xl"></div>
                  <div className="h-10 bg-slate-100 dark:bg-slate-850 rounded-xl"></div>
                </div>
              ) : docInsights ? (
                <div className="space-y-3.5 flex-grow flex flex-col justify-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Patients Seen Today</span>
                    <span className="text-sm font-black">{docInsights.patients_seen_today}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Seen This Week</span>
                    <span className="text-sm font-black">{docInsights.patients_seen_this_week}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Avg Consult Duration</span>
                    <span className="text-sm font-black">{docInsights.average_consultation_duration_minutes} min</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Avg Wait Time</span>
                    <span className="text-sm font-black">{docInsights.average_waiting_time_minutes} min</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold">Completion Triage Rate</span>
                    <span className="text-sm font-black text-emerald-500 flex items-center">
                      <span>{docInsights.consultation_completion_rate_percentage}%</span>
                      <Percent className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Department stats and Age groups */}
            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clinical Demographics</h3>
                <div className="h-56">
                  <AgeDistributionChart data={docCharts.patient_age_distribution} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {/* Doughnut: Risk distribution of predictions */}
            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prediction Risk Load</h3>
                <div className="h-56 flex items-center justify-center">
                  <RiskDistributionChart data={docCharts.prediction_risk_distribution} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {/* Line: Daily Consultation Trend */}
            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daily Consultation Trend</h3>
                <div className="h-60">
                  <DailyConsultationTrendChart data={docCharts.daily_consultation_trend} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {/* Bar: Weekly Consultation Trend */}
            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Weekly Activity Triage</h3>
                <div className="h-60">
                  <WeeklyConsultationTrendChart data={docCharts.weekly_consultation_trend} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {/* Top Diseases & Department Statistics */}
            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Common Clinical Pathologies</h3>
                <div className="h-56">
                  <CommonPredictedDiseasesChart data={docCharts.most_common_diseases} isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {docCharts && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department Workload Profile</h3>
                
                <div className="space-y-4 py-2 flex-grow flex flex-col justify-center">
                  <div className="p-4 bg-slate-550/5 dark:bg-slate-950 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Department Patient Load</span>
                    <span className="text-2xl font-black text-slate-850 dark:text-white mt-1.5 block">
                      {docCharts.department_statistics.total_department_patients}
                    </span>
                  </div>
                  
                  <div className="p-4 bg-slate-550/5 dark:bg-slate-950 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Completed Consultations</span>
                    <span className="text-2xl font-black text-hospital-500 mt-1.5 block">
                      {docCharts.department_statistics.total_department_completed_consultations}
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================
          3. GLOBAL AI PREDICTIONS TAB
          ======================================================== */}
      {activeTab === 'ai_predictions' && (
        <div className="space-y-6">
          
          {/* Controls Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-550 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="h-4 w-4 text-cyan-500 animate-pulse" />
                <span>AI Prediction Range:</span>
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
                    className="px-2 py-1 bg-transparent border border-slate-300 dark:border-slate-750 text-xs rounded-lg"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2 py-1 bg-transparent border border-slate-300 dark:border-slate-750 text-xs rounded-lg"
                  />
                </div>
              )}
            </div>

            <button
              onClick={loadPredictionAnalytics}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-350 rounded-xl flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Predictions</span>
            </button>
          </div>

          {/* AI Prediction Cards */}
          {predictionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-24 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : predictionAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Total Predictions Logs</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{predictionAnalytics.total_predictions}</span>
                </div>
                <div className="bg-cyan-50 text-cyan-500 dark:bg-cyan-950/40 p-3 rounded-xl"><Activity className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Predictions Logged Today</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{predictionAnalytics.predictions_today}</span>
                </div>
                <div className="bg-blue-50 text-blue-500 dark:bg-blue-950/40 p-3 rounded-xl"><Sparkles className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Average ML Confidence</span>
                  <span className="text-2xl font-black text-emerald-500 mt-1 block">{(predictionAnalytics.average_confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 p-3 rounded-xl"><CheckCircle className="h-5 w-5" /></div>
              </div>

            </div>
          ) : null}

          {/* Predictions Visualizations */}
          {predictionAnalytics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              
              {/* Top Predicted Diseases Bar Chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Top Predicted Pathology Profiles</h3>
                <div className="h-64">
                  <CommonPredictedDiseasesChart 
                    data={predictionAnalytics.top_predicted_diseases} 
                    isDarkMode={isDarkMode} 
                  />
                </div>
              </div>

              {/* Pie/Doughnut: Risk distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Triage Risk Distribution</h3>
                <div className="h-56 flex items-center justify-center">
                  <RiskDistributionChart 
                    data={Object.entries(predictionAnalytics.risk_distribution).map(([risk_level, count]) => ({ risk_level, count }))} 
                    isDarkMode={isDarkMode} 
                  />
                </div>
              </div>

              {/* Confidence distribution progress bars */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-xs font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model Prediction Confidence Triage</h3>
                
                <div className="space-y-4 py-2">
                  {Object.entries(predictionAnalytics.confidence_distribution).map(([bucket, count]) => {
                    const total = Object.values(predictionAnalytics.confidence_distribution).reduce((a, b) => a + b, 0) || 1;
                    const percent = ((count / total) * 100).toFixed(0);
                    return (
                      <div key={bucket} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500 dark:text-slate-400">Confidence {bucket}</span>
                          <span className="text-slate-700 dark:text-slate-200">{count} reports ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${percent}%` }}
                            className="bg-hospital-500 h-full rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Disease Frequency breakdown list */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col max-h-[300px]">
                <h3 className="text-xs font-bold mb-3 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clinical Frequency Table</h3>
                
                <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                  {Object.entries(predictionAnalytics.disease_frequency)
                    .sort((a, b) => b[1] - a[1])
                    .map(([disease, count]) => (
                      <div key={disease} className="p-2 border border-slate-100 dark:border-slate-850 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">{disease}</span>
                        <span className="font-bold text-hospital-500 px-2 py-0.5 bg-hospital-50 dark:bg-hospital-950/40 rounded-lg">
                          {count} logs
                        </span>
                      </div>
                    ))}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default DoctorDashboard;
