import React, { useState, useEffect } from 'react';
import {
  Stethoscope, Sparkles, Brain, CheckCircle, AlertTriangle, Calendar,
  User, Clock, Printer, Download, Search, Plus, ChevronDown, ChevronUp,
  RefreshCw, ShieldAlert, FileText, Check, Activity, FlaskConical, Pill,
  Info, ArrowRight, Shield, Heart, Eye, ListFilter, ClipboardCheck,
  Compass, ShieldCheck
} from 'lucide-react';
import { patientService, appointmentsService } from '../../services/api';

export default function HealthScore() {
  const [patient, setPatient] = useState(null);
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [symptomSearch, setSymptomSearch] = useState('');

  // Vitals form
  const defaultVitals = { age: '', bmi: '24.5', blood_glucose: '90', heart_rate: '75', temperature: '98.2', systolic_bp: '115' };
  const [vitalsForm, setVitalsForm] = useState(defaultVitals);
  const [vitalsCollapsed, setVitalsCollapsed] = useState(true);

  // Active Report / Prediction State
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionError, setPredictionError] = useState('');

  // History State
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');

  // SubTab View ('new' for analysis input, 'history' for past reports)
  const [activeSubTab, setActiveSubTab] = useState('new');

  const loadInitialData = async () => {
    try {
      const [profileData, symptomsData, historyData] = await Promise.allSettled([
        patientService.getMe(),
        patientService.getSymptoms(),
        patientService.getPredictionHistory()
      ]);

      if (profileData.status === 'fulfilled') {
        const p = profileData.value;
        setPatient(p);
        setVitalsForm(prev => ({
          ...prev,
          age: p?.age ? p.age.toString() : ''
        }));
      }

      if (symptomsData.status === 'fulfilled') {
        setAllSymptoms(symptomsData.value || []);
      }

      if (historyData.status === 'fulfilled') {
        setPredictionHistory(historyData.value || []);
      }
    } catch (err) {
      console.error("Failed to initialize AI HealthScore data:", err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleToggleSymptom = (sym) => {
    setSelectedSymptoms(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const handleRunPrediction = async (e) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0) {
      setPredictionError("Please select at least one symptom to run clinical prediction.");
      return;
    }

    setPredictionLoading(true);
    setPredictionError('');
    setPredictionResult(null);

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
      setPredictionResult(result);

      // Refresh history
      const historyList = await patientService.getPredictionHistory();
      setPredictionHistory(historyList || []);
    } catch (err) {
      console.error("Prediction failed:", err);
      setPredictionError(err.response?.data?.detail || "Failed to execute AI prediction. Please check your symptom inputs and try again.");
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleViewHistoricalReport = async (historyId) => {
    setPredictionLoading(true);
    setPredictionError('');
    try {
      const detail = await patientService.getPredictionDetail(historyId);
      setPredictionResult(detail);
      setActiveSubTab('new');
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (err) {
      console.error("Failed to load historical report detail:", err);
      setPredictionError("Unable to retrieve report details.");
    } finally {
      setPredictionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper: Determine Affected System from Disease Name
  const getAffectedSystem = (diseaseName = '') => {
    const name = diseaseName.toLowerCase();
    if (name.includes('diabet')) return 'Endocrine & Metabolic System';
    if (name.includes('asthma') || name.includes('cold') || name.includes('bronch') || name.includes('pneumon')) return 'Respiratory System';
    if (name.includes('migraine') || name.includes('stroke') || name.includes('headache') || name.includes('neuro')) return 'Central Nervous System';
    if (name.includes('heart') || name.includes('cardio') || name.includes('hyper') || name.includes('coronary')) return 'Cardiovascular System';
    if (name.includes('sepsis') || name.includes('infect')) return 'Immune & Systemic Vascular System';
    return 'Physiological System';
  };

  // Helper: Default Clinical Precautions Fallback
  const getDefaultPrecautions = (diseaseName = '') => {
    const name = diseaseName.toLowerCase();
    if (name.includes('diabet')) {
      return [
        'Monitor blood glucose levels consistently as advised by physician.',
        'Follow a balanced, low-glycemic dietary regimen rich in whole grains and fibers.',
        'Engage in regular light-to-moderate physical exercise daily.',
        'Schedule periodic consultations for HbA1c testing and endocrine evaluation.'
      ];
    }
    if (name.includes('asthma') || name.includes('cold')) {
      return [
        'Avoid exposure to known environmental allergens, cold air, and tobacco smoke.',
        'Keep prescribed quick-relief inhalers or medications readily accessible.',
        'Maintain proper daily hydration and adequate physical rest.',
        'Seek urgent medical care if experiencing severe shortness of breath or persistent chest tightness.'
      ];
    }
    if (name.includes('migraine') || name.includes('stroke')) {
      return [
        'Maintain a consistent sleep routine and minimize sensory or emotional stress.',
        'Stay well-hydrated and avoid skipping meals throughout the day.',
        'Limit excessive screen exposure and bright environmental lights during episodes.',
        'Consult a neurologist immediately if experiencing sudden unilateral weakness, numbness, or difficulty speaking.'
      ];
    }
    if (name.includes('heart')) {
      return [
        'Avoid strenuous exertion and monitor resting heart rate and blood pressure.',
        'Maintain a low-sodium, heart-healthy dietary plan.',
        'Refrain from tobacco and excessive caffeine intake.',
        'Seek emergency emergency services immediately if experiencing chest pain radiating to arm or jaw.'
      ];
    }
    return [
      'Monitor physiological symptoms and vital metrics daily.',
      'Avoid known environmental, dietary, or physical triggers.',
      'Ensure adequate daily physical rest, balanced nutrition, and hydration.',
      'Consult a certified healthcare provider if symptoms persist, escalate, or worsen.'
    ];
  };

  // Filter symptoms by search query
  const filteredSymptoms = allSymptoms.filter(s =>
    s.toLowerCase().includes(symptomSearch.toLowerCase())
  );

  // Filter history list
  const filteredHistory = predictionHistory.filter(item => {
    const q = historySearch.toLowerCase();
    return !q ||
      (item.predicted_disease || '').toLowerCase().includes(q) ||
      (item.symptoms && JSON.stringify(item.symptoms).toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 md:p-6 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* Global Error Banner */}
      {predictionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="font-semibold">{predictionError}</span>
          </div>
          <button onClick={() => setPredictionError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg text-rose-500">
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. ACURAQUEUE HERO SECTION */}
      <div className="relative rounded-3xl bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-purple-500/10 overflow-hidden border border-purple-400/20 dark:border-slate-800">
        <div className="absolute -top-12 -right-12 h-64 w-64 bg-white/10 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 left-1/3 h-48 w-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md border border-white/30 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                AI Clinical Prediction & Diagnostics
              </span>
              <span className="text-xs text-purple-100 dark:text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Machine Learning Model
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              AI Clinical HealthScore & Predictor
            </h1>

            <p className="text-xs sm:text-sm text-purple-50 dark:text-slate-300 leading-relaxed font-normal">
              Analyze your current physiological vitals and reported symptoms using AcuraQueue's trained machine-learning clinical prediction engine.
            </p>

            {patient && (
              <div className="flex items-center space-x-3 pt-2 text-xs text-purple-100 dark:text-slate-300 font-medium">
                <span>Patient: <strong className="text-white font-bold">{patient.name}</strong></span>
                <span>•</span>
                <span>ID: <strong className="text-white font-bold">#{patient.id}</strong></span>
                {patient.age && (
                  <>
                    <span>•</span>
                    <span>Age: <strong className="text-white font-bold">{patient.age} yrs</strong></span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SubTab Navigation Switcher */}
          <div className="shrink-0 flex items-center bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
            <button
              onClick={() => setActiveSubTab('new')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${activeSubTab === 'new' ? 'bg-white text-purple-700 shadow-md' : 'text-white hover:bg-white/10'}`}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              <span>New Analysis</span>
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${activeSubTab === 'history' ? 'bg-white text-purple-700 shadow-md' : 'text-white hover:bg-white/10'}`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Past Reports ({predictionHistory.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SUBTAB: NEW ANALYSIS & ACTIVE CLINICAL REPORT */}
      {/* ========================================================= */}
      {activeSubTab === 'new' && (
        <div className="space-y-6">

          {/* Symptom Selection & Vitals Form Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Symptom Checklist & Physiological Vitals
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select all active symptoms you are experiencing to generate a clinical AI analysis.</p>
              </div>

              {/* Vitals Collapse Toggle */}
              <button
                onClick={() => setVitalsCollapsed(!vitalsCollapsed)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                <span>{vitalsCollapsed ? 'Edit Vitals (Optional)' : 'Hide Vitals Form'}</span>
                {vitalsCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Collapsible Vitals Input Grid */}
            {!vitalsCollapsed && (
              <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4 animate-fadeIn">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
                  Physiological Baseline Parameters
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Age</label>
                    <input
                      type="number"
                      value={vitalsForm.age}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, age: e.target.value })}
                      placeholder="e.g. 35"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">BMI</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.bmi}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bmi: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Glucose (mg/dL)</label>
                    <input
                      type="number"
                      value={vitalsForm.blood_glucose}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, blood_glucose: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={vitalsForm.heart_rate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, heart_rate: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Temp (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Systolic BP</label>
                    <input
                      type="number"
                      value={vitalsForm.systolic_bp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, systolic_bp: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Symptom Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={symptomSearch}
                onChange={(e) => setSymptomSearch(e.target.value)}
                placeholder="Filter symptoms (e.g. Chest Pain, Headache, Shortness of Breath)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Symptom Pills Selector */}
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 scrollbar-none">
              {filteredSymptoms.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleToggleSymptom(sym)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center space-x-1.5 border hover:scale-[1.02] active:scale-[0.98] ${isSelected ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-md shadow-purple-500/20' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>{sym}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 ml-1 font-black" />}
                  </button>
                );
              })}
            </div>

            {/* Selected Count & Action Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 font-medium">
                Selected: <strong className="text-purple-600 dark:text-purple-400 font-bold">{selectedSymptoms.length} symptom(s)</strong>
              </div>

              <button
                onClick={handleRunPrediction}
                disabled={predictionLoading || selectedSymptoms.length === 0}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {predictionLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Analyzing Clinical Symptoms...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Execute AI Prediction Analysis</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* ========================================================= */}
          {/* 3. COMPLETE CLINICAL REPORT UI */}
          {/* ========================================================= */}
          {predictionResult && (
            <div id="prediction-report-print-area" className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden animate-fadeIn">
              
              {/* Top Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500"></div>

              {/* Report Header & Metadata */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                      Official Clinical AI Report
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      AcuraQueue ML Engine v2.4
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-1">
                    AI Clinical Diagnostic Report
                  </h2>
                </div>

                {/* Prediction Metadata (ID & Date) */}
                <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3 rounded-2xl text-xs space-y-0.5">
                  <div className="text-slate-500 dark:text-slate-400">
                    <strong>Prediction ID:</strong> <span className="font-mono font-bold text-purple-600 dark:text-purple-400">#PRED-{predictionResult.id}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    <strong>Prediction Date:</strong> {new Date(predictionResult.prediction_time || predictionResult.created_at || Date.now()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>

              {/* TASK 1 & 4: CONDITION PROFILE & CLINICAL SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Left 2 Cols: Condition Profile */}
                <div className="md:col-span-2 bg-gradient-to-br from-purple-50/70 to-indigo-50/40 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900/50 p-6 rounded-3xl space-y-3.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
                      Condition Profile & Etiology
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-200/60 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                      {getAffectedSystem(predictionResult.predicted_disease)}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {predictionResult.predicted_disease}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {predictionResult.details?.description || `${predictionResult.predicted_disease} identified based on clinical symptom mapping and physiological baseline analysis.`}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-purple-200/60 dark:border-purple-900/40 text-xs">
                    <div>
                      <span className="font-bold text-purple-700 dark:text-purple-300 block mb-0.5">Affected System:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{getAffectedSystem(predictionResult.predicted_disease)}</span>
                    </div>

                    <div>
                      <span className="font-bold text-purple-700 dark:text-purple-300 block mb-0.5">Specialist Physician:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{predictionResult.details?.specialist || 'Consulting Physician'}</span>
                    </div>
                  </div>

                  {predictionResult.details?.causes && (
                    <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40 text-xs">
                      <span className="font-bold text-purple-700 dark:text-purple-300 block mb-0.5">Clinical Etiology & Causes:</span>
                      <span className="text-slate-600 dark:text-slate-400">{predictionResult.details.causes}</span>
                    </div>
                  )}
                </div>

                {/* Right 1 Col: Clinical Summary */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block flex items-center gap-1">
                      <ClipboardCheck className="h-3.5 w-3.5 text-purple-500" />
                      Clinical Summary
                    </span>

                    <div className="space-y-2 text-xs border-b border-slate-100 dark:border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Predicted Disease</span>
                        <strong className="text-slate-800 dark:text-white block font-extrabold text-sm">{predictionResult.predicted_disease}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Department</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{predictionResult.details?.department || 'General Medicine'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Recommended Specialist</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{predictionResult.details?.specialist || 'Consulting Physician'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Prediction Date</span>
                        <span className="text-slate-500 font-medium">
                          {new Date(predictionResult.prediction_time || predictionResult.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => window.location.hash = '#/patient/appointments'}
                    className="w-full bg-hospital-500 hover:bg-hospital-600 text-white font-bold py-2.5 px-4 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Book Specialist Visit</span>
                  </button>
                </div>

              </div>

              {/* TASK 3: SYMPTOMS REVIEWED SECTION */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Symptoms Reviewed & Submitted ({predictionResult.symptoms?.length || 0})
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    ML Feature Verification Complete
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {predictionResult.symptoms && predictionResult.symptoms.map((sym, idx) => (
                    <span
                      key={idx}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 shadow-xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <span>{sym}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* TASK 2 & 6: PRECAUTIONS & CLINICAL RECOMMENDATIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                
                {/* Precautions */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Clinical Precautions & Care Instructions
                  </span>
                  
                  {(() => {
                    const precList = (predictionResult.details?.precautions && predictionResult.details.precautions.length > 0)
                      ? predictionResult.details.precautions
                      : getDefaultPrecautions(predictionResult.predicted_disease);

                    return (
                      <div className="space-y-2">
                        {precList.map((prec, i) => (
                          <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-start space-x-2.5">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                            <span className="leading-relaxed">{prec}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Recommendations, Next Steps & Follow-up Advice */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block flex items-center gap-1.5">
                    <Compass className="h-4 w-4" />
                    Next Steps & Clinical Recommendations
                  </span>

                  <div className="space-y-2.5 text-xs">
                    {/* Next steps list */}
                    <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-2">
                      <strong className="text-purple-700 dark:text-purple-300 block font-extrabold uppercase text-[10px] tracking-wider">
                        Recommended Action Plan:
                      </strong>
                      <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc list-inside font-medium">
                        <li>Schedule an outpatient appointment with a <strong className="text-purple-600 dark:text-purple-400">{predictionResult.details?.specialist || 'Specialist'}</strong>.</li>
                        <li>Log daily symptom onset, frequency, and intensity patterns.</li>
                        <li>Maintain routine vitals tracking (blood pressure, pulse, temperature).</li>
                        <li>Seek immediate emergency care if acute red-flag symptoms develop.</li>
                      </ul>
                    </div>

                    {/* Dietary / Fitness fallback */}
                    {predictionResult.details?.diet && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800/60 space-y-1">
                        <strong className="text-slate-800 dark:text-white block font-bold">Dietary Guidance:</strong>
                        <p className="text-slate-600 dark:text-slate-400">
                          {typeof predictionResult.details.diet === 'object' ? predictionResult.details.diet.recommended : predictionResult.details.diet}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* TASK 5: MEDICAL DISCLAIMER (STRICT REQUIREMENT) */}
              <div className="p-4.5 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs space-y-1.5 text-amber-900 dark:text-amber-300">
                <div className="flex items-center space-x-2 font-extrabold uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Medical Disclaimer & Triage Notice</span>
                </div>
                <p className="leading-relaxed font-medium">
                  This AI Clinical Prediction Report is designed to assist clinical decision-making and provide preliminary symptom triage. It does not replace a formal diagnosis by a licensed physician or healthcare professional. Please consult an attending physician for clinical validation, diagnostic testing, and prescribed treatment plans.
                </p>
              </div>

              {/* PRINT / DOWNLOAD ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 no-print">
                <div className="text-xs text-slate-400 font-medium">
                  Report Status: <strong className="text-emerald-600 dark:text-emerald-400">ML Model Verified</strong>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button
                    onClick={handlePrint}
                    className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Clinical Report</span>
                  </button>

                  <button
                    onClick={() => setPredictionResult(null)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all"
                  >
                    Dismiss Report
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUBTAB: PREDICTION HISTORY (IF DATA EXISTS) */}
      {/* ========================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          
          {/* History Search & Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search past predicted conditions..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <span className="text-xs text-slate-400 font-medium">
              Total Recorded Logs: <strong className="text-purple-600 dark:text-purple-400">{filteredHistory.length}</strong>
            </span>
          </div>

          {/* History Cards / List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="h-16 w-16 bg-purple-50 dark:bg-purple-950 rounded-2xl flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
                <Clock className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-800 dark:text-white">No Prediction History Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Execute your first AI diagnostic prediction analysis to record clinical reports here.
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('new')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md transition-all inline-flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>New AI Prediction</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map((item) => {
                let symptomsList = [];
                try {
                  symptomsList = typeof item.symptoms === 'string' ? JSON.parse(item.symptoms) : (item.symptoms || []);
                } catch (e) {
                  symptomsList = [];
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
                          Prediction Log #PRED-{item.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(item.prediction_time || item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <h4 className="font-black text-lg text-slate-800 dark:text-white">
                        {item.predicted_disease}
                      </h4>

                      {symptomsList.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {symptomsList.slice(0, 4).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {s}
                            </span>
                          ))}
                          {symptomsList.length > 4 && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400">
                              +{symptomsList.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleViewHistoricalReport(item.id)}
                        className="px-4 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-xl transition-all flex items-center space-x-1 hover:scale-105 active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Full Clinical Report</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
