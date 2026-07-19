import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Clipboard, FileText, Bell, Search, Edit2, Phone,
  Trash2, RefreshCw, Printer, Download, Eye, Plus, ArrowRight,
  CheckCircle, AlertCircle, Clock, Heart, Activity, ShieldAlert,
  Stethoscope, Brain, AlertTriangle, FlaskConical, Pill, ChevronRight,
  BarChart3, Info, Sparkles, Check, ArrowUpRight, Shield, RefreshCcw
} from 'lucide-react';
import {
  patientService, dashboardService, queueService,
  appointmentsService, doctorService, createQueueWebSocket
} from '../services/api';
import PatientAIPortal from './PatientAIPortal';

const HEALTH_TIPS = [
  {
    id: 1,
    category: 'Hydration',
    title: 'Optimal Daily Hydration',
    tip: 'Aim for 8-10 glasses (2.5L) of water daily. Staying hydrated optimizes kidney filtration, joint health, and energy levels.',
    icon: Sparkles,
    gradient: 'from-blue-500 to-cyan-500',
    accentBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
  },
  {
    id: 2,
    category: 'Preventive Care',
    title: 'Routine Health Screenings',
    tip: 'Keep up with yearly health check-ups and routine blood panels. Early detection is key to managing long-term wellness.',
    icon: Heart,
    gradient: 'from-rose-500 to-pink-500',
    accentBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
  },
  {
    id: 3,
    category: 'Sleep & Recovery',
    title: 'Restorative Sleep Routine',
    tip: 'Maintain 7-8 hours of uninterrupted sleep nightly. Consistent sleep hygiene boosts natural immunity and mental acuity.',
    icon: Activity,
    gradient: 'from-purple-500 to-indigo-500',
    accentBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
  },
  {
    id: 4,
    category: 'Nutrition',
    title: 'Micronutrient Balance',
    tip: 'Incorporate leafy greens, antioxidant-rich berries, and healthy fats into your diet to reduce inflammation.',
    icon: Stethoscope,
    gradient: 'from-emerald-500 to-teal-500',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
  }
];

function PatientDashboard({ initialTab = 'home' }) {
  // Tabs: home, appointments, prescription, history, medicines, reports, notifications, diagnosis, ai_portal, profile
  const [activeTab, setActiveTab] = useState(initialTab);
  const [patient, setPatient] = useState(null);
  const [stats, setStats] = useState(null);

  // Data lists
  const [appointments, setAppointments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Active Health Tip state
  const [tipIndex, setTipIndex] = useState(0);

  // Form / modal states
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', mobile_number: '', blood_group: '', allergies: '', emergency_contact: '', age: '', gender: ''
  });

  const [bookingModal, setBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    doctor_id: '', appointment_time: '', appointment_type: 'Scheduled'
  });

  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Queue self check-in state
  const [selectedDept, setSelectedDept] = useState('');
  const [viewingAppointment, setViewingAppointment] = useState(null);

  // Filters & searches
  const [historySearch, setHistorySearch] = useState('');
  const [historyDeptFilter, setHistoryDeptFilter] = useState('');
  const [historyDocFilter, setHistoryDocFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('All');

  // General loading & message states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Disease Diagnosis AI states
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState('');
  const defaultVitals = { age: '', bmi: '24.5', blood_glucose: '90', heart_rate: '75', temperature: '98.2', systolic_bp: '115' };
  const [vitalsForm, setVitalsForm] = useState(defaultVitals);
  const [vitalsCollapsed, setVitalsCollapsed] = useState(true);

  // Dynamic Symptom Selection & History States
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [symptomSearch, setSymptomSearch] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [diagnosisSubTab, setDiagnosisSubTab] = useState('new'); // 'new' or 'history'

  // History Filters
  const [predHistorySearch, setPredHistorySearch] = useState('');
  const [predHistoryRiskFilter, setPredHistoryRiskFilter] = useState('');
  const [predHistorySortBy, setPredHistorySortBy] = useState('prediction_time');
  const [predHistorySortOrder, setPredHistorySortOrder] = useState('desc');

  const loadAllData = async () => {
    try {
      setError('');
      // 1. Get profile
      const profile = await patientService.getMe();
      setPatient(profile);
      setProfileForm({
        name: profile.name || '',
        email: profile.email || '',
        mobile_number: profile.mobile_number || '',
        blood_group: profile.blood_group || '',
        allergies: profile.allergies || '',
        emergency_contact: profile.emergency_contact || '',
        age: profile.age || '',
        gender: profile.gender || ''
      });
      setVitalsForm(prev => ({
        ...prev,
        age: profile.age ? profile.age.toString() : ''
      }));

      // 2. Queue stats
      const patientStats = await dashboardService.getPatientStats(profile.id);
      setStats(patientStats);

      // 3. Appointments list
      const apps = await appointmentsService.list();
      setAppointments(apps);

      // 4. Visits list
      const vis = await patientService.getVisits();
      setVisits(vis);

      // 5. Prescriptions list
      const meds = await patientService.getPrescriptions();
      setPrescriptions(meds);

      // 6. Reports list
      const reps = await patientService.getReports();
      setReports(reps);

      // 7. Notifications list
      const notifs = await patientService.getNotifications();
      setNotifications(notifs);

      // 8. Departments & Doctors for booking / check-in
      const depts = await queueService.getDepartments();
      setDepartments(depts);
      if (depts.length > 0 && !selectedDept) {
        setSelectedDept(depts[0].id.toString());
      }

      const docs = await doctorService.list();
      setDoctors(docs);
      if (docs.length > 0 && !bookingForm.doctor_id) {
        setBookingForm(prev => ({ ...prev, doctor_id: docs[0].id.toString() }));
      }

      // 9. Dynamic symptoms
      try {
        const symsList = await patientService.getSymptoms();
        setAllSymptoms(symsList);
      } catch (err) {
        console.error("Failed to load symptoms", err);
      }

      // 10. Predictions history
      try {
        const historyList = await patientService.getPredictionHistory();
        setPredictionHistory(historyList);
      } catch (err) {
        console.error("Failed to load prediction history", err);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to fetch patient data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Sync queue real-time
    const ws = createQueueWebSocket((message) => {
      if (message.event === 'queue_update') {
        if (patient) {
          dashboardService.getPatientStats(patient.id).then(setStats).catch(console.error);
        }
      }
    });

    return () => {
      ws.close();
    };
  }, [patient?.id]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...profileForm,
        name: profileForm.name ? profileForm.name.trim() : '',
        email: profileForm.email && profileForm.email.trim() !== '' ? profileForm.email.trim() : null,
        mobile_number: profileForm.mobile_number ? profileForm.mobile_number.trim() : '',
        blood_group: profileForm.blood_group && profileForm.blood_group !== '' ? profileForm.blood_group : null,
        allergies: profileForm.allergies && profileForm.allergies.trim() !== '' ? profileForm.allergies.trim() : null,
        emergency_contact: profileForm.emergency_contact && profileForm.emergency_contact.trim() !== '' ? profileForm.emergency_contact.trim() : null,
        age: parseInt(profileForm.age) || 0
      };

      const updated = await patientService.updateProfile(payload);
      setPatient(updated);
      setEditingProfile(false);
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("Profile update failed:", err);
      const backendDetail = err.response?.data?.detail;
      setError(typeof backendDetail === 'string' ? backendDetail : 'Failed to update profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingForm.appointment_time) {
      setError('Please select appointment date and time');
      return;
    }
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await appointmentsService.book(
        parseInt(bookingForm.doctor_id),
        bookingForm.appointment_time,
        bookingForm.appointment_type
      );
      setBookingModal(false);
      setSuccess('Appointment booked successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadAllData();
    } catch (err) {
      console.error(err);
      setError('Failed to book appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await appointmentsService.cancel(id);
      setSuccess('Appointment cancelled successfully.');
      setTimeout(() => setSuccess(''), 3000);
      loadAllData();
    } catch (err) {
      console.error(err);
      setError('Failed to cancel appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTime) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await appointmentsService.reschedule(rescheduleId, rescheduleTime);
      setRescheduleId(null);
      setRescheduleTime('');
      setSuccess('Appointment rescheduled successfully.');
      setTimeout(() => setSuccess(''), 3000);
      loadAllData();
    } catch (err) {
      console.error(err);
      setError('Failed to reschedule appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelfCheckIn = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await queueService.checkIn(patient.id, parseInt(selectedDept), 3);
      setSuccess('Successfully checked in! Queue token generated.');
      setTimeout(() => setSuccess(''), 3000);
      loadAllData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to check in.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiagnosis = async (e) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0) {
      setDiagnosisError("Please select at least one symptom to run prediction.");
      return;
    }
    setDiagnosisLoading(true);
    setDiagnosisError('');
    setDiagnosisResult(null);
    try {
      const vitals = {
        age: parseInt(vitalsForm.age || patient?.age || 30),
        bmi: parseFloat(vitalsForm.bmi || 24.5),
        blood_glucose: parseInt(vitalsForm.blood_glucose || 90),
        heart_rate: parseInt(vitalsForm.heart_rate || 75),
        temperature: parseFloat(vitalsForm.temperature || 98.2),
        systolic_bp: parseInt(vitalsForm.systolic_bp || 115)
      };
      const result = await patientService.predictPatientDisease(vitals, selectedSymptoms);
      setDiagnosisResult(result);

      // Reload history list
      const historyList = await patientService.getPredictionHistory();
      setPredictionHistory(historyList);
    } catch (err) {
      console.error(err);
      setDiagnosisError(err.response?.data?.detail || 'Failed to run disease prediction. Please check your inputs and try again.');
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const printPredictionReport = () => {
    window.print();
  };

  const printPrescription = () => {
    if (latestVisit) {
      const url = patientService.getPrescriptionPdfUrl(latestVisit.id);
      window.open(url, '_blank');
    } else {
      window.print();
    }
  };

  const downloadPrescriptionFile = () => {
    if (latestVisit) {
      const url = patientService.getPrescriptionPdfUrl(latestVisit.id);
      window.open(url, '_blank');
    } else {
      alert("No prescription available to download.");
    }
  };

  // Helper data calculations
  const latestVisit = visits.find(v => v.prescriptions && v.prescriptions.length > 0);
  const scheduledApps = appointments.filter(a => a.status === 'Scheduled');
  const activeQueueToken = stats?.active_tokens && stats.active_tokens.length > 0 ? stats.active_tokens[0] : null;

  // Filter visits
  const filteredVisits = visits.filter(v => {
    const matchesSearch = historySearch ? (v.diagnosis || '').toLowerCase().includes(historySearch.toLowerCase()) : true;
    const matchesDept = historyDeptFilter ? v.department === historyDeptFilter : true;
    const matchesDoc = historyDocFilter ? v.doctor?.name === historyDocFilter : true;
    const matchesDate = historyDateFilter ? new Date(v.visit_date).toLocaleDateString() === new Date(historyDateFilter).toLocaleDateString() : true;
    return matchesSearch && matchesDept && matchesDoc && matchesDate;
  });

  // Filter medicines
  const filteredPrescriptions = prescriptions.filter(p =>
    medicineSearch ? p.medicine_name.toLowerCase().includes(medicineSearch.toLowerCase()) : true
  );

  // Recent activity generator
  const getRecentActivities = () => {
    const activities = [];

    appointments.forEach(app => {
      activities.push({
        id: `app-${app.id}`,
        type: 'appointment',
        title: app.status === 'Scheduled' ? 'Appointment Scheduled' : `Appointment ${app.status}`,
        description: `Dr. ${app.doctor?.name || 'Physician'} (${app.doctor?.department?.name || 'Consultation'})`,
        date: new Date(app.appointment_time),
        icon: Calendar,
        badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      });
    });

    visits.forEach(vis => {
      activities.push({
        id: `vis-${vis.id}`,
        type: 'visit',
        title: vis.diagnosis ? `Consultation: ${vis.diagnosis}` : 'Medical Visit Completed',
        description: `Dr. ${vis.doctor?.name || 'Physician'} • ${vis.department || 'General'}`,
        date: new Date(vis.visit_date),
        icon: Activity,
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
      });
    });

    reports.forEach(rep => {
      activities.push({
        id: `rep-${rep.id}`,
        type: 'report',
        title: `Lab Report Available: ${rep.report_name}`,
        description: `Diagnostic Type: ${rep.report_type}`,
        date: new Date(rep.upload_date),
        icon: FileText,
        badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
      });
    });

    notifications.forEach(notif => {
      activities.push({
        id: `notif-${notif.id}`,
        type: 'notification',
        title: notif.title || 'System Notification',
        description: notif.message,
        date: new Date(notif.created_at),
        icon: Bell,
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      });
    });

    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  };

  const recentActivities = getRecentActivities();

  // Skeleton Loading Screen
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-pulse">
        {/* Skeleton Banner */}
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        {/* Skeleton Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const activeTip = HEALTH_TIPS[tipIndex];

  const NAV_ITEMS = [
    { key: 'home', label: 'Overview', icon: BarChart3 },
    { key: 'appointments', label: 'Appointments', icon: Calendar, badge: scheduledApps.length },
    { key: 'prescription', label: 'Prescription', icon: Clipboard },
    { key: 'history', label: 'Medical History', icon: Activity },
    { key: 'medicines', label: 'Medicine Log', icon: Pill },
    { key: 'reports', label: 'Lab Reports', icon: FileText, badge: reports.length },
    { key: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.length, isDangerBadge: true },
    { key: 'diagnosis', label: 'AI Predictor', icon: Stethoscope, tag: 'AI', isAi: true },
    { key: 'ai_portal', label: 'AI Assistant', icon: Sparkles, tag: 'Live', isTeal: true },
    { key: 'profile', label: 'My Profile', icon: User }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative min-h-screen">

      {/* ---------------- SIDEBAR / NAVIGATION ---------------- */}

      {/* Mobile Horizontal Navigation Scrollbar */}
      <div className="lg:hidden w-full overflow-x-auto pb-2 flex items-center space-x-2 scrollbar-none border-b border-slate-200 dark:border-slate-800 shrink-0">
        {NAV_ITEMS.map(({ key, label, icon: Icon, badge, isDangerBadge, tag }) => {
          const isActive = activeTab === key;

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${isActive ? 'bg-hospital-500 text-white shadow-md shadow-hospital-500/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isActive ? 'bg-white/20 text-white' : isDangerBadge ? 'bg-rose-500 text-white' : 'bg-hospital-100 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400'}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Vertical Sidebar */}
      <div className="hidden lg:block w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 shrink-0 self-start backdrop-blur-xl">

        {/* Patient Profile Header */}
        <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative shrink-0">
            <div className="bg-gradient-to-br from-hospital-500 to-indigo-600 p-0.5 rounded-2xl shadow-md">
              {patient?.profile_photo ? (
                <img src={patient.profile_photo} alt={patient.name} className="h-11 w-11 rounded-[14px] object-cover" />
              ) : (
                <div className="h-11 w-11 rounded-[14px] bg-hospital-100 dark:bg-hospital-950 flex items-center justify-center text-hospital-600 dark:text-hospital-400 font-black text-sm">
                  {patient?.name ? patient.name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-white shadow-xs">
              <Check className="h-2.5 w-2.5 font-black" />
            </span>
          </div>
          <div className="overflow-hidden space-y-0.5">
            <span className="font-extrabold text-sm block truncate text-slate-800 dark:text-slate-100">{patient?.name || 'Patient'}</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ID: #{patient?.id}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        {NAV_ITEMS.map(({ key, label, icon: Icon, badge, isDangerBadge, tag, isAi, isTeal }) => {
          const isActive = activeTab === key;

          let btnClass = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60';
          if (isActive) {
            if (isAi) btnClass = 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/25';
            else if (isTeal) btnClass = 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-teal-500/25';
            else btnClass = 'bg-hospital-500 text-white shadow-lg shadow-hospital-500/25';
          } else if (isAi) {
            btnClass = 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30';
          } else if (isTeal) {
            btnClass = 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30';
          }

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${btnClass}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : isDangerBadge ? 'bg-rose-500 text-white' : 'bg-hospital-100 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400'}`}>
                  {badge}
                </span>
              )}
              {tag && (
                <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : isAi ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'}`}>
                  {tag}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div className="flex-grow space-y-6 overflow-hidden">

        {/* Global Banner Alert Messages */}
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

        {/* ========================================================= */}
        {/* ---------------- TAB: HOME / OVERVIEW ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6">

            {/* 1. PROFESSIONAL HERO SECTION */}
            <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-hospital-500 to-indigo-600 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-hospital-500/10 overflow-hidden border border-hospital-400/20 dark:border-slate-800">
              <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-hospital-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-12 left-1/3 h-48 w-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/15 dark:bg-white/10 text-white backdrop-blur-md border border-white/20">
                      Patient Portal & Self Service
                    </span>
                    <span className="flex items-center space-x-1 text-xs text-hospital-100 dark:text-hospital-300 font-semibold">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{currentDateFormatted}</span>
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Welcome back, {patient?.name || 'Patient'}! 👋
                  </h1>

                  <p className="text-xs sm:text-sm text-hospital-100 dark:text-slate-300 leading-relaxed font-normal">
                    {activeQueueToken ? (
                      <span>You have an active queue ticket <strong className="text-white font-bold">#{activeQueueToken.token_number}</strong> for {activeQueueToken.department_name}. Est. wait time: {activeQueueToken.estimated_wait_time.toFixed(0)} mins.</span>
                    ) : scheduledApps.length > 0 ? (
                      <span>You have <strong className="text-white font-bold">{scheduledApps.length} upcoming appointment(s)</strong> scheduled. Stay updated with live queue tracking.</span>
                    ) : (
                      <span>Welcome to AcuraQueue Digital Healthcare. Access appointments, prescriptions, and AI disease diagnostics seamlessly.</span>
                    )}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => setBookingModal(true)}
                      className="bg-white text-hospital-600 hover:bg-hospital-50 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Book Consultation</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('ai_portal')}
                      className="bg-white/15 hover:bg-white/25 text-white font-semibold px-4 py-2 rounded-xl text-xs backdrop-blur-md border border-white/20 transition-all flex items-center space-x-1.5 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>AI Care Assistant</span>
                    </button>
                  </div>
                </div>

                {/* Quick Status Box */}
                <div className="shrink-0 bg-white/10 dark:bg-slate-800/50 backdrop-blur-md border border-white/20 dark:border-slate-700/60 p-4 rounded-2xl w-full md:w-56 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-hospital-100 dark:text-slate-400 font-medium">Health Profile</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      Verified
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-white font-bold">Blood Group: <span className="text-hospital-200">{patient?.blood_group || 'O+'}</span></div>
                    <div className="text-xs text-white font-bold">Emergency: <span className="text-hospital-200">{patient?.emergency_contact || 'Registered'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. MODERN STATISTICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

              {/* Card 1: Appointments */}
              <div
                onClick={() => setActiveTab('appointments')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-20 w-20 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-500 transition-colors flex items-center">
                    View <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Scheduled Appointments</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{scheduledApps.length}</span>
                    <span className="text-xs font-bold text-slate-400">Upcoming</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {scheduledApps.length > 0 ? `Next: Dr. ${scheduledApps[0].doctor?.name || 'Physician'}` : 'No upcoming visits'}
                  </p>
                </div>
              </div>

              {/* Card 2: Queue Status */}
              <div
                onClick={() => setActiveTab('appointments')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-6 w-6" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${activeQueueToken ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {activeQueueToken ? activeQueueToken.status : 'Standby'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Queue Ticket</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {activeQueueToken ? activeQueueToken.token_number : 'None'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {activeQueueToken ? `#${activeQueueToken.position} in line` : 'Ready to check-in'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {activeQueueToken ? `Est. wait: ${activeQueueToken.estimated_wait_time.toFixed(0)} mins` : 'Select department to check in'}
                  </p>
                </div>
              </div>

              {/* Card 3: Medical Records */}
              <div
                onClick={() => setActiveTab('history')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-20 w-20 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all"></div>
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-purple-50 dark:bg-purple-950/50 p-3 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-purple-500 transition-colors flex items-center">
                    View <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Medical Records & Labs</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{visits.length + reports.length}</span>
                    <span className="text-xs font-bold text-slate-400">Documents</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {visits.length > 0 ? `Latest Visit: ${new Date(visits[0].visit_date).toLocaleDateString()}` : 'No past clinical records'}
                  </p>
                </div>
              </div>

              {/* Card 4: Prescriptions */}
              <div
                onClick={() => setActiveTab('prescription')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-20 w-20 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-rose-50 dark:bg-rose-950/50 p-3 rounded-2xl text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300">
                    <Pill className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-rose-500 transition-colors flex items-center">
                    View <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Prescriptions</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{prescriptions.length}</span>
                    <span className="text-xs font-bold text-slate-400">Medications</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {prescriptions.length > 0 ? `Item: ${prescriptions[0].medicine_name}` : 'No active prescriptions'}
                  </p>
                </div>
              </div>

            </div>

            {/* 3. QUICK ACTIONS SECTION */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Quick Patient Actions</h3>
                  <p className="text-xs text-slate-400">Fast access to essential health portal tasks</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-hospital-500 bg-hospital-50 dark:bg-hospital-950/50 px-2.5 py-1 rounded-full">
                  Shortcuts
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Action 1: Book Appointment */}
                <button
                  onClick={() => setBookingModal(true)}
                  className="flex items-center space-x-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-hospital-500 dark:hover:border-hospital-500 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-850 shadow-sm hover:shadow-md transition-all duration-300 text-left group hover:-translate-y-0.5"
                >
                  <div className="bg-gradient-to-br from-hospital-500 to-blue-600 text-white p-3 rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-300">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-hospital-600 dark:group-hover:text-hospital-400 transition-colors">Book Appointment</h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Schedule physician visit</span>
                  </div>
                </button>

                {/* Action 2: View Records */}
                <button
                  onClick={() => setActiveTab('history')}
                  className="flex items-center space-x-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-850 shadow-sm hover:shadow-md transition-all duration-300 text-left group hover:-translate-y-0.5"
                >
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-3 rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">View Records</h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Past visits & diagnoses</span>
                  </div>
                </button>

                {/* Action 3: Prescriptions */}
                <button
                  onClick={() => setActiveTab('prescription')}
                  className="flex items-center space-x-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-850 shadow-sm hover:shadow-md transition-all duration-300 text-left group hover:-translate-y-0.5"
                >
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3 rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-300">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Prescriptions</h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Digital RX & medicine logs</span>
                  </div>
                </button>

                {/* Action 4: Edit Profile */}
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setEditingProfile(true);
                  }}
                  className="flex items-center space-x-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-850 shadow-sm hover:shadow-md transition-all duration-300 text-left group hover:-translate-y-0.5"
                >
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-3 rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Edit Profile</h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Update contact & info</span>
                  </div>
                </button>

              </div>
            </div>

            {/* 4. QUEUE STATUS & UPCOMING APPOINTMENTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left 2 columns: Queue Ticket / Check-in & Upcoming Appointments */}
              <div className="lg:col-span-2 space-y-6">

                {/* Queue Card */}
                {activeQueueToken ? (
                  <div className="bg-white dark:bg-slate-900 border border-hospital-200 dark:border-hospital-900/60 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-hospital-500/10 rounded-full blur-3xl"></div>
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-hospital-600 dark:text-hospital-400 uppercase tracking-widest">Live Active Queue Token</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">{activeQueueToken.department_name} Department</h2>
                      </div>
                      <div className="text-right">
                        <span className="text-4xl font-black text-hospital-500 tracking-tight block">{activeQueueToken.token_number}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Token ID</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Queue Position</span>
                        <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                          {activeQueueToken.status === "Calling" ? "Calling Next!" : `#${activeQueueToken.position}`}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{activeQueueToken.patients_ahead} patients ahead</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl text-center sm:col-span-2 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Est. Waiting Time</span>
                          <span className="text-lg font-black text-hospital-500 flex items-center space-x-1">
                            <Clock className="h-4 w-4 animate-pulse text-hospital-500" />
                            <span>{activeQueueToken.status === "Calling" ? "0 mins" : `${activeQueueToken.estimated_wait_time.toFixed(0)} mins`}</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-hospital-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${activeQueueToken.status === "Calling" ? 100 : Math.min(100, Math.max(10, ((60 - activeQueueToken.estimated_wait_time) / 60) * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-hospital-50/50 dark:bg-hospital-950/30 border border-hospital-100 dark:border-hospital-900/40 rounded-2xl gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-hospital-100 dark:bg-hospital-950 p-2.5 rounded-xl text-hospital-600 dark:text-hospital-400">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Doctor</span>
                          <span className="text-xs font-black text-slate-800 dark:text-white block">Dr. {activeQueueToken.doctor_name}</span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Consultation Room</span>
                        <span className="text-xs font-black text-hospital-600 dark:text-hospital-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-hospital-200 dark:border-hospital-800 inline-block mt-0.5">
                          Room {activeQueueToken.room_number}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="space-y-1 text-left w-full md:w-auto">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-hospital-500" />
                        <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Self Check-In Portal</h3>
                      </div>
                      <p className="text-xs text-slate-400">Arrived at the clinic? Register your queue token instantly.</p>
                    </div>

                    <form onSubmit={handleSelfCheckIn} className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="w-full sm:w-48 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-hospital-500"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full sm:w-auto bg-hospital-500 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-hospital-600 transition-all shadow-md shadow-hospital-500/20 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Check In Now
                      </button>
                    </form>
                  </div>
                )}

                {/* Upcoming Appointments List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Upcoming Consultations</h3>
                      <p className="text-xs text-slate-400">Scheduled visits with healthcare specialists</p>
                    </div>
                    <button
                      onClick={() => setBookingModal(true)}
                      className="bg-hospital-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-hospital-600 transition-all flex items-center space-x-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Book Visit</span>
                    </button>
                  </div>

                  {scheduledApps.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {scheduledApps.map(app => (
                        <div key={app.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/20 dark:bg-slate-800/10 hover:border-hospital-300 dark:hover:border-hospital-700 transition-all space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] text-hospital-500 font-extrabold uppercase tracking-wider block">{app.doctor?.department?.name || 'Department'}</span>
                              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white mt-0.5">Dr. {app.doctor?.name}</h4>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              {app.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 dark:border-slate-800/60 py-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Date</span>
                              <strong className="text-slate-700 dark:text-slate-200">{new Date(app.appointment_time).toLocaleDateString()}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Time</span>
                              <strong className="text-slate-700 dark:text-slate-200">
                                {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              onClick={() => setViewingAppointment(app)}
                              className="flex-grow text-center text-xs font-semibold py-1.5 px-2 bg-hospital-50 hover:bg-hospital-100 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-400 rounded-xl transition-all"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => {
                                setRescheduleId(app.id);
                                setRescheduleTime(app.appointment_time.slice(0, 16));
                              }}
                              className="text-center text-xs font-semibold py-1.5 px-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(app.id)}
                              className="text-center text-xs font-semibold py-1.5 px-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-850/20 space-y-3">
                      <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No upcoming appointments scheduled</p>
                        <p className="text-[10px] text-slate-400">Schedule your next visit with our medical team</p>
                      </div>
                      <button
                        onClick={() => setBookingModal(true)}
                        className="bg-hospital-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-hospital-600 transition-all inline-block shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Book Appointment Now
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Right 1 column: Recent Activity & Wellness Health Tips */}
              <div className="space-y-6">

                {/* Recent Activity Timeline */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Recent Activity Feed</h3>
                    <span className="text-[10px] font-bold text-slate-400">Live Updates</span>
                  </div>

                  {recentActivities.length > 0 ? (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {recentActivities.map((act) => (
                        <div key={act.id} className="relative group">
                          <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-slate-900 border-2 border-hospital-500 flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-hospital-500"></div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 leading-tight">{act.title}</h4>
                              <span className="text-[9px] text-slate-400 font-semibold shrink-0 ml-2">
                                {act.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{act.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No recent patient activities logged.
                    </div>
                  )}
                </div>

                {/* Health Tips / Wellness Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-lg border border-slate-800 relative overflow-hidden space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-xl ${activeTip.accentBg}`}>
                        <activeTip.icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300">Health & Wellness Tip</span>
                    </div>
                    <button
                      onClick={() => setTipIndex((prev) => (prev + 1) % HEALTH_TIPS.length)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors hover:scale-105 active:scale-95"
                      title="Next Tip"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-hospital-400 block">{activeTip.category}</span>
                    <h4 className="text-base font-extrabold text-white tracking-tight">{activeTip.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">{activeTip.tip}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 border-t border-slate-800/80">
                    <span>Daily Clinical Advice</span>
                    <span className="font-bold text-hospital-400">{tipIndex + 1} of {HEALTH_TIPS.length}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- APPOINTMENTS & QUEUE TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">

            {/* Active Queue Ticket */}
            {stats && stats.active_tokens && stats.active_tokens.length > 0 ? (
              stats.active_tokens.map((token) => {
                const maxWait = 60;
                const percent = Math.min(100, Math.max(0, (maxWait - token.estimated_wait_time) / maxWait * 100));

                return (
                  <div key={token.queue_id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-hospital-500/5 rounded-full blur-2xl"></div>
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
                      <div>
                        <span className="text-xs font-bold text-hospital-500 uppercase tracking-widest">Active Queue Ticket</span>
                        <h2 className="text-lg font-bold mt-0.5">{token.department_name}</h2>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-extrabold text-hospital-500 tracking-tight">{token.token_number}</span>
                        <span className="text-xs block text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Queue Token</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl text-center">
                        <span className="text-xs text-slate-500 font-semibold block">QUEUE POSITION</span>
                        <span className="text-2xl font-black mt-1 block">
                          {token.status === "Calling" ? "Calling Next!" : `#${token.position}`}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5 block">{token.patients_ahead} patients ahead</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl text-center col-span-2 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-500 font-semibold">ESTIMATED WAITING TIME</span>
                          <span className="text-xl font-extrabold text-hospital-500 flex items-center space-x-1">
                            <Clock className="h-5 w-5 animate-pulse" />
                            <span>{token.status === "Calling" ? "0 mins" : `${token.estimated_wait_time.toFixed(0)} mins`}</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-hospital-500 to-hospital-400 h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${token.status === "Calling" ? 100 : percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-hospital-50 dark:bg-hospital-950/20 border border-hospital-100 dark:border-hospital-900/30 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="bg-hospital-100 dark:bg-hospital-950 p-2 rounded-xl text-hospital-600 dark:text-hospital-400">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Assigned Physician</span>
                          <span className="text-sm font-bold block">{token.doctor_name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-medium block">Room Number</span>
                        <span className="text-sm font-extrabold bg-hospital-100 dark:bg-hospital-950/50 text-hospital-600 dark:text-hospital-400 px-3 py-1 rounded-lg">
                          {token.room_number}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-base">Self Check-In Portal</h3>
                  <p className="text-xs text-slate-500">Already at the hospital? Check-in directly to register a queue token.</p>
                </div>
                <form onSubmit={handleSelfCheckIn} className="flex items-center space-x-3 w-full md:w-auto">
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-sm"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="bg-hospital-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-hospital-600 transition-colors shadow-sm whitespace-nowrap"
                  >
                    Check In
                  </button>
                </form>
              </div>
            )}

        {/* ========================================================= */}
        {/* ---------------- APPOINTMENTS TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">

            {/* Page Hero Header */}
            <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-hospital-500 to-indigo-600 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl overflow-hidden border border-hospital-400/20 dark:border-slate-800">
              <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-hospital-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/20 text-white border border-white/30 backdrop-blur-md">
                      Specialist Consultations
                    </span>
                    <span className="text-[10px] text-hospital-100 dark:text-slate-400 font-semibold">
                      {appointments.length} Total Registered
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    My Appointments & Schedule
                  </h1>

                  <p className="text-xs text-hospital-100 dark:text-slate-300 max-w-xl">
                    Manage upcoming hospital visits, review historical consultation logs, and schedule new specialist appointments with live queue tracking.
                  </p>
                </div>

                <button
                  onClick={() => setBookingModal(true)}
                  className="bg-white text-hospital-600 font-extrabold px-5 py-3 rounded-2xl text-xs shadow-lg hover:bg-hospital-50 transition-all flex items-center space-x-2 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Book Appointment</span>
                </button>
              </div>
            </div>

            {/* Statistics KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Upcoming */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upcoming</span>
                  <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    {appointments.filter(a => a.status === 'Scheduled').length}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Active scheduled OPD visits</p>
                </div>
              </div>

              {/* Completed */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</span>
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    {appointments.filter(a => a.status === 'Completed').length}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Finished consultations</p>
                </div>
              </div>

              {/* Cancelled */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelled</span>
                  <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    {appointments.filter(a => a.status === 'Cancelled').length}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Cancelled appointment logs</p>
                </div>
              </div>

              {/* Next Appointment */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Visit</span>
                  <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  {(() => {
                    const scheduled = appointments
                      .filter(a => a.status === 'Scheduled')
                      .sort((a, b) => new Date(a.appointment_time) - new Date(b.appointment_time));
                    const nextApp = scheduled[0];
                    const docRaw = nextApp?.doctor?.name || '';
                    const formattedDoc = docRaw ? (/^dr\.?/i.test(docRaw.trim()) ? docRaw.trim() : `Dr. ${docRaw.trim()}`) : '';

                    return (
                      <>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white truncate">
                          {nextApp ? new Date(nextApp.appointment_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'None Scheduled'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {nextApp ? formattedDoc : 'No upcoming visit'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Self Check-In Portal Fallback / Banner */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Stethoscope className="h-4 w-4 text-hospital-500" />
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Hospital Clinic Self Check-In</h3>
                </div>
                <p className="text-xs text-slate-400">Already physically at the OPD desk? Check in directly to retrieve your live queue token.</p>
              </div>

              <form onSubmit={handleSelfCheckIn} className="flex items-center space-x-3 w-full md:w-auto">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-hospital-500"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-hospital-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-hospital-600 transition-all shadow-sm whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading ? 'Checking In...' : 'Check In Now'}
                </button>
              </form>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctor name or department..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-2xl text-xs outline-none focus:ring-2 focus:ring-hospital-500 text-slate-800 dark:text-white"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto scrollbar-none">
                {['All', 'Scheduled', 'Completed', 'Cancelled'].map(status => {
                  const isActive = appointmentStatusFilter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setAppointmentStatusFilter(status)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-hospital-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-50 dark:bg-slate-800/40'}`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Appointments Grid */}
            {(() => {
              const filteredList = appointments.filter(app => {
                const matchesSearch = !appointmentSearch || 
                  (app.doctor?.name && app.doctor.name.toLowerCase().includes(appointmentSearch.toLowerCase())) ||
                  (app.doctor?.department?.name && app.doctor.department.name.toLowerCase().includes(appointmentSearch.toLowerCase()));
                
                const matchesStatus = appointmentStatusFilter === 'All' || app.status === appointmentStatusFilter;

                return matchesSearch && matchesStatus;
              });

              if (loading) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse"></div>
                    ))}
                  </div>
                );
              }

              if (filteredList.length === 0) {
                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-sm">
                    <div className="h-16 w-16 bg-hospital-50 dark:bg-hospital-950 rounded-2xl flex items-center justify-center mx-auto text-hospital-500">
                      <Calendar className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-extrabold text-base text-slate-800 dark:text-white">No Appointments Found</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No appointments match your current search or status filter. Try clearing your filters or schedule a new consultation.
                      </p>
                    </div>
                    {(appointmentSearch || appointmentStatusFilter !== 'All') ? (
                      <button
                        onClick={() => { setAppointmentSearch(''); setAppointmentStatusFilter('All'); }}
                        className="text-xs font-bold text-hospital-600 dark:text-hospital-400 hover:underline"
                      >
                        Reset All Filters
                      </button>
                    ) : (
                      <button
                        onClick={() => setBookingModal(true)}
                        className="bg-hospital-500 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-hospital-600 transition-all inline-flex items-center space-x-1.5 shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Schedule Appointment</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredList.map(app => {
                    const activeQueue = stats?.active_tokens?.find(
                      token => token.doctor_id === app.doctor_id ||
                        (token.doctor_id === null && token.department_name === app.doctor?.department?.name)
                    );

                    const isScheduled = app.status === 'Scheduled';
                    const isCompleted = app.status === 'Completed';

                    const rawName = app.doctor?.name || '';
                    const doctorDisplayName = rawName ? (/^dr\.?/i.test(rawName.trim()) ? rawName.trim() : `Dr. ${rawName.trim()}`) : 'Physician Specialist';

                    return (
                      <div
                        key={app.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-full space-y-4 group"
                      >
                        <div className="space-y-4">
                          {/* Header: Dept & Status Pill */}
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-hospital-500 dark:text-hospital-400 block">
                                {app.doctor?.department?.name || 'Medical Department'}
                              </span>
                              <h3 className="font-extrabold text-base text-slate-800 dark:text-white group-hover:text-hospital-600 dark:group-hover:text-hospital-400 transition-colors">
                                {doctorDisplayName}
                              </h3>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isScheduled ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40' : isCompleted ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
                              {app.status}
                            </span>
                          </div>

                          {/* Date, Time & Location Grid */}
                          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-slate-150 dark:border-slate-800 text-xs">
                            <div className="flex items-center space-x-2.5">
                              <Calendar className="h-4 w-4 text-hospital-500 shrink-0" />
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">Date</span>
                                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                  {new Date(app.appointment_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </strong>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2.5">
                              <Clock className="h-4 w-4 text-hospital-500 shrink-0" />
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">Time</span>
                                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                                  {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </strong>
                              </div>
                            </div>

                            <div className="col-span-2 pt-2 border-t border-slate-150 dark:border-slate-800/60 flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 font-bold uppercase">Consultation Suite</span>
                              <span className="font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                Room #{activeQueue?.room_number || app.doctor?.room_number || '102'} (OPD Main)
                              </span>
                            </div>
                          </div>

                          {/* Live Queue Status Badge */}
                          <div className="text-xs bg-slate-50/40 dark:bg-slate-800/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-1.5">
                            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <span>Live Queue Token</span>
                              <span className={`px-2 py-0.5 rounded font-extrabold ${activeQueue ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                {activeQueue ? activeQueue.status : 'Scheduled'}
                              </span>
                            </div>

                            {activeQueue ? (
                              <div className="flex justify-between items-center text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400">Token ID:</span>
                                  <strong className="text-hospital-600 dark:text-hospital-400 font-black ml-1">#{activeQueue.token_number}</strong>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400">Status:</span>
                                  <strong className="text-slate-800 dark:text-slate-200 font-bold ml-1">
                                    {activeQueue.status === 'Calling' ? 'Calling Next!' : `Pos #${activeQueue.position}`}
                                  </strong>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 text-center">
                                No active live queue token issued yet.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Natural Fitted Action Buttons */}
                        <div className="flex items-center space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                          <button
                            onClick={() => setViewingAppointment(app)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-hospital-50 hover:bg-hospital-100 dark:bg-hospital-950/30 dark:hover:bg-hospital-950/50 text-hospital-600 dark:text-hospital-400 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                          >
                            View Details
                          </button>

                          {isScheduled && (
                            <>
                              <button
                                onClick={() => {
                                  setRescheduleId(app.id);
                                  setRescheduleTime(app.appointment_time.slice(0, 16));
                                }}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                              >
                                Reschedule
                              </button>

                              <button
                                onClick={() => handleCancelAppointment(app.id)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        )}

          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- CURRENT PRESCRIPTION TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'prescription' && (
          <div className="space-y-6">
            {latestVisit ? (
              <div id="prescription-print-area" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">

                {/* Hospital Header Banner */}
                <div className="flex justify-between items-start border-b-2 border-slate-100 dark:border-slate-800 pb-6 gap-4">
                  <div>
                    <h1 className="text-xl font-black text-hospital-600 dark:text-hospital-400 tracking-tight">AcuraQueue Medical Center</h1>
                    <p className="text-xs text-slate-400">100 Innovation Parkway, Suite A • +1 (555) 0122</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p><strong>Prescription ID:</strong> RX-{latestVisit.id}</p>
                    <p><strong>Visit Date:</strong> {new Date(latestVisit.visit_date).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Patient & Doctor metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40 text-xs">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Patient Details</h3>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-white">{patient?.name}</p>
                    <p className="text-slate-600 dark:text-slate-400">Age: {patient?.age} • Gender: {patient?.gender} • Blood Group: {patient?.blood_group || 'O+'}</p>
                    {patient?.allergies && <p className="text-rose-500 font-medium">Allergies: {patient.allergies}</p>}
                  </div>
                  <div className="space-y-1 text-left md:text-right">
                    <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Prescribing Physician</h3>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-white">Dr. {latestVisit.doctor?.name || 'Doctor'}</p>
                    <p className="text-slate-600 dark:text-slate-400">{latestVisit.department} Department</p>
                  </div>
                </div>

                {/* Complaint & Diagnosis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chief Complaint</span>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl leading-relaxed text-slate-700 dark:text-slate-300 min-h-[50px]">
                      {latestVisit.chief_complaint || 'Patient reported symptoms.'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diagnosis</span>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl leading-relaxed text-slate-800 dark:text-slate-100 font-semibold min-h-[50px]">
                      {latestVisit.diagnosis || 'None recorded.'}
                    </div>
                  </div>
                </div>

                {/* Medicines List */}
                <div className="space-y-3">
                  <span className="text-[10px] text-hospital-500 dark:text-hospital-400 font-bold uppercase tracking-wider block">Prescribed Medication Items (Rx)</span>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                          <th className="py-3 px-4">Medicine Name</th>
                          <th className="py-3 px-4">Dosage</th>
                          <th className="py-3 px-4">Frequency</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">Special Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestVisit.prescriptions.map((med) => (
                          <tr key={med.id} className="border-b border-slate-100 dark:border-slate-800/30">
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">{med.medicine_name}</td>
                            <td className="py-3.5 px-4">{med.dosage}</td>
                            <td className="py-3.5 px-4">{med.frequency}</td>
                            <td className="py-3.5 px-4 font-semibold text-hospital-600 dark:text-hospital-400">{med.duration}</td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{med.instructions || 'Take as directed.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Doctor Notes */}
                {latestVisit.doctor_notes && (
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Doctor Advice & Recommendations</span>
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800 p-4 rounded-xl leading-relaxed">
                      {latestVisit.doctor_notes}
                    </div>
                  </div>
                )}

                {/* Action buttons (Print, Download) */}
                <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800 no-print">
                  <button
                    onClick={printPrescription}
                    className="flex-grow md:flex-grow-0 bg-hospital-500 hover:bg-hospital-600 text-white font-semibold py-2.5 px-5 rounded-xl shadow transition-all flex items-center justify-center space-x-2 text-xs hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Prescription</span>
                  </button>
                  <button
                    onClick={downloadPrescriptionFile}
                    className="flex-grow md:flex-grow-0 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center space-x-2 text-xs text-slate-700 dark:text-slate-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center space-y-4">
                <div className="inline-flex bg-hospital-50 dark:bg-hospital-950 p-5 rounded-full text-hospital-500">
                  <Clipboard className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold">No prescriptions found</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Once your physician completes your consultation and issues a prescription, it will render here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- VISIT / MEDICAL HISTORY TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Filter controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
              <div className="relative w-full md:w-72">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs focus:ring-1 focus:ring-hospital-500 outline-none"
                  placeholder="Search diagnosis..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Dept:</span>
                  <select
                    value={historyDeptFilter}
                    onChange={(e) => setHistoryDeptFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs w-24 md:w-28"
                  >
                    <option value="">All</option>
                    {Array.from(new Set(visits.map(v => v.department).filter(Boolean))).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Doctor:</span>
                  <select
                    value={historyDocFilter}
                    onChange={(e) => setHistoryDocFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs w-24 md:w-28"
                  >
                    <option value="">All</option>
                    {Array.from(new Set(visits.map(v => v.doctor?.name).filter(Boolean))).map(docName => (
                      <option key={docName} value={docName}>Dr. {docName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">Date:</span>
                  <input
                    type="date"
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs w-28 md:w-32 focus:ring-1 focus:ring-hospital-500 outline-none"
                  />
                </div>

                {(historySearch || historyDeptFilter || historyDocFilter || historyDateFilter) && (
                  <button
                    onClick={() => {
                      setHistorySearch('');
                      setHistoryDeptFilter('');
                      setHistoryDocFilter('');
                      setHistoryDateFilter('');
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Visit timeline */}
            {filteredVisits.length > 0 ? (
              <div className="space-y-6">
                {filteredVisits.map((record) => {
                  const isExpanded = !!expandedVisits[record.id];

                  return (
                    <div
                      key={record.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-3xl p-5 hover:border-hospital-500 bg-white dark:bg-slate-900 shadow-sm relative transition-all"
                    >
                      <div className="flex justify-between items-start pb-3 mb-2 gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="bg-hospital-50 dark:bg-hospital-950 p-2 rounded-xl text-hospital-600 dark:text-hospital-400">
                            <Activity className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm">Dr. {record.doctor?.name || 'Physician'}</h4>
                            <span className="text-xs text-slate-400 block">{record.department} Department</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block">
                            {new Date(record.visit_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100/50 dark:border-slate-800/50">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Diagnosis</span>
                          <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{record.diagnosis || 'None diagnosed'}</span>
                        </div>
                        <button
                          onClick={() => setExpandedVisits(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                          className="text-xs font-semibold py-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 transition-all flex items-center space-x-1"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                          <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Chief Complaint</span>
                              <div className="bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl min-h-[50px] leading-relaxed">
                                {record.chief_complaint || 'No complaint details recorded.'}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Clinical Notes</span>
                              <div className="bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl min-h-[50px] leading-relaxed">
                                {record.doctor_notes || 'No notes recorded.'}
                              </div>
                            </div>
                          </div>

                          {record.prescriptions && record.prescriptions.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-hospital-500 dark:text-hospital-400 font-bold uppercase block">Prescribed Medication List</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {record.prescriptions.map(med => (
                                  <div key={med.id} className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/20 rounded-xl text-xs flex justify-between items-center">
                                    <div>
                                      <span className="font-extrabold block text-slate-700 dark:text-slate-200">{med.medicine_name}</span>
                                      <span className="text-[10px] text-slate-400">{med.dosage} • {med.frequency}</span>
                                    </div>
                                    <span className="text-[10px] bg-hospital-50 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-400 font-extrabold px-2 py-0.5 rounded">
                                      {med.duration}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {record.follow_up_date && (
                            <div className="text-xs bg-hospital-50/30 dark:bg-hospital-950/10 p-2.5 rounded-xl border border-hospital-100/30 dark:border-hospital-900/10 font-semibold text-hospital-600 dark:text-hospital-400">
                              Follow-up Visit Scheduled: {new Date(record.follow_up_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
                No past consultations found matching the filters.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- MEDICINES LOG TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'medicines' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 dark:border-slate-800 pb-3 gap-4">
              <h2 className="text-lg font-bold">Historical Medication Tracker</h2>
              <div className="relative w-full sm:w-60">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={medicineSearch}
                  onChange={(e) => setMedicineSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl text-xs outline-none focus:ring-1 focus:ring-hospital-500"
                  placeholder="Filter by medicine name..."
                />
              </div>
            </div>

            {filteredPrescriptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                      <th className="py-3 px-4">Medicine Name</th>
                      <th className="py-3 px-4">Dosage / Frequency</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Prescribed Date</th>
                      <th className="py-3 px-4">Prescribing Doctor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrescriptions.map((med, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">{med.medicine_name}</td>
                        <td className="py-3.5 px-4">{med.dosage} ({med.frequency})</td>
                        <td className="py-3.5 px-4 font-semibold text-hospital-600 dark:text-hospital-400">{med.duration}</td>
                        <td className="py-3.5 px-4 text-slate-500">{new Date(med.prescribed_date).toLocaleDateString()}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">Dr. {med.doctor_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No prescribed medicines match your query.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- LABORATORY REPORTS TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'reports' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <h2 className="text-lg font-bold border-b border-slate-100 dark:border-slate-800 pb-3">Diagnostic Laboratory Reports</h2>

            {reports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports.map((rep) => (
                  <div key={rep.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center bg-slate-50/10 dark:bg-slate-800/10 hover:shadow-sm transition-all">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded bg-hospital-50 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400 font-bold uppercase tracking-wider text-[8px]">
                        {rep.report_type}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{rep.report_name}</h4>
                      <span className="text-[10px] text-slate-400 block font-semibold">Uploaded: {new Date(rep.upload_date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => window.open(patientService.getReportPdfUrl(rep.id), '_blank')}
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 rounded-xl transition-all hover:scale-105 active:scale-95"
                        title="Preview Report"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => window.open(patientService.getReportPdfUrl(rep.id), '_blank')}
                        className="p-2 bg-hospital-500 hover:bg-hospital-600 text-white rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
                        title="Download Report"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No lab or diagnostic test reports found in your records.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- NOTIFICATIONS TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <h2 className="text-lg font-bold border-b border-slate-100 dark:border-slate-800 pb-3">Notification Logs</h2>

            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10 flex items-start space-x-3.5">
                    <div className="bg-hospital-100 dark:bg-hospital-950 p-2.5 rounded-xl text-hospital-600 dark:text-hospital-400 mt-0.5">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 flex-grow">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{notif.title || 'Notification'}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold">{new Date(notif.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No notifications logged.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- MY PROFILE TAB ---------------- */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* ---------------- MY PROFILE TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-6">

            {/* Profile Hero Header Card */}
            <div className="relative rounded-3xl bg-gradient-to-r from-hospital-600 via-hospital-500 to-indigo-600 dark:from-slate-900 dark:via-hospital-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl overflow-hidden border border-hospital-400/20 dark:border-slate-800">
              <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-hospital-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center space-x-5">
                  <div className="relative">
                    <div className="bg-white/20 p-1 rounded-3xl backdrop-blur-md shadow-lg">
                      {patient?.profile_photo ? (
                        <img
                          src={patient.profile_photo}
                          alt={patient?.name}
                          className="h-20 w-20 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black">
                          {patient?.name ? patient.name.charAt(0).toUpperCase() : <User className="h-9 w-9" />}
                        </div>
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-slate-900 font-bold" />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        Verified Patient
                      </span>
                      <span className="text-[10px] text-hospital-100 dark:text-slate-400 font-semibold">
                        ID: #{patient?.id}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      {patient?.name || 'Patient Profile'}
                    </h1>

                    <p className="text-xs text-hospital-100 dark:text-slate-300 flex items-center space-x-2">
                      <span>Registered Patient</span>
                      <span>•</span>
                      <span>{patient?.created_at ? `Member since ${new Date(patient.created_at).toLocaleDateString()}` : 'Active Account'}</span>
                    </p>
                  </div>
                </div>

                {/* Mode Toggle Switch Button */}
                <div className="shrink-0 flex items-center bg-white/10 dark:bg-slate-800/60 p-1.5 rounded-2xl backdrop-blur-md border border-white/20 dark:border-slate-700/60">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!editingProfile ? 'bg-white text-hospital-600 shadow-md' : 'text-white/80 hover:text-white'}`}
                  >
                    View Mode
                  </button>
                  <button
                    onClick={() => setEditingProfile(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${editingProfile ? 'bg-white text-hospital-600 shadow-md' : 'text-white/80 hover:text-white'}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>
            </div>

            {/* VIEW MODE */}
            {!editingProfile ? (
              <div className="space-y-6">

                {/* Personal Information Cards */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Personal Information</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20 hover:border-hospital-300 dark:hover:border-hospital-700 transition-all space-y-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Full Name</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block">{patient?.name || 'N/A'}</strong>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20 hover:border-hospital-300 dark:hover:border-hospital-700 transition-all space-y-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Age & Gender</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block">{patient?.age ? `${patient.age} yrs` : 'N/A'} • {patient?.gender || 'N/A'}</strong>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20 hover:border-hospital-300 dark:hover:border-hospital-700 transition-all space-y-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Mobile Phone</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block">{patient?.mobile_number || 'N/A'}</strong>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20 hover:border-hospital-300 dark:hover:border-hospital-700 transition-all space-y-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Email Address</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100 block truncate">{patient?.email || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Medical Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Emergency Contact Card */}
                  <div className="bg-rose-50/30 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Emergency Contact</span>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Primary Designation</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-150 dark:border-rose-900/30 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact Detail</span>
                      <strong className="text-base font-black text-rose-600 dark:text-rose-400 block">
                        {patient?.emergency_contact || 'No emergency contact registered'}
                      </strong>
                    </div>
                  </div>

                  {/* Blood Group Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-2xl bg-hospital-50 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400">
                        <Heart className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-hospital-500 block">Medical Profile</span>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Blood Group</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Registered Type</span>
                        <span className="text-xs text-slate-500">Emergency compatible</span>
                      </div>
                      <span className="text-2xl font-black text-hospital-600 dark:text-hospital-400 bg-hospital-50 dark:bg-hospital-950 px-4 py-1 rounded-xl border border-hospital-200 dark:border-hospital-800">
                        {patient?.blood_group || 'O+'}
                      </span>
                    </div>
                  </div>

                  {/* Allergies Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block">Clinical Alerts</span>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Known Allergies</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 min-h-[60px] flex items-center">
                      {patient?.allergies ? (
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 leading-relaxed">
                          {patient.allergies}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 font-medium">
                          No known drug or food allergies on record.
                        </p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Health Records Summary */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Health Summary Metrics</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinical Log</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800 flex items-center space-x-3">
                      <div className="bg-blue-50 dark:bg-blue-950 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-xl font-black text-slate-800 dark:text-white block">{visits?.length || 0}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Medical Consultations</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800 flex items-center space-x-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <Pill className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-xl font-black text-slate-800 dark:text-white block">{prescriptions?.length || 0}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Active Medications</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-800 flex items-center space-x-3">
                      <div className="bg-purple-50 dark:bg-purple-950 p-2.5 rounded-xl text-purple-600 dark:text-purple-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-xl font-black text-slate-800 dark:text-white block">{reports?.length || 0}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Laboratory Reports</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* EDIT MODE */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Edit Patient Information</h3>
                    <p className="text-xs text-slate-400">Update personal, contact, and medical details</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-hospital-50 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400">
                    Editing Mode
                  </span>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6 text-xs">
                  
                  {/* Section 1: Personal Details */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-hospital-500 uppercase tracking-widest block">Personal Information</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">FULL NAME</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                          placeholder="e.g. Jane Doe"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">AGE (YEARS)</label>
                        <input
                          type="number"
                          value={profileForm.age}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                          placeholder="e.g. 32"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">GENDER</label>
                        <select
                          value={profileForm.gender}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">BLOOD GROUP</label>
                        <select
                          value={profileForm.blood_group}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, blood_group: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Contact Details */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-hospital-500 uppercase tracking-widest block">Contact & Emergency Details</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">MOBILE PHONE NUMBER</label>
                        <input
                          type="text"
                          value={profileForm.mobile_number}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, mobile_number: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                          placeholder="e.g. +1 555-0199"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold block">EMAIL ADDRESS</label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                          placeholder="e.g. patient@example.com"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="text-slate-400 font-bold block">PRIMARY EMERGENCY CONTACT</label>
                        <input
                          type="text"
                          value={profileForm.emergency_contact}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                          placeholder="e.g. John Doe (Spouse) - +1 555-0122"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Clinical Alerts */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">Medical Allergies</span>
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold block">KNOWN DRUG OR FOOD ALLERGIES</label>
                      <input
                        type="text"
                        value={profileForm.allergies}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-2 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white transition-all"
                        placeholder="e.g. Penicillin, Peanuts, Aspirin"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-hospital-500 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-hospital-600 shadow-md transition-all flex items-center space-x-2 text-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm({
                          name: patient.name || '',
                          email: patient.email || '',
                          mobile_number: patient.mobile_number || '',
                          blood_group: patient.blood_group || '',
                          allergies: patient.allergies || '',
                          emergency_contact: patient.emergency_contact || '',
                          age: patient.age || '',
                          gender: patient.gender || ''
                        });
                        setEditingProfile(false);
                      }}
                      className="border border-slate-200 dark:border-slate-800 font-bold py-2.5 px-6 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </div>

                </form>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- DISEASE DIAGNOSIS TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-6">

            {/* Sub-tab headers */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px mb-4">
              <button
                onClick={() => setDiagnosisSubTab('new')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${diagnosisSubTab === 'new' ? 'border-hospital-500 text-hospital-600 dark:text-hospital-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                New AI Analysis
              </button>
              <button
                onClick={() => {
                  setDiagnosisSubTab('history');
                  patientService.getPredictionHistory().then(setPredictionHistory).catch(console.error);
                }}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${diagnosisSubTab === 'history' ? 'border-hospital-500 text-hospital-600 dark:text-hospital-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Prediction History Log
              </button>
            </div>

            {/* Sub-tab: New Prediction */}
            {diagnosisSubTab === 'new' && (
              <div className="space-y-6">

                {/* Intro Card */}
                {!diagnosisResult && !diagnosisLoading && (
                  <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Brain className="h-5 w-5 text-purple-200" />
                          <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">Ensemble Machine Learning</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">AI Disease Predictor</h2>
                        <p className="text-sm text-purple-200 max-w-lg">
                          Select your current symptoms and enter vital metrics. Our clinical ensemble model will evaluate and match indicators against optimized ML algorithms.
                        </p>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm hidden md:block">
                        <Stethoscope className="h-10 w-10 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Selector and Vitals view */}
                {!diagnosisResult && !diagnosisLoading && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Symptoms Selector */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <h3 className="font-extrabold text-sm">Select Symptoms</h3>
                          <p className="text-[10px] text-slate-400">Search and select all that apply</p>
                        </div>
                        {selectedSymptoms.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSymptoms([])}
                            className="text-xs font-bold text-rose-500 hover:underline"
                          >
                            Clear All ({selectedSymptoms.length})
                          </button>
                        )}
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search symptoms (e.g. fever, chest pain, coughing)..."
                          value={symptomSearch}
                          onChange={(e) => setSymptomSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-xs"
                        />
                      </div>

                      {/* Selected Symptoms Chips */}
                      {selectedSymptoms.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800">
                          {selectedSymptoms.map((sym) => (
                            <span
                              key={sym}
                              className="bg-hospital-50 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-400 border border-hospital-100 dark:border-hospital-900/30 text-xs font-semibold pl-3 pr-1.5 py-1 rounded-full flex items-center space-x-1"
                            >
                              <span>{sym}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedSymptoms(prev => prev.filter(s => s !== sym))}
                                className="hover:bg-hospital-100 dark:hover:bg-hospital-900 rounded-full p-0.5 text-hospital-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Symptoms Checklist */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                        {allSymptoms
                          .filter(sym => sym.toLowerCase().includes(symptomSearch.toLowerCase()))
                          .map((sym) => {
                            const isSelected = selectedSymptoms.includes(sym);
                            return (
                              <label
                                key={sym}
                                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-hospital-300 dark:hover:border-hospital-700 ${isSelected ? 'bg-hospital-50/20 dark:bg-hospital-950/20 border-hospital-300 dark:border-hospital-700' : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedSymptoms(prev => prev.filter(s => s !== sym));
                                    } else {
                                      setSelectedSymptoms(prev => [...prev, sym]);
                                    }
                                  }}
                                  className="w-4 h-4 accent-hospital-600 rounded"
                                />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{sym}</span>
                              </label>
                            );
                          })}
                      </div>

                      {/* Predict Submit */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button
                          type="button"
                          onClick={handleDiagnosis}
                          disabled={selectedSymptoms.length === 0}
                          className="bg-hospital-500 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-hospital-600 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Brain className="h-4 w-4" />
                          <span>Predict Disease</span>
                        </button>
                      </div>
                    </div>

                    {/* Vitals Panel */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 self-start">
                      <button
                        type="button"
                        onClick={() => setVitalsCollapsed(prev => !prev)}
                        className="w-full flex justify-between items-center text-left"
                      >
                        <div>
                          <h3 className="font-extrabold text-sm">Clinical Vitals</h3>
                          <p className="text-[10px] text-slate-400">Prefilled with patient normal values</p>
                        </div>
                        <span className="text-xs font-bold text-hospital-500 hover:underline">
                          {vitalsCollapsed ? "Edit Vitals" : "Minimize"}
                        </span>
                      </button>

                      {!vitalsCollapsed ? (
                        <form className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                          {[
                            { key: 'age', label: 'Age (years)', type: 'number', placeholder: '30' },
                            { key: 'bmi', label: 'BMI (kg/m²)', type: 'number', placeholder: '24.5', step: '0.1' },
                            { key: 'blood_glucose', label: 'Blood Glucose (mg/dL)', type: 'number', placeholder: '90' },
                            { key: 'heart_rate', label: 'Heart Rate (BPM)', type: 'number', placeholder: '75' },
                            { key: 'temperature', label: 'Body Temp (°F)', type: 'number', placeholder: '98.2', step: '0.1' },
                            { key: 'systolic_bp', label: 'Systolic BP (mmHg)', type: 'number', placeholder: '115' }
                          ].map(({ key, label, type, placeholder, step }) => (
                            <div key={key} className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{label}</label>
                              <input
                                type={type}
                                step={step || '1'}
                                placeholder={placeholder}
                                value={vitalsForm[key]}
                                onChange={(e) => setVitalsForm(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 bg-white dark:bg-slate-900"
                              />
                            </div>
                          ))}
                        </form>
                      ) : (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Age</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.age || patient?.age || '30'} yrs</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">BMI</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.bmi || '24.5'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Glucose</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.blood_glucose || '90'} mg/dL</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Heart Rate</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.heart_rate || '75'} BPM</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {diagnosisLoading && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6 animate-pulse">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Brain className="h-8 w-8 text-slate-300" />
                      </div>
                      <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                      <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/80 rounded-md"></div>
                    </div>
                  </div>
                )}

                {/* Diagnosis Results Card */}
                {diagnosisResult && (
                  <div id="prediction-report-print" className="space-y-6 animate-fadeIn">
                    <div className="flex justify-between items-center print:hidden">
                      <button
                        onClick={() => setDiagnosisResult(null)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 flex items-center space-x-1"
                      >
                        <span>← Back to Diagnosis</span>
                      </button>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={printPredictionReport}
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Print / Download PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
                        <div>
                          <span className="text-[9px] font-black text-hospital-500 uppercase tracking-widest block mb-1">AI Ensemble Prediction Report</span>
                          <h2 className="text-3xl font-black tracking-tight">{diagnosisResult.predicted_disease}</h2>
                          {diagnosisResult.details && (
                            <p className="text-xs text-slate-400 mt-1">
                              Specialty Department: <strong>{diagnosisResult.details.department} ({diagnosisResult.details.specialist})</strong>
                            </p>
                          )}
                        </div>

                        <div className="text-left md:text-right text-xs text-slate-500">
                          <span className="block font-bold">Prediction ID: #{diagnosisResult.id || "TEMP"}</span>
                          <span className="block mt-0.5">Date: {new Date(diagnosisResult.prediction_time).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Details lookup sections */}
                      {diagnosisResult.details && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                          <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-2">
                              <h4 className="font-extrabold text-sm text-hospital-600 dark:text-hospital-400 flex items-center space-x-1.5">
                                <Info className="h-4 w-4" />
                                <span>Condition Profile</span>
                              </h4>
                              <p className="text-slate-600 dark:text-slate-300">{diagnosisResult.details.description}</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                              <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center space-x-1.5">
                                <Heart className="h-4 w-4" />
                                <span>Precautions</span>
                              </h4>
                              <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-0.5">
                                {diagnosisResult.details.precautions.map((p, idx) => (
                                  <li key={idx}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab: History Log */}
            {diagnosisSubTab === 'history' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">Past Prediction Logs</h3>
                {predictionHistory.length > 0 ? (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[9px]">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Condition</th>
                          <th className="py-2.5 px-3">Confidence</th>
                          <th className="py-2.5 px-3">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionHistory.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/40">
                            <td className="py-2.5 px-3">{new Date(item.prediction_time).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3 font-bold">{item.predicted_disease}</td>
                            <td className="py-2.5 px-3 font-semibold">{Math.round(item.confidence * 100)}%</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800">
                                {item.risk_level}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No past predictions recorded.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ---------------- AI HEALTH PORTAL TAB ---------------- */}
        {/* ========================================================= */}
        {activeTab === 'ai_portal' && patient && (
          <PatientAIPortal patientId={patient.id} />
        )}

      </div>

      {/* ---------------- BOOKING APPOINTMENT MODAL ---------------- */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-4 animate-scaleUp">
            <h3 className="font-extrabold text-base border-b border-slate-100 dark:border-slate-800 pb-3 text-slate-800 dark:text-white">Book New Consultation</h3>

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">SELECT DOCTOR / PHYSICIAN</label>
                <select
                  value={bookingForm.doctor_id}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, doctor_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                >
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>Dr. {doc.name} ({doc.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">APPOINTMENT TYPE</label>
                <select
                  value={bookingForm.appointment_type}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, appointment_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                >
                  <option value="Scheduled">Scheduled Visit</option>
                  <option value="Walk-in">Walk-in Checkup</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">DATE & TIME</label>
                <input
                  type="datetime-local"
                  value={bookingForm.appointment_time}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, appointment_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-grow bg-hospital-500 text-white font-semibold py-2 rounded-xl hover:bg-hospital-600 transition-colors shadow-sm"
                >
                  Confirm Booking
                </button>
                <button
                  type="button"
                  onClick={() => setBookingModal(false)}
                  className="border border-slate-200 dark:border-slate-800 font-semibold py-2 px-5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- RESCHEDULING MODAL ---------------- */}
      {rescheduleId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-4 animate-scaleUp">
            <h3 className="font-extrabold text-base border-b border-slate-100 dark:border-slate-800 pb-3 text-slate-800 dark:text-white">Reschedule Appointment</h3>

            <form onSubmit={handleReschedule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">NEW DATE & TIME</label>
                <input
                  type="datetime-local"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-grow bg-hospital-500 text-white font-semibold py-2 rounded-xl hover:bg-hospital-600 transition-colors shadow-sm"
                >
                  Save Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setRescheduleId(null)}
                  className="border border-slate-200 dark:border-slate-800 font-semibold py-2 px-5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- VIEW APPOINTMENT DETAILS MODAL ---------------- */}
      {viewingAppointment && (() => {
        const activeQueue = stats?.active_tokens?.find(
          token => token.doctor_id === viewingAppointment.doctor_id ||
            (token.doctor_id === null && token.department_name === viewingAppointment.doctor?.department?.name)
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg space-y-5 animate-scaleUp">

              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-white">Appointment Details</h3>
                  <span className="text-[10px] text-slate-400">ID: APP-{viewingAppointment.id}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${viewingAppointment.status === 'Scheduled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {viewingAppointment.status}
                </span>
              </div>

              {/* Doctor Details */}
              <div className="bg-slate-50/50 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl flex items-center space-x-3.5">
                <div className="bg-hospital-100 dark:bg-hospital-950 p-3 rounded-xl text-hospital-600 dark:text-hospital-400">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Assigned Physician</span>
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Dr. {viewingAppointment.doctor?.name}</h4>
                  <span className="text-xs text-slate-500 block">{viewingAppointment.doctor?.specialization} • Room {viewingAppointment.doctor?.room_number}</span>
                </div>
              </div>

              {/* Schedule Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block font-bold text-[9px] tracking-wider uppercase">Appointment Date</span>
                  <strong className="text-slate-800 dark:text-white text-sm block mt-0.5">
                    {new Date(viewingAppointment.appointment_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </strong>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block font-bold text-[9px] tracking-wider uppercase">Appointment Time</span>
                  <strong className="text-slate-800 dark:text-white text-sm block mt-0.5">
                    {new Date(viewingAppointment.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
              </div>

              {/* Live Queue Status */}
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-3">
                <span className="text-[10px] text-hospital-500 font-bold uppercase tracking-wider block">Live Queue Status</span>

                {activeQueue ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-hospital-50/20 dark:bg-hospital-950/10 border border-hospital-100/50 dark:border-hospital-900/30 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">TOKEN</span>
                      <strong className="text-hospital-600 dark:text-hospital-400 font-black text-lg block mt-0.5">{activeQueue.token_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">POSITION</span>
                      <strong className="text-slate-800 dark:text-white font-black text-lg block mt-0.5">
                        {activeQueue.status === 'Calling' ? 'Calling Next!' : `#${activeQueue.position}`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">EST. WAIT TIME</span>
                      <strong className="text-slate-800 dark:text-white font-bold text-sm block mt-1">{activeQueue.status === 'Calling' ? '0 mins' : `${activeQueue.estimated_wait_time.toFixed(0)} mins`}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">STATUS</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold inline-block mt-1.5 uppercase ${activeQueue.status === 'Calling' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                        {activeQueue.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-center space-y-2 text-xs">
                    <p className="text-slate-500 font-medium">Status: Scheduled (Not Checked In)</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                      Please use the Self Check-In Portal on your dashboard once you arrive at the hospital to receive your queue token.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setViewingAppointment(null)}
                  className="bg-hospital-500 hover:bg-hospital-600 text-white font-semibold py-2 px-6 rounded-xl transition-all text-xs"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default PatientDashboard;
