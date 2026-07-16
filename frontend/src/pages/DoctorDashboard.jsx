import React, { useState, useEffect } from 'react';
import { 
  User, CheckCircle, SkipForward, Play, AlertCircle, 
  Activity, ClipboardList, ToggleLeft, ToggleRight, Clock 
} from 'lucide-react';
import { doctorService, dashboardService, queueService, createQueueWebSocket } from '../services/api';

function DoctorDashboard() {
  const [doctor, setDoctor] = useState(null);
  const [stats, setStats] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  
  // Consultation form states
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [duration, setDuration] = useState(15); // standard 15 minutes

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadData();
    
    // WebSockets listener to sync live queue
    const ws = createQueueWebSocket((msg) => {
      if (msg.event === 'queue_update') {
        console.log('Doctor live sync triggered');
        if (doctor) {
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
        } else {
          loadData();
        }
      }
    });
    return () => ws.close();
  }, [doctor?.id]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Doctor Header card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-xl md:text-2xl font-black">{doctor?.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {doctor?.specialization} | Room: <strong>{doctor?.room_number}</strong> | Dept ID: {doctor?.department_id}
          </p>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-bold block uppercase">Duty Status</span>
            <button
              onClick={handleToggleAvailability}
              className="flex items-center space-x-2 text-sm mt-1 font-semibold focus:outline-none"
            >
              {doctor?.is_available ? (
                <>
                  <span className="text-emerald-500">Active Duty</span>
                  <ToggleRight className="h-6 w-6 text-emerald-500 cursor-pointer" />
                </>
              ) : (
                <>
                  <span className="text-slate-400">Off Duty</span>
                  <ToggleLeft className="h-6 w-6 text-slate-400 cursor-pointer" />
                </>
              )}
            </button>
          </div>

          <div className="border-l border-slate-200 dark:border-slate-800 pl-6 text-center">
            <span className="text-xs text-slate-500 font-bold block uppercase">Completed Today</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5 block">{stats?.completed_today}</span>
          </div>

          <div className="border-l border-slate-200 dark:border-slate-800 pl-6 text-center">
            <span className="text-xs text-slate-500 font-bold block uppercase">Avg Pace</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5 block">{stats?.average_consultation_time_minutes.toFixed(0)} min</span>
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

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Consultation Workspace (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {stats?.current_patient ? (
            <>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                <div>
                  <span className="text-xs font-bold text-hospital-500 uppercase tracking-widest">Active Consultation</span>
                  <h2 className="text-lg font-black mt-0.5">{stats.current_patient.name}</h2>
                  <span className="text-xs text-slate-500">
                    Age: {stats.current_patient.age} | Gender: {stats.current_patient.gender}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-hospital-500">{stats.current_patient.token_number}</span>
                  <span className="text-[10px] block text-slate-500 font-bold uppercase mt-0.5">
                    Priority {stats.current_patient.priority_level}
                  </span>
                </div>
              </div>

              {/* Consultation Details Form */}
              <form onSubmit={handleComplete} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">SYMPTOMS RECORDED</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm resize-none"
                    placeholder="Enter patient symptoms..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">DIAGNOSIS</label>
                  <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm resize-none"
                    placeholder="Describe clinical diagnosis..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">PRESCRIPTION</label>
                  <input
                    type="text"
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                    placeholder="e.g. Paracetamol 500mg (1-0-1) 5 days"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                    <span>ESTIMATED SESSION DURATION</span>
                    <span className="text-hospital-500">{duration} minutes</span>
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

                {/* Submit Controls */}
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
                    className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-semibold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 text-sm"
                  >
                    <SkipForward className="h-4 w-4" />
                    <span>Skip</span>
                  </button>
                </div>
              </form>

            </div>

            {/* Patient Medical History Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mt-6">
              <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
                <ClipboardList className="h-5 w-5 text-hospital-500" />
                <span>Patient Medical History ({stats.current_patient.name})</span>
              </h2>

              {patientHistory && patientHistory.length > 0 ? (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {patientHistory.map((record) => (
                    <div key={record.id} className="p-4 border border-slate-100 dark:border-slate-800/80 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {new Date(record.created_at).toLocaleDateString()} at {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {record.doctor && (
                          <span className="px-2.5 py-0.5 rounded-full bg-hospital-50 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-400 font-bold uppercase tracking-wider text-[9px]">
                            Dr. {record.doctor.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Symptoms</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 block bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg mt-0.5">
                            {record.symptoms || 'None recorded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Diagnosis</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 block bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg mt-0.5 font-semibold">
                            {record.diagnosis || 'None recorded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Prescription & Medicine</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 block bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg mt-0.5 font-mono">
                            {record.prescription || 'None recorded'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-450 text-sm">
                  No past consultation history found for this patient.
                </div>
              )}
            </div>
          </>
          ) : (
            /* Idle Screen - Call Next Patient */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-sm text-center space-y-4">
              <div className="inline-flex bg-hospital-50 dark:bg-hospital-950 p-5 rounded-full text-hospital-500">
                <Activity className="h-12 w-12" />
              </div>
              <h2 className="text-xl font-bold">No active patient consultation</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Select "Call Next Patient" to fetch the highest priority waiting patient from the queue.
              </p>
              <button
                onClick={handleCallNext}
                disabled={actionLoading}
                className="px-8 py-3.5 bg-hospital-500 hover:bg-hospital-600 text-white font-semibold rounded-2xl shadow-md transition-colors inline-flex items-center space-x-2"
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
          )}

        </div>

        {/* Right Side: Upcoming queue list */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
              <Clock className="h-5 w-5 text-hospital-500" />
              <span>Upcoming Patient Queue</span>
            </h2>

            {stats && stats.upcoming_patients && stats.upcoming_patients.length > 0 ? (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {stats.upcoming_patients.map((item, index) => {
                  let priorityColor = "bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-450";
                  if (item.priority_level === 1) {
                    priorityColor = "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-450 font-bold";
                  } else if (item.priority_level === 2) {
                    priorityColor = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450";
                  }

                  return (
                    <div 
                      key={item.queue_id}
                      className="p-3 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-400">#{item.position}</span>
                        <div>
                          <span className="text-xs font-extrabold text-hospital-500 block">{item.token_number}</span>
                          <span className="text-xs font-bold block truncate max-w-[120px]">{item.name}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] block mb-1 font-semibold ${priorityColor}`}>
                          {item.priority_level === 1 ? 'Critical' : item.priority_level === 2 ? 'Urgent' : 'Normal'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{item.estimated_wait_time.toFixed(0)} min wait</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No waiting patients.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default DoctorDashboard;
