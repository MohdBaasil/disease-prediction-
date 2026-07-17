import React, { useState, useEffect } from 'react';
import { 
  User, Calendar, Clipboard, FileText, Bell, Search, Edit2, 
  Trash2, RefreshCw, Printer, Download, Eye, Plus, ArrowRight,
  CheckCircle, AlertCircle, Clock, Heart, Activity, FileSpreadsheet, ShieldAlert,
  Stethoscope, Brain, AlertTriangle, FlaskConical, Pill, ChevronRight, BarChart3, Info
} from 'lucide-react';
import { 
  patientService, dashboardService, queueService, 
  appointmentsService, doctorService, createQueueWebSocket 
} from '../services/api';

function PatientDashboard() {
  // Tabs: profile, appointments, prescription, history, medicines, reports, notifications, diagnosis
  const [activeTab, setActiveTab] = useState('appointments');
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
  const [expandedVisits, setExpandedVisits] = useState({});
  const [medicineSearch, setMedicineSearch] = useState('');

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
      const updated = await patientService.updateProfile(profileForm);
      setPatient(updated);
      setEditingProfile(false);
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to update profile.');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Determine latest prescription
  const latestVisit = visits.find(v => v.prescriptions && v.prescriptions.length > 0);
  
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 shrink-0 self-start">
        <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="bg-hospital-100 dark:bg-hospital-950 p-2 rounded-xl text-hospital-600 dark:text-hospital-400">
            <User className="h-6 w-6" />
          </div>
          <div>
            <span className="font-bold text-sm block truncate max-w-[150px]">{patient?.name}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Patient ID: {patient?.id}</span>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('appointments')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'appointments' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Calendar className="h-5 w-5" />
          <span>Appointments & Queue</span>
        </button>

        <button 
          onClick={() => setActiveTab('prescription')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'prescription' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Clipboard className="h-5 w-5" />
          <span>Latest Prescription</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Activity className="h-5 w-5" />
          <span>Medical History</span>
        </button>

        <button 
          onClick={() => setActiveTab('medicines')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'medicines' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Heart className="h-5 w-5" />
          <span>Medicine Log</span>
        </button>

        <button 
          onClick={() => setActiveTab('reports')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <FileText className="h-5 w-5" />
          <span>Laboratory Reports</span>
        </button>

        <button 
          onClick={() => setActiveTab('notifications')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all relative ${activeTab === 'notifications' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Bell className="h-5 w-5" />
          <span>Notifications</span>
          {notifications.length > 0 && (
            <span className="absolute right-4 top-3.5 bg-rose-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('diagnosis')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'diagnosis' ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/30' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <Stethoscope className="h-5 w-5" />
          <span>Disease Diagnosis</span>
          <span className="ml-auto text-[8px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-full">Reserved</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${activeTab === 'profile' ? 'bg-hospital-500 text-white shadow-md' : 'text-slate-650 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'}`}
        >
          <User className="h-5 w-5" />
          <span>My Profile</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow space-y-6">
        
        {/* Banner Alert messages */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2 shadow-sm animate-fadeIn">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-2 shadow-sm animate-fadeIn">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ---------------- APPOINTMENTS & QUEUE TAB ---------------- */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            
            {/* Active Queue Ticket (if checked in) */}
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
                        <span className="text-xs text-slate-555 font-semibold block">QUEUE POSITION</span>
                        <span className="text-2xl font-black mt-1 block">
                          {token.status === "Calling" ? "Calling Next!" : `#${token.position}`}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5 block">{token.patients_ahead} patients ahead</span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl text-center col-span-2 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-555 font-semibold">ESTIMATED WAITING TIME</span>
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

            {/* Upcoming Appointments List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-bold">Upcoming Appointments</h2>
                <button 
                  onClick={() => setBookingModal(true)}
                  className="bg-hospital-500 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-hospital-600 transition-all flex items-center space-x-1.5 shadow"
                >
                  <Plus className="h-4 w-4" />
                  <span>Book Appointment</span>
                </button>
              </div>

              {appointments.filter(a => a.status === 'Scheduled').length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appointments.filter(a => a.status === 'Scheduled').map(app => {
                    const activeQueue = stats?.active_tokens?.find(
                      token => token.doctor_id === app.doctor_id || 
                      (token.doctor_id === null && token.department_name === app.doctor?.department?.name)
                    );

                    return (
                      <div key={app.id} className="border border-slate-250 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/10 dark:bg-slate-800/10 space-y-3 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-hospital-500 dark:text-hospital-400 font-bold uppercase tracking-wider">{app.doctor?.department?.name || 'Department'}</span>
                            <h4 className="font-extrabold text-sm mt-0.5">Dr. {app.doctor?.name}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            {app.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 dark:border-slate-800/60 py-2">
                          <div>
                            <span className="text-slate-400 block font-medium">Date</span>
                            <strong className="text-slate-700 dark:text-slate-200">{new Date(app.appointment_time).toLocaleDateString()}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Time</span>
                            <strong className="text-slate-700 dark:text-slate-200">
                              {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </strong>
                          </div>
                        </div>

                        {/* Live Queue Status */}
                        <div className="text-xs bg-slate-50/50 dark:bg-slate-800/25 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 grid grid-cols-2 gap-1.5">
                          <div className="col-span-2 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Live Queue Status</span>
                            <span className={`px-1.5 py-0.5 rounded font-black ${
                              activeQueue ? 'bg-teal-55 text-teal-600 dark:bg-teal-950/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                            }`}>
                              {activeQueue ? activeQueue.status : 'Scheduled'}
                            </span>
                          </div>
                          {activeQueue ? (
                            <>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Token Number</span>
                                <strong className="text-hospital-600 dark:text-hospital-450 text-sm font-black">{activeQueue.token_number}</strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Position / Est. Wait</span>
                                <strong className="text-slate-700 dark:text-slate-200 text-xs block">
                                  {activeQueue.status === 'Calling' ? 'Calling Next!' : `#${activeQueue.position} (${activeQueue.estimated_wait_time.toFixed(0)}m)`}
                                </strong>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2 text-center text-slate-400 text-[10px] py-1">
                              Not Checked In (Check-in available at clinic)
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap md:flex-nowrap justify-between items-center pt-1 gap-2">
                          <button 
                            onClick={() => setViewingAppointment(app)}
                            className="flex-grow text-center text-xs font-semibold py-2 px-2 bg-hospital-50 hover:bg-hospital-100 dark:bg-hospital-950/20 dark:hover:bg-hospital-950/30 text-hospital-600 dark:text-hospital-450 rounded-xl transition-all"
                          >
                            View Appointment
                          </button>
                          <button 
                            onClick={() => {
                              setRescheduleId(app.id);
                              setRescheduleTime(app.appointment_time.slice(0, 16));
                            }}
                            className="text-center text-xs font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                          >
                            Reschedule
                          </button>
                          <button 
                            onClick={() => handleCancelAppointment(app.id)}
                            className="text-center text-xs font-semibold py-2 px-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-450 rounded-xl transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No upcoming appointments scheduled.
                </div>
              )}
            </div>

            {/* Past Appointments List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
              <h2 className="text-lg font-bold border-b border-slate-100 dark:border-slate-800 pb-3">Past / Cancelled Appointments</h2>
              {appointments.filter(a => a.status !== 'Scheduled').length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Doctor</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.filter(a => a.status !== 'Scheduled').map(app => (
                        <tr key={app.id} className="border-b border-slate-100 dark:border-slate-800/30">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {new Date(app.appointment_time).toLocaleDateString()} {new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">Dr. {app.doctor?.name}</td>
                          <td className="py-2.5 px-3">{app.appointment_type}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${app.status === 'Completed' ? 'bg-emerald-55 dark:bg-emerald-950/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-450'}`}>
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No historical appointment logs.
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---------------- CURRENT PRESCRIPTION TAB ---------------- */}
        {activeTab === 'prescription' && (
          <div className="space-y-6">
            
            {latestVisit ? (
              <div id="prescription-print-area" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
                
                {/* Hospital Header Banner */}
                <div className="flex justify-between items-start border-b-2 border-slate-100 dark:border-slate-800 pb-6 gap-4">
                  <div>
                    <h1 className="text-xl font-black text-hospital-600 dark:text-hospital-450 tracking-tight">AcuraQueue Medical Center</h1>
                    <p className="text-xs text-slate-400">100 Innovation Parkway, Suite A • +1 (555) 0122</p>
                  </div>
                  <div className="text-right text-xs text-slate-450">
                    <p><strong>Prescription ID:</strong> RX-{latestVisit.id}</p>
                    <p><strong>Visit Date:</strong> {new Date(latestVisit.visit_date).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Patient & Doctor metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40 text-xs">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Patient details</h3>
                    <p className="text-sm font-extrabold text-slate-850 dark:text-white">{patient?.name}</p>
                    <p className="text-slate-600 dark:text-slate-450">Age: {patient?.age} • Gender: {patient?.gender} • Blood Group: {patient?.blood_group || 'O+'}</p>
                    {patient?.allergies && <p className="text-rose-500 font-medium">Allergies: {patient.allergies}</p>}
                  </div>
                  <div className="space-y-1 text-left md:text-right">
                    <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Prescribing Physician</h3>
                    <p className="text-sm font-extrabold text-slate-850 dark:text-white">Dr. {latestVisit.doctor?.name || 'Doctor'}</p>
                    <p className="text-slate-600 dark:text-slate-450">{latestVisit.department} Department</p>
                  </div>
                </div>

                {/* Complaint & Diagnosis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chief Complaint</span>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl leading-relaxed text-slate-700 dark:text-slate-350 min-h-[50px]">
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
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-250 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px]">
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
                            <td className="py-3.5 px-4 font-semibold text-hospital-600 dark:text-hospital-450">{med.duration}</td>
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{med.instructions || 'Take as directed.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Advice Notes */}
                {latestVisit.doctor_notes && (
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <span className="text-[10px] text-slate-450 font-bold uppercase block">Doctor Advice & Recommendations</span>
                    <div className="text-xs text-slate-650 bg-slate-50/30 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800 p-4 rounded-xl leading-relaxed">
                      {latestVisit.doctor_notes}
                    </div>
                  </div>
                )}

                {/* Action buttons (Print, Download) */}
                <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800 no-print">
                  <button 
                    onClick={printPrescription}
                    className="flex-grow md:flex-grow-0 bg-hospital-500 hover:bg-hospital-600 text-white font-semibold py-2.5 px-5 rounded-xl shadow transition-all flex items-center justify-center space-x-2 text-xs"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Prescription</span>
                  </button>
                  <button 
                    onClick={downloadPrescriptionFile}
                    className="flex-grow md:flex-grow-0 border border-slate-250 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-850 font-semibold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center space-x-2 text-xs"
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

        {/* ---------------- VISIT/MEDICAL HISTORY TAB ---------------- */}
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
                  <span className="text-xs text-slate-450 font-semibold shrink-0">Dept:</span>
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
                  <span className="text-xs text-slate-450 font-semibold shrink-0">Doctor:</span>
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
                  <span className="text-xs text-slate-450 font-semibold shrink-0">Date:</span>
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
                    className="text-xs font-bold text-rose-500 hover:text-rose-650 px-2 py-1"
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
                            <span className="text-xs text-slate-450 block">{record.department} Department</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block">
                            {new Date(record.visit_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Collapsed overview / Expanded details toggle bar */}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100/50 dark:border-slate-800/50">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Diagnosis</span>
                          <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{record.diagnosis || 'None diagnosed'}</span>
                        </div>
                        <button 
                          onClick={() => setExpandedVisits(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                          className="text-xs font-semibold py-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-650 dark:text-slate-400 transition-all flex items-center space-x-1"
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
                              <div className="bg-slate-50/50 dark:bg-slate-850 p-3 rounded-xl min-h-[50px] leading-relaxed">
                                {record.chief_complaint || 'No complaint details recorded.'}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Clinical Notes</span>
                              <div className="bg-slate-50/50 dark:bg-slate-850 p-3 rounded-xl min-h-[50px] leading-relaxed">
                                {record.doctor_notes || 'No notes recorded.'}
                              </div>
                            </div>
                          </div>

                          {record.prescriptions && record.prescriptions.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-hospital-550 dark:text-hospital-400 font-bold uppercase block">Prescribed Medication List</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {record.prescriptions.map(med => (
                                  <div key={med.id} className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850 rounded-xl text-xs flex justify-between items-center">
                                    <div>
                                      <span className="font-extrabold block text-slate-700 dark:text-slate-200">{med.medicine_name}</span>
                                      <span className="text-[10px] text-slate-450">{med.dosage} • {med.frequency}</span>
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
              <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-250 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
                No past consultations found matching the filters.
              </div>
            )}

          </div>
        )}

        {/* ---------------- MEDICINES LOG TAB ---------------- */}
        {activeTab === 'medicines' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-105 dark:border-slate-800 pb-3 gap-4">
              <h2 className="text-lg font-bold">Historical Medication Tracker</h2>
              <div className="relative w-full sm:w-60">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input 
                  type="text" 
                  value={medicineSearch}
                  onChange={(e) => setMedicineSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 dark:border-slate-805 bg-transparent rounded-xl text-xs outline-none focus:ring-1 focus:ring-hospital-500"
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
                        <td className="py-3.5 px-4 font-bold text-slate-850 dark:text-slate-200">{med.medicine_name}</td>
                        <td className="py-3.5 px-4">{med.dosage} ({med.frequency})</td>
                        <td className="py-3.5 px-4 font-semibold text-hospital-600 dark:text-hospital-450">{med.duration}</td>
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

        {/* ---------------- LABORATORY REPORTS TAB ---------------- */}
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
                      <span className="text-[10px] text-slate-450 block font-semibold">Uploaded: {new Date(rep.upload_date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button 
                        onClick={() => window.open(patientService.getReportPdfUrl(rep.id), '_blank')}
                        className="p-2 border border-slate-250 dark:border-slate-800 hover:bg-slate-55 text-slate-650 dark:text-slate-350 rounded-xl"
                        title="Preview Report"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => window.open(patientService.getReportPdfUrl(rep.id), '_blank')}
                        className="p-2 bg-hospital-500 hover:bg-hospital-600 text-white rounded-xl shadow-sm"
                        title="Download Report"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-450 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No lab or diagnostic test reports found in your records.
              </div>
            )}
          </div>
        )}

        {/* ---------------- NOTIFICATIONS TAB ---------------- */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <h2 className="text-lg font-bold border-b border-slate-100 dark:border-slate-800 pb-3">Notification Logs</h2>

            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-4 border border-slate-150 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10 flex items-start space-x-3.5">
                    <div className="bg-hospital-100 dark:bg-hospital-950 p-2.5 rounded-xl text-hospital-600 dark:text-hospital-450 mt-0.5">
                      <Bell className="h-4 w-4 animate-swing" />
                    </div>
                    <div className="space-y-1 flex-grow">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{notif.title || 'Notification'}</h4>
                        <span className="text-[10px] text-slate-450 font-semibold">{new Date(notif.created_at).toLocaleDateString()}</span>
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

        {/* ---------------- PROFILE TAB ---------------- */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold">Patient Profile Information</h2>
              {!editingProfile && (
                <button 
                  onClick={() => setEditingProfile(true)}
                  className="bg-hospital-500 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-hospital-600 transition-all flex items-center space-x-1.5 shadow"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>

            {editingProfile ? (
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">FULL NAME</label>
                  <input 
                    type="text" 
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">EMAIL ADDRESS</label>
                  <input 
                    type="email" 
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">PHONE NUMBER</label>
                  <input 
                    type="text" 
                    value={profileForm.mobile_number}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, mobile_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">AGE</label>
                  <input 
                    type="number" 
                    value={profileForm.age}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">GENDER</label>
                  <select 
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">EMERGENCY CONTACT</label>
                  <input 
                    type="text" 
                    value={profileForm.emergency_contact}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">BLOOD GROUP</label>
                  <select 
                    value={profileForm.blood_group}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, blood_group: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
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
                <div className="space-y-1">
                  <label className="text-slate-450 font-bold block">KNOWN ALLERGIES</label>
                  <input 
                    type="text" 
                    value={profileForm.allergies}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-800 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2 flex space-x-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="bg-hospital-500 text-white font-semibold py-2 px-5 rounded-xl hover:bg-hospital-600 shadow transition-colors"
                  >
                    Save Changes
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
                    className="border border-slate-200 dark:border-slate-800 font-semibold py-2 px-5 rounded-xl text-slate-650 hover:bg-slate-55 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs leading-relaxed">
                {patient?.profile_photo && (
                  <div className="md:col-span-2 lg:col-span-3 flex items-center space-x-4 mb-2 bg-slate-50/50 dark:bg-slate-800/10 p-4 border border-slate-100 dark:border-slate-800 rounded-3xl">
                    <img 
                      src={patient.profile_photo} 
                      alt="Patient Profile" 
                      className="h-16 w-16 rounded-full border-2 border-hospital-500 object-cover shadow-sm"
                    />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{patient.name}</h4>
                      <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Registration Date: {new Date(patient.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Patient ID</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.id}</strong>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Age / Gender</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.age} yrs • {patient?.gender}</strong>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Blood Group</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.blood_group || 'O+'}</strong>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Mobile Phone</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.mobile_number || 'N/A'}</strong>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Email Address</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.email || 'N/A'}</strong>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold tracking-wider uppercase block text-[9px]">Emergency Contact</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{patient?.emergency_contact || 'N/A'}</strong>
                </div>

                {patient?.allergies && (
                  <div className="md:col-span-2 lg:col-span-3 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
                    <span className="text-rose-500 font-bold tracking-wider uppercase block text-[9px] mb-1">Known Drug or Food Allergies</span>
                    <div className="p-3 bg-rose-50/20 dark:bg-rose-950/15 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-450 font-semibold text-xs leading-relaxed">
                      {patient.allergies}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- DISEASE DIAGNOSIS TAB (RESERVED) ---------------- */}
        {/* ---------------- DISEASE DIAGNOSIS TAB ---------------- */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-6">
            
            {/* Tab navigation headers */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px mb-4">
              <button 
                onClick={() => setDiagnosisSubTab('new')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${diagnosisSubTab === 'new' ? 'border-hospital-500 text-hospital-600 dark:text-hospital-450' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                New AI Analysis
              </button>
              <button 
                onClick={() => {
                  setDiagnosisSubTab('history');
                  patientService.getPredictionHistory().then(setPredictionHistory).catch(console.error);
                }}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${diagnosisSubTab === 'history' ? 'border-hospital-500 text-hospital-600 dark:text-hospital-450' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
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
                          Select your current symptoms and enter vital metrics. Our clinical ensemble model will evaluate and match indicators against 3 optimized ML algorithms (Random Forest, Gradient Boosting, and XGBoost).
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
                    
                    {/* Symptoms Selector (Left 2 cols) */}
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
                              className="bg-hospital-50 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-450 border border-hospital-100 dark:border-hospital-900/30 text-xs font-semibold pl-3 pr-1.5 py-1 rounded-full flex items-center space-x-1"
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
                          className="bg-hospital-500 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-hospital-600 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          <Brain className="h-4 w-4" />
                          <span>Predict Disease</span>
                        </button>
                      </div>
                    </div>

                    {/* Vitals Editor Panel (Right 1 col) */}
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
                            <span className="text-[9px] font-bold text-slate-450 block uppercase">Age</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.age || patient?.age || '30'} yrs</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-450 block uppercase">BMI</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.bmi || '24.5'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-450 block uppercase">Glucose</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300">{vitalsForm.blood_glucose || '90'} mg/dL</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-450 block uppercase">Heart Rate</span>
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
                      <div className="w-16 h-16 bg-slate-250 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Brain className="h-8 w-8 text-slate-300" />
                      </div>
                      <div className="h-6 w-48 bg-slate-250 dark:bg-slate-800 rounded-lg"></div>
                      <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/80 rounded-md"></div>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Diagnosis Results Card */}
                {diagnosisResult && (
                  <div id="prediction-report-print" className="space-y-6 animate-fadeIn">
                    
                    {/* Header Controls (hide on print) */}
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

                    {/* Main Prediction Details */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
                      <div className="absolute top-0 right-0 h-32 w-32 bg-hospital-500/5 rounded-full blur-3xl"></div>
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
                        <div>
                          <span className="text-[9px] font-black text-hospital-500 uppercase tracking-widest block mb-1">AI Ensemble Prediction Report</span>
                          <h2 className="text-3xl font-black tracking-tight">{diagnosisResult.predicted_disease}</h2>
                          {diagnosisResult.details && (
                            <p className="text-xs text-slate-400 mt-1">
                              Specialty Specialty: <strong>{diagnosisResult.details.department} ({diagnosisResult.details.specialist})</strong>
                            </p>
                          )}
                        </div>

                        {/* Date Time & ID */}
                        <div className="text-left md:text-right text-xs text-slate-500 dark:text-slate-455">
                          <span className="block font-bold">Prediction ID: #{diagnosisResult.id || "TEMP"}</span>
                          <span className="block mt-0.5">Date: {new Date(diagnosisResult.prediction_time).toLocaleDateString()}</span>
                          <span className="block mt-0.5">Time: {new Date(diagnosisResult.prediction_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Confidence Meter */}
                      {(() => {
                        const score = diagnosisResult.confidence_score !== undefined ? diagnosisResult.confidence_score : diagnosisResult.confidence;
                        const pct = Math.round(score * 100);
                        const isHigh = pct >= 80;
                        const isMed = pct >= 50 && pct < 80;
                        const meterColor = isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-400' : 'bg-rose-500';
                        const textClass = isHigh ? 'text-emerald-600 dark:text-emerald-400' : isMed ? 'text-amber-550 dark:text-amber-450' : 'text-rose-500';
                        const labelText = isHigh ? 'Excellent Confidence' : isMed ? 'Moderate Confidence' : 'Low Confidence';

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            
                            {/* Confidence Gauge */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Model Confidence</span>
                                <span className={`text-xs font-black uppercase tracking-wider ${textClass}`}>{labelText}</span>
                              </div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-black tracking-tight">{pct}%</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">agreement</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mt-3">
                                <div className={`h-full ${meterColor} rounded-full`} style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>

                            {/* Risk Badges */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                              <div>
                                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Risk Evaluation</span>
                                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider inline-block ${
                                  diagnosisResult.risk_level === 'High' || diagnosisResult.risk_level === 'Critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450' :
                                  diagnosisResult.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450' :
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450'
                                }`}>
                                  {diagnosisResult.risk_level} Risk
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Severity Level</span>
                                <span className="text-sm font-bold block">{diagnosisResult.details?.severity || "Mild"}</span>
                              </div>
                            </div>

                            {/* Symptoms list log */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl">
                              <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-2">Evaluated Symptoms</span>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                                {diagnosisResult.symptoms.map(s => (
                                  <span key={s} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-350 text-[9px] font-bold px-2 py-0.5 rounded">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Details lookup sections */}
                      {diagnosisResult.details && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs leading-relaxed">
                          
                          {/* Disease Profile */}
                          <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-2">
                              <h4 className="font-extrabold text-sm text-hospital-600 dark:text-hospital-450 flex items-center space-x-1.5">
                                <Info className="h-4 w-4" />
                                <span>Condition Profile</span>
                              </h4>
                              <p className="text-slate-650 dark:text-slate-300">{diagnosisResult.details.description}</p>
                              <div className="border-t border-slate-100 dark:border-slate-850/80 pt-2 mt-2">
                                <strong className="block text-[10px] text-slate-450 uppercase font-black">Probable Causes</strong>
                                <span className="text-slate-500 dark:text-slate-400 text-xs block">{diagnosisResult.details.causes}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-850/80 pt-2 mt-2">
                                <div>
                                  <strong className="block text-[10px] text-slate-450 uppercase font-black">Recovery Estimation</strong>
                                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold block">Typically 1-2 weeks or managed</span>
                                </div>
                                <div>
                                  <strong className="block text-[10px] text-slate-450 uppercase font-black">Typical Symptoms</strong>
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">{diagnosisResult.details.symptoms}</span>
                                </div>
                              </div>
                            </div>

                            {/* Lifestyle guidance */}
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3">
                              <h4 className="font-extrabold text-sm text-indigo-650 dark:text-indigo-400 flex items-center space-x-1.5">
                                <Heart className="h-4 w-4" />
                                <span>Lifestyle & Recovery Guidance</span>
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <strong className="block text-[10px] text-indigo-500 uppercase font-black mb-1">Recommended Diet</strong>
                                  <span className="text-slate-650 dark:text-slate-350 block">{diagnosisResult.details.diet?.recommended}</span>
                                  {diagnosisResult.details.diet?.avoid && (
                                    <span className="text-rose-500 dark:text-rose-400 block mt-1">Avoid: {diagnosisResult.details.diet.avoid}</span>
                                  )}
                                </div>
                                <div>
                                  <strong className="block text-[10px] text-indigo-500 uppercase font-black mb-1">Workout & Exercise</strong>
                                  <span className="text-slate-650 dark:text-slate-350 block">{diagnosisResult.details.workout}</span>
                                </div>
                              </div>
                              <div className="border-t border-slate-100 dark:border-slate-850/85 pt-2">
                                <strong className="block text-[10px] text-indigo-500 uppercase font-black mb-1">Precautions Checklist</strong>
                                <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-0.5">
                                  {diagnosisResult.details.precautions.map((p, idx) => (
                                    <li key={idx}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* Clinical Interventions */}
                          <div className="space-y-4">
                            
                            {/* Tests & Screenings */}
                            {diagnosisResult.details.tests && diagnosisResult.details.tests.length > 0 && (
                              <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-2">
                                <h4 className="font-extrabold text-sm text-teal-600 dark:text-teal-400 flex items-center space-x-1.5">
                                  <FlaskConical className="h-4 w-4" />
                                  <span>Suggested Clinical Investigations</span>
                                </h4>
                                <div className="space-y-2">
                                  {diagnosisResult.details.tests.map((test, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <strong className="text-slate-700 dark:text-slate-200 block">{test.name}</strong>
                                      <span className="text-[10px] text-slate-450 block mt-0.5">Clinical rationale: {test.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Medicines with Disclaimer */}
                            {diagnosisResult.details.medicines && diagnosisResult.details.medicines.length > 0 && (
                              <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3">
                                <h4 className="font-extrabold text-sm text-rose-600 dark:text-rose-450 flex items-center space-x-1.5">
                                  <Pill className="h-4 w-4" />
                                  <span>Educational Medication Lookup</span>
                                </h4>
                                <div className="space-y-2">
                                  {diagnosisResult.details.medicines.map((med, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-start">
                                      <div>
                                        <strong className="text-slate-700 dark:text-slate-200 block">{med.name}</strong>
                                        <span className="text-[10px] text-slate-400 block">{med.notes}</span>
                                      </div>
                                      <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 px-2.5 py-0.5 rounded whitespace-nowrap">
                                        {med.dosage}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Medicine Warning Disclaimer */}
                                <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span>AI Recommendation Only. Consult Your Doctor Before Taking Any Medicine.</span>
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Educational General Disclaimer */}
                      <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-2xl mx-auto italic">
                          "This prediction is generated by an AI model for educational and decision-support purposes only. It is not a confirmed medical diagnosis. Please consult a qualified doctor before making medical decisions."
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab: History Log */}
            {diagnosisSubTab === 'history' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
                  <div>
                    <h3 className="font-extrabold text-sm">Past Clinical Analyses</h3>
                    <p className="text-[10px] text-slate-400">View and reprint past model reports</p>
                  </div>

                  {/* History Filters */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input 
                      type="text"
                      placeholder="Search disease..."
                      value={predHistorySearch}
                      onChange={(e) => setPredHistorySearch(e.target.value)}
                      className="px-3 py-1.5 border border-slate-250 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 bg-white dark:bg-slate-900"
                    />
                    <select 
                      value={predHistoryRiskFilter}
                      onChange={(e) => setPredHistoryRiskFilter(e.target.value)}
                      className="px-3 py-1.5 border border-slate-250 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 bg-white dark:bg-slate-900"
                    >
                      <option value="">All Risks</option>
                      <option value="Low">Low Risk</option>
                      <option value="Medium">Medium Risk</option>
                      <option value="High">High Risk</option>
                    </select>
                    <select 
                      value={predHistorySortBy}
                      onChange={(e) => setPredHistorySortBy(e.target.value)}
                      className="px-3 py-1.5 border border-slate-250 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 bg-white dark:bg-slate-900"
                    >
                      <option value="prediction_time">Sort by Date</option>
                      <option value="confidence">Sort by Confidence</option>
                    </select>
                    <button 
                      onClick={() => setPredHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="px-2 py-1.5 border border-slate-250 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 font-bold"
                    >
                      {predHistorySortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>

                {/* Predictions Table */}
                {(() => {
                  const filteredHistory = predictionHistory
                    .filter(item => {
                      const matchesSearch = item.predicted_disease.toLowerCase().includes(predHistorySearch.toLowerCase());
                      const matchesRisk = predHistoryRiskFilter ? item.risk_level === predHistoryRiskFilter : true;
                      return matchesSearch && matchesRisk;
                    })
                    .sort((a, b) => {
                      let valA = a[predHistorySortBy];
                      let valB = b[predHistorySortBy];
                      if (predHistorySortBy === 'prediction_time') {
                        valA = new Date(valA).getTime();
                        valB = new Date(valB).getTime();
                      }
                      if (predHistorySortOrder === 'desc') {
                        return valB - valA;
                      } else {
                        return valA - valB;
                      }
                    });

                  return filteredHistory.length > 0 ? (
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
                            <th className="py-3 px-4">Date / Time</th>
                            <th className="py-3 px-4">Predicted Condition</th>
                            <th className="py-3 px-4">Confidence</th>
                            <th className="py-3 px-4">Risk Badge</th>
                            <th className="py-3 px-4">Symptom Tags</th>
                            <th className="py-3 px-4">Consultation Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistory.map((item) => (
                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                              <td className="py-3 px-4 text-slate-500 font-medium">
                                {new Date(item.prediction_time).toLocaleDateString()} {new Date(item.prediction_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-3 px-4 font-black">{item.predicted_disease}</td>
                              <td className="py-3 px-4 font-bold">{Math.round(item.confidence * 100)}%</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block ${
                                  item.risk_level === 'High' || item.risk_level === 'Critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-455' :
                                  item.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-455' :
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-455'
                                }`}>
                                  {item.risk_level}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 truncate max-w-xs font-semibold">
                                {item.symptoms.join(', ')}
                              </td>
                              <td className="py-3 px-4 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] inline-block ${
                                  item.consultation_status === 'Scheduled' ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-850'
                                }`}>
                                  {item.consultation_status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button 
                                  onClick={async () => {
                                    setDiagnosisLoading(true);
                                    try {
                                      const detail = await patientService.getPredictionDetail(item.id);
                                      setDiagnosisResult(detail);
                                      setDiagnosisSubTab('new');
                                    } catch (err) {
                                      console.error(err);
                                      alert("Failed to load prediction report.");
                                    } finally {
                                      setDiagnosisLoading(false);
                                    }
                                  }}
                                  className="text-hospital-600 dark:text-hospital-450 hover:underline font-bold"
                                >
                                  View Report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No prediction logs matches filters or logs exist.
                    </div>
                  );
                })()}

              </div>
            )}
            
            {/* Inline print style rule */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #prediction-report-print, #prediction-report-print * {
                  visibility: visible;
                }
                #prediction-report-print {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  background: white !important;
                  color: black !important;
                }
                .print\\:hidden {
                  display: none !important;
                }
              }
            `}</style>

          </div>
        )}

      </div>

      {/* ---------------- BOOKING APPOINTMENT MODAL ---------------- */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-4 animate-scaleUp">
            <h3 className="font-extrabold text-base border-b border-slate-100 dark:border-slate-800 pb-3">Book New Consultation</h3>
            
            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-450 font-bold block">SELECT DOCTOR / PHYSICIAN</label>
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
                <label className="text-slate-450 font-bold block">APPOINTMENT TYPE</label>
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
                <label className="text-slate-450 font-bold block">DATE & TIME</label>
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
                  className="border border-slate-200 dark:border-slate-800 font-semibold py-2 px-5 rounded-xl text-slate-650 hover:bg-slate-55 transition-colors"
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
            <h3 className="font-extrabold text-base border-b border-slate-100 dark:border-slate-800 pb-3">Reschedule Appointment</h3>
            
            <form onSubmit={handleReschedule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-450 font-bold block">NEW DATE & TIME</label>
                <input 
                  type="datetime-local" 
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl outline-none focus:ring-1 focus:ring-hospital-500 text-sm text-slate-850 dark:text-white"
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
                  className="border border-slate-200 dark:border-slate-800 font-semibold py-2 px-5 rounded-xl text-slate-650 hover:bg-slate-55 transition-colors"
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
                  <h3 className="font-extrabold text-base">Appointment Details</h3>
                  <span className="text-[10px] text-slate-450">ID: APP-{viewingAppointment.id}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  viewingAppointment.status === 'Scheduled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-450'
                }`}>
                  {viewingAppointment.status}
                </span>
              </div>

              {/* Doctor Details */}
              <div className="bg-slate-50/50 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl flex items-center space-x-3.5">
                <div className="bg-hospital-100 dark:bg-hospital-950 p-3 rounded-xl text-hospital-600 dark:text-hospital-450">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-450 font-bold block uppercase tracking-wider">Assigned Physician</span>
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

              {/* Queue status */}
              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-3">
                <span className="text-[10px] text-hospital-500 font-bold uppercase tracking-wider block">Live Queue Status</span>
                
                {activeQueue ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-hospital-50/20 dark:bg-hospital-950/10 border border-hospital-100/50 dark:border-hospital-900/30 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">TOKEN</span>
                      <strong className="text-hospital-600 dark:text-hospital-450 font-black text-lg block mt-0.5">{activeQueue.token_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">POSITION</span>
                      <strong className="text-slate-800 dark:text-white font-black text-lg block mt-0.5">
                        {activeQueue.status === 'Calling' ? 'Calling Next!' : `#${activeQueue.position}`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">EST. WAIT TIME</span>
                      <strong className="text-slate-850 dark:text-white font-bold text-sm block mt-1">{activeQueue.status === 'Calling' ? '0 mins' : `${activeQueue.estimated_wait_time.toFixed(0)} mins`}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold text-[9px]">STATUS</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold inline-block mt-1.5 uppercase ${
                        activeQueue.status === 'Calling' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                        activeQueue.status === 'Skipped' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }`}>
                        {activeQueue.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50/60 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-center space-y-2 text-xs">
                    <p className="text-slate-500 font-medium">Status: Scheduled (Not Checked In)</p>
                    <p className="text-[10px] text-slate-450 max-w-xs mx-auto">
                      Please use the **Self Check-In Portal** on this dashboard or at the reception desk once you arrive at the hospital to receive your token.
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
