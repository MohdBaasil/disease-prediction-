import React from 'react';
import {
  CheckCircle2,
  Calendar,
  BedDouble,
  Share2,
  FileText,
  Clock,
  AlertCircle,
  Building2,
  UserCheck,
  Award,
  ShieldAlert
} from 'lucide-react';

const OUTCOME_OPTIONS = [
  {
    id: 'Discharge',
    title: 'Discharge Patient',
    description: 'Patient treated & cleared to leave with instructions',
    icon: CheckCircle2,
    color: 'emerald'
  },
  {
    id: 'Follow-up',
    title: 'Schedule Follow-up',
    description: 'Requires subsequent review or progress monitoring',
    icon: Calendar,
    color: 'blue'
  },
  {
    id: 'Admit',
    title: 'Admit Patient',
    description: 'Inpatient hospital admission required for care',
    icon: BedDouble,
    color: 'amber'
  },
  {
    id: 'Refer',
    title: 'Refer Patient',
    description: 'Transfer or refer to another department/specialist',
    icon: Share2,
    color: 'purple'
  }
];

function ConsultationDisposition({
  outcome = 'Discharge',
  onChangeOutcome,
  dispositionData = {},
  onChangeData
}) {
  const updateField = (field, value) => {
    if (onChangeData) {
      onChangeData({
        ...dispositionData,
        [field]: value
      });
    }
  };

  return (
    <div className="space-y-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all animate-fadeIn">
      {/* Module Title */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-hospital-500 text-white rounded-xl shadow-xs">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              Consultation Outcome & Disposition
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              Select final patient disposition to finalize consultation session
            </p>
          </div>
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-hospital-50 text-hospital-700 dark:bg-hospital-950/80 dark:text-hospital-300 border border-hospital-200 dark:border-hospital-900/60">
          Required Stage
        </span>
      </div>

      {/* 4 Outcome Selectable Cards (ONE Selection Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {OUTCOME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = outcome === opt.id;

          let cardClasses = 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300';
          let iconClasses = 'text-slate-400 bg-white dark:bg-slate-800';

          if (isSelected) {
            if (opt.color === 'emerald') {
              cardClasses = 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20';
              iconClasses = 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60';
            } else if (opt.color === 'blue') {
              cardClasses = 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20';
              iconClasses = 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60';
            } else if (opt.color === 'amber') {
              cardClasses = 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20';
              iconClasses = 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60';
            } else if (opt.color === 'purple') {
              cardClasses = 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 dark:border-purple-500 ring-2 ring-purple-500/20';
              iconClasses = 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeOutcome(opt.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 ${cardClasses}`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl ${iconClasses}`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? 'border-hospital-500 bg-hospital-500' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                </div>
              </div>

              <div>
                <strong className="text-xs font-black text-slate-800 dark:text-white block">{opt.title}</strong>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block leading-snug mt-0.5">
                  {opt.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* SUB-FORM DETAILS BASED ON OUTCOME */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">

        {/* 1. DISCHARGE SUB-FORM */}
        {outcome === 'Discharge' && (
          <div className="space-y-3 p-4 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Discharge Details & Patient Instructions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Discharge Summary</label>
                <textarea
                  value={dispositionData.discharge_summary || ''}
                  onChange={(e) => updateField('discharge_summary', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Enter clinical summary of patient recovery and discharge condition..."
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Patient Home Care Instructions</label>
                <textarea
                  value={dispositionData.patient_instructions || ''}
                  onChange={(e) => updateField('patient_instructions', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Rest instructions, wound care, warning signs to return..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-emerald-100 dark:border-emerald-900/40">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!dispositionData.medical_certificate}
                  onChange={(e) => updateField('medical_certificate', e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span>Issue Medical Fitness / Sick Leave Certificate</span>
              </label>

              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Next Review Required:</span>
                <button
                  type="button"
                  onClick={() => updateField('next_review_required', !dispositionData.next_review_required)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-extrabold transition-all ${
                    dispositionData.next_review_required
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {dispositionData.next_review_required ? 'Yes (Review Recommended)' : 'No (Routine)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. FOLLOW-UP SUB-FORM */}
        {outcome === 'Follow-up' && (
          <div className="space-y-3 p-4 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-blue-800 dark:text-blue-300">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Follow-up Appointment Scheduling</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={dispositionData.followup_date || ''}
                  onChange={(e) => updateField('followup_date', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Follow-up Time</label>
                <input
                  type="time"
                  value={dispositionData.followup_time || '10:00'}
                  onChange={(e) => updateField('followup_time', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reason for Follow-up</label>
                <input
                  type="text"
                  value={dispositionData.followup_reason || ''}
                  onChange={(e) => updateField('followup_reason', e.target.value)}
                  placeholder="e.g. Blood pressure review, Lab result check"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Priority</label>
                <select
                  value={dispositionData.followup_priority || 'Routine'}
                  onChange={(e) => updateField('followup_priority', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Routine">Routine Priority</option>
                  <option value="Urgent">Urgent Priority</option>
                  <option value="High Priority">High Priority</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. ADMIT SUB-FORM */}
        {outcome === 'Admit' && (
          <div className="space-y-3 p-4 bg-amber-50/40 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-amber-800 dark:text-amber-300">
              <BedDouble className="h-4 w-4 text-amber-600" />
              <span>Inpatient Admission Request</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Admission Reason & Indication</label>
                <input
                  type="text"
                  value={dispositionData.admission_reason || ''}
                  onChange={(e) => updateField('admission_reason', e.target.value)}
                  placeholder="e.g. Acute exacerbation, IV antibiotic therapy, continuous telemetry"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ward Category</label>
                <select
                  value={dispositionData.ward || 'General Ward'}
                  onChange={(e) => updateField('ward', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="General Ward">General Ward</option>
                  <option value="Private Ward">Private Ward</option>
                  <option value="ICU">ICU (Intensive Care Unit)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Expected Stay</label>
                <input
                  type="text"
                  value={dispositionData.expected_stay || ''}
                  onChange={(e) => updateField('expected_stay', e.target.value)}
                  placeholder="e.g. 3 Days"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Bed Number (Optional)</label>
                <input
                  type="text"
                  value={dispositionData.bed_number || ''}
                  onChange={(e) => updateField('bed_number', e.target.value)}
                  placeholder="e.g. B-204"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. REFER SUB-FORM */}
        {outcome === 'Refer' && (
          <div className="space-y-3 p-4 bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl border border-purple-200/60 dark:border-purple-900/40">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-purple-800 dark:text-purple-300">
              <Share2 className="h-4 w-4 text-purple-600" />
              <span>Specialist & Department Referral</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Referral Department</label>
                <input
                  type="text"
                  value={dispositionData.referral_department || ''}
                  onChange={(e) => updateField('referral_department', e.target.value)}
                  placeholder="e.g. Cardiology, Neurology, Orthopedics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Referral Doctor (Attending Specialist)</label>
                <input
                  type="text"
                  value={dispositionData.referral_doctor || ''}
                  onChange={(e) => updateField('referral_doctor', e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reason for Referral</label>
                <textarea
                  value={dispositionData.referral_reason || ''}
                  onChange={(e) => updateField('referral_reason', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Describe reason for specialist consultation..."
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Additional Clinical Notes</label>
                <textarea
                  value={dispositionData.referral_notes || ''}
                  onChange={(e) => updateField('referral_notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Attach vitals, lab findings, or specific requests..."
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ConsultationDisposition;
