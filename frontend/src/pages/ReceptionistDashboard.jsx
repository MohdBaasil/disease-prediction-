import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Ticket, ClipboardList, CheckCircle2, AlertTriangle,
  UserCheck, Heart, Search, HelpCircle, PlusCircle, Calendar,
  Clock, UserPlus, CalendarPlus, Bell, RefreshCw, XCircle,
  Stethoscope, Building2, ChevronRight, Filter, AlertCircle,
  Sparkles, X, Activity, Phone, ArrowUpRight
} from 'lucide-react';
import {
  patientService, queueService, dashboardService, doctorService, appointmentsService, createQueueWebSocket
} from '../services/api';
import PatientRegistrationModal from '../components/PatientRegistrationModal';
import AppointmentBookingModal from '../components/AppointmentBookingModal';

// Module-level in-flight request trackers and cache to deduplicate React 18 StrictMode double-mounts
let dashboardInFlightPromise = null;
let lastDashboardData = null;
let lastDashboardFetchTime = 0;

const fetchDashboardStatsDeduplicated = (isForceRefresh = false) => {
  const now = Date.now();

  // 1. Share active in-flight Promise if request is currently pending
  if (dashboardInFlightPromise && !isForceRefresh) {
    return dashboardInFlightPromise;
  }

  // 2. Reuse recent data if fetched < 1.5 seconds ago (e.g. StrictMode remount)
  if (!isForceRefresh && lastDashboardData && (now - lastDashboardFetchTime < 1500)) {
    return Promise.resolve(lastDashboardData);
  }

  // 3. Initiate fresh network request
  dashboardInFlightPromise = dashboardService.getReceptionistStats()
    .then((data) => {
      lastDashboardData = data;
      lastDashboardFetchTime = Date.now();
      return data;
    })
    .finally(() => {
      dashboardInFlightPromise = null;
    });

  return dashboardInFlightPromise;
};

let deptsInFlightPromise = null;
let lastDeptsData = null;

const fetchDepartmentsDeduplicated = () => {
  if (deptsInFlightPromise) return deptsInFlightPromise;
  if (lastDeptsData) return Promise.resolve(lastDeptsData);
  deptsInFlightPromise = queueService.getDepartments()
    .then((data) => {
      lastDeptsData = data;
      return data;
    })
    .finally(() => {
      deptsInFlightPromise = null;
    });
  return deptsInFlightPromise;
};

function ReceptionistDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Dashboard Data from API with safe default structures
  const [receptionistInfo, setReceptionistInfo] = useState({
    name: 'Reception Staff',
    username: 'reception',
    role: 'Receptionist',
    current_date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  });

  const [stats, setStats] = useState({
    total_appointments_today: 0,
    walkin_patients_today: 0,
    waiting_patients: 0,
    checked_in_patients_today: 0,
    emergency_waiting: 0
  });

  const [todayAppointments, setTodayAppointments] = useState([]);
  const [queueOverview, setQueueOverview] = useState([]);
  const [notifications, setNotifications] = useState({
    late_arrivals: [],
    cancelled_appointments: [],
    queue_alerts: []
  });

  // UI Filters & Tab States
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentFilter, setAppointmentFilter] = useState('All'); // All, Scheduled, Checked-in, Completed, Late/Cancelled
  const [activeNotificationTab, setActiveNotificationTab] = useState('alerts'); // alerts, late, cancelled

  // Modals & Quick Action States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState('');
  const [actionModalMessage, setActionModalMessage] = useState('');

  // Appointment Booking Modal State
  const [isApptBookingModalOpen, setIsApptBookingModalOpen] = useState(false);
  const [apptModalPatient, setApptModalPatient] = useState(null);
  const [apptModalInitialData, setApptModalInitialData] = useState(null);
  const [apptModalMode, setApptModalMode] = useState('create');

  // Token Generation Drawer/Modal Form
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [searchMobile, setSearchMobile] = useState('');
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [tokenDept, setTokenDept] = useState('');
  const [tokenDoctor, setTokenDoctor] = useState('');
  const [tokenPriority, setTokenPriority] = useState('3');
  const [tokenLoading, setTokenLoading] = useState(false);

  // Quick Patient Search Dialog State
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const data = await fetchDashboardStatsDeduplicated(isManualRefresh);
      if (data) {
        if (data.receptionist_info) setReceptionistInfo(data.receptionist_info);
        if (data.statistics) setStats(data.statistics);
        setTodayAppointments(Array.isArray(data.today_appointments) ? data.today_appointments : []);
        setQueueOverview(Array.isArray(data.queue_overview) ? data.queue_overview : []);
        setNotifications({
          late_arrivals: Array.isArray(data.notifications?.late_arrivals) ? data.notifications.late_arrivals : [],
          cancelled_appointments: Array.isArray(data.notifications?.cancelled_appointments) ? data.notifications.cancelled_appointments : [],
          queue_alerts: Array.isArray(data.notifications?.queue_alerts) ? data.notifications.queue_alerts : []
        });
      }
    } catch (err) {
      console.error("[loadDashboardData] Error fetching dashboard data:", err);
      showMsg('error', 'Failed to update dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDepartmentsAndDoctors = async () => {
    try {
      const depts = await fetchDepartmentsDeduplicated();
      const deptsArray = Array.isArray(depts) ? depts : [];
      setDepartments(deptsArray);
      if (deptsArray.length > 0 && deptsArray[0]?.id) {
        setTokenDept(deptsArray[0].id.toString());
      }
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadDepartmentsAndDoctors();

    // WebSocket real-time updates
    const ws = createQueueWebSocket((msg) => {
      if (msg && msg.event === 'queue_update') {
        loadDashboardData();
      }
    });

    return () => {
      if (ws && typeof ws.close === 'function') ws.close();
    };
  }, []);

  // Update doctor list when department changes in token generation form
  useEffect(() => {
    if (tokenDept) {
      doctorService.list(parseInt(tokenDept))
        .then((data) => setDoctors(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error('Error loading doctors by department:', err);
          setDoctors([]);
        });
    }
  }, [tokenDept]);

  // Quick Action Handlers
  const handleOpenRegisterModal = () => {
    setIsRegisterModalOpen(true);
  };

  const handleOpenBookModal = (patient = null, initialData = null, mode = 'create') => {
    // Defensive check: ensure patient is a valid patient record and not a React SyntheticEvent
    const isValidPatient = patient && typeof patient === 'object' && !('_reactName' in patient) && ('id' in patient || 'name' in patient);
    setApptModalPatient(isValidPatient ? patient : null);
    setApptModalInitialData(initialData);
    setApptModalMode(mode);
    setIsApptBookingModalOpen(true);
  };

  const handleCheckInAppointment = async (appt) => {
    if (typeof appt.id === 'string' && appt.id.startsWith('q-')) {
      showMsg('success', `Patient ${appt.patient_name} is already checked in with token ${appt.token_number}.`);
      return;
    }
    try {
      const res = await appointmentsService.checkIn(appt.id, appt.priority || 3);
      showMsg('success', `Checked in ${appt.patient_name} successfully! Token assigned.`);
      loadDashboardData();
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.detail || 'Failed to check in appointment.');
    }
  };

  const handleCancelAppointmentItem = async (appt) => {
    if (typeof appt.id === 'string' && appt.id.startsWith('q-')) {
      showMsg('error', 'Cannot cancel a live walk-in queue item directly from appointment list.');
      return;
    }
    if (window.confirm(`Are you sure you want to cancel the appointment for ${appt.patient_name}?`)) {
      try {
        await appointmentsService.cancel(appt.id);
        showMsg('success', `Appointment for ${appt.patient_name} cancelled.`);
        loadDashboardData();
      } catch (err) {
        console.error(err);
        showMsg('error', err.response?.data?.detail || 'Failed to cancel appointment.');
      }
    }
  };

  const handleOpenGenerateTokenModal = () => {
    setIsTokenModalOpen(true);
  };

  const handleOpenSearchModal = () => {
    setIsSearchModalOpen(true);
  };

  // Search Patient in Token Modal
  const handleSearchPatientInTokenModal = async () => {
    if (!searchMobile || !searchMobile.trim()) return;
    try {
      const results = await patientService.getByMobile(searchMobile.trim());
      const resArray = Array.isArray(results) ? results : (results ? [results] : []);
      setFoundPatients(resArray);
      if (resArray.length > 0) {
        setSelectedPatient(resArray[0]);
      } else {
        setSelectedPatient(null);
        showMsg('error', 'No patient found with this mobile number.');
      }
    } catch (err) {
      console.error(err);
      showMsg('error', 'Error searching patient record.');
    }
  };

  // Generate Token Ticket
  const handleGenerateToken = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !selectedPatient.id) {
      showMsg('error', 'Please search and select a patient first.');
      return;
    }
    setTokenLoading(true);
    try {
      const entry = await queueService.checkIn(
        selectedPatient.id,
        parseInt(tokenDept),
        parseInt(tokenPriority),
        tokenDoctor ? parseInt(tokenDoctor) : null
      );
      showMsg('success', `Token ${entry?.token_number || 'generated'} successfully for ${selectedPatient.name || 'patient'}!`);
      setIsTokenModalOpen(false);
      setSelectedPatient(null);
      setSearchMobile('');
      setFoundPatients([]);
      loadDashboardData();
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.detail || 'Failed to generate token.');
    } finally {
      setTokenLoading(false);
    }
  };

  // Global Patient Search
  const handleGlobalSearch = async (query) => {
    const qStr = (query || '').trim();
    setGlobalSearchTerm(query);
    if (!qStr) {
      setGlobalSearchResults([]);
      return;
    }
    setSearchingGlobal(true);
    try {
      const results = await patientService.list(qStr);
      setGlobalSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
      setGlobalSearchResults([]);
    } finally {
      setSearchingGlobal(false);
    }
  };

  // Filter today's appointments safely
  const filteredAppointments = (Array.isArray(todayAppointments) ? todayAppointments : []).filter((app) => {
    if (!app) return false;
    const search = (appointmentSearch || '').toLowerCase();
    const pName = (app.patient_name || '').toString().toLowerCase();
    const dName = (app.doctor || '').toString().toLowerCase();
    const tNum = (app.token_number || '').toString().toLowerCase();
    const dept = (app.department || '').toString().toLowerCase();

    const matchesSearch =
      pName.includes(search) ||
      dName.includes(search) ||
      tNum.includes(search) ||
      dept.includes(search);

    if (!matchesSearch) return false;

    if (appointmentFilter === 'Scheduled') return app.status === 'Scheduled';
    if (appointmentFilter === 'Checked-in') return app.status === 'Checked-in' || app.status === 'In Consultation';
    if (appointmentFilter === 'Completed') return app.status === 'Completed';
    if (appointmentFilter === 'Late/Cancelled') return app.status === 'Late' || app.status === 'Cancelled';
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Receptionist Dashboard Home...</p>
        </div>
      </div>
    );
  }

  const totalAlertsCount =
    (notifications?.queue_alerts?.length || 0) +
    (notifications?.late_arrivals?.length || 0) +
    (notifications?.cancelled_appointments?.length || 0);

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. DASHBOARD HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Welcome back, {receptionistInfo?.name || receptionistInfo?.username || 'Reception Staff'} 👋
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-hospital-100 text-hospital-700 dark:bg-hospital-950 dark:text-hospital-300 border border-hospital-200 dark:border-hospital-800">
              Reception Desk
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {receptionistInfo?.current_date || 'Today'} • AcuraQueue Smart Patient Flow Monitoring
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live WS Sync</span>
          </div>

          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Refresh Dashboard Statistics"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-hospital-500' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Global Message Banner */}
      {message?.text && (
        <div className={`p-4 rounded-2xl text-sm flex items-center justify-between border ${
          message.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/60 dark:text-rose-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-300'
        }`}>
          <div className="flex items-center space-x-3">
            {message.type === 'error' ? <AlertTriangle className="h-5 w-5 flex-shrink-0" /> : <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
            <span className="font-semibold">{message.text}</span>
          </div>
          <button onClick={() => setMessage({ type: '', text: '' })} className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Appointments Today */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-hospital-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Appointments</span>
            <div className="bg-hospital-50 text-hospital-600 dark:bg-hospital-950 dark:text-hospital-400 p-3 rounded-2xl">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.total_appointments_today ?? 0}</span>
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">Today</span>
              <span>Scheduled & Walk-ins</span>
            </div>
          </div>
        </div>

        {/* Walk-in Patients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Walk-in Patients</span>
            <div className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 p-3 rounded-2xl">
              <UserPlus className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.walkin_patients_today ?? 0}</span>
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">Desk Reg</span>
              <span>Unscheduled Visits</span>
            </div>
          </div>
        </div>

        {/* Waiting Patients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Waiting Patients</span>
            <div className="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 p-3 rounded-2xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-3xl font-black tracking-tight ${(stats?.emergency_waiting || 0) > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
              {stats?.waiting_patients ?? 0}
            </span>
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              {(stats?.emergency_waiting || 0) > 0 ? (
                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold">
                  {stats.emergency_waiting} Emergency
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold">In Lounge</span>
              )}
              <span>Active Queue</span>
            </div>
          </div>
        </div>

        {/* Checked-in Patients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Checked-in Patients</span>
            <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 p-3 rounded-2xl">
              <UserCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats?.checked_in_patients_today ?? 0}</span>
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">Processed</span>
              <span>Desk Check-ins</span>
            </div>
          </div>
        </div>

      </div>

      {/* 5. QUICK ACTIONS BAR */}
      <div className="bg-gradient-to-r from-hospital-600 via-hospital-500 to-sky-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-amber-300" />
              <span>Quick Actions & Desk Workflows</span>
            </h2>
            <p className="text-xs text-hospital-100">Instantly execute reception tasks or lookup patient flow tickets.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <button
            onClick={handleOpenRegisterModal}
            className="flex items-center justify-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md p-3.5 rounded-2xl text-xs font-bold transition-all transform active:scale-95 text-white"
          >
            <UserPlus className="h-4 w-4 text-emerald-300" />
            <span>Register Patient</span>
          </button>

          <button
            onClick={() => handleOpenBookModal()}
            className="flex items-center justify-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md p-3.5 rounded-2xl text-xs font-bold transition-all transform active:scale-95 text-white"
          >
            <CalendarPlus className="h-4 w-4 text-sky-300" />
            <span>Book Appointment</span>
          </button>

          <button
            onClick={handleOpenGenerateTokenModal}
            className="flex items-center justify-center space-x-2 bg-white text-hospital-700 hover:bg-hospital-50 p-3.5 rounded-2xl text-xs font-black shadow transition-all transform active:scale-95"
          >
            <Ticket className="h-4 w-4 text-hospital-600" />
            <span>Generate Token</span>
          </button>

          <button
            onClick={handleOpenSearchModal}
            className="flex items-center justify-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md p-3.5 rounded-2xl text-xs font-bold transition-all transform active:scale-95 text-white"
          >
            <Search className="h-4 w-4 text-amber-300" />
            <span>Search Patient</span>
          </button>

        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT / PRIMARY COLUMN (Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 3. TODAY'S APPOINTMENT LIST */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-hospital-500" />
                  <span>Today's Appointment List</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Scheduled consultations and walk-in arrivals for today.</p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                {['All', 'Scheduled', 'Checked-in', 'Completed', 'Late/Cancelled'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAppointmentFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      appointmentFilter === tab
                        ? 'bg-white dark:bg-slate-900 text-hospital-600 dark:text-hospital-400 shadow-sm font-bold'
                        : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={appointmentSearch}
                onChange={(e) => setAppointmentSearch(e.target.value)}
                placeholder="Filter by patient name, token #, doctor, or department..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-xl text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none transition-all"
              />
            </div>

            {/* Table */}
            {filteredAppointments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Patient Name</th>
                      <th className="py-3 px-3 text-center">Token #</th>
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Doctor</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {filteredAppointments.map((item) => {
                      if (!item) return null;
                      // Status Badge Styling
                      let statusBadge = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                      if (item.status === "Scheduled") {
                        statusBadge = "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
                      } else if (item.status === "Checked-in") {
                        statusBadge = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800";
                      } else if (item.status === "In Consultation") {
                        statusBadge = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold animate-pulse border border-purple-200 dark:border-purple-800";
                      } else if (item.status === "Completed") {
                        statusBadge = "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400";
                      } else if (item.status === "Late") {
                        statusBadge = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800";
                      } else if (item.status === "Cancelled") {
                        statusBadge = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 line-through border border-rose-200 dark:border-rose-800";
                      }

                      return (
                        <tr key={item.id || item.token_number || Math.random()} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">{item.patient_name || 'Patient'}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">{item.appointment_type || 'Scheduled'}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.token_number && item.token_number !== 'TBD' ? (
                              <span className="font-black text-hospital-600 dark:text-hospital-400 bg-hospital-50 dark:bg-hospital-950/50 px-2.5 py-1 rounded-lg border border-hospital-200 dark:border-hospital-800">
                                {item.token_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">TBD</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                            {item.appointment_time || '--'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.doctor || 'Unassigned'}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-medium">
                            {item.department || 'General'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] ${statusBadge}`}>
                              {item.status || 'Scheduled'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5">
                            {(item.status === 'Scheduled' || item.status === 'Late') && (
                              <button
                                onClick={() => handleCheckInAppointment(item)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 font-bold text-[10px] transition-colors"
                                title="Check-in patient and issue queue token"
                              >
                                Check In
                              </button>
                            )}
                            {typeof item.id === 'number' && item.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleOpenBookModal(null, item, 'edit')}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 text-[10px] font-bold transition-colors"
                              >
                                Edit
                              </button>
                            )}
                            {typeof item.id === 'number' && item.status !== 'Cancelled' && item.status !== 'Completed' && (
                              <button
                                onClick={() => handleCancelAppointmentItem(item)}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-lg hover:bg-rose-100 text-[10px] font-bold transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                No appointments found matching the selected filter criteria.
              </div>
            )}
          </div>

          {/* 4. CURRENT QUEUE OVERVIEW */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Stethoscope className="h-5 w-5 text-hospital-500" />
                  <span>Current Queue Overview</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live token status and waiting counts by attending physician.</p>
              </div>
            </div>

            {Array.isArray(queueOverview) && queueOverview.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {queueOverview.map((doc) => doc && (
                  <div
                    key={doc.doctor_id || doc.doctor_name}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{doc.doctor_name || 'Physician'}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{doc.specialization || 'General'} • Room {doc.room_number || 'TBD'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.is_available
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {doc.is_available ? 'Available' : 'Busy'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Token</span>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          {doc.current_token && doc.current_token !== 'None' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              <span className="font-black text-hospital-600 dark:text-hospital-400">{doc.current_token}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-medium">Idle</span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Waiting Count</span>
                        <span className="font-black text-slate-900 dark:text-white mt-0.5 block">{doc.waiting_count ?? 0} Patients</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No active doctors loaded in the queue system.
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: NOTIFICATIONS PANEL (Span 1) */}
        <div className="space-y-6">
          
          {/* 6. NOTIFICATIONS PANEL */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Bell className="h-5 w-5 text-amber-500" />
                  {totalAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Notifications Panel</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {totalAlertsCount} Updates
              </span>
            </div>

            {/* Sub-tabs */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              <button
                onClick={() => setActiveNotificationTab('alerts')}
                className={`flex-1 py-1.5 rounded-lg transition-colors text-center ${
                  activeNotificationTab === 'alerts'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                Queue Alerts ({notifications?.queue_alerts?.length || 0})
              </button>
              <button
                onClick={() => setActiveNotificationTab('late')}
                className={`flex-1 py-1.5 rounded-lg transition-colors text-center ${
                  activeNotificationTab === 'late'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                Late ({notifications?.late_arrivals?.length || 0})
              </button>
              <button
                onClick={() => setActiveNotificationTab('cancelled')}
                className={`flex-1 py-1.5 rounded-lg transition-colors text-center ${
                  activeNotificationTab === 'cancelled'
                    ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                Cancelled ({notifications?.cancelled_appointments?.length || 0})
              </button>
            </div>

            {/* Content per Tab */}
            <div className="space-y-3 pt-2">
              
              {/* Queue Alerts Tab */}
              {activeNotificationTab === 'alerts' && (
                <>
                  {Array.isArray(notifications?.queue_alerts) && notifications.queue_alerts.length > 0 ? (
                    notifications.queue_alerts.map((alert) => (
                      <div
                        key={alert?.id || Math.random()}
                        className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                          alert?.severity === 'high'
                            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300'
                            : alert?.severity === 'medium'
                            ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300'
                            : 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/40 dark:border-sky-900/60 dark:text-sky-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 font-bold">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{alert?.title || 'Alert'}</span>
                        </div>
                        <p className="pl-6 text-[11px] leading-relaxed opacity-90">{alert?.message || ''}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No active queue alerts at this time.
                    </div>
                  )}
                </>
              )}

              {/* Late Arrivals Tab */}
              {activeNotificationTab === 'late' && (
                <>
                  {Array.isArray(notifications?.late_arrivals) && notifications.late_arrivals.length > 0 ? (
                    notifications.late_arrivals.map((item) => (
                      <div
                        key={item?.id || Math.random()}
                        className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold text-amber-800 dark:text-amber-300">
                          <span>{item?.patient_name || 'Patient'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-[10px]">
                            {item?.delay_minutes ?? 0}m late
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Appt with {item?.doctor_name || 'Doctor'} scheduled for {item?.scheduled_time || '--'}.
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No late arrivals recorded today.
                    </div>
                  )}
                </>
              )}

              {/* Cancelled Appointments Tab */}
              {activeNotificationTab === 'cancelled' && (
                <>
                  {Array.isArray(notifications?.cancelled_appointments) && notifications.cancelled_appointments.length > 0 ? (
                    notifications.cancelled_appointments.map((item) => (
                      <div
                        key={item?.id || Math.random()}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200">
                          <span>{item?.patient_name || 'Patient'}</span>
                          <span className="text-[10px] text-slate-400">{item?.time || '--'}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Booking with {item?.doctor_name || 'Doctor'} was cancelled.
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No cancelled appointments today.
                    </div>
                  )}
                </>
              )}

            </div>

          </div>

          {/* QUICK LINKS / HELP CARD */}
          <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <HelpCircle className="h-4 w-4 text-hospital-500" />
              <span>Reception Guidelines</span>
            </h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              Tokens marked priority 1 (Critical) automatically bypass standard wait order. Skip tokens if patient fails to respond after 3 calls.
            </p>
          </div>

        </div>

      </div>

      {/* MODAL 1: GENERATE TOKEN DISPATCH DIALOG */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <Ticket className="h-5 w-5 text-hospital-500" />
                <span>Generate Queue Token</span>
              </h3>
              <button onClick={() => setIsTokenModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Lookup Mobile */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">1. SEARCH PATIENT MOBILE</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchPatientInTokenModal()}
                    placeholder="Enter mobile number..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchPatientInTokenModal}
                    className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900 rounded-xl text-xs font-bold transition-colors"
                  >
                    Find
                  </button>
                </div>
              </div>

              {selectedPatient && (
                <div className="p-3 bg-hospital-50 dark:bg-hospital-950/30 border border-hospital-200 dark:border-hospital-900/50 rounded-2xl text-xs space-y-1">
                  <div className="font-bold text-hospital-600 dark:text-hospital-400 text-[10px] uppercase">SELECTED PATIENT</div>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedPatient.name}</div>
                  <div className="text-[11px] text-slate-500">Age: {selectedPatient.age} | Gen: {selectedPatient.gender} | Mob: {selectedPatient.mobile_number}</div>
                </div>
              )}

              <form onSubmit={handleGenerateToken} className="space-y-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">2. ASSIGN DEPARTMENT</label>
                  <select
                    value={tokenDept}
                    onChange={(e) => setTokenDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  >
                    {(Array.isArray(departments) ? departments : []).map((dept) => (
                      <option key={dept?.id} value={dept?.id}>{dept?.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">3. PHYSICIAN (OPTIONAL)</label>
                  <select
                    value={tokenDoctor}
                    onChange={(e) => setTokenDoctor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  >
                    <option value="">Any Available Physician</option>
                    {(Array.isArray(doctors) ? doctors : [])
                      .filter((d) => d && d.department_id === parseInt(tokenDept))
                      .map((doc) => (
                        <option key={doc?.id} value={doc?.id}>{doc?.name} (Room {doc?.room_number || 'TBD'})</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">4. PRIORITY TRIAGE LEVEL</label>
                  <select
                    value={tokenPriority}
                    onChange={(e) => setTokenPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  >
                    <option value="3">Priority 3 - Normal</option>
                    <option value="2">Priority 2 - Urgent</option>
                    <option value="1">Priority 1 - Critical</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsTokenModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={tokenLoading || !selectedPatient}
                    className="px-5 py-2 rounded-xl bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-bold shadow disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {tokenLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Generate Token Ticket</span>
                        <Ticket className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: SEARCH PATIENT OVERLAY */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <Search className="h-5 w-5 text-hospital-500" />
                <span>Patient Master Lookup</span>
              </h3>
              <button onClick={() => setIsSearchModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={globalSearchTerm}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Search patient name, mobile number, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchingGlobal ? (
                <div className="py-6 text-center text-xs text-slate-400 flex justify-center items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching patient database...</span>
                </div>
              ) : Array.isArray(globalSearchResults) && globalSearchResults.length > 0 ? (
                globalSearchResults.map((pat) => pat && (
                  <div
                    key={pat.id || pat.patient_code || Math.random()}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-hospital-300 dark:hover:border-hospital-700 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{pat.name || 'Patient'}</div>
                      <div className="text-[11px] text-slate-500">
                        Age: {pat.age ?? 'N/A'} | Gen: {pat.gender || 'N/A'} | Mob: {pat.mobile_number || 'N/A'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPatient(pat);
                        setIsSearchModalOpen(false);
                        setIsTokenModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-hospital-50 text-hospital-600 hover:bg-hospital-100 dark:bg-hospital-950 dark:text-hospital-300 rounded-xl font-bold text-[10px]"
                    >
                      Select for Token
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {globalSearchTerm ? 'No patient records found matching query.' : 'Type to search patient master registry.'}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: PLACEHOLDER ACTION MODAL (Register / Book Appointment) */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-hospital-500" />
                <span>{actionModalTitle || 'Action'}</span>
              </h3>
              <button onClick={() => setIsActionModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-hospital-50 dark:bg-hospital-950/40 border border-hospital-200 dark:border-hospital-800/60 text-xs space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                {actionModalMessage || ''}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsActionModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-bold shadow"
              >
                Understand
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Patient Registration Modal */}
      <PatientRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegistrationSuccess={() => {
          loadDashboardData();
        }}
        onGenerateToken={(patient) => {
          setSelectedPatient(patient);
          setSearchMobile(patient?.mobile_number || '');
          setIsTokenModalOpen(true);
        }}
        onBookAppointment={(patient) => {
          handleOpenBookModal(patient, null, 'create');
        }}
      />

      {/* Appointment Booking / Edit Modal */}
      <AppointmentBookingModal
        isOpen={isApptBookingModalOpen}
        onClose={() => setIsApptBookingModalOpen(false)}
        onSuccess={() => {
          showMsg('success', apptModalMode === 'edit' ? 'Appointment updated!' : 'Appointment booked successfully!');
          loadDashboardData();
        }}
        patient={apptModalPatient}
        initialData={apptModalInitialData}
        mode={apptModalMode}
      />

    </div>
  );
}

export default ReceptionistDashboard;
