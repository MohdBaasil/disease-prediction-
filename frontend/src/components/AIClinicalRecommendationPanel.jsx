import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Stethoscope,
  Pill,
  FlaskConical,
  Utensils,
  Dumbbell,
  ShieldAlert,
  AlertTriangle,
  Check,
  X,
  Plus,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { clinicalService } from '../services/api';

function AIClinicalRecommendationPanel({ diseaseName, confidence = '85%', onAddLabTest, onAcceptMedicine }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Doctor control states
  const [dismissedMeds, setDismissedMeds] = useState([]);
  const [acceptedMeds, setAcceptedMeds] = useState([]);
  const [customMeds, setCustomMeds] = useState([]);
  const [showAddCustomMed, setShowAddCustomMed] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [addedLabTests, setAddedLabTests] = useState([]);

  const fetchRecommendations = async () => {
    if (!diseaseName || !diseaseName.trim()) {
      setData(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await clinicalService.getDiseaseRecommendations(diseaseName.trim());
      setData(res);
      setDismissedMeds([]);
      setAcceptedMeds([]);
      setCustomMeds([]);
      setAddedLabTests([]);
    } catch (err) {
      console.error('Error fetching clinical recommendations:', err);
      setError('Failed to fetch verified clinical recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [diseaseName]);

  const handleAcceptMed = (med) => {
    if (onAcceptMedicine) {
      onAcceptMedicine({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        description: med.description
      });
    }
    setAcceptedMeds((prev) => [...prev, med.name]);
  };

  const handleDismissMed = (medName) => {
    setDismissedMeds((prev) => [...prev, medName]);
  };

  const handleAddCustomMed = (e) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    const customObj = {
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || 'Consult physician dosage guidelines.',
      frequency: 'As directed by physician',
      duration: '7 days',
      description: 'Custom physician prescribed medication'
    };

    setCustomMeds((prev) => [...prev, customObj]);
    setNewMedName('');
    setNewMedDosage('');
    setShowAddCustomMed(false);
  };

  const handleAddLab = (test) => {
    if (onAddLabTest) {
      onAddLabTest({
        test_name: test.name,
        reason: test.reason || `Recommended for ${diseaseName}`,
        priority: 'Routine'
      });
    }
    setAddedLabTests((prev) => [...prev, test.name]);
  };

  // 1. EMPTY STATE (No disease or diagnosis selected)
  if (!diseaseName || !diseaseName.trim()) {
    return (
      <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-2 animate-fadeIn">
        <div className="inline-flex bg-purple-50 dark:bg-purple-950/60 p-2.5 rounded-full text-purple-500">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-extrabold text-slate-800 dark:text-white">AI Clinical Decision Support</h4>
          <p className="text-[11px] text-slate-400 font-medium">
            Enter a diagnosis or run AI prediction to view verified clinical guidelines, medicines, and lab test recommendations.
          </p>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE (Skeleton Loaders)
  if (loading) {
    return (
      <div className="space-y-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 animate-pulse">
        <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // 3. ERROR STATE
  if (error) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-center space-y-2 animate-fadeIn">
        <div className="inline-flex bg-rose-100 dark:bg-rose-900/60 p-2 rounded-full text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="font-bold text-rose-700 dark:text-rose-400">{error}</p>
        <button
          onClick={fetchRecommendations}
          className="px-3 py-1.5 bg-rose-600 text-white font-extrabold rounded-xl text-[11px] inline-flex items-center space-x-1"
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const medicines = [...(data.medicines ?? []), ...customMeds].filter(
    (m) => !dismissedMeds.includes(m.name)
  );
  const labTests = data.laboratory_tests ?? [];
  const dietList = data.diet ?? [];
  const workoutList = data.workout ?? [];
  const precautions = data.precautions ?? [];
  const riskFactors = data.risk_factors ?? [];
  const department = data.department ?? { name: 'General Medicine', specialist: 'General Practitioner' };

  // Risk badge color generator
  const getRiskBadgeColor = (idx) => {
    const colors = [
      'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-900/50',
      'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
      'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-900/50',
      'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="space-y-4 p-5 bg-gradient-to-br from-purple-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20 rounded-3xl border border-purple-200/70 dark:border-purple-900/40 shadow-sm transition-all animate-fadeIn">

      {/* ----------------------------------
          SECTION 1: HEADER & PATHOLOGY PROFILE
          ---------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-purple-100 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-500 text-white rounded-2xl shadow-md shadow-purple-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                Verified Clinical Knowledge Base
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                {confidence} Match
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{data.disease}</h3>
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-purple-100 dark:border-slate-800 flex items-center space-x-2 text-xs">
          <Stethoscope className="h-4 w-4 text-purple-500 shrink-0" />
          <div>
            <span className="text-[9px] text-slate-400 font-bold block uppercase">Recommended Specialty</span>
            <strong className="text-slate-800 dark:text-white font-extrabold">{department.name} ({department.specialist})</strong>
          </div>
        </div>
      </div>

      {/* ----------------------------------
          DOCTOR AUTHORITY DISCLAIMER BANNER
          ---------------------------------- */}
      <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center space-x-2">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-semibold">
          <strong>Doctor Authority Disclaimer:</strong> Recommendations are sourced from verified disease knowledge bases as clinical decision support aids. Attending physician holds final prescribing and ordering authority.
        </span>
      </div>

      {/* ----------------------------------
          GRID LAYOUT FOR CLINICAL SECTIONS
          ---------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* SECTION 2: VERIFIED MEDICINES & DOCTOR CONTROLS */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Pill className="h-4 w-4 text-emerald-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                Verified Medicines
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomMed(!showAddCustomMed)}
              className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-xl border border-purple-200 dark:border-purple-900/40 hover:bg-purple-100 transition-all flex items-center space-x-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add Custom Medicine</span>
            </button>
          </div>

          {/* Form to add custom medicine */}
          {showAddCustomMed && (
            <form onSubmit={handleAddCustomMed} className="p-3 bg-purple-50/50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-purple-200 dark:border-purple-800 text-xs animate-fadeIn">
              <div className="font-extrabold text-slate-800 dark:text-white text-[11px]">Add Custom Medicine Order</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="Medicine Name (e.g. Metformin)"
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-semibold text-slate-800 dark:text-white"
                  required
                />
                <input
                  type="text"
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  placeholder="Dosage (e.g. 500mg twice daily)"
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCustomMed(false)}
                  className="px-2.5 py-1 text-slate-500 text-[10px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-purple-600 text-white font-extrabold rounded-lg text-[10px]"
                >
                  Add Medicine
                </button>
              </div>
            </form>
          )}

          {medicines.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {medicines.map((med, idx) => {
                const isAccepted = acceptedMeds.includes(med.name);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border space-y-1.5 transition-all text-xs ${
                      isAccepted
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <strong className="font-extrabold text-slate-800 dark:text-white block">{med.name}</strong>
                          {med.category && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              med.category === 'Primary Treatment'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : med.category === 'Supportive Therapy'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {med.category}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
                          Dosage: {med.dosage || 'Consult physician dosage guidelines.'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleAcceptMed(med)}
                          disabled={isAccepted}
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all flex items-center space-x-1 ${
                            isAccepted
                              ? 'bg-emerald-500 text-white cursor-default'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-500 hover:text-white'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          <span>{isAccepted ? 'Accepted' : 'Accept'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismissMed(med.name)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                          title="Dismiss Medicine"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                      <div>Frequency: <span className="font-semibold text-slate-700 dark:text-slate-300">{med.frequency}</span> • Duration: <span className="font-semibold text-slate-700 dark:text-slate-300">{med.duration}</span></div>
                      {med.reason && <div className="text-slate-600 dark:text-slate-300 font-medium">Rationale: {med.reason}</div>}
                      {med.description && <div className="italic">{med.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              No verified medicines listed for this condition. Use "Add Custom Medicine" to prescribe.
            </div>
          )}
        </div>

        {/* SECTION 3: RECOMMENDED LABORATORY TESTS */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <FlaskConical className="h-4 w-4 text-blue-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Recommended Laboratory Tests
            </h4>
          </div>

          {labTests.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {labTests.map((test, idx) => {
                const isAdded = addedLabTests.includes(test.name);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs"
                  >
                    <div>
                      <strong className="font-extrabold text-slate-800 dark:text-white block">{test.name}</strong>
                      <span className="text-[10px] text-slate-400 font-medium block">{test.reason}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddLab(test)}
                      disabled={isAdded}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all flex items-center space-x-1 ${
                        isAdded
                          ? 'bg-blue-500 text-white cursor-default'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-500 hover:text-white'
                      }`}
                    >
                      {isAdded ? <Check className="h-3 w-3 mr-0.5" /> : <Plus className="h-3 w-3 mr-0.5" />}
                      <span>{isAdded ? 'Added to Orders' : 'Add to Orders'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              No specific laboratory tests linked in knowledge base.
            </div>
          )}
        </div>

        {/* SECTION 4 & 5: DIET & EXERCISE RECOMMENDATIONS */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Utensils className="h-4 w-4 text-amber-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Diet & Exercise Recommendations
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 flex items-center space-x-1">
                <Utensils className="h-3 w-3 text-amber-500" />
                <span>Dietary Guidelines:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dietList.map((d, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-extrabold border border-amber-200/60 dark:border-amber-900/40"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 flex items-center space-x-1">
                <Dumbbell className="h-3 w-3 text-indigo-500" />
                <span>Exercise & Activity:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {workoutList.map((w, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-[11px] font-extrabold border border-indigo-200/60 dark:border-indigo-900/40"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6 & 7: PRECAUTIONS & RISK FACTORS */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Precautions & Risk Factors
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Risk Factors (Colored Badges):</span>
              <div className="flex flex-wrap gap-1.5">
                {riskFactors.map((rf, idx) => (
                  <span
                    key={idx}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border shadow-xs ${getRiskBadgeColor(idx)}`}
                  >
                    {rf}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Clinical Precautions:</span>
              <ul className="space-y-1">
                {precautions.map((p, i) => (
                  <li key={i} className="flex items-start space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <ChevronRight className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default AIClinicalRecommendationPanel;
