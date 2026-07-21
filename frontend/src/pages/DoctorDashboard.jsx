import React, { useState, useEffect } from 'react';
import {
  User,
  CheckCircle,
  SkipForward,
  Play,
  AlertCircle,
  Activity,
  ClipboardList,
  ToggleLeft,
  ToggleRight,
  Clock,
  TrendingUp,
  Calendar,
  CalendarDays,
  RefreshCw,
  RefreshCcw,
  BarChart2,
  ShieldAlert,
  Sparkles,
  AlertOctagon,
  HeartPulse,
  Percent,
  Bell,
  FileText,
  Plus,
  Search,
  Stethoscope,
  Check,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Users
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
import PatientInformationPanel from '../components/PatientInformationPanel';
import LaboratoryOrdersModule from '../components/LaboratoryOrdersModule';
import AIClinicalRecommendationPanel from '../components/AIClinicalRecommendationPanel';
import ConsultationDisposition from '../components/ConsultationDisposition';
import ClinicalReportModal from '../components/ClinicalReportModal';

function DoctorDashboard() {
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);

  // Report Modal States
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalData, setReportModalData] = useState({
    consultationId: null,
    patientData: {},
    doctorData: {},
    clinicalData: {}
  });

  // Consultation form states
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [duration, setDuration] = useState(15);
  const [labRequests, setLabRequests] = useState([]);

  // Disposition Outcome States
  const [consultationOutcome, setConsultationOutcome] = useState('Discharge');
  const [dispositionData, setDispositionData] = useState({
    discharge_summary: '',
    patient_instructions: '',
    medical_certificate: false,
    next_review_required: false,
    followup_date: '',
    followup_time: '10:00',
    followup_reason: '',
    followup_priority: 'Routine',
    admission_reason: '',
    ward: 'General Ward',
    expected_stay: '',
    bed_number: '',
    referral_department: '',
    referral_doctor: '',
    referral_reason: '',
    referral_notes: ''
  });

  const handleAddLabTestFromPanel = (testObj) => {
    if (!testObj || !testObj.test_name) return;
    setLabRequests((prev) => {
      if (prev.some(r => r.test_name.toLowerCase() === testObj.test_name.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          test_name: testObj.test_name,
          reason: testObj.reason || '',
          priority: testObj.priority || 'Routine'
        }
      ];
    });
  };

  const handleAcceptMedicineFromPanel = (medObj) => {
    if (!medObj || !medObj.name) return;
    const medLine = `${medObj.name}, ${medObj.dosage || 'As directed'}, ${medObj.frequency || 'Daily'}, ${medObj.duration || '7 days'}, ${medObj.description || ''}`;
    setPrescription((prev) => (prev ? `${prev}\n${medLine}` : medLine));
  };

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
      if (docStats?.current_patient) {
        setSymptoms(docStats.current_patient.symptoms || '');
        try {
          const history = await patientService.getConsultations(docStats.current_patient.patient_id);
          setPatientHistory(history || []);
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
          if (newStats?.current_patient) {
            if (!symptoms) {
              setSymptoms(newStats.current_patient.symptoms || '');
            }
            patientService.getConsultations(newStats.current_patient.patient_id)
              .then(res => setPatientHistory(res || []))
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
      setSuccess(`Status updated to ${nextStatus ? 'Available' : 'Away'}`);
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

  const resetForm = () => {
    setDiagnosis('');
    setPrescription('');
    setSymptoms('');
    setLabRequests([]);
    setConsultationOutcome('Discharge');
    setDispositionData({
      discharge_summary: '',
      patient_instructions: '',
      medical_certificate: false,
      next_review_required: false,
      followup_date: '',
      followup_time: '10:00',
      followup_reason: '',
      followup_priority: 'Routine',
      admission_reason: '',
      ward: 'General Ward',
      expected_stay: '',
      bed_number: '',
      referral_department: '',
      referral_doctor: '',
      referral_reason: '',
      referral_notes: ''
    });
  };

  const handleComplete = async (e) => {
    e.preventDefault();

    if (!stats?.current_patient?.queue_id) {
      setError('No active patient session found in queue.');
      return;
    }
    if (!diagnosis || !diagnosis.trim()) {
      setError('Please enter a Diagnosis before completing the consultation.');
      return;
    }
    if (!prescription || !prescription.trim()) {
      setError('Please enter a Prescription before completing the consultation.');
      return;
    }
    if (!consultationOutcome) {
      setError('Please select a Consultation Outcome before completing.');
      return;
    }

    setError('');
    setActionLoading(true);
    try {
      const dispositionPayload = {
        consultation_outcome: consultationOutcome,
        ...dispositionData
      };

      const currentPatientObj = stats.current_patient;
      const response = await queueService.complete(
        stats.current_patient.queue_id,
        symptoms,
        diagnosis,
        prescription,
        parseInt(duration),
        labRequests,
        dispositionPayload
      );

      const consId = response?.id || (Date.now() % 10000);

      // Open Clinical Report Modal immediately
      setReportModalData({
        consultationId: consId,
        patientData: currentPatientObj || {},
        doctorData: doctor || {},
        clinicalData: {
          diagnosis,
          prescription,
          consultation_outcome: consultationOutcome,
          lab_requests: labRequests
        }
      });
      setReportModalOpen(true);

      const labMsg = labRequests.length > 0 
        ? ` with ${labRequests.length} laboratory order(s) submitted.` 
        : '.';
      setSuccess(`Consultation completed successfully (${consultationOutcome})${labMsg}`);
      resetForm();
      setTimeout(() => setSuccess(''), 4000);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Error completing consultation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!stats?.current_patient?.queue_id) return;
    setError('');
    setActionLoading(true);
    try {
      await queueService.skip(stats.current_patient.queue_id);
      setSuccess('Patient marked as skipped.');
      setDiagnosis('');
      setPrescription('');
      setSymptoms('');
      setLabRequests([]);
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
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-pulse">
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  const waitingCount = stats?.upcoming_patients?.length ?? 0;
  const completedTodayCount = stats?.completed_today ?? 0;
  const pendingReportsCount = (stats?.upcoming_patients || []).filter(p => p.priority_level === 1).length;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* 1. MODERN ACURAQUEUE HERO SECTION & PROFILE SUMMARY */}
      <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-indigo-600 to-slate-900 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-hospital-500/10 overflow-hidden border border-hospital-400/20 dark:border-slate-800">
        <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-hospital-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 left-1/3 h-48 w-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">

          {/* Doctor Profile Info */}
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md border border-white/30 flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                AcuraQueue Clinical OPD Hub
              </span>
              <span className="text-xs text-hospital-100 dark:text-slate-300 font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {currentDateFormatted}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Welcome, Dr. {doctor?.name?.replace(/^dr\.?/i, '') || 'Physician'}! 👋
            </h1>

            <p className="text-xs sm:text-sm text-hospital-100 dark:text-slate-300 leading-relaxed font-normal">
              Specialization: <strong className="text-white font-bold">{doctor?.specialization || 'Physician'}</strong> • Consultation Room: <strong className="text-white font-bold">Room {doctor?.room_number || '101'}</strong> • Department: <strong className="text-white font-bold">{doctor?.department?.name || 'General Medicine'}</strong>
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleCallNext}
                disabled={actionLoading}
                className="bg-white text-hospital-700 hover:bg-hospital-50 font-extrabold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all flex items-center space-x-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-hospital-700" />
                )}
                <span>Call Next Patient</span>
              </button>

              <button
                onClick={handleToggleAvailability}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 backdrop-blur-md border ${doctor?.is_available
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                  }`}
              >
                {doctor?.is_available ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span>Duty Status: Active On OPD</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span>Duty Status: Away</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Navigation SubTab Selector */}
          <div className="shrink-0 flex items-center bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('worklist')}
              className={`flex-1 lg:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap ${activeTab === 'worklist'
                  ? 'bg-white text-hospital-700 shadow-md'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>OPD Worklist</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 lg:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap ${activeTab === 'analytics'
                  ? 'bg-white text-hospital-700 shadow-md'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Workload Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('ai_predictions')}
              className={`flex-1 lg:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap ${activeTab === 'ai_predictions'
                  ? 'bg-white text-hospital-700 shadow-md'
                  : 'text-white hover:bg-white/10'
                }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>AI Triage Analytics</span>
            </button>
          </div>

        </div>
      </div>

      {/* Global Alert Messages */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg text-rose-500">
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-500">
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. REQUIRED KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* KPI 1: Today's Appointments */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today's Appointments</span>
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {stats?.total_today ?? (completedTodayCount + waitingCount)}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total scheduled patient visits</p>
          </div>
        </div>

        {/* KPI 2: Patients Waiting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patients Waiting</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{waitingCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">In OPD live queue line</p>
          </div>
        </div>

        {/* KPI 3: Completed Consultations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed Consultations</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{completedTodayCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Finished clinical sessions</p>
          </div>
        </div>

        {/* KPI 4: Pending Reports / Triage */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-3 group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Priority / Reports</span>
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">{pendingReportsCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">High priority patients waiting</p>
          </div>
        </div>

      </div>

      {/* DISPOSITION ANALYTICS METRICS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">Discharged Today</span>
            <h4 className="text-lg font-black text-emerald-700 dark:text-emerald-400">{stats?.discharged_today ?? 0}</h4>
          </div>
          <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>

        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">Follow-ups Scheduled</span>
            <h4 className="text-lg font-black text-blue-700 dark:text-blue-400">{stats?.followups_today ?? 0}</h4>
          </div>
          <div className="p-2 bg-blue-500 text-white rounded-xl shadow-xs">
            <Calendar className="h-4 w-4" />
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">Admissions</span>
            <h4 className="text-lg font-black text-amber-700 dark:text-amber-400">{stats?.admissions_today ?? 0}</h4>
          </div>
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
            <Activity className="h-4 w-4" />
          </div>
        </div>

        <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-800 dark:text-purple-300 block">Referrals</span>
            <h4 className="text-lg font-black text-purple-700 dark:text-purple-400">{stats?.referrals_today ?? 0}</h4>
          </div>
          <div className="p-2 bg-purple-500 text-white rounded-xl shadow-xs">
            <Users className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ========================================================
          3. TAB 1: WORKLIST / LIVE CONSULTATION WORKSPACE
          ======================================================== */}
      {activeTab === 'worklist' && (
        stats?.current_patient ? (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Comprehensive Patient Information Panel */}
            <PatientInformationPanel patientId={stats.current_patient.patient_id} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Left Side: Active Consultation Form & Live Queue Overview */}
            <div className="space-y-6">

              {/* Consultation Details Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-black text-hospital-500 uppercase tracking-widest block">Active Consultation Session</span>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{stats.current_patient.name}</h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Age: {stats.current_patient.age} • Gender: {stats.current_patient.gender}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-hospital-500 tracking-tight block">{stats.current_patient.token_number}</span>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Priority Level {stats.current_patient.priority_level}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleComplete} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Symptoms Recorded & Clinical Notes</label>
                    <textarea
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500 resize-none transition-all"
                      placeholder="Enter patient symptoms, vitals, and physical examination findings..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Diagnosis</label>
                    <textarea
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500 resize-none transition-all"
                      placeholder="Describe primary and secondary diagnosis..."
                    />
                  </div>

                  {/* AI CLINICAL RECOMMENDATION PANEL (Below Diagnosis/AI Prediction, Above Lab Orders) */}
                  <AIClinicalRecommendationPanel
                    diseaseName={diagnosis || stats?.current_patient?.predicted_disease || ''}
                    confidence="88%"
                    onAddLabTest={handleAddLabTestFromPanel}
                    onAcceptMedicine={handleAcceptMedicineFromPanel}
                  />

                  {/* LABORATORY INVESTIGATIONS & ORDERS MODULE */}
                  <LaboratoryOrdersModule
                    labRequests={labRequests}
                    onChange={setLabRequests}
                  />

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Prescription (Rx)</label>
                    <input
                      type="text"
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500 transition-all"
                      placeholder="e.g. Paracetamol 500mg, 1 tablet twice daily, 5 days"
                    />
                  </div>

                  {/* CONSULTATION DISPOSITION / OUTCOME MODULE */}
                  <ConsultationDisposition
                    outcome={consultationOutcome}
                    onChangeOutcome={setConsultationOutcome}
                    dispositionData={dispositionData}
                    onChangeData={setDispositionData}
                  />

                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
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
                      className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 text-xs hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Complete Consultation</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={actionLoading}
                      className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-2xl transition-all flex items-center justify-center space-x-2 text-xs hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <SkipForward className="h-4 w-4" />
                      <span>Skip Patient</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* LIVE QUEUE OVERVIEW */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-hospital-500" />
                    <span>Live Queue Overview & Upcoming Patients</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400">{waitingCount} Waiting</span>
                </div>

                {stats?.upcoming_patients && stats.upcoming_patients.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
                    {stats.upcoming_patients.map((item) => {
                      const isCritical = item.priority_level === 1;
                      const isUrgent = item.priority_level === 2;
                      let badge = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                      if (isCritical) {
                        badge = "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900/40";
                      } else if (isUrgent) {
                        badge = "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40";
                      }

                      return (
                        <div
                          key={item.queue_id}
                          className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 hover:border-hospital-200 dark:hover:border-hospital-800 transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">#{item.position}</span>
                            <div>
                              <span className="text-xs font-black text-hospital-500 block">{item.token_number}</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white block truncate max-w-[130px]">{item.name}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] block mb-1 font-extrabold uppercase ${badge}`}>
                              {isCritical ? 'Critical' : isUrgent ? 'Urgent' : 'Normal'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">{(item?.estimated_wait_time ?? 0).toFixed(0)} min est. wait</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No pending patients currently waiting in your OPD line.
                  </div>
                )}
              </div>

            </div>

            {/* Right Side: ClinicalWorkspace & ClinicalAIPanel */}
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
        </div>
        ) : (
          /* IDLE OPD VIEW */
          <div className="space-y-6 animate-fadeIn">
            {/* Empty Patient Information Panel */}
            <PatientInformationPanel patientId={null} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Side: Call Next Patient Box */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-sm">
                <div className="inline-flex bg-hospital-50 dark:bg-hospital-950 p-5 rounded-full text-hospital-500 shadow-inner">
                  <Activity className="h-12 w-12" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">No Active Patient Session</h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Call the next waiting patient from your department's queue line to initialize the clinical consultation workspace.
                  </p>
                </div>

                <button
                  onClick={handleCallNext}
                  disabled={actionLoading}
                  className="px-8 py-3.5 bg-hospital-500 hover:bg-hospital-600 text-white font-extrabold rounded-2xl shadow-lg shadow-hospital-500/25 transition-all inline-flex items-center space-x-2 text-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Call Next Waiting Patient</span>
                      <Play className="h-4 w-4 fill-white" />
                    </>
                  )}
                </button>
              </div>

              {/* QUICK ACTIONS PANEL */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                  Clinical Quick Actions
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleCallNext}
                    disabled={actionLoading}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-hospital-500 text-left transition-all group"
                  >
                    <Play className="h-5 w-5 text-hospital-500 mb-2 group-hover:scale-110 transition-transform" />
                    <strong className="text-xs font-extrabold text-slate-800 dark:text-white block">Call Next Token</strong>
                    <span className="text-[10px] text-slate-400">Advance OPD queue</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-indigo-500 text-left transition-all group"
                  >
                    <TrendingUp className="h-5 w-5 text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
                    <strong className="text-xs font-extrabold text-slate-800 dark:text-white block">View Analytics</strong>
                    <span className="text-[10px] text-slate-400">Workload & metrics</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ai_predictions')}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-purple-500 text-left transition-all group"
                  >
                    <Sparkles className="h-5 w-5 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
                    <strong className="text-xs font-extrabold text-slate-800 dark:text-white block">AI Triage Hub</strong>
                    <span className="text-[10px] text-slate-400">Pathology insights</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Right Side: Waiting Queue & Notifications */}
            <div className="space-y-6">

              {/* LIVE QUEUE OVERVIEW */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-hospital-500" />
                    <span>Live Waiting Queue</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400">{waitingCount} Patients</span>
                </div>

                {stats?.upcoming_patients && stats.upcoming_patients.length > 0 ? (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-none">
                    {stats.upcoming_patients.map((item) => {
                      const isCritical = item.priority_level === 1;
                      const isUrgent = item.priority_level === 2;
                      let badge = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                      if (isCritical) {
                        badge = "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900/40";
                      } else if (isUrgent) {
                        badge = "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40";
                      }

                      return (
                        <div
                          key={item.queue_id}
                          className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 hover:border-hospital-200 dark:hover:border-hospital-800 transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">#{item.position}</span>
                            <div>
                              <span className="text-xs font-black text-hospital-500 block">{item.token_number}</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white block truncate max-w-[120px]">{item.name}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] block mb-1 font-extrabold uppercase ${badge}`}>
                              {isCritical ? 'Critical' : isUrgent ? 'Urgent' : 'Normal'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">{(item?.estimated_wait_time ?? 0).toFixed(0)} min wait</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No pending patients waiting in queue line.
                  </div>
                )}
              </div>

              {/* NOTIFICATIONS PANEL */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-hospital-500" />
                    <span>Clinical Alerts & Updates</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">Live Feed</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-hospital-50/60 dark:bg-hospital-950/20 border border-hospital-100 dark:border-hospital-900/30 flex items-start space-x-2.5">
                    <Activity className="h-4 w-4 text-hospital-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-extrabold text-slate-800 dark:text-white block">Queue Sync Active</strong>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">Real-time WebSocket synchronization connected.</span>
                    </div>
                  </div>

                  {pendingReportsCount > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex items-start space-x-2.5">
                      <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-extrabold text-rose-700 dark:text-rose-300 block">Critical Triage Alert</strong>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px]">{pendingReportsCount} high-priority patient(s) waiting for immediate care.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
        )
      )}

      {/* ========================================================
          4. TAB 2: WORKLOAD & PERFORMANCE ANALYTICS
          ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">

          {/* Filters Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <CalendarDays className="h-4 w-4 text-hospital-500" />
                <span>Filter Workload:</span>
              </span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500"
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
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded-xl text-slate-800 dark:text-white font-bold"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded-xl text-slate-800 dark:text-white font-bold"
                  />
                </div>
              )}
            </div>

            <button
              onClick={loadDoctorAnalytics}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300 rounded-2xl flex items-center space-x-1.5 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Stats</span>
            </button>
          </div>

          {/* Doctor Specific KPI Cards */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm h-28 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Today's Patients</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{docKpis?.todays_patients ?? 0}</span>
                </div>
                <div className="bg-blue-50 text-blue-600 dark:bg-blue-950/60 p-3 rounded-2xl"><User className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Today's Consults</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{docKpis?.todays_consultations ?? 0}</span>
                </div>
                <div className="bg-teal-50 text-teal-600 dark:bg-teal-950/60 p-3 rounded-2xl"><CheckCircle className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Active Queue</span>
                  <span className="text-2xl font-black text-amber-500 mt-1 block">{docKpis?.pending_consultations ?? 0}</span>
                </div>
                <div className="bg-amber-50 text-amber-600 dark:bg-amber-950/60 p-3 rounded-2xl"><Clock className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Reviewed Predictions</span>
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">{docKpis?.ai_predictions_reviewed ?? 0}</span>
                </div>
                <div className="bg-purple-50 text-purple-600 dark:bg-purple-950/60 p-3 rounded-2xl"><Activity className="h-5 w-5" /></div>
              </div>

            </div>
          )}

          {/* Performance insights & Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Performance Insights */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <TrendingUp className="h-4.5 w-4.5 text-hospital-500" />
                <span>My Performance Metrics</span>
              </h3>

              {analyticsLoading ? (
                <div className="space-y-4 animate-pulse flex-grow justify-center flex flex-col">
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
                </div>
              ) : (
                <div className="space-y-3 flex-grow flex flex-col justify-center text-xs">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Patients Seen Today</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{docInsights?.patients_seen_today ?? 0}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Seen This Week</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{docInsights?.patients_seen_this_week ?? 0}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Avg Consult Duration</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{docInsights?.average_consultation_duration_minutes ?? 0} min</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Avg Wait Time</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">{docInsights?.average_waiting_time_minutes ?? 0} min</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Completion Triage Rate</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                      <span>{docInsights?.consultation_completion_rate_percentage ?? 0}%</span>
                      <Percent className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Demographics & Risk Doughnut */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Clinical Demographics</h3>
              <div className="h-56">
                <AgeDistributionChart data={docCharts?.patient_age_distribution ?? []} isDarkMode={isDarkMode} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Prediction Risk Load</h3>
              <div className="h-56 flex items-center justify-center">
                <RiskDistributionChart data={docCharts?.prediction_risk_distribution ?? []} isDarkMode={isDarkMode} />
              </div>
            </div>

            {/* Consultation Trend Charts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Daily Consultation Trend</h3>
              <div className="h-60">
                <DailyConsultationTrendChart data={docCharts?.daily_consultation_trend ?? []} isDarkMode={isDarkMode} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Weekly Activity Triage</h3>
              <div className="h-60">
                <WeeklyConsultationTrendChart data={docCharts?.weekly_consultation_trend ?? []} isDarkMode={isDarkMode} />
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          5. TAB 3: GLOBAL AI PREDICTIONS
          ======================================================== */}
      {activeTab === 'ai_predictions' && (
        <div className="space-y-6">

          {/* Controls Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="h-4 w-4 text-cyan-500 animate-pulse" />
                <span>AI Prediction Range:</span>
              </span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500"
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
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded-xl text-slate-800 dark:text-white font-bold"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs rounded-xl text-slate-800 dark:text-white font-bold"
                  />
                </div>
              )}
            </div>

            <button
              onClick={loadPredictionAnalytics}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-300 rounded-2xl flex items-center space-x-1.5 transition-all"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span>Refresh Predictions</span>
            </button>
          </div>

          {/* AI Prediction Cards */}
          {predictionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-28 rounded-3xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Predictions Logs</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{predictionAnalytics?.total_predictions ?? 0}</span>
                </div>
                <div className="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 p-3 rounded-2xl"><Activity className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Predictions Logged Today</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{predictionAnalytics?.predictions_today ?? 0}</span>
                </div>
                <div className="bg-blue-50 text-blue-600 dark:bg-blue-950/60 p-3 rounded-2xl"><Sparkles className="h-5 w-5" /></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Average ML Model Match</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {((predictionAnalytics?.average_confidence ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 p-3 rounded-2xl"><CheckCircle className="h-5 w-5" /></div>
              </div>

            </div>
          )}

          {/* Predictions Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Top Predicted Pathology Profiles</h3>
              <div className="h-64">
                <CommonPredictedDiseasesChart
                  data={predictionAnalytics?.top_predicted_diseases ?? []}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Triage Risk Distribution</h3>
              <div className="h-56 flex items-center justify-center">
                <RiskDistributionChart
                  data={
                    predictionAnalytics?.risk_distribution
                      ? (Array.isArray(predictionAnalytics.risk_distribution)
                          ? predictionAnalytics.risk_distribution
                          : Object.entries(predictionAnalytics.risk_distribution).map(([risk_level, count]) => ({ risk_level, count })))
                      : []
                  }
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>

            {/* Confidence distribution progress bars */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm lg:col-span-2">
              <h3 className="text-xs font-bold mb-4 text-slate-400 uppercase tracking-wider">Model Prediction Confidence Triage</h3>

              <div className="space-y-4 py-2">
                {predictionAnalytics?.confidence_distribution ? (
                  Object.entries(predictionAnalytics.confidence_distribution).map(([bucket, count]) => {
                    const dist = predictionAnalytics.confidence_distribution || {};
                    const total = Object.values(dist).reduce((a, b) => (a || 0) + (b || 0), 0) || 1;
                    const percent = (((count || 0) / total) * 100).toFixed(0);
                    return (
                      <div key={bucket} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500 dark:text-slate-400">Confidence {bucket}</span>
                          <span className="text-slate-700 dark:text-slate-200">{count ?? 0} reports ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className="bg-hospital-500 h-full rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400">No confidence distribution available.</div>
                )}
              </div>
            </div>

            {/* Disease Frequency breakdown list */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col max-h-[300px]">
              <h3 className="text-xs font-bold mb-3 text-slate-400 uppercase tracking-wider">Clinical Frequency Table</h3>

              <div className="overflow-y-auto space-y-2 flex-grow pr-1">
                {predictionAnalytics?.disease_frequency ? (
                  Object.entries(predictionAnalytics.disease_frequency)
                    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                    .map(([disease, count]) => (
                      <div key={disease} className="p-2 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{disease}</span>
                        <span className="font-bold text-hospital-500 px-2 py-0.5 bg-hospital-50 dark:bg-hospital-950/40 rounded-lg">
                          {count ?? 0} logs
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-slate-400">No disease frequency logs.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUCCESS CLINICAL REPORT GENERATION MODAL */}
      <ClinicalReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        consultationId={reportModalData.consultationId}
        patientData={reportModalData.patientData}
        doctorData={reportModalData.doctorData}
        clinicalData={reportModalData.clinicalData}
      />

    </div>
  );
}

export default DoctorDashboard;
