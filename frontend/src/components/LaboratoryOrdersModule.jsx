import React, { useState } from 'react';
import { FlaskConical, Plus, X, Tag, AlertCircle, FileText, Check } from 'lucide-react';

const COMMON_LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "Blood Sugar",
  "HbA1c",
  "Lipid Profile",
  "Liver Function Test",
  "Kidney Function Test",
  "Urine Analysis",
  "ECG",
  "Chest X-Ray",
  "CT Scan",
  "MRI"
];

function LaboratoryOrdersModule({ labRequests = [], onChange }) {
  const [customTestName, setCustomTestName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleAddTest = (testName) => {
    if (!testName || !testName.trim()) return;
    const cleanName = testName.trim();
    
    // Check if test is already added
    if (labRequests.some(r => r.test_name.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }

    const newRequest = {
      id: Date.now() + Math.random(),
      test_name: cleanName,
      reason: '',
      priority: 'Routine'
    };

    onChange([...labRequests, newRequest]);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (customTestName.trim()) {
      handleAddTest(customTestName.trim());
      setCustomTestName('');
      setShowCustomInput(false);
    }
  };

  const handleRemoveTest = (id) => {
    onChange(labRequests.filter(r => r.id !== id));
  };

  const handleUpdateTest = (id, field, value) => {
    onChange(labRequests.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-all">
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <FlaskConical className="h-4 w-4 text-hospital-500" />
          <label className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            Laboratory Investigations & Orders
          </label>
        </div>
        <span className="text-[10px] font-bold text-hospital-600 dark:text-hospital-400 bg-hospital-50 dark:bg-hospital-950/60 px-2 py-0.5 rounded-full border border-hospital-200 dark:border-hospital-900/40">
          {labRequests.length} Selected
        </span>
      </div>

      {/* Common Quick Test Selectors */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Quick Add Common Tests</span>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_LAB_TESTS.map((test) => {
            const isSelected = labRequests.some(r => r.test_name.toLowerCase() === test.toLowerCase());
            return (
              <button
                key={test}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    const found = labRequests.find(r => r.test_name.toLowerCase() === test.toLowerCase());
                    if (found) handleRemoveTest(found.id);
                  } else {
                    handleAddTest(test);
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-hospital-500 text-white shadow-sm ring-2 ring-hospital-400/30'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-hospital-400 hover:text-hospital-600'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 mr-0.5" />}
                <span>{test}</span>
              </button>
            );
          })}

          {!showCustomInput && (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all flex items-center space-x-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add Custom Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Test Input Form */}
      {showCustomInput && (
        <form onSubmit={handleAddCustom} className="flex items-center space-x-2 pt-1 animate-fadeIn">
          <input
            type="text"
            value={customTestName}
            onChange={(e) => setCustomTestName(e.target.value)}
            placeholder="Type custom test name (e.g. Thyroid Profile, Vitamin D)..."
            className="flex-grow px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 text-xs rounded-xl text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* Selected Investigation Chips with Notes & Priority */}
      {labRequests.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Requested Investigations & Details</span>
          <div className="space-y-2">
            {labRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-hospital-50 dark:bg-hospital-950/80 text-hospital-700 dark:text-hospital-300 font-extrabold text-xs border border-hospital-200 dark:border-hospital-900/60">
                      {req.test_name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={req.priority}
                      onChange={(e) => handleUpdateTest(req.id, 'priority', e.target.value)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black border outline-none cursor-pointer ${
                        req.priority === 'Emergency'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60'
                          : req.priority === 'Urgent'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60'
                          : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60'
                      }`}
                    >
                      <option value="Routine">Routine Priority</option>
                      <option value="Urgent">Urgent Priority</option>
                      <option value="Emergency">Emergency Priority</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveTest(req.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={req.reason}
                    onChange={(e) => handleUpdateTest(req.id, 'reason', e.target.value)}
                    placeholder="Enter reason or clinical notes (e.g. 'Rule out infection', 'Fasting blood sugar check')..."
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-hospital-500 font-medium"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default LaboratoryOrdersModule;
