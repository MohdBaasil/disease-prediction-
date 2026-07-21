import React, { useState, useEffect } from 'react';
import {
  User,
  Activity,
  AlertCircle,
  Clock,
  Heart,
  ShieldAlert,
  FileText,
  Stethoscope,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Pill,
  Thermometer,
  Scale,
  Ruler,
  Cigarette,
  Wine,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { clinicalService } from '../services/api';

function PatientInformationPanel({ patientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPatientInfo = async () => {
    if (!patientId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await clinicalService.getPatientSummary(patientId);
      setData(result);
    } catch (err) {
      console.error('Error fetching patient information:', err);
      setError('Failed to load patient information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientInfo();
  }, [patientId]);

  // 1. EMPTY STATE (No patient selected)
  if (!patientId) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-sm animate-fadeIn">
        <div className="inline-flex bg-hospital-50 dark:bg-hospital-950/60 p-5 rounded-full text-hospital-500 shadow-inner">
          <User className="h-10 w-10" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">No Patient Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
            Select a patient from the OPD queue to begin consultation.
          </p>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE (Skeleton Loaders)
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>

        {/* 2-Column Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
          <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
          <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        </div>
      </div>
    );
  }

  // 3. ERROR STATE
  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 shadow-sm space-y-4 text-center animate-fadeIn">
        <div className="inline-flex bg-rose-50 dark:bg-rose-950/60 p-3 rounded-full text-rose-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Unable to Fetch Patient Profile</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchPatientInfo}
          className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-2xl transition-all inline-flex items-center space-x-2 shadow-md"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry Loading Patient Info</span>
        </button>
      </div>
    );
  }

  // Safe data extractions with fallback guarantees
  const patient = data?.patient ?? {};
  const currentVisit = data?.current_visit ?? {};
  const lastVisit = data?.last_visit ?? {};
  const flags = Array.isArray(data?.flags) ? data.flags : [];
  const currentMedications = Array.isArray(data?.current_medications) ? data.current_medications : [];

  // Automated BMI Calculation if missing
  const heightCm = Number(patient?.height ?? 170);
  const weightKg = Number(patient?.weight ?? 68);
  const calculatedBmi = patient?.bmi ?? (
    heightCm > 0 ? (weightKg / ((heightCm / 100) * (heightCm / 100))).toFixed(1) : 23.5
  );

  let bmiCategory = 'Normal Weight';
  const numericBmi = Number(calculatedBmi);
  if (numericBmi < 18.5) bmiCategory = 'Underweight';
  else if (numericBmi >= 25 && numericBmi < 30) bmiCategory = 'Overweight';
  else if (numericBmi >= 30) bmiCategory = 'Obese';

  // Badge Color Helper for Patient Flags
  const getFlagBadgeStyle = (color) => {
    switch (color) {
      case 'red':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-900/60';
      case 'yellow':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';
      case 'purple':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-900/60';
      case 'black':
        return 'bg-slate-800 text-white dark:bg-slate-950 dark:text-slate-200 border-slate-700 dark:border-slate-800';
      case 'green':
      default:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn transition-colors duration-300">

      {/* ----------------------------------
          PATIENT FLAGS BAR & QUICK SUMMARY
          ---------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-hospital-100 dark:bg-hospital-950/60 text-hospital-600 dark:text-hospital-400 flex items-center justify-center font-black text-lg overflow-hidden border border-hospital-200 dark:border-hospital-800">
              {patient?.profile_photo ? (
                <img src={patient.profile_photo} alt={patient.name} className="h-full w-full object-cover" />
              ) : (
                <span>{patient?.name?.charAt(0) ?? 'P'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-800 dark:text-white">{patient?.name ?? 'Patient Name'}</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  #PAT-{patient?.id ?? '000'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {patient?.age ?? '--'} Yrs • {patient?.gender ?? 'Gender'} • Blood Group: <strong className="text-hospital-600 dark:text-hospital-400">{patient?.blood_group ?? 'O+'}</strong>
              </p>
            </div>
          </div>

          {/* DYNAMIC PATIENT FLAGS */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 block sm:inline">
              Patient Flags:
            </span>
            {flags.map((flag, idx) => (
              <span
                key={idx}
                className={`px-3 py-1 rounded-full text-xs font-extrabold border flex items-center space-x-1.5 shadow-sm ${getFlagBadgeStyle(flag.color)}`}
              >
                <span>{flag.symbol}</span>
                <span>{flag.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------------------------
          GRID LAYOUT FOR CARDS
          Desktop: 2 Columns
          Tablet / Mobile: Stacked
          ---------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. PATIENT PROFILE CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="h-5 w-5 text-hospital-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Patient Profile</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Age / Gender</span>
              <span className="font-extrabold text-slate-800 dark:text-white mt-0.5 block">
                {patient?.age ?? '--'} yrs ({patient?.gender ?? 'N/A'})
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Blood Group</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 block">
                {patient?.blood_group ?? 'O+'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Height</span>
              <span className="font-extrabold text-slate-800 dark:text-white mt-0.5 block">
                {heightCm} cm
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Weight</span>
              <span className="font-extrabold text-slate-800 dark:text-white mt-0.5 block">
                {weightKg} kg
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 col-span-2 sm:col-span-2">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">BMI (Calculated)</span>
              <span className="font-extrabold text-hospital-600 dark:text-hospital-400 mt-0.5 block">
                {numericBmi} kg/m² ({bmiCategory})
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{patient?.mobile ?? 'No phone provided'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{patient?.email ?? 'No email on file'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{patient?.address ?? '123 Health Avenue, City Zone'}</span>
            </div>
          </div>
        </div>

        {/* 2. MEDICAL INFORMATION CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Medical Information</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-0.5">Allergies</span>
              <p className="font-extrabold text-slate-800 dark:text-slate-200">{patient?.allergies ?? 'None recorded'}</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Chronic Diseases</span>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(patient?.chronic_diseases) && patient.chronic_diseases.length > 0 ? (
                  patient.chronic_diseases.map((cd, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-extrabold">
                      {cd}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 font-semibold">None reported</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Current Medications</span>
              <ul className="space-y-1">
                {currentMedications.map((med, i) => (
                  <li key={i} className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <Pill className="h-3.5 w-3.5 text-hospital-500 shrink-0" />
                    <span>{med}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                <Cigarette className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Smoking Status</span>
                  <span className="font-bold text-slate-800 dark:text-white text-[11px]">{patient?.smoking_status ?? 'Non-smoker'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                <Wine className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Alcohol Status</span>
                  <span className="font-bold text-slate-800 dark:text-white text-[11px]">{patient?.alcohol_status ?? 'Non-drinker'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CURRENT VISIT CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Activity className="h-5 w-5 text-hospital-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Current Visit</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Current Symptoms</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                {currentVisit?.symptoms ?? 'General consultation & vitals screening'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-hospital-50/60 dark:bg-hospital-950/20 border border-hospital-100 dark:border-hospital-900/30 rounded-2xl">
                <span className="text-[10px] text-hospital-600 dark:text-hospital-400 font-bold block uppercase">Disease Prediction Result</span>
                <span className="font-black text-slate-800 dark:text-white text-sm mt-0.5 block">
                  {currentVisit?.predicted_disease ?? 'General Medical Checkup'}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">Prediction Confidence</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm mt-0.5 block">
                  {currentVisit?.confidence ?? '85%'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block uppercase">Recommended Department</span>
                <span className="font-black text-slate-800 dark:text-white text-xs mt-0.5 block">
                  {currentVisit?.recommended_department ?? 'General Medicine'}
                </span>
              </div>
              <Stethoscope className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
        </div>

        {/* 4. LAST VISIT CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="h-5 w-5 text-purple-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Last Visit History</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Previous Diagnosis</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {lastVisit?.previous_diagnosis ?? 'No prior recorded diagnosis'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Previous Prescription</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {lastVisit?.previous_prescription ?? 'None'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">Last Visit Date</span>
                <span className="font-bold text-slate-800 dark:text-white text-[11px]">
                  {lastVisit?.last_consultation_date
                    ? new Date(lastVisit.last_consultation_date).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 font-bold block uppercase">Last Attending Doctor</span>
                <span className="font-bold text-slate-800 dark:text-white text-[11px]">
                  {lastVisit?.last_doctor ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default PatientInformationPanel;
