import React, { useState, useEffect } from 'react';
import {
  User, Phone, Mail, MapPin, Heart, Shield, AlertTriangle,
  CheckCircle2, X, Calendar, Clock, Ticket, Printer, Eye,
  Sparkles, FileText, ChevronRight, ChevronLeft, UserPlus,
  AlertCircle
} from 'lucide-react';
import { patientService } from '../services/api';

function PatientRegistrationModal({
  isOpen,
  onClose,
  onRegistrationSuccess,
  onGenerateToken,
  onBookAppointment
}) {
  const [activeTab, setActiveTab] = useState('personal'); // personal, contact, emergency, medical, insurance
  const [loading, setLoading] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);
  const [dupInfo, setDupInfo] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'Male',
    blood_group: 'O+',
    mobile_number: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_relationship: 'Spouse',
    emergency_contact_phone: '',
    allergies: '',
    existing_conditions: '',
    national_id: '',
    insurance_provider: '',
    insurance_number: '',
    profile_photo: ''
  });

  // Inline Validation Errors
  const [errors, setErrors] = useState({});

  // Registered Patient State (Success View)
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [showPrintSlipModal, setShowPrintSlipModal] = useState(false);
  const [showViewProfileModal, setShowViewProfileModal] = useState(false);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab('personal');
      setLoading(false);
      setCheckingDup(false);
      setDupInfo(null);
      setRegisteredPatient(null);
      setErrors({});
      setFormData({
        name: '',
        dob: '',
        age: '',
        gender: 'Male',
        blood_group: 'O+',
        mobile_number: '',
        email: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_relationship: 'Spouse',
        emergency_contact_phone: '',
        allergies: '',
        existing_conditions: '',
        national_id: '',
        insurance_provider: '',
        insurance_number: '',
        profile_photo: ''
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-calculate Age when DOB changes
  const handleDobChange = (e) => {
    const dobVal = e.target.value;
    let computedAge = formData.age;
    
    if (dobVal) {
      const dobDate = new Date(dobVal);
      const today = new Date();
      if (dobDate > today) {
        setErrors((prev) => ({ ...prev, dob: 'Date of Birth cannot be in the future.' }));
      } else {
        setErrors((prev) => ({ ...prev, dob: null }));
        let years = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
          years--;
        }
        computedAge = years >= 0 ? years.toString() : '';
      }
    }

    setFormData((prev) => ({
      ...prev,
      dob: dobVal,
      age: computedAge
    }));
  };

  // Generic Field Change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Run Duplicate Check on Blur of Mobile/Email/National ID
  const handleCheckDuplicate = async () => {
    if (!formData.mobile_number && !formData.email && !formData.national_id) return;
    setCheckingDup(true);
    try {
      const res = await patientService.checkDuplicate({
        mobile_number: formData.mobile_number,
        email: formData.email,
        national_id: formData.national_id
      });
      if (res && res.is_duplicate) {
        setDupInfo(res);
      } else {
        setDupInfo(null);
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
    } finally {
      setCheckingDup(false);
    }
  };

  // Validate form fields before submit
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Full Name is required.';
    
    if (!formData.dob && !formData.age) {
      newErrors.dob = 'Date of Birth or Age is required.';
    } else if (formData.dob) {
      const dobDate = new Date(formData.dob);
      if (dobDate > new Date()) {
        newErrors.dob = 'Date of Birth cannot be in the future.';
      }
    }

    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = 'Mobile Number is required.';
    } else if (formData.mobile_number.replace(/\D/g, '').length < 7) {
      newErrors.mobile_number = 'Enter a valid Mobile Number (min 7 digits).';
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Enter a valid Email Address.';
      }
    }

    if (!formData.emergency_contact_name.trim()) {
      newErrors.emergency_contact_name = 'Emergency Contact Name is required.';
    }

    if (!formData.emergency_contact_phone.trim()) {
      newErrors.emergency_contact_phone = 'Emergency Contact Phone is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check duplicate one more time
    if (dupInfo && dupInfo.is_duplicate) {
      if (!window.confirm(`Warning: A duplicate record was detected (${dupInfo.message}). Do you still want to proceed with registration?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        dob: formData.dob ? formData.dob : null,
        age: parseInt(formData.age) || 0,
        gender: formData.gender,
        blood_group: formData.blood_group,
        mobile_number: formData.mobile_number.trim(),
        email: formData.email.trim() ? formData.email.trim() : null,
        address: formData.address.trim() ? formData.address.trim() : null,
        emergency_contact_name: formData.emergency_contact_name.trim(),
        emergency_contact_relationship: formData.emergency_contact_relationship,
        emergency_contact_phone: formData.emergency_contact_phone.trim(),
        allergies: formData.allergies.trim() ? formData.allergies.trim() : null,
        existing_conditions: formData.existing_conditions.trim() ? formData.existing_conditions.trim() : null,
        national_id: formData.national_id.trim() ? formData.national_id.trim() : null,
        insurance_provider: formData.insurance_provider.trim() ? formData.insurance_provider.trim() : null,
        insurance_number: formData.insurance_number.trim() ? formData.insurance_number.trim() : null,
        profile_photo: formData.profile_photo.trim() ? formData.profile_photo.trim() : null
      };

      const result = await patientService.register(payload);
      setRegisteredPatient(result);
      if (onRegistrationSuccess) onRegistrationSuccess(result);
    } catch (err) {
      console.error(err);
      const detailMsg = err.response?.data?.detail || 'Failed to register patient. Please check field requirements.';
      setErrors((prev) => ({ ...prev, global: detailMsg }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-hospital-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-hospital-500/20 border border-hospital-500/30 rounded-2xl text-hospital-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Patient Desk Registration</h2>
              <p className="text-xs text-slate-400">Register new patient master record into AcuraQueue system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errors.global && (
          <div className="m-6 mb-0 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="font-semibold">{errors.global}</span>
          </div>
        )}

        {/* SUCCESS VIEW */}
        {registeredPatient ? (
          <div className="p-8 space-y-6">
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg animate-bounce">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-emerald-800 dark:text-emerald-300">
                ✓ Patient Registered Successfully!
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Master record created and stored in AcuraQueue Patient Registry.
              </p>

              {/* Patient Card Details */}
              <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 text-left grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Patient ID</span>
                  <span className="font-black text-hospital-600 dark:text-hospital-400 text-sm">
                    {registeredPatient.patient_code || `ID-${registeredPatient.id}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{registeredPatient.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Age / Gender</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{registeredPatient.age} yrs / {registeredPatient.gender}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Registration Date</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(registeredPatient.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions after Registration */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Quick Actions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => {
                    onClose();
                    if (onGenerateToken) onGenerateToken(registeredPatient);
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-hospital-600 hover:bg-hospital-700 text-white shadow font-bold text-xs space-y-1.5 transition-all transform active:scale-95"
                >
                  <Ticket className="h-5 w-5" />
                  <span>Generate Token</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    if (onBookAppointment) onBookAppointment(registeredPatient);
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shadow font-bold text-xs space-y-1.5 transition-all transform active:scale-95"
                >
                  <Calendar className="h-5 w-5" />
                  <span>Book Appointment</span>
                </button>

                <button
                  onClick={() => setShowViewProfileModal(true)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs space-y-1.5 transition-all"
                >
                  <Eye className="h-5 w-5 text-hospital-500" />
                  <span>View Profile</span>
                </button>

                <button
                  onClick={() => setShowPrintSlipModal(true)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs space-y-1.5 transition-all"
                >
                  <Printer className="h-5 w-5 text-amber-500" />
                  <span>Print Slip</span>
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow"
              >
                Done & Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Section Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold">
              {[
                { id: 'personal', label: '1. Personal', icon: User },
                { id: 'contact', label: '2. Contact', icon: Phone },
                { id: 'emergency', label: '3. Emergency', icon: AlertTriangle },
                { id: 'medical', label: '4. Medical', icon: Heart },
                { id: 'insurance', label: '5. Insurance & ID', icon: Shield }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors flex-shrink-0 ${
                      isActive
                        ? 'border-hospital-500 text-hospital-600 dark:text-hospital-400 bg-hospital-50/50 dark:bg-hospital-950/30 font-black'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Duplicate Detection Warning Banner */}
            {dupInfo && dupInfo.is_duplicate && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300 text-xs space-y-1">
                <div className="flex items-center space-x-2 font-bold">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>Duplicate Patient Record Warning</span>
                </div>
                <p className="pl-7 text-[11px] leading-relaxed">{dupInfo.message}</p>
              </div>
            )}

            {/* SECTION 1: PERSONAL INFORMATION */}
            {activeTab === 'personal' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">FULL NAME *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g. Johnathan Doe"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.name && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.name}</span>}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">DATE OF BIRTH *</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={handleDobChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.dob ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.dob && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.dob}</span>}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">AGE (YEARS) *</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => handleChange('age', e.target.value)}
                      placeholder="e.g. 35"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GENDER *</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">BLOOD GROUP</label>
                    <select
                      value={formData.blood_group}
                      onChange={(e) => handleChange('blood_group', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: CONTACT INFORMATION */}
            {activeTab === 'contact' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">MOBILE NUMBER *</label>
                    <input
                      type="tel"
                      value={formData.mobile_number}
                      onChange={(e) => handleChange('mobile_number', e.target.value)}
                      onBlur={handleCheckDuplicate}
                      placeholder="e.g. 9876543210"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.mobile_number ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.mobile_number && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.mobile_number}</span>}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">EMAIL ADDRESS (OPTIONAL)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={handleCheckDuplicate}
                      placeholder="e.g. john@example.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.email ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.email && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.email}</span>}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">RESIDENTIAL ADDRESS (OPTIONAL)</label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Enter street, city, state, zip code..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* SECTION 3: EMERGENCY CONTACT */}
            {activeTab === 'emergency' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CONTACT NAME *</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                      placeholder="e.g. Mary Doe"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.emergency_contact_name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.emergency_contact_name && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.emergency_contact_name}</span>}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">RELATIONSHIP</label>
                    <select
                      value={formData.emergency_contact_relationship}
                      onChange={(e) => handleChange('emergency_contact_relationship', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Child">Child</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Relative">Relative</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">CONTACT PHONE *</label>
                    <input
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                      placeholder="e.g. 9876500000"
                      className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none ${
                        errors.emergency_contact_phone ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                    {errors.emergency_contact_phone && <span className="text-[10px] text-rose-500 font-semibold mt-1 block">{errors.emergency_contact_phone}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: MEDICAL HISTORY */}
            {activeTab === 'medical' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">KNOWN ALLERGIES (OPTIONAL)</label>
                  <textarea
                    rows={2}
                    value={formData.allergies}
                    onChange={(e) => handleChange('allergies', e.target.value)}
                    placeholder="e.g. Penicillin, Peanuts, Latex..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">EXISTING MEDICAL CONDITIONS (OPTIONAL)</label>
                  <textarea
                    rows={3}
                    value={formData.existing_conditions}
                    onChange={(e) => handleChange('existing_conditions', e.target.value)}
                    placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* SECTION 5: INSURANCE & NATIONAL ID */}
            {activeTab === 'insurance' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">NATIONAL ID / PASSPORT (OPTIONAL)</label>
                    <input
                      type="text"
                      value={formData.national_id}
                      onChange={(e) => handleChange('national_id', e.target.value)}
                      onBlur={handleCheckDuplicate}
                      placeholder="e.g. NID-987654321"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">PROFILE PHOTO URL (OPTIONAL)</label>
                    <input
                      type="url"
                      value={formData.profile_photo}
                      onChange={(e) => handleChange('profile_photo', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">INSURANCE PROVIDER (OPTIONAL)</label>
                    <input
                      type="text"
                      value={formData.insurance_provider}
                      onChange={(e) => handleChange('insurance_provider', e.target.value)}
                      placeholder="e.g. Star Health Insurance"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">INSURANCE POLICY NUMBER (OPTIONAL)</label>
                    <input
                      type="text"
                      value={formData.insurance_number}
                      onChange={(e) => handleChange('insurance_number', e.target.value)}
                      placeholder="e.g. POL-88776655"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:ring-2 focus:ring-hospital-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation & Submit */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                {activeTab !== 'personal' && (
                  <button
                    type="button"
                    onClick={() => {
                      const tabs = ['personal', 'contact', 'emergency', 'medical', 'insurance'];
                      const idx = tabs.indexOf(activeTab);
                      if (idx > 0) setActiveTab(tabs[idx - 1]);
                    }}
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous Step</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {activeTab !== 'insurance' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const tabs = ['personal', 'contact', 'emergency', 'medical', 'insurance'];
                      const idx = tabs.indexOf(activeTab);
                      if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
                    }}
                    className="flex items-center space-x-1 px-5 py-2.5 rounded-xl bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900 text-xs font-bold shadow"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-bold shadow disabled:opacity-50 transition-all transform active:scale-95"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Registering Patient...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
                        <UserPlus className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </form>
        )}

      </div>

      {/* SUB-MODAL 1: VIEW PATIENT PROFILE DIALOG */}
      {showViewProfileModal && registeredPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <User className="h-5 w-5 text-hospital-500" />
                <span>Patient Master Record</span>
              </h3>
              <button onClick={() => setShowViewProfileModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">PATIENT ID</div>
                <div className="font-black text-hospital-600 dark:text-hospital-400 text-base">
                  {registeredPatient.patient_code || `ID-${registeredPatient.id}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{registeredPatient.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{registeredPatient.mobile_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">DOB / Age</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{registeredPatient.dob || 'N/A'} ({registeredPatient.age} yrs)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Gender / Blood</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{registeredPatient.gender} / {registeredPatient.blood_group || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Emergency Contact</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {registeredPatient.emergency_contact_name || 'N/A'} ({registeredPatient.emergency_contact_phone || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">National ID</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{registeredPatient.national_id || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowViewProfileModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: PRINT REGISTRATION SLIP DIALOG */}
      {showPrintSlipModal && registeredPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center space-x-2">
                <Printer className="h-5 w-5 text-hospital-500" />
                <span>Patient Registration Slip</span>
              </h3>
              <button onClick={() => setShowPrintSlipModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Content Box */}
            <div className="p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50 dark:bg-slate-800/40 text-xs">
              <div className="text-center border-b pb-2">
                <h4 className="font-black text-sm text-hospital-600">AcuraQueue Medical Center</h4>
                <p className="text-[10px] text-slate-400 uppercase">Patient Registration Slip</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">PATIENT ID:</span>
                  <span className="font-black text-slate-900 dark:text-white">{registeredPatient.patient_code || `ID-${registeredPatient.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">NAME:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{registeredPatient.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">MOBILE:</span>
                  <span className="font-semibold">{registeredPatient.mobile_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">AGE / GENDER:</span>
                  <span className="font-semibold">{registeredPatient.age} yrs / {registeredPatient.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">BLOOD GROUP:</span>
                  <span className="font-semibold">{registeredPatient.blood_group || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">DATE:</span>
                  <span className="font-semibold">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setShowPrintSlipModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2 rounded-xl bg-hospital-600 hover:bg-hospital-700 text-white text-xs font-bold shadow flex items-center space-x-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PatientRegistrationModal;
