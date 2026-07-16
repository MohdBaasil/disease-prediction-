import React, { useState, useEffect } from 'react';
import { 
  Users, Ticket, ClipboardList, CheckCircle, AlertTriangle, 
  UserCheck, Heart, Search, HelpCircle, PlusCircle 
} from 'lucide-react';
import { 
  patientService, queueService, dashboardService, 
  doctorService, createQueueWebSocket 
} from '../services/api';

function ReceptionistDashboard() {
  // Stats
  const [stats, setStats] = useState({
    waiting_patients: 0,
    emergency_waiting: 0,
    available_doctors: 0,
    average_wait_time_minutes: 0
  });

  // Departments & Doctors
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [activeQueue, setActiveQueue] = useState([]);

  // Patient Registration Form
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regMobile, setRegMobile] = useState('');

  // Token Generation Form
  const [searchMobile, setSearchMobile] = useState('');
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [tokenDept, setTokenDept] = useState('');
  const [tokenPriority, setTokenPriority] = useState('3'); // 3: Normal
  const [tokenDoctor, setTokenDoctor] = useState('');

  const [loading, setLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadInitialData = async () => {
    try {
      const depts = await queueService.getDepartments();
      setDepartments(depts);
      if (depts.length > 0) {
        setActiveDept(depts[0].id.toString());
        setTokenDept(depts[0].id.toString());
      }
      
      const docs = await doctorService.list();
      setDoctors(docs);

      await refreshStatsAndQueue();
    } catch (e) {
      console.error(e);
      showMsg('error', 'Error loading system configuration.');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatsAndQueue = async () => {
    try {
      const statsData = await dashboardService.getReceptionistStats();
      setStats(statsData);
      
      if (activeDept) {
        const queueData = await queueService.getDepartmentQueue(parseInt(activeDept));
        setActiveQueue(queueData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Sync queue details when selected department changes
  useEffect(() => {
    if (activeDept) {
      queueService.getDepartmentQueue(parseInt(activeDept)).then(setActiveQueue).catch(console.error);
    }
  }, [activeDept]);

  // Sync available doctors when token generator department changes
  useEffect(() => {
    if (tokenDept) {
      doctorService.list(parseInt(tokenDept)).then(setDoctors).catch(console.error);
    }
  }, [tokenDept]);

  useEffect(() => {
    // WebSocket real-time updates listener
    const ws = createQueueWebSocket((msg) => {
      if (msg.event === 'queue_update') {
        console.log('Receptionist live sync triggered');
        refreshStatsAndQueue();
      }
    });
    return () => ws.close();
  }, [activeDept]);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Register a patient
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!regName || !regAge || !regMobile) {
      showMsg('error', 'Please fill in Name, Age, and Mobile number.');
      return;
    }
    
    setRegLoading(true);
    try {
      const patient = await patientService.register(regName, regAge, regGender, regMobile);
      showMsg('success', `Registered Patient: ${patient.name}!`);
      // Auto select this patient in the token generator
      setSelectedPatient(patient);
      setSearchMobile(patient.mobile_number);
      // Clear form
      setRegName('');
      setRegAge('');
      setRegMobile('');
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.detail || 'Failed to register patient.');
    } finally {
      setRegLoading(false);
    }
  };

  // Search patients for token generation
  const handleSearchPatient = async () => {
    if (!searchMobile) return;
    try {
      const results = await patientService.getByMobile(searchMobile);
      setFoundPatients(results);
      if (results.length > 0) {
        setSelectedPatient(results[0]);
      } else {
        setSelectedPatient(null);
        showMsg('error', 'No patient found with this mobile number. Register below.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Generate queue token
  const handleGenerateToken = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      showMsg('error', 'Please select or search a patient first.');
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
      showMsg('success', `Generated Token ${entry.token_number} successfully!`);
      setSelectedPatient(null);
      setSearchMobile('');
      setFoundPatients([]);
      setTokenDoctor('');
      setTokenPriority('3');
      refreshStatsAndQueue();
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.detail || 'Failed to generate token.');
    } finally {
      setTokenLoading(false);
    }
  };

  // Reschedule skipped patient
  const handleReschedule = async (queueId) => {
    try {
      await queueService.reschedule(queueId);
      showMsg('success', 'Patient re-added to active waiting queue.');
      refreshStatsAndQueue();
    } catch (e) {
      console.error(e);
      showMsg('error', 'Failed to reschedule patient.');
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
      
      {/* Top Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black">Receptionist Desk</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Register incoming patients, assign physicians, and route emergency tokens.</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-sm flex items-center space-x-2 border ${
          message.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400'
        }`}>
          {message.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stats KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Total Waiting</span>
            <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{stats.waiting_patients}</span>
          </div>
          <div className="bg-hospital-50 text-hospital-500 dark:bg-hospital-950 p-3 rounded-xl"><ClipboardList className="h-6 w-6" /></div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Emergency Waiting</span>
            <span className={`text-3xl font-black mt-1 block ${stats.emergency_waiting > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>{stats.emergency_waiting}</span>
          </div>
          <div className="bg-amber-50 text-amber-500 dark:bg-amber-950 p-3 rounded-xl"><AlertTriangle className="h-6 w-6" /></div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Active Doctors</span>
            <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{stats.available_doctors}</span>
          </div>
          <div className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950 p-3 rounded-xl"><UserCheck className="h-6 w-6" /></div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Avg Wait Time</span>
            <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{stats.average_wait_time_minutes.toFixed(0)} min</span>
          </div>
          <div className="bg-hospital-50 text-hospital-500 dark:bg-hospital-950 p-3 rounded-xl"><ClipboardList className="h-6 w-6" /></div>
        </div>
      </div>

      {/* Grid Layout for Forms and Queue */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Hand Column: Forms */}
        <div className="space-y-6">
          
          {/* Token Generation Generator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
              <Ticket className="h-5 w-5 text-hospital-500" />
              <span>Token Dispatch Generator</span>
            </h2>
            
            <div className="space-y-4">
              {/* Lookup Mobile */}
              <div className="flex space-x-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                    placeholder="Search mobile, e.g. 98765..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchPatient}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Find
                </button>
              </div>

              {selectedPatient && (
                <div className="p-3 bg-hospital-50 dark:bg-hospital-950/20 border border-hospital-100 dark:border-hospital-900/35 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-hospital-500 text-[10px] uppercase tracking-wider">Selected Patient</div>
                  <div><strong>Name:</strong> {selectedPatient.name}</div>
                  <div><strong>Age/Gender:</strong> {selectedPatient.age} / {selectedPatient.gender}</div>
                  <div><strong>Mobile:</strong> {selectedPatient.mobile_number}</div>
                </div>
              )}

              <form onSubmit={handleGenerateToken} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">DEPARTMENT</label>
                  <select
                    value={tokenDept}
                    onChange={(e) => setTokenDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">PHYSICIAN ASSIGNMENT (OPTIONAL)</label>
                  <select
                    value={tokenDoctor}
                    onChange={(e) => setTokenDoctor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="">Any Available Physician</option>
                    {doctors
                      .filter(d => d.department_id === parseInt(tokenDept))
                      .map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name} (Room {doc.room_number})</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">PRIORITY TRIAGE LEVEL</label>
                  <select
                    value={tokenPriority}
                    onChange={(e) => setTokenPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="3">Priority 3 - Normal</option>
                    <option value="2">Priority 2 - Urgent</option>
                    <option value="1">Priority 1 - Critical</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={tokenLoading}
                  className="w-full mt-2 bg-hospital-500 text-white font-semibold py-2.5 rounded-xl hover:bg-hospital-600 shadow transition-colors text-xs flex items-center justify-center space-x-2"
                >
                  {tokenLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Generate Token Ticket</span>
                      <PlusCircle className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

          {/* New Patient Registration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5 text-hospital-500" />
              <span>Patient Desk Registry</span>
            </h2>

            <form onSubmit={handleRegisterPatient} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">FULL NAME</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">AGE</label>
                  <input
                    type="number"
                    value={regAge}
                    onChange={(e) => setRegAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">GENDER</label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">MOBILE NUMBER</label>
                <input
                  type="tel"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  placeholder="9876543210"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full mt-2 bg-slate-800 text-white font-semibold py-2.5 rounded-xl hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 shadow transition-colors text-xs flex items-center justify-center space-x-2"
              >
                {regLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Register New Patient</span>
                    <UserCheck className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Right Hand Column: Live Queue list (Span 2) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 space-y-3 sm:space-y-0">
              <h2 className="text-md font-bold flex items-center space-x-2">
                <Heart className="h-5 w-5 text-hospital-500" />
                <span>Live Queue Monitor</span>
              </h2>
              
              {/* Department selector filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-semibold uppercase">Department:</span>
                <select
                  value={activeDept}
                  onChange={(e) => setActiveDept(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeQueue.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-2 text-center">Pos</th>
                      <th className="py-3 px-3">Token</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-center">Wait (Est)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQueue.map((item, index) => {
                      let priorityBadge = "bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-400";
                      let priorityText = "Normal";
                      if (item.priority_level === 1) {
                        priorityBadge = "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-bold animate-pulse";
                        priorityText = "Critical";
                      } else if (item.priority_level === 2) {
                        priorityBadge = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-semibold";
                        priorityText = "Urgent";
                      }

                      let statusBadge = "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400";
                      if (item.status === "Calling") {
                        statusBadge = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800";
                      } else if (item.status === "Skipped") {
                        statusBadge = "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400";
                      }

                      return (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                          <td className="py-3.5 px-2 text-center font-bold text-slate-500">
                            {item.status === "Calling" ? "Calling" : `#${item.position}`}
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-hospital-500 text-sm">{item.token_number}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold block">{item.patient.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Age: {item.patient.age} | Gen: {item.patient.gender}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${priorityBadge}`}>
                              {priorityText}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] ${statusBadge}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-350">
                            {item.status === "Calling" ? "0 min" : `${item.estimated_wait_time.toFixed(0)} min`}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.status === "Skipped" ? (
                              <button
                                onClick={() => handleReschedule(item.id)}
                                className="px-2.5 py-1 bg-hospital-500 hover:bg-hospital-600 text-white rounded-lg font-bold tracking-tight text-[10px]"
                              >
                                Re-queue
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No active patients waiting in this queue.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default ReceptionistDashboard;
