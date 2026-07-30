import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, Calendar, Hash, Bell, Sparkles, 
  Globe, Palette, Save, RefreshCw, CheckCircle2, AlertTriangle, X,
  ShieldCheck, Server, Database, Activity, Cpu
} from 'lucide-react';
import { settingsService } from '../services/api';

export default function SystemSettings({ onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('hospital');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const DEFAULT_SETTINGS = {
    hospital_name: "AcuraQueue General Hospital",
    hospital_code: "ACURA-HQ",
    hospital_address: "100 Health Science Blvd, Suite 400",
    hospital_phone: "555-0199",
    hospital_email: "info@acuraqueue.com",
    hospital_website: "https://acuraqueue.com",
    hospital_logo: "/logo.png",

    appointment_duration_minutes: 15,
    booking_interval_minutes: 15,
    max_daily_appointments: 100,
    allow_walk_in: true,

    queue_prefix: "Q",
    auto_generate_tokens: true,
    emergency_priority_enabled: true,
    queue_reset_daily: true,

    email_notifications: true,
    sms_notifications: false,
    appointment_reminders: true,
    reminder_hours_before: 24,

    ai_recommendations_enabled: true,
    ai_confidence_threshold: 75,

    timezone: "UTC",
    date_format: "YYYY-MM-DD",
    time_format: "12h",
    language: "en",

    system_theme: "system",
    primary_color: "#0284c7"
  };

  const [formData, setFormData] = useState(DEFAULT_SETTINGS);

  // Fetch settings from API
  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await settingsService.getSettings();
      if (data) {
        setFormData({
          hospital_name: data.hospital_name || DEFAULT_SETTINGS.hospital_name,
          hospital_code: data.hospital_code || DEFAULT_SETTINGS.hospital_code,
          hospital_address: data.hospital_address || '',
          hospital_phone: data.hospital_phone || '',
          hospital_email: data.hospital_email || '',
          hospital_website: data.hospital_website || '',
          hospital_logo: data.hospital_logo || '',

          appointment_duration_minutes: data.appointment_duration_minutes ?? 15,
          booking_interval_minutes: data.booking_interval_minutes ?? 15,
          max_daily_appointments: data.max_daily_appointments ?? 100,
          allow_walk_in: data.allow_walk_in ?? true,

          queue_prefix: data.queue_prefix || "Q",
          auto_generate_tokens: data.auto_generate_tokens ?? true,
          emergency_priority_enabled: data.emergency_priority_enabled ?? true,
          queue_reset_daily: data.queue_reset_daily ?? true,

          email_notifications: data.email_notifications ?? true,
          sms_notifications: data.sms_notifications ?? false,
          appointment_reminders: data.appointment_reminders ?? true,
          reminder_hours_before: data.reminder_hours_before ?? 24,

          ai_recommendations_enabled: data.ai_recommendations_enabled ?? true,
          ai_confidence_threshold: data.ai_confidence_threshold ?? 75,

          timezone: data.timezone || "UTC",
          date_format: data.date_format || "YYYY-MM-DD",
          time_format: data.time_format || "12h",
          language: data.language || "en",

          system_theme: data.system_theme || "system",
          primary_color: data.primary_color || "#0284c7"
        });
      }
    } catch (err) {
      console.error("Error fetching system settings:", err);
      setError("Failed to load system settings configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save Settings
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');

    // Validations
    if (!formData.hospital_name || !formData.hospital_name.trim()) {
      setError("Hospital name is required.");
      return;
    }
    if (formData.hospital_email && !formData.hospital_email.includes('@')) {
      setError("Invalid hospital email address format.");
      return;
    }
    if (formData.appointment_duration_minutes <= 0) {
      setError("Consultation duration must be greater than 0 minutes.");
      return;
    }
    if (formData.max_daily_appointments <= 0) {
      setError("Maximum daily appointments must be greater than 0.");
      return;
    }
    if (!formData.queue_prefix || formData.queue_prefix.length > 5) {
      setError("Queue prefix must be between 1 and 5 characters.");
      return;
    }
    if (formData.reminder_hours_before < 1 || formData.reminder_hours_before > 72) {
      setError("Reminder hours must be between 1 and 72 hours.");
      return;
    }

    setSaving(true);
    try {
      await settingsService.updateSettings(formData);
      setSuccess("System settings updated and saved successfully.");
      if (onSettingsUpdated) onSettingsUpdated();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update system settings.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = () => {
    setFormData(DEFAULT_SETTINGS);
    setSuccess("Settings reset to default configuration. Click 'Save Changes' to persist.");
    setTimeout(() => setSuccess(''), 3500);
  };

  const tabs = [
    { id: 'hospital', label: 'Hospital Info', icon: Building2 },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'queue', label: 'Queue Rules', icon: Hash },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'ai', label: 'AI Preferences', icon: Sparkles },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Palette }
  ];

  return (
    <div className="space-y-6">

      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Settings className="h-5 w-5 text-hospital-500" />
            <span>System Configuration & Preferences</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control global hospital operational rules, queue parameters, notification alerts, and AI prediction parameters.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-hospital-500 hover:bg-hospital-600 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-1.5 transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 rounded"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Navigation Tabs Header */}
        <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-2 gap-1">
          {tabs.map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all shrink-0 ${
                  isActive 
                    ? 'bg-white dark:bg-slate-900 text-hospital-600 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-800' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                <IconComp className={`h-4 w-4 ${isActive ? 'text-hospital-500' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400 font-semibold animate-pulse">Loading system configuration...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">

              {/* TAB 1: HOSPITAL INFORMATION */}
              {activeTab === 'hospital' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    Hospital Profile & Identity
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hospital Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.hospital_name}
                        onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hospital Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.hospital_code}
                        onChange={(e) => setFormData({ ...formData, hospital_code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Address</label>
                      <input
                        type="text"
                        value={formData.hospital_address}
                        onChange={(e) => setFormData({ ...formData, hospital_address: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={formData.hospital_phone}
                        onChange={(e) => setFormData({ ...formData, hospital_phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={formData.hospital_email}
                        onChange={(e) => setFormData({ ...formData, hospital_email: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Website URL</label>
                      <input
                        type="text"
                        value={formData.hospital_website}
                        onChange={(e) => setFormData({ ...formData, hospital_website: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Logo Asset URL</label>
                      <input
                        type="text"
                        value={formData.hospital_logo}
                        onChange={(e) => setFormData({ ...formData, hospital_logo: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: APPOINTMENTS */}
              {activeTab === 'appointments' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    Appointment Booking & Schedule Policy
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Default Consultation Duration (Minutes) *</label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={formData.appointment_duration_minutes}
                        onChange={(e) => setFormData({ ...formData, appointment_duration_minutes: parseInt(e.target.value) || 15 })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Booking Interval Slot (Minutes) *</label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={formData.booking_interval_minutes}
                        onChange={(e) => setFormData({ ...formData, booking_interval_minutes: parseInt(e.target.value) || 15 })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Max Daily Appointments Per Doctor *</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={formData.max_daily_appointments}
                        onChange={(e) => setFormData({ ...formData, max_daily_appointments: parseInt(e.target.value) || 100 })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Allow Walk-in Appointments</span>
                        <span className="text-[10px] text-slate-400">Enable receptionists to book same-day walk-in patients</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, allow_walk_in: !formData.allow_walk_in })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.allow_walk_in ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.allow_walk_in ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: QUEUE RULES */}
              {activeTab === 'queue' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    Queue Ticket & Token Generation Rules
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Queue Token Prefix *</label>
                      <input
                        type="text"
                        maxLength="5"
                        value={formData.queue_prefix}
                        onChange={(e) => setFormData({ ...formData, queue_prefix: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Auto Generate Token Numbers</span>
                        <span className="text-[10px] text-slate-400">Sequential token assignment on patient check-in</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, auto_generate_tokens: !formData.auto_generate_tokens })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.auto_generate_tokens ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.auto_generate_tokens ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Emergency Priority Queue</span>
                        <span className="text-[10px] text-slate-400">Boost emergency tickets to top of calling list</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, emergency_priority_enabled: !formData.emergency_priority_enabled })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.emergency_priority_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.emergency_priority_enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Daily Queue Token Reset</span>
                        <span className="text-[10px] text-slate-400">Reset token sequence to 001 at midnight</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, queue_reset_daily: !formData.queue_reset_daily })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.queue_reset_daily ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.queue_reset_daily ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    Patient Notification & Reminder Dispatch
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Email Dispatch</span>
                        <span className="text-[10px] text-slate-400">Send email notifications for appointments and queue updates</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, email_notifications: !formData.email_notifications })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.email_notifications ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.email_notifications ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">SMS Notifications</span>
                        <span className="text-[10px] text-slate-400">Send SMS text messages to patient mobile numbers</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, sms_notifications: !formData.sms_notifications })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.sms_notifications ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.sms_notifications ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Automated Reminders</span>
                        <span className="text-[10px] text-slate-400">Send advance reminders prior to scheduled visit time</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, appointment_reminders: !formData.appointment_reminders })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.appointment_reminders ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.appointment_reminders ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reminder Notice Lead Time (Hours) *</label>
                      <input
                        type="number"
                        min="1"
                        max="72"
                        value={formData.reminder_hours_before}
                        onChange={(e) => setFormData({ ...formData, reminder_hours_before: parseInt(e.target.value) || 24 })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: AI PREFERENCES */}
              {activeTab === 'ai' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    AI Clinical Diagnostic Preferences
                  </h3>

                  <div className="space-y-4 max-w-xl">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Enable AI Clinical Recommendations</span>
                        <span className="text-[10px] text-slate-400">Provide AI disease prediction and treatment care suggestions</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ai_recommendations_enabled: !formData.ai_recommendations_enabled })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative inline-flex items-center ${
                          formData.ai_recommendations_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.ai_recommendations_enabled ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-800 dark:text-white">AI Diagnostic Confidence Threshold</label>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-extrabold bg-hospital-100 text-hospital-700 dark:bg-hospital-950 dark:text-hospital-300">
                          {formData.ai_confidence_threshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="99"
                        step="1"
                        value={formData.ai_confidence_threshold}
                        onChange={(e) => setFormData({ ...formData, ai_confidence_threshold: parseFloat(e.target.value) })}
                        className="w-full accent-hospital-500 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400">
                        Predictions with confidence lower than {formData.ai_confidence_threshold}% will be flagged for physician review.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: LOCALIZATION */}
              {activeTab === 'localization' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    Regional & Time Standards
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Time Zone</label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      >
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="EST">EST (Eastern Standard Time)</option>
                        <option value="CST">CST (Central Standard Time)</option>
                        <option value="PST">PST (Pacific Standard Time)</option>
                        <option value="GMT">GMT (Greenwich Mean Time)</option>
                        <option value="IST">IST (Indian Standard Time)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date Display Format</label>
                      <select
                        value={formData.date_format}
                        onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-30)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (30/07/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (07/30/2026)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Time Format</label>
                      <select
                        value={formData.time_format}
                        onChange={(e) => setFormData({ ...formData, time_format: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      >
                        <option value="12h">12-Hour (02:30 PM)</option>
                        <option value="24h">24-Hour (14:30)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">System Language</label>
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      >
                        <option value="en">English (US)</option>
                        <option value="es">Spanish (Español)</option>
                        <option value="fr">French (Français)</option>
                        <option value="de">German (Deutsch)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: APPEARANCE */}
              {activeTab === 'appearance' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    UI Theme & Branding
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Default Workspace Theme</label>
                      <select
                        value={formData.system_theme}
                        onChange={(e) => setFormData({ ...formData, system_theme: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                      >
                        <option value="system">System Synchronized</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Primary Accent Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="w-9 h-9 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.primary_color}
                          onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                          className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>
          )}
        </div>

      </div>

    </div>
  );
}
