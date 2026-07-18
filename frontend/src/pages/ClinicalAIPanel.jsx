import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, UploadCloud, CheckCircle, AlertTriangle, AlertCircle, 
  RefreshCw, Clipboard, HeartPulse, ShieldAlert, Send, Printer, User, BookOpen 
} from 'lucide-react';
import { aiService } from '../services/api';

function ClinicalAIPanel({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('summary'); // 'summary', 'care_plan', 'ocr', 'alerts'
  
  // Care Plan states
  const [carePlan, setCarePlan] = useState(null);
  const [carePlanApproved, setCarePlanApproved] = useState(false);
  const [savingCarePlan, setSavingCarePlan] = useState(false);

  // Risk Alerts state
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // OCR state
  const [selectedFile, setSelectedFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [savingOcr, setSavingOcr] = useState(false);

  // Patient Summary state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Vitals inputs for OCR edit
  const [ocrVitals, setOcrVitals] = useState({});
  const [ocrObservation, setOcrObservation] = useState('');
  const [ocrMeds, setOcrMeds] = useState([]);
  const [ocrDiags, setOcrDiags] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Load Patient Summary
      setSummaryLoading(true);
      const summaryRes = await aiService.getPatientSummary(patientId);
      setSummary(summaryRes);
      setSummaryLoading(false);

      // Load Care Plan
      const planRes = await aiService.getCarePlan(patientId);
      setCarePlan(planRes);
      setCarePlanApproved(planRes.is_approved);

      // Load Alerts
      setAlertsLoading(true);
      const alertsRes = await aiService.getRiskAlerts(patientId);
      setAlerts(alertsRes);
      setAlertsLoading(false);

    } catch (err) {
      console.error('Error fetching Clinical AI panel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  // Care Plan handler
  const handleSaveCarePlan = async (e) => {
    e.preventDefault();
    if (!carePlan) return;
    setSavingCarePlan(true);
    try {
      const data = {
        ...carePlan,
        is_approved: carePlanApproved
      };
      await aiService.updateCarePlan(patientId, data);
      alert("Care plan approved and saved successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCarePlan(false);
    }
  };

  // OCR file drop handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Simulate scanning
      setOcrLoading(true);
      setOcrPreview(null);
      setTimeout(async () => {
        try {
          const res = await aiService.uploadOcrReport(patientId, file.name);
          setOcrPreview(res);
          setOcrVitals(res.vitals || {});
          setOcrObservation(res.doctor_observations || '');
          setOcrMeds(res.medicine_names || []);
          setOcrDiags(res.diagnoses || []);
        } catch (err) {
          console.error(err);
        } finally {
          setOcrLoading(false);
        }
      }, 2000);
    }
  };

  const handleSaveOcrResult = async () => {
    if (!ocrPreview) return;
    setSavingOcr(true);
    try {
      const data = {
        patient_id: patientId,
        vitals: ocrVitals,
        blood_test_values: ocrPreview.blood_test_values || {},
        doctor_observations: ocrObservation,
        medicine_names: ocrMeds,
        diagnoses: ocrDiags
      };
      await aiService.saveOcrReport(data);
      alert("OCR Lab values integrated into patient chart!");
      setOcrPreview(null);
      setSelectedFile(null);
      fetchData(); // Refresh summary and alerts
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOcr(false);
    }
  };

  const handleResolveAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    alert("Alert marked as acknowledged/resolved.");
  };

  const triggerPrintPdf = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[520px] transition-all">
      
      {/* Selector Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-850 pb-3 mb-4 shrink-0 overflow-x-auto space-x-1.5 scrollbar-thin">
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'summary' 
              ? 'bg-hospital-50 dark:bg-hospital-950 text-hospital-500 font-extrabold' 
              : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Clinical Summary
        </button>
        <button
          onClick={() => setActiveSubTab('care_plan')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'care_plan' 
              ? 'bg-hospital-50 dark:bg-hospital-950 text-hospital-500 font-extrabold' 
              : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Care Plan Builder
        </button>
        <button
          onClick={() => setActiveSubTab('ocr')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'ocr' 
              ? 'bg-hospital-50 dark:bg-hospital-950 text-hospital-500 font-extrabold' 
              : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          OCR Report Scan
        </button>
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
            activeSubTab === 'alerts' 
              ? 'bg-hospital-50 dark:bg-hospital-950 text-hospital-500 font-extrabold' 
              : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Risk Alerts 
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center animate-bounce">
              {alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* SUB-TABS INTERFACE PANELS */}
      <div className="flex-grow overflow-y-auto pr-1 text-xs">
        
        {/* ==============================================
            A. CLINICAL PATIENT SUMMARY TAB
            ============================================== */}
        {activeSubTab === 'summary' && summary && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Demographic header */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-hospital-50 dark:bg-hospital-950 rounded-full flex items-center justify-center text-hospital-500 font-black text-sm uppercase">
                  {summary.patient_info.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">{summary.patient_info.name}</h4>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    Age: {summary.patient_info.age} | Gender: {summary.patient_info.gender} | Blood: {summary.patient_info.blood_group}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-hospital-500 block">{summary.health_score}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Health Score</span>
              </div>
            </div>

            {/* Diagnostics and medications grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-1.5">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Diagnosed Conditions</span>
                {summary.major_diagnoses.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {summary.major_diagnoses.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-350 font-bold">{d}</span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 font-bold">No active clinical diagnoses logged.</span>
                )}
              </div>

              <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-1.5">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Active Medications</span>
                {summary.current_medications.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {summary.current_medications.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold font-mono">{m}</span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 font-bold">No active medication records.</span>
                )}
              </div>
            </div>

            {/* Vitals summary block */}
            <div className="p-3 bg-slate-50/50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-2">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Latest Logged Vital Parameters</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 border border-slate-100 dark:border-slate-900 rounded-xl bg-white dark:bg-slate-900">
                  <span className="text-[8px] uppercase text-slate-400 font-extrabold">Systolic BP</span>
                  <span className="text-xs font-black text-slate-700 dark:text-white block mt-0.5">{summary.latest_vitals.systolic_bp || 120} mmHg</span>
                </div>
                <div className="p-2 border border-slate-100 dark:border-slate-900 rounded-xl bg-white dark:bg-slate-900">
                  <span className="text-[8px] uppercase text-slate-400 font-extrabold">Heart Rate</span>
                  <span className="text-xs font-black text-slate-700 dark:text-white block mt-0.5">{summary.latest_vitals.heart_rate || 72} BPM</span>
                </div>
                <div className="p-2 border border-slate-100 dark:border-slate-900 rounded-xl bg-white dark:bg-slate-900">
                  <span className="text-[8px] uppercase text-slate-400 font-extrabold">Blood Glucose</span>
                  <span className="text-xs font-black text-slate-700 dark:text-white block mt-0.5">{summary.latest_vitals.blood_glucose || 98} mg/dL</span>
                </div>
              </div>
            </div>

            {/* Action and Print */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-slate-400 font-bold">Allergies: <strong className="text-rose-500 font-extrabold">{summary.patient_info.allergies}</strong></span>
              <button
                type="button"
                onClick={triggerPrintPdf}
                className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Export Print-Ready PDF</span>
              </button>
            </div>

          </div>
        )}

        {/* ==============================================
            B. PERSONALIZED CARE PLAN BUILDER TAB
            ============================================== */}
        {activeSubTab === 'care_plan' && carePlan && (
          <form onSubmit={handleSaveCarePlan} className="space-y-4 animate-fadeIn">
            
            {/* Input cards list */}
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              <div>
                <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Diet recommendations</label>
                <input
                  type="text"
                  value={carePlan.diet_recommendations || ''}
                  onChange={(e) => setCarePlan({...carePlan, diet_recommendations: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Exercise & activity suggestions</label>
                <input
                  type="text"
                  value={carePlan.exercise_suggestions || ''}
                  onChange={(e) => setCarePlan({...carePlan, exercise_suggestions: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Medication Compliance Reminders</label>
                  <input
                    type="text"
                    value={carePlan.medication_reminders || ''}
                    onChange={(e) => setCarePlan({...carePlan, medication_reminders: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Hydration & water goals</label>
                  <input
                    type="text"
                    value={carePlan.hydration_goals || ''}
                    onChange={(e) => setCarePlan({...carePlan, hydration_goals: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Sleep guidelines</label>
                  <input
                    type="text"
                    value={carePlan.sleep_recommendations || ''}
                    onChange={(e) => setCarePlan({...carePlan, sleep_recommendations: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-extrabold block uppercase">Vaccination schedule</label>
                  <input
                    type="text"
                    value={carePlan.vaccinations || ''}
                    onChange={(e) => setCarePlan({...carePlan, vaccinations: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Check approval and save */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-850">
              <label className="flex items-center space-x-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={carePlanApproved}
                  onChange={(e) => setCarePlanApproved(e.target.checked)}
                  className="rounded border-slate-350 text-hospital-500 accent-hospital-500"
                />
                <span>Approve plan for patient release</span>
              </label>

              <button
                type="submit"
                disabled={savingCarePlan}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-sm"
              >
                {savingCarePlan ? "Saving Plan..." : "Verify & Save Plan"}
              </button>
            </div>

          </form>
        )}

        {/* ==============================================
            C. OCR REPORT SCANNER TAB
            ============================================== */}
        {activeSubTab === 'ocr' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* File Selector Zone */}
            {!selectedFile ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950 text-center">
                <UploadCloud className="h-10 w-10 text-slate-400 mb-2" />
                <label className="px-4 py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold rounded-xl shadow-sm text-center cursor-pointer transition-colors block">
                  Select Lab PDF / Image
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-slate-400 font-bold block mt-2">Supports PDF, PNG, JPG files. Simulated scanner will extract vitals and diagnostic details.</span>
              </div>
            ) : ocrLoading ? (
              <div className="space-y-2 py-12 text-center">
                <div className="w-8 h-8 border-3 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <span className="text-xs text-slate-400 font-bold block">Running OCR computer vision filters...</span>
              </div>
            ) : ocrPreview ? (
              <div className="space-y-3 animate-fadeIn">
                
                {/* File summary */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-hospital-500" />
                    <span className="font-bold">{selectedFile.name}</span>
                  </div>
                  <button 
                    onClick={() => { setSelectedFile(null); setOcrPreview(null); }} 
                    className="text-[9px] font-black text-rose-500 hover:underline uppercase"
                  >
                    Discard
                  </button>
                </div>

                {/* Editable results form */}
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[8px] text-slate-400 font-extrabold uppercase">Systolic BP</label>
                      <input
                        type="number"
                        value={ocrVitals.systolic_bp || 120}
                        onChange={(e) => setOcrVitals({...ocrVitals, systolic_bp: parseFloat(e.target.value)})}
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-transparent rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 font-extrabold uppercase">Heart Rate</label>
                      <input
                        type="number"
                        value={ocrVitals.heart_rate || 72}
                        onChange={(e) => setOcrVitals({...ocrVitals, heart_rate: parseFloat(e.target.value)})}
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-transparent rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 font-extrabold uppercase">Temperature</label>
                      <input
                        type="number"
                        value={ocrVitals.temperature || 98.6}
                        onChange={(e) => setOcrVitals({...ocrVitals, temperature: parseFloat(e.target.value)})}
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-transparent rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[8px] text-slate-400 font-extrabold uppercase block">Extracted Observations</label>
                    <textarea
                      value={ocrObservation}
                      onChange={(e) => setOcrObservation(e.target.value)}
                      rows={2}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] text-slate-400 font-extrabold uppercase block">Medicine suggestions (Comma split)</label>
                      <input
                        type="text"
                        value={ocrMeds.join(', ')}
                        onChange={(e) => setOcrMeds(e.target.value.split(',').map(s => s.trim()))}
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-transparent rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-400 font-extrabold uppercase block">Extracted Diagnosis</label>
                      <input
                        type="text"
                        value={ocrDiags.join(', ')}
                        onChange={(e) => setOcrDiags(e.target.value.split(',').map(s => s.trim()))}
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-transparent rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveOcrResult}
                  disabled={savingOcr}
                  className="w-full py-2.5 bg-hospital-500 hover:bg-hospital-600 text-white font-bold rounded-xl shadow-sm text-center"
                >
                  {savingOcr ? "Integrating records..." : "Accept OCR & Save to Patient File"}
                </button>

              </div>
            ) : null}

          </div>
        )}

        {/* ==============================================
            D. RISK ALERTS MONITOR TAB
            ============================================== */}
        {activeSubTab === 'alerts' && (
          <div className="space-y-3 animate-fadeIn">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">Active Patient Risk Alerts</span>
            
            {alertsLoading ? (
              <div className="space-y-2 py-8 text-center animate-pulse">
                <div className="w-6 h-6 border-2 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <span className="text-xs text-slate-400 font-bold block">Evaluating clinical alerts...</span>
              </div>
            ) : alerts.length > 0 ? (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {alerts.map((alert) => {
                  let alertClass = "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950";
                  let priorityLabel = alert.priority;
                  let dot = "🟢";

                  if (alert.priority === 'Critical') {
                    alertClass = "border-rose-200 dark:border-rose-950 bg-rose-500/5 text-rose-800 dark:text-rose-400";
                    dot = "🔴";
                  } else if (alert.priority === 'High') {
                    alertClass = "border-orange-200 dark:border-orange-950 bg-orange-500/5 text-orange-800 dark:text-orange-400";
                    dot = "🟠";
                  } else if (alert.priority === 'Medium') {
                    alertClass = "border-amber-200 dark:border-amber-950 bg-amber-500/5 text-amber-800 dark:text-amber-400";
                    dot = "🟡";
                  }

                  return (
                    <div 
                      key={alert.id}
                      className={`p-3.5 border rounded-2xl flex justify-between items-start gap-4 transition-all ${alertClass}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider">{dot} {alert.alert_type}</span>
                        </div>
                        <p className="font-semibold leading-relaxed text-slate-700 dark:text-slate-350">{alert.description}</p>
                      </div>
                      
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300"
                      >
                        Acknowledge
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 border border-slate-100 dark:border-slate-900 rounded-3xl bg-slate-50/20">
                <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <span className="font-bold text-xs">All patient vital parameters stable. No active alerts.</span>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}

export default ClinicalAIPanel;
