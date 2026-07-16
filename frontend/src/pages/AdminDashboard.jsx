import React, { useState, useEffect } from 'react';
import { 
  Users, BarChart2, PlusCircle, FileText, Download, 
  Settings, CheckCircle, AlertTriangle, ShieldCheck, HeartPulse 
} from 'lucide-react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, BarElement, Title, Tooltip, Legend, ArcElement 
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { doctorService, queueService, reportsService } from '../services/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
);

function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);

  // Doctor Creation Form States
  const [docUsername, setDocUsername] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docRoom, setDocRoom] = useState('');
  const [docDept, setDocDept] = useState('');

  // Report Export Form States
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');

  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setError('');
      // Load Departments
      const depts = await queueService.getDepartments();
      setDepartments(depts);
      if (depts.length > 0 && !docDept) {
        setDocDept(depts[0].id.toString());
      }

      // Load Doctor list
      const docs = await doctorService.list();
      setDoctorsList(docs);

      // Load Analytics
      const analyticsData = await reportsService.getAnalytics();
      setAnalytics(analyticsData);
    } catch (e) {
      console.error(e);
      setError('Failed to fetch admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Default report dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setReportStart(thirtyDaysAgo.toISOString().split('T')[0]);
    setReportEnd(today.toISOString().split('T')[0]);
  }, []);

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
      // Reset form
      setDocUsername('');
      setDocPassword('');
      setDocName('');
      setDocSpec('');
      setDocRoom('');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to create doctor.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    const url = reportsService.getExcelUrl(reportStart, reportEnd);
    window.open(url, '_blank');
  };

  const handleDownloadPdf = () => {
    const url = reportsService.getPdfUrl(reportStart, reportEnd);
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-12 h-12 border-4 border-hospital-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Chart configs
  const peakHoursData = analytics ? {
    labels: Object.keys(analytics.peak_hours),
    datasets: [{
      label: 'Patient Registrations',
      data: Object.values(analytics.peak_hours),
      borderColor: '#0066f5',
      backgroundColor: 'rgba(0, 102, 245, 0.1)',
      fill: true,
      tension: 0.4
    }]
  } : null;

  const docUtilData = analytics ? {
    labels: Object.keys(analytics.doctor_utilization),
    datasets: [{
      label: 'Completed Consultations',
      data: Object.values(analytics.doctor_utilization),
      backgroundColor: '#338bff',
      borderRadius: 8
    }]
  } : null;

  const priorityData = analytics ? {
    labels: Object.keys(analytics.priority_distribution),
    datasets: [{
      data: Object.values(analytics.priority_distribution),
      backgroundColor: ['#f43f5e', '#f59e0b', '#3b82f6'],
      hoverOffset: 4
    }]
  } : null;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black">Hospital Administration</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">View real-time operation metrics, configure medical staff, and generate PDF/Excel exports.</p>
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

      {/* KPI Overviews */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold block uppercase">Total Consultations</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{analytics.summary.total_consultations}</span>
            </div>
            <div className="bg-hospital-50 text-hospital-500 dark:bg-hospital-950 p-3 rounded-xl"><HeartPulse className="h-6 w-6" /></div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold block uppercase">Emergency Load Ratio</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{analytics.summary.emergency_percentage}%</span>
            </div>
            <div className="bg-rose-50 text-rose-500 dark:bg-rose-950 p-3 rounded-xl"><AlertTriangle className="h-6 w-6" /></div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold block uppercase">Avg Patient Wait</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{analytics.summary.avg_wait_minutes.toFixed(0)} min</span>
            </div>
            <div className="bg-amber-50 text-amber-500 dark:bg-amber-950 p-3 rounded-xl"><BarChart2 className="h-6 w-6" /></div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold block uppercase">Avg Consult Time</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white mt-1 block">{analytics.summary.avg_duration_minutes.toFixed(0)} min</span>
            </div>
            <div className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950 p-3 rounded-xl"><ShieldCheck className="h-6 w-6" /></div>
          </div>
        </div>
      )}

      {/* Analytics Charts Grid */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wide">Peak Registration Hours</h3>
            <div className="h-64 flex items-center justify-center">
              {peakHoursData && <Line data={peakHoursData} options={{ responsive: true, maintainAspectRatio: false }} />}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <h3 className="text-sm font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wide">Priority Caseload Triage</h3>
            <div className="h-64 flex items-center justify-center">
              {priorityData && <Doughnut data={priorityData} options={{ responsive: true, maintainAspectRatio: false }} />}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-3">
            <h3 className="text-sm font-bold mb-4 text-slate-500 dark:text-slate-400 uppercase tracking-wide">Physician Consult Load</h3>
            <div className="h-64 flex items-center justify-center">
              {docUtilData && <Bar data={docUtilData} options={{ responsive: true, maintainAspectRatio: false }} />}
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout for Configuration & Reports */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
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

        {/* Right Side: Doctor Directory list & Exports (Span 2) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Export Panel */}
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

          {/* Doctor Directory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h2 className="text-md font-bold mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5 text-hospital-500" />
              <span>Medical Staff Directory</span>
            </h2>

            <div className="overflow-x-auto">
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

    </div>
  );
}

export default AdminDashboard;
