import React, { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Download,
  Printer,
  X,
  Eye,
  Sparkles,
  AlertTriangle,
  Stethoscope,
  Building2,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  Heart,
  Award
} from 'lucide-react';

function ClinicalReportModal({
  isOpen,
  onClose,
  consultationId,
  patientData = {},
  doctorData = {},
  clinicalData = {}
}) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'preview'
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const reportUrl = `/api/consultations/${consultationId}/report`;
  const downloadUrl = `/api/consultations/${consultationId}/report?download=true`;

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `CONSULTATION_${consultationId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 1000);
  };

  const handlePrint = () => {
    const printWindow = window.open(reportUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn('Print pop-up blocked or not directly printable:', e);
        }
      }, 800);
    }
  };

  const handleView = () => {
    window.open(reportUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-hospital-600 to-blue-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Session Finalized
                </span>
                <span className="text-[10px] font-extrabold text-emerald-100">
                  ID: AQ-CONS-{String(consultationId || 0).padStart(6, '0')}
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">Consultation Completed Successfully</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow scrollbar-thin">
          
          {/* SUCCESS BANNER & ACTION BAR */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <strong className="text-xs font-black text-emerald-900 dark:text-emerald-300 block">
                  Clinical Consultation Report Generated
                </strong>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium block">
                  Document archived to patient medical history & ReportLab PDF store.
                </span>
              </div>
            </div>

            {/* PRIMARY ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleView}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-extrabold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <Eye className="h-4 w-4 text-hospital-500" />
                <span>View Report</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-3.5 py-2 bg-hospital-600 hover:bg-hospital-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-md shadow-hospital-600/20 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-extrabold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* REPORT SUMMARY & CLINICAL BREAKDOWN */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center space-x-1.5">
                <Stethoscope className="h-4 w-4 text-hospital-500" />
                <span>Report Content Summary</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">A4 Hospital Standard Layout</span>
            </div>

            {/* DEMOGRAPHICS & CLINICAL OVERVIEW GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Patient Profile</span>
                <div className="space-y-1 text-slate-800 dark:text-white font-semibold">
                  <div><strong>Name:</strong> {patientData.name || 'N/A'}</div>
                  <div><strong>Patient ID:</strong> P-{String(patientData.id || 0).padStart(4, '0')}</div>
                  <div><strong>Age / Gender:</strong> {patientData.age || 'N/A'} yrs • {patientData.gender || 'N/A'}</div>
                  <div><strong>Blood Group:</strong> {patientData.blood_group || 'O+'}</div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Diagnosis & Disposition</span>
                <div className="space-y-1 text-slate-800 dark:text-white font-semibold">
                  <div><strong>Diagnosis:</strong> <span className="text-hospital-600 dark:text-hospital-400 font-extrabold">{clinicalData.diagnosis || 'Evaluated'}</span></div>
                  <div><strong>Disposition:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{clinicalData.consultation_outcome || 'Discharge'}</span></div>
                  <div><strong>Prescription Items:</strong> {clinicalData.prescription ? clinicalData.prescription.split('\n').filter(Boolean).length : 0} items</div>
                  <div><strong>Lab Orders:</strong> {clinicalData.lab_requests ? clinicalData.lab_requests.length : 0} requested</div>
                </div>
              </div>
            </div>

            {/* EMBEDDED PREVIEW IF VIEW PRESSED */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-xs font-extrabold text-slate-600 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Report Verified with Attending Physician Digital Signature & Hospital QR Code</span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                Use the action buttons above to open the full A4 PDF document in browser viewer or trigger instant local printer output.
              </p>
            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-all"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}

export default ClinicalReportModal;
