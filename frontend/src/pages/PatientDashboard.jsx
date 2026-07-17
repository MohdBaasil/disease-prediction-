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
  const defaultVitals = { age: '', bmi: '', blood_glucose: '', heart_rate: '', temperature: '', systolic_bp: '' };
  const defaultSymptoms = {
    frequent_urination: 0, increased_thirst: 0, family_history_diabetes: 0,
    shortness_of_breath: 0, wheezing: 0, chest_tightness: 0, coughing: 0,
    throbbing_headache: 0, nausea: 0, light_sensitivity: 0, chest_pain: 0,
    pain_radiating_arm_jaw: 0, sweating: 0, sudden_numbness_weakness: 0,
    trouble_speaking: 0, confusion: 0, drooping_face: 0, shivering: 0, rapid_breathing: 0
  };
  const [vitalsForm, setVitalsForm] = useState(defaultVitals);
  const [symptomsForm, setSymptomsForm] = useState(defaultSymptoms);

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
    setDiagnosisLoading(true);
    setDiagnosisError('');
    setDiagnosisResult(null);
    try {
      const vitals = {
        age: parseInt(vitalsForm.age),
        bmi: parseFloat(vitalsForm.bmi),
        blood_glucose: parseInt(vitalsForm.blood_glucose),
        heart_rate: parseInt(vitalsForm.heart_rate),
        temperature: parseFloat(vitalsForm.temperature),
        systolic_bp: parseInt(vitalsForm.systolic_bp)
      };
      const result = await patientService.predictDisease(vitals, symptomsForm);
      setDiagnosisResult(result);
    } catch (err) {
      console.error(err);
      setDiagnosisError(err.response?.data?.detail || 'Failed to run disease prediction. Please check your inputs and try again.');
    } finally {
      setDiagnosisLoading(false);
    }
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
          <span>AI Diagnosis</span>
          <span className="ml-auto text-[8px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-full hidden group-hover:flex">AI</span>
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

        {/* ---------------- AI DISEASE DIAGNOSIS TAB ---------------- */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="h-5 w-5 text-purple-200" />
                    <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">AI-Powered</span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">Disease Diagnosis</h2>
                  <p className="text-sm text-purple-200 mt-1 max-w-sm">Enter your vitals and symptoms. Our ensemble of 3 ML models will analyze and predict the most likely condition.</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                  <Stethoscope className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-4 text-xs text-purple-200">
                <span className="flex items-center space-x-1"><BarChart3 className="h-3 w-3" /><span>Random Forest</span></span>
                <span>•</span>
                <span className="flex items-center space-x-1"><Brain className="h-3 w-3" /><span>Gradient Boosting</span></span>
                <span>•</span>
                <span className="flex items-center space-x-1"><Activity className="h-3 w-3" /><span>XGBoost</span></span>
              </div>
            </div>

            {/* Disclaimer Banner */}
            <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-amber-700 dark:text-amber-300 text-xs">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p><strong>Educational Use Only:</strong> This AI tool is for informational purposes and does not replace professional medical advice, diagnosis, or treatment. Always consult a qualified physician.</p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleDiagnosis} className="space-y-6">
              {/* Vitals Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center space-x-2 mb-5">
                  <div className="bg-violet-100 dark:bg-violet-950/40 p-2 rounded-xl text-violet-600 dark:text-violet-400">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Clinical Vitals</h3>
                    <p className="text-[10px] text-slate-400">Enter your measured vital signs</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'age', label: 'Age', unit: 'years', type: 'number', placeholder: '30' },
                    { key: 'bmi', label: 'BMI', unit: 'kg/m²', type: 'number', placeholder: '24.5', step: '0.1' },
                    { key: 'blood_glucose', label: 'Blood Glucose', unit: 'mg/dL', type: 'number', placeholder: '90' },
                    { key: 'heart_rate', label: 'Heart Rate', unit: 'BPM', type: 'number', placeholder: '75' },
                    { key: 'temperature', label: 'Body Temp', unit: '°F', type: 'number', placeholder: '98.2', step: '0.1' },
                    { key: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', type: 'number', placeholder: '120' }
                  ].map(({ key, label, unit, type, placeholder, step }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{label} <span className="text-violet-400 font-normal normal-case">({unit})</span></label>
                      <input
                        required
                        type={type}
                        step={step || '1'}
                        placeholder={placeholder}
                        value={vitalsForm[key]}
                        onChange={e => setVitalsForm(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-xl outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 text-sm text-slate-800 dark:text-white transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Symptoms Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center space-x-2 mb-5">
                  <div className="bg-rose-100 dark:bg-rose-950/40 p-2 rounded-xl text-rose-500 dark:text-rose-400">
                    <Heart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Symptom Checklist</h3>
                    <p className="text-[10px] text-slate-400">Check all symptoms you are currently experiencing</p>
                  </div>
                </div>
                {/* Symptoms grouped by category */}
                {[
                  { label: 'Metabolic / Endocrine', color: 'blue', keys: [
                    { key: 'frequent_urination', label: 'Frequent Urination (Polyuria)' },
                    { key: 'increased_thirst', label: 'Excessive Thirst (Polydipsia)' },
                    { key: 'family_history_diabetes', label: 'Family History of Diabetes' }
                  ]},
                  { label: 'Respiratory / Chest', color: 'sky', keys: [
                    { key: 'shortness_of_breath', label: 'Shortness of Breath' },
                    { key: 'wheezing', label: 'Wheezing Sound' },
                    { key: 'chest_tightness', label: 'Chest Tightness' },
                    { key: 'coughing', label: 'Persistent Cough' },
                    { key: 'rapid_breathing', label: 'Rapid Breathing' }
                  ]},
                  { label: 'Neurological / Head', color: 'violet', keys: [
                    { key: 'throbbing_headache', label: 'Severe Throbbing Headache' },
                    { key: 'light_sensitivity', label: 'Light / Sound Sensitivity' },
                    { key: 'sudden_numbness_weakness', label: 'Sudden Numbness or Weakness' },
                    { key: 'trouble_speaking', label: 'Slurred / Difficult Speech' },
                    { key: 'drooping_face', label: 'Facial Drooping' },
                    { key: 'confusion', label: 'Sudden Confusion' }
                  ]},
                  { label: 'Cardiac / Systemic', color: 'rose', keys: [
                    { key: 'chest_pain', label: 'Chest Pain or Pressure' },
                    { key: 'pain_radiating_arm_jaw', label: 'Pain Radiating to Arm or Jaw' },
                    { key: 'sweating', label: 'Profuse Sweating' },
                    { key: 'nausea', label: 'Nausea or Vomiting' },
                    { key: 'shivering', label: 'Chills / Shivering / Rigors' }
                  ]}
                ].map(group => (
                  <div key={group.label} className="mb-5">
                    <span className={`text-[9px] font-black uppercase tracking-widest text-${group.color}-500 block mb-2 pl-1`}>{group.label}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.keys.map(({ key, label }) => (
                        <label key={key} className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-violet-300 dark:hover:border-violet-700 ${symptomsForm[key] === 1 ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20'}`}>
                          <input
                            type="checkbox"
                            checked={symptomsForm[key] === 1}
                            onChange={e => setSymptomsForm(prev => ({ ...prev, [key]: e.target.checked ? 1 : 0 }))}
                            className="w-4 h-4 accent-violet-600 rounded"
                          />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <div className="flex items-center space-x-4">
                <button
                  type="submit"
                  disabled={diagnosisLoading}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white font-bold py-3.5 px-8 rounded-2xl hover:from-violet-700 hover:to-purple-600 transition-all shadow-lg shadow-violet-200 dark:shadow-violet-900/40 disabled:opacity-60 flex items-center justify-center space-x-2"
                >
                  {diagnosisLoading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Analyzing...</span></>
                  ) : (
                    <><Brain className="h-5 w-5" /><span>Run AI Diagnosis</span><ChevronRight className="h-4 w-4" /></>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setVitalsForm(defaultVitals); setSymptomsForm(defaultSymptoms); setDiagnosisResult(null); setDiagnosisError(''); }}
                  className="px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-semibold"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Error */}
            {diagnosisError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" /><span>{diagnosisError}</span>
              </div>
            )}

            {/* Results Panel */}
            {diagnosisResult && (() => {
              const r = diagnosisResult;
              const riskColor = r.risk_level === 'High' ? 'rose' : r.risk_level === 'Medium' ? 'amber' : 'emerald';
              const riskBg = r.risk_level === 'High' ? 'bg-rose-500' : r.risk_level === 'Medium' ? 'bg-amber-400' : 'bg-emerald-500';
              const confidencePct = Math.round(r.confidence_score * 100);

              return (
                <div className="space-y-5 animate-fadeIn">
                  {/* Emergency Alert */}
                  {r.is_emergency && (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-600 to-red-500 p-5 text-white shadow-2xl shadow-rose-300 dark:shadow-rose-900/50">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                      <div className="flex items-start space-x-4 relative">
                        <div className="p-3 bg-white/20 rounded-2xl animate-pulse">
                          <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tight">🚨 EMERGENCY DETECTED</h3>
                          <p className="text-rose-100 text-sm mt-1">Predicted condition <strong>{r.predicted_disease}</strong> may require <strong>IMMEDIATE EMERGENCY MEDICAL ATTENTION</strong>. Do not wait. Call emergency services or go to the nearest Emergency Room immediately.</p>
                          <p className="text-xs text-rose-200 mt-2 font-semibold">📞 Emergency: 911 / 999 / 112</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Prediction Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest block mb-1">Ensemble Prediction Result</span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{r.predicted_disease}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Based on soft-voting ensemble of 3 ML models</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        {/* Confidence Meter */}
                        <div className="text-center">
                          <div className="relative w-20 h-20">
                            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                              <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                              <circle cx="40" cy="40" r="32" fill="none" stroke="url(#confGrad)" strokeWidth="8"
                                strokeDasharray={`${201 * confidencePct / 100} 201`} strokeLinecap="round" />
                              <defs>
                                <linearGradient id="confGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#7c3aed" />
                                  <stop offset="100%" stopColor="#a855f7" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-violet-600 dark:text-violet-400">{confidencePct}%</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Confidence</span>
                        </div>
                        {/* Risk Badge */}
                        <div className={`${riskBg} text-white px-4 py-2 rounded-2xl text-center shadow-lg`}>
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-80">Risk Level</span>
                          <span className="text-base font-black">{r.risk_level}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top 3 Predictions */}
                    <div className="mt-5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Top 3 Differential Predictions</span>
                      <div className="space-y-2">
                        {r.top_predictions.map((p, idx) => (
                          <div key={p.disease} className="flex items-center space-x-3">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${idx === 0 ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{idx + 1}</span>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className={`text-xs font-bold ${idx === 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}>{p.disease}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{Math.round(p.probability * 100)}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? 'bg-gradient-to-r from-violet-600 to-purple-400' : 'bg-slate-300 dark:bg-slate-600'}`} style={{ width: `${p.probability * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Model Comparison */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                      <BarChart3 className="h-4 w-4 text-violet-500" />
                      <h4 className="font-bold text-sm">Model-by-Model Comparison</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'random_forest', label: 'Random Forest', icon: '🌲', color: 'green' },
                        { key: 'gradient_boosting', label: 'Gradient Boost', icon: '🔥', color: 'orange' },
                        { key: 'xgboost', label: 'XGBoost', icon: '⚡', color: 'yellow' }
                      ].map(({ key, label, icon, color }) => {
                        const m = r.comparisons[key];
                        const matches = m.disease === r.predicted_disease;
                        return (
                          <div key={key} className={`p-4 rounded-2xl border text-center transition-all ${matches ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'}`}>
                            <span className="text-2xl block mb-1">{icon}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{label}</span>
                            <span className={`text-xs font-black block mt-1 ${matches ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}>{m.disease}</span>
                            <span className="text-[10px] text-slate-400">{Math.round(m.probability * 100)}%</span>
                            {matches && <span className="text-[8px] font-black text-violet-500 bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 rounded-full inline-block mt-1">✓ Agrees</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* XAI Reasons */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                      <Brain className="h-4 w-4 text-violet-500" />
                      <h4 className="font-bold text-sm">Why This Prediction? <span className="text-[9px] text-violet-500 font-black uppercase tracking-wider ml-1">Explainable AI</span></h4>
                    </div>
                    <div className="space-y-2">
                      {r.reasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start space-x-3 p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-xl">
                          <div className="w-5 h-5 bg-violet-600 text-white rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{idx + 1}</div>
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Department & Doctors */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2">
                        <Stethoscope className="h-4 w-4 text-teal-500" />
                        <h4 className="font-bold text-sm">Recommended Department</h4>
                      </div>
                      <div className="p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/50 rounded-2xl">
                        <span className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider block">Suggested Specialty</span>
                        <p className="text-sm font-extrabold text-teal-700 dark:text-teal-300 mt-0.5">{r.recommended_specialty}</p>
                        <span className="text-[9px] text-teal-500/70 mt-1 block">Available in hospital: {r.mapped_db_dept}</span>
                      </div>
                      {r.recommended_doctors && r.recommended_doctors.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Available Doctors</span>
                          {r.recommended_doctors.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-teal-300 dark:hover:border-teal-700 transition-all">
                              <div className="flex items-center space-x-3">
                                <div className="bg-teal-100 dark:bg-teal-950/40 p-2 rounded-xl">
                                  <User className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-slate-800 dark:text-white block">{doc.name}</span>
                                  <span className="text-[9px] text-slate-400">{doc.specialization} • Room {doc.room_number}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => { setBookingForm(prev => ({ ...prev, doctor_id: doc.id.toString() })); setActiveTab('appointments'); setBookingModal(true); }}
                                className="text-[9px] font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all"
                              >
                                Book
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-2">No doctors available in this department currently.</p>
                      )}
                    </div>

                    {/* Lab Tests */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2">
                        <FlaskConical className="h-4 w-4 text-blue-500" />
                        <h4 className="font-bold text-sm">Suggested Laboratory Tests</h4>
                      </div>
                      <div className="space-y-2">
                        {r.suggested_tests.map((test, idx) => (
                          <div key={idx} className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-black shrink-0">{idx + 1}</div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{test}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Medicine Suggestions */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center space-x-2">
                      <Pill className="h-4 w-4 text-indigo-500" />
                      <h4 className="font-bold text-sm">Educational Medicine Information</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {r.suggested_medicines.map((med, idx) => (
                        <div key={idx} className="flex items-start space-x-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
                          <Pill className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{med}</span>
                        </div>
                      ))}
                    </div>
                    {/* Disclaimer */}
                    <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                      <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
                        ⚠️ {r.medicine_disclaimer}
                      </p>
                    </div>
                  </div>

                </div>
              );
            })()}

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
