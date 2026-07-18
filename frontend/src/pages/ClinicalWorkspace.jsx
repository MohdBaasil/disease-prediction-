import React, { useState, useEffect } from 'react';
import { 
  Activity, Sparkles, AlertTriangle, HelpCircle, 
  Clock, CheckCircle, FileText, User, Heart, ShieldAlert, BookOpen
} from 'lucide-react';
import { clinicalService } from '../services/api';

const CLINICAL_TEMPLATES = {
  general: {
    name: "General Checkup",
    diagnosis: "General checkup & wellness review",
    notes: "Chief Complaint: Routine health screening.\nSymptoms: Patient reports feeling well; no acute clinical complaints.\nPhysical Exam: Chest clear, abdomen soft, no pedal edema.\nPlan: Maintain healthy active lifestyle, routine yearly physical review."
  },
  diabetes: {
    name: "Diabetes",
    diagnosis: "Type 2 Diabetes Mellitus",
    notes: "Chief Complaint: Glycemic control monitoring.\nSymptoms: Occasional mild fatigue; no active polyuria or polydipsia.\nPhysical Exam: Diabetic foot screen negative for neuropathy/ulcers.\nPlan: Restrict simple carbohydrates, daily foot checks, maintain blood sugar charting."
  },
  hypertension: {
    name: "Hypertension",
    diagnosis: "Essential Hypertension",
    notes: "Chief Complaint: Blood pressure assessment.\nSymptoms: No headache, blurred vision, or palpitations.\nPhysical Exam: Normal heart sounds; no signs of fluid retention.\nPlan: Low sodium diet (<2g daily), DASH compliance, daily home BP checks."
  },
  respiratory: {
    name: "Respiratory check",
    diagnosis: "Reactive Airway Disease / Asthma",
    notes: "Chief Complaint: Wheezing and bronchial check.\nSymptoms: Mild exertional dyspnea; occasional dry cough.\nPhysical Exam: Bilateral mild expiratory wheeze; chest expansion equal.\nPlan: Keep rescue inhaler at hand; avoid smoke/dust triggers; peak flow meter logs."
  },
  cardiology: {
    name: "Cardiology consult",
    diagnosis: "Ischemic Heart Disease / Chest discomfort monitoring",
    notes: "Chief Complaint: Cardiovascular status screening.\nSymptoms: No active chest pressure, radiating pain, or orthopnea.\nPhysical Exam: Regular rate and rhythm; no murmurs or carotid bruits.\nPlan: Low fat diet, strict cardiac rest upon fatigue, immediate emergency check if chest pain develops."
  },
  emergency: {
    name: "Emergency Triage",
    diagnosis: "Emergency status triage review",
    notes: "Chief Complaint: Acute vital parameters instability.\nSymptoms: Severe discomfort/pain; shortness of breath.\nPhysical Exam: Tachycardic, borderline low oxygen levels, active distress.\nPlan: Immediate resuscitation protocol, stabilize vitals, direct emergency monitoring."
  }
};

function ClinicalWorkspace({ patientId, currentDiagnosis, currentPrescription, onApplyNotes, onApplyDiagnosis }) {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'assistant', 'prescription', 'recommendations'
  
  // Clinical data states
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [assistant, setAssistant] = useState(null);
  const [prescriptionAlerts, setPrescriptionAlerts] = useState([]);
  const [followupRec, setFollowupRec] = useState(null);
  const [patientFlag, setPatientFlag] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load patient basic summary & timeline
  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      const [sumRes, timeRes] = await Promise.all([
        clinicalService.getPatientSummary(patientId),
        clinicalService.getTimeline(patientId)
      ]);
      setSummary(sumRes);
      setTimeline(timeRes);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch workspace records.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch flags, assistant summaries, and non-blocking guidelines
  const loadClinicalAssistant = async () => {
    setAssistantLoading(true);
    try {
      const payload = { 
        patient_id: patientId, 
        symptoms: summary?.patient?.allergies || '',
        diagnosis: currentDiagnosis 
      };

      const [assRes, flagRes, recRes, followRes] = await Promise.all([
        clinicalService.getAssistantSummary(payload),
        clinicalService.getPatientFlags(payload),
        clinicalService.getClinicalDecisionSupport({ patient_id: patientId, diagnosis: currentDiagnosis }),
        clinicalService.getFollowupRecommendation({ patient_id: patientId, diagnosis: currentDiagnosis, risk_level: assistant?.risk_level })
      ]);

      setAssistant(assRes);
      setPatientFlag(flagRes);
      setRecommendations(recRes);
      setFollowupRec(followRes);
    } catch (err) {
      console.error("Clinical assistant load error:", err);
    } finally {
      setAssistantLoading(false);
    }
  };

  // Run initial data load
  useEffect(() => {
    if (patientId) {
      loadWorkspaceData();
    }
  }, [patientId]);

  // Run clinical assistant analysis when diagnosis inputs change
  useEffect(() => {
    if (!loading && patientId) {
      loadClinicalAssistant();
    }
  }, [loading, patientId, currentDiagnosis]);

  // Helper to parse drug names from the raw prescription textbox input
  const parseMedicines = (prescriptionStr) => {
    if (!prescriptionStr) return [];
    return prescriptionStr
      .split(/[,;\n]/)
      .map(m => m.trim().split(/\s+/)[0]) // take first token (e.g. "Amoxicillin 500mg" -> "Amoxicillin")
      .filter(m => m.length > 2);
  };

  // Evaluate prescription screening
  useEffect(() => {
    const checkPrescriptionAlerts = async () => {
      if (!patientId) return;
      const parsedMeds = parseMedicines(currentPrescription);
      if (parsedMeds.length === 0) {
        setPrescriptionAlerts([]);
        return;
      }
      setAlertsLoading(true);
      try {
        const res = await clinicalService.getPrescriptionScreening({
          patient_id: patientId,
          medicines: parsedMeds
        });
        setPrescriptionAlerts(res.warnings || []);
      } catch (err) {
        console.error("Error screening prescription:", err);
      } finally {
        setAlertsLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      checkPrescriptionAlerts();
    }, 700);

    return () => clearTimeout(delayDebounce);
  }, [patientId, currentPrescription]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm h-full">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-850 rounded animate-pulse"></div>
        <div className="h-10 bg-slate-200 dark:bg-slate-850 rounded-xl animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-20 bg-slate-100 dark:bg-slate-850 rounded-xl animate-pulse"></div>
          <div className="h-28 bg-slate-100 dark:bg-slate-850 rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Get flag color class
  const getFlagClasses = (color) => {
    switch (color) {
      case 'red': return 'bg-red-50 text-red-700 dark:bg-red-950/45 dark:text-red-400 border border-red-200 dark:border-red-900/50';
      case 'orange': return 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50';
      case 'yellow': return 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-250/60 dark:border-yellow-900/50';
      default: return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5 h-full flex flex-col">
      
      {/* Top section: Patient flags & Vitals */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-850 pb-3 gap-3">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Clinical Flag Triage</span>
          {patientFlag ? (
            <div className={`mt-1 px-3 py-1 rounded-xl text-xs font-black inline-flex items-center space-x-1 ${getFlagClasses(patientFlag.color)}`}>
              <span>{patientFlag.flag}</span>
            </div>
          ) : (
            <div className="h-5 w-24 bg-slate-100 dark:bg-slate-850 rounded animate-pulse mt-1"></div>
          )}
        </div>

        {/* Dynamic Vitals Preview */}
        {summary?.vitals && (
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <span className="px-2.5 py-1 bg-slate-555/5 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-lg text-slate-500">
              BP: <strong className="text-slate-700 dark:text-slate-200">{summary.vitals.systolic_bp || 120}/80 mmHg</strong>
            </span>
            <span className="px-2.5 py-1 bg-slate-555/5 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-lg text-slate-500">
              HR: <strong className="text-slate-700 dark:text-slate-200">{summary.vitals.heart_rate || 72} bpm</strong>
            </span>
            <span className="px-2.5 py-1 bg-slate-555/5 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-lg text-slate-500">
              Sugar: <strong className="text-slate-700 dark:text-slate-200">{summary.vitals.blood_glucose || 95} mg/dL</strong>
            </span>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex p-1 bg-slate-105 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850 rounded-2xl shadow-inner shrink-0">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-grow py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'timeline'
              ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Timeline</span>
        </button>
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex-grow py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'assistant'
              ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Assistant</span>
        </button>
        <button
          onClick={() => setActiveTab('prescription')}
          className={`flex-grow py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'prescription'
              ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Alerts ({prescriptionAlerts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex-grow py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'recommendations'
              ? 'bg-white dark:bg-slate-800 text-hospital-500 dark:text-white shadow-sm'
              : 'text-slate-550 hover:text-slate-800'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Guidelines</span>
        </button>
      </div>

      {/* Main scrolling workspace section */}
      <div className="flex-grow overflow-y-auto pr-1">
        
        {/* ==========================================
            TAB 1: CLINICAL TIMELINE
            ========================================== */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            
            {/* Vitals Summary Card */}
            {summary && (
              <div className="p-4 bg-slate-555/5 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                  <User className="h-4 w-4 text-hospital-500" />
                  <span>Clinical Patient Details</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><strong className="text-slate-400">Allergies:</strong> <span className="text-rose-500 font-semibold">{summary.patient.allergies}</span></div>
                  <div><strong className="text-slate-400">Blood Group:</strong> <span className="font-semibold">{summary.patient.blood_group}</span></div>
                  <div><strong className="text-slate-400">Emergency Contact:</strong> <span className="font-semibold">{summary.patient.emergency_contact}</span></div>
                  <div><strong className="text-slate-400">Mobile:</strong> <span className="font-semibold">{summary.patient.mobile}</span></div>
                </div>

                {summary.current_medications.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-150/60 dark:border-slate-800">
                    <strong className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Active Prescribed Medications:</strong>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.current_medications.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-hospital-50 dark:bg-hospital-950/40 text-hospital-600 dark:text-hospital-400 text-[10px] font-bold rounded-lg border border-hospital-100 dark:border-hospital-900/35">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline component */}
            <div className="relative pl-6 border-l-2 border-slate-250 dark:border-slate-800 space-y-5 py-2">
              {timeline.length > 0 ? (
                timeline.map((event, index) => {
                  let eventColor = "bg-hospital-500 text-white";
                  if (event.type === 'Registration') eventColor = "bg-slate-600 text-white";
                  if (event.type === 'AI Prediction') eventColor = "bg-cyan-500 text-white";
                  if (event.type === 'Prescription') eventColor = "bg-purple-500 text-white";
                  if (event.type === 'Lab Report') eventColor = "bg-amber-500 text-white";
                  if (event.type === 'Follow-up') eventColor = "bg-blue-500 text-white";

                  return (
                    <div key={index} className="relative group">
                      {/* Timeline circle node */}
                      <span className={`absolute -left-[31px] top-1 h-5.5 w-5.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${eventColor}`}>
                        {event.type[0]}
                      </span>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold block">
                          {new Date(event.date).toLocaleDateString()} at {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h5 className="text-xs font-black text-slate-800 dark:text-white">{event.title}</h5>
                        <p className="text-xs text-slate-555 dark:text-slate-355">{event.description}</p>
                        {event.details && (
                          <span className="text-[10px] text-slate-400 block pt-0.5 font-medium">{event.details}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">No timeline events logged.</div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: AI CLINICAL ASSISTANT
            ========================================== */}
        {activeTab === 'assistant' && (
          <div className="space-y-4">
            
            {/* Quick Consultation Templates Loader */}
            <div className="p-4 bg-slate-555/5 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                <BookOpen className="h-4 w-4 text-hospital-500" />
                <span>Intelligent Templates Dispatcher</span>
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(CLINICAL_TEMPLATES).map(([key, item]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onApplyDiagnosis(item.diagnosis);
                      onApplyNotes(item.notes);
                    }}
                    className="p-2 border border-slate-200 dark:border-slate-800 hover:border-hospital-500 rounded-xl text-[10px] font-bold text-left transition-all active:scale-[0.98] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Assistant Output */}
            {assistantLoading ? (
              <div className="space-y-3 py-6 animate-pulse">
                <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
                <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
              </div>
            ) : assistant ? (
              <div className="space-y-4">
                
                {/* Narrated Clinical Summary */}
                <div className="p-4 bg-cyan-50/20 dark:bg-cyan-950/20 border border-cyan-150/40 dark:border-cyan-900/50 rounded-2xl space-y-1.5 animate-fadeIn">
                  <h4 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center space-x-1.5">
                    <Sparkles className="h-4 w-4 text-cyan-500" />
                    <span>AI-Powered Narrative Synthesis</span>
                  </h4>
                  <p className="text-xs text-slate-750 dark:text-slate-350 leading-relaxed font-semibold">
                    {assistant.summary}
                  </p>
                </div>

                {/* Complications & Risks */}
                <div className="space-y-2">
                  <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Possible Complications & Pathologies</h4>
                  <div className="space-y-1.5">
                    {assistant.complications.map((c, idx) => (
                      <div key={idx} className="p-2.5 bg-rose-50/20 dark:bg-rose-950/15 border border-rose-150/30 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Patient risk factors history highlights */}
                <div className="space-y-2">
                  <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Important Medical History Alerts</h4>
                  <ul className="list-disc pl-5 text-xs text-slate-650 dark:text-slate-350 space-y-1 font-medium">
                    {assistant.important_history.map((h, idx) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>

                {/* Suggested actions list */}
                <div className="space-y-2">
                  <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Suggested Care Actions</h4>
                  <div className="space-y-1.5">
                    {assistant.suggested_actions.map((a, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs flex items-center space-x-2 font-medium">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Specialty Referral */}
                <div className="p-3 bg-violet-50/20 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider block">Suggested Specialist Referral</span>
                    <strong className="text-violet-700 dark:text-violet-400">{assistant.specialist_referral}</strong>
                  </div>
                </div>

              </div>
            ) : null}

          </div>
        )}

        {/* ==========================================
            TAB 3: PRESCRIPTION ALERTS
            ========================================== */}
        {activeTab === 'prescription' && (
          <div className="space-y-4">
            
            {/* Follow-up Recommendation widget at top */}
            {followupRec && (
              <div className="p-4 bg-slate-555/5 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5">
                    <Clock className="h-4 w-4 text-hospital-500" />
                    <span>Follow-up Recommendation Engine</span>
                  </h4>
                  <span className="px-2.5 py-0.5 bg-hospital-50 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400 font-black rounded-lg text-xs">
                    {followupRec.recommended_interval}
                  </span>
                </div>
                <p className="text-xs text-slate-550 dark:text-slate-355">{followupRec.reason}</p>
                
                {/* Available choices to quickly set followup */}
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  {followupRec.available_options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onApplyNotes(prev => {
                          const separator = "\n\n";
                          const added = `Follow-up interval set: Care checkup in ${opt}.`;
                          if (prev.includes("Follow-up interval set:")) {
                            return prev.replace(/Follow-up interval set: Care checkup in.*/, added);
                          }
                          return prev ? `${prev}${separator}${added}` : added;
                        });
                      }}
                      className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 hover:border-hospital-500 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts List */}
            <div className="space-y-3">
              <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Prescription Safety Checks</h4>
              
              {alertsLoading ? (
                <div className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
              ) : prescriptionAlerts.length > 0 ? (
                prescriptionAlerts.map((w, idx) => {
                  let alertTheme = "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400";
                  if (w.severity === 'Medium') {
                    alertTheme = "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400";
                  } else if (w.severity === 'High') {
                    alertTheme = "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/20 dark:border-orange-900/50 dark:text-orange-400";
                  }

                  return (
                    <div key={idx} className={`p-4 rounded-2xl border ${alertTheme} space-y-1.5 flex items-start space-x-2.5 animate-fadeIn`}>
                      <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block">{w.type}</span>
                        <p className="text-xs leading-relaxed font-semibold">{w.message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-450 border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl text-xs space-y-1">
                  <div>No safety alerts detected.</div>
                  <div className="text-[10px] text-slate-400">Type medications in the prescription field to perform live drug screenings.</div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ==========================================
            TAB 4: GUIDELINES & DECISION SUPPORT
            ========================================== */}
        {activeTab === 'recommendations' && recommendations && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Suggested Diagnostics */}
            {recommendations.suggested_investigations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Suggested Investigations</h4>
                <div className="flex flex-wrap gap-1.5">
                  {recommendations.suggested_investigations.map((i, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-555/5 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lifestyle Advice */}
            {recommendations.lifestyle_advice.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Clinical Lifestyle Advice</h4>
                <div className="space-y-1.5">
                  {recommendations.lifestyle_advice.map((l, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-555/5 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-650 dark:text-slate-355">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preventive screening checks */}
            {recommendations.preventive_screening.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Preventive Screening Guidelines</h4>
                <div className="space-y-1.5">
                  {recommendations.preventive_screening.map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-hospital-50/20 dark:bg-hospital-950/15 border border-hospital-100 dark:border-hospital-900/35 rounded-xl text-xs font-semibold text-slate-650 dark:text-slate-355 flex items-center space-x-2">
                      <Heart className="h-4 w-4 text-hospital-500 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccinations */}
            {recommendations.vaccination_reminders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Vaccination Reminders</h4>
                <div className="flex flex-wrap gap-1.5">
                  {recommendations.vaccination_reminders.map((v, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-teal-50/25 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/35 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-400">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default ClinicalWorkspace;
