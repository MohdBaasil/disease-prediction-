import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, User, Search, Stethoscope, Building2,
  AlertTriangle, CheckCircle2, Sparkles, X, FileText, ShieldAlert,
  ChevronRight, RefreshCw, Check
} from 'lucide-react';
import {
  patientService, doctorService, queueService, appointmentsService
} from '../services/api';

function AppointmentBookingModal({
  isOpen,
  onClose,
  onSuccess,
  patient: preSelectedPatient = null,
  initialData = null,
  mode = 'create'
}) {
  // Master Metadata
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  
  // Patient Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient);

  // Form State
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('09:30 AM');
  const [appointmentType, setAppointmentType] = useState('Scheduled');
  const [priorityLevel, setPriorityLevel] = useState('3');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Doctor Availability Slots State
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // UI Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Initialize Departments & prefilled values
  useEffect(() => {
    if (!isOpen) return;

    const initializeModal = async () => {
      setErrorMessage('');
      try {
        const depts = await queueService.getDepartments();
        const deptsArr = Array.isArray(depts) ? depts : [];
        setDepartments(deptsArr);

        if (initialData) {
          // Edit or Reschedule mode
          if (initialData.patient) setSelectedPatient(initialData.patient);
          if (initialData.department_id) {
            setSelectedDepartment(initialData.department_id.toString());
          } else if (deptsArr.length > 0) {
            setSelectedDepartment(deptsArr[0].id.toString());
          }

          if (initialData.doctor_id) setSelectedDoctor(initialData.doctor_id.toString());
          if (initialData.appointment_type) setAppointmentType(initialData.appointment_type);
          if (initialData.priority) setPriorityLevel(initialData.priority.toString());
          if (initialData.reason) setReason(initialData.reason);
          if (initialData.notes) setNotes(initialData.notes);

          if (initialData.appointment_time) {
            const dt = new Date(initialData.appointment_time);
            if (!isNaN(dt.getTime())) {
              setAppointmentDate(dt.toISOString().split('T')[0]);
              setSelectedTimeSlot(dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            }
          }
        } else {
          // Create Mode
          setSelectedPatient(preSelectedPatient);
          if (deptsArr.length > 0) {
            setSelectedDepartment(deptsArr[0].id.toString());
          }
          setAppointmentDate(todayStr);
          setSelectedTimeSlot('09:30 AM');
          setAppointmentType('Scheduled');
          setPriorityLevel('3');
          setReason('');
          setNotes('');
        }
      } catch (err) {
        console.error('Error initializing appointment modal:', err);
      }
    };

    initializeModal();
  }, [isOpen, initialData, preSelectedPatient]);

  // Load doctors whenever department changes
  useEffect(() => {
    if (!isOpen || !selectedDepartment) return;

    const loadDoctors = async () => {
      try {
        const docs = await doctorService.list(parseInt(selectedDepartment));
        const docsArr = Array.isArray(docs) ? docs : [];
        setDoctors(docsArr);

        if (docsArr.length > 0) {
          if (!selectedDoctor || !docsArr.some(d => d.id.toString() === selectedDoctor)) {
            setSelectedDoctor(docsArr[0].id.toString());
          }
        } else {
          setSelectedDoctor('');
        }
      } catch (err) {
        console.error('Error fetching doctors by department:', err);
        setDoctors([]);
      }
    };

    loadDoctors();
  }, [isOpen, selectedDepartment]);

  // Fetch Doctor Availability Slots whenever doctor or date changes
  useEffect(() => {
    if (!isOpen || !selectedDoctor || !appointmentDate) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await appointmentsService.getDoctorAvailability(parseInt(selectedDoctor), appointmentDate);
        setAvailability(res);
        // If current selected time slot is unavailable, default to first available slot
        if (res && Array.isArray(res.slots) && res.slots.length > 0) {
          const avail = res.slots.find(s => s.available);
          if (avail && !res.slots.some(s => s.time === selectedTimeSlot && s.available)) {
            setSelectedTimeSlot(avail.time);
          }
        }
      } catch (err) {
        console.error('Error fetching doctor availability slots:', err);
        setAvailability(null);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [isOpen, selectedDoctor, appointmentDate]);

  // Search Patient
  const handleSearchPatient = async (query) => {
    setSearchQuery(query);
    if (!query || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingPatient(true);
    try {
      const results = await patientService.list(query.trim());
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setIsSearchingPatient(false);
    }
  };

  // Helper to convert date + "09:30 AM" into valid ISO String
  const getAppointmentDateTimeISO = () => {
    if (!appointmentDate || !selectedTimeSlot) return null;
    const [year, month, day] = appointmentDate.split('-').map(Number);
    let [timeStr, modifier] = selectedTimeSlot.split(' ');
    let [hours, minutes] = timeStr.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const dt = new Date(year, month - 1, day, hours, minutes, 0);
    return dt.toISOString();
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedPatient || !selectedPatient.id) {
      setErrorMessage('Please select a patient before proceeding.');
      return;
    }

    if (!selectedDoctor) {
      setErrorMessage('Please select an attending doctor.');
      return;
    }

    if (!appointmentDate) {
      setErrorMessage('Please select an appointment date.');
      return;
    }

    if (!selectedTimeSlot) {
      setErrorMessage('Please select a time slot.');
      return;
    }

    if (!reason || !reason.trim()) {
      setErrorMessage('Please enter a brief visit reason / chief complaint.');
      return;
    }

    const isoDateTime = getAppointmentDateTimeISO();
    if (!isoDateTime) {
      setErrorMessage('Invalid date or time format selected.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patient_id: selectedPatient.id,
        doctor_id: parseInt(selectedDoctor),
        department_id: selectedDepartment ? parseInt(selectedDepartment) : null,
        appointment_type: appointmentType,
        appointment_time: isoDateTime,
        priority: parseInt(priorityLevel),
        reason: reason.trim(),
        notes: notes.trim()
      };

      if (mode === 'edit' && initialData && initialData.id) {
        await appointmentsService.update(initialData.id, payload);
      } else if (mode === 'reschedule' && initialData && initialData.id) {
        await appointmentsService.reschedule(initialData.id, isoDateTime);
      } else {
        await appointmentsService.book(payload);
      }

      if (typeof onSuccess === 'function') {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMessage(detail);
      } else if (Array.isArray(detail)) {
        setErrorMessage(detail.map(d => d.msg).join(', '));
      } else {
        setErrorMessage('Failed to save appointment. Please check inputs and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
              <div className="p-2 rounded-2xl bg-hospital-50 text-hospital-600 dark:bg-hospital-950 dark:text-hospital-400">
                <Calendar className="h-6 w-6" />
              </div>
              <span>
                {mode === 'edit' ? 'Edit Appointment' : mode === 'reschedule' ? 'Reschedule Appointment' : 'Book New Appointment'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Schedule patient consultation with real-time doctor availability check.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: PATIENT SELECTION */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="h-4 w-4 text-hospital-500" />
              <span>1. Select Patient</span>
            </label>

            {selectedPatient ? (
              <div className="p-4 rounded-2xl bg-hospital-50/60 dark:bg-hospital-950/30 border border-hospital-200 dark:border-hospital-900/50 flex justify-between items-center text-xs">
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{selectedPatient.name}</span>
                    {selectedPatient.patient_code && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-hospital-100 dark:bg-hospital-900 text-hospital-700 dark:text-hospital-300 font-bold">
                        {selectedPatient.patient_code}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium">
                    Age: {selectedPatient.age ?? 'N/A'} • Gen: {selectedPatient.gender || 'N/A'} • Mob: {selectedPatient.mobile_number || 'N/A'}
                  </div>
                </div>

                {!preSelectedPatient && mode === 'create' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-bold shadow-sm"
                  >
                    Change Patient
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 relative">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchPatient(e.target.value)}
                    placeholder="Type patient name or mobile number to search..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  />
                </div>

                {/* Live Search Results Dropdown */}
                {searchQuery && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-lg space-y-1">
                    {isSearchingPatient ? (
                      <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-hospital-500" />
                        <span>Searching master registry...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full p-2.5 text-left rounded-xl hover:bg-hospital-50 dark:hover:bg-hospital-950/40 flex justify-between items-center transition-colors text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-500">Mob: {p.mobile_number} | Age: {p.age}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No matching patient records found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: DEPARTMENT & DOCTOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Building2 className="h-4 w-4 text-hospital-500" />
                <span>2. Department</span>
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Stethoscope className="h-4 w-4 text-hospital-500" />
                <span>3. Attending Physician</span>
              </label>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              >
                <option value="">Select Doctor</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name} - {doc.specialization} (Room {doc.room_number})
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* SECTION 3: DATE & TIME SLOT PICKER */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-hospital-500" />
                <span>4. Date & Available Time Slot</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {availability ? `${availability.available_slots_count} free slot(s) open` : 'Select doctor to check slots'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Date Input */}
              <div className="sm:col-span-1">
                <input
                  type="date"
                  min={todayStr}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                />
              </div>

              {/* Time Slot Picker Grid */}
              <div className="sm:col-span-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-800/30 max-h-40 overflow-y-auto">
                {loadingSlots ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-hospital-500" />
                    <span>Loading physician availability...</span>
                  </div>
                ) : availability && Array.isArray(availability.slots) && availability.slots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availability.slots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot.time;
                      const isAvailable = slot.available;

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedTimeSlot(slot.time)}
                          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold text-center transition-all ${
                            isSelected
                              ? 'bg-hospital-600 text-white shadow-md ring-2 ring-hospital-400'
                              : isAvailable
                              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-hospital-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through cursor-not-allowed opacity-60'
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Select a physician to view open time slots.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* SECTION 4: TYPE & PRIORITY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Appointment Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Appointment Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Scheduled', 'Walk-in'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAppointmentType(type)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      appointmentType === type
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Priority Triage Level
              </label>
              <select
                value={priorityLevel}
                onChange={(e) => setPriorityLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              >
                <option value="3">Priority 3 - Normal (Standard Wait)</option>
                <option value="2">Priority 2 - Urgent (Fast-track)</option>
                <option value="1">Priority 1 - Critical (Immediate)</option>
              </select>
            </div>

          </div>

          {/* SECTION 5: REASON & NOTES */}
          <div className="space-y-3">
            
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-hospital-500" />
                <span>5. Reason for Visit / Chief Complaint</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Routine checkup, severe headache, blood pressure review..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Additional Notes (Optional)
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special accommodations, patient history remarks, or instructions..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
              />
            </div>

          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPatient || !selectedDoctor}
              className="px-6 py-2.5 rounded-xl bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-extrabold shadow-md disabled:opacity-50 flex items-center space-x-2 transition-all active:scale-95"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{mode === 'edit' ? 'Save Changes' : mode === 'reschedule' ? 'Confirm Reschedule' : 'Confirm Appointment'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

export default AppointmentBookingModal;
