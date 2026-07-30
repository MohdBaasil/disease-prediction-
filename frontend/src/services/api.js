import axios from 'axios';

// Automatically detect host URL
const API_BASE_URL = window.location.origin;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Authorization tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Authentication Services
export const authService = {
  login: async (username, password) => {
    // FastAPI expects form-encoded payload for OAuth2PasswordRequestForm
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    
    const response = await api.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);
      localStorage.setItem('username', response.data.username);
    }
    return response.data;
  },
  
  register: async (username, password, role = 'Patient') => {
    const response = await api.post('/api/auth/register', { username, password, role });
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
  },
  
  getCurrentUser: () => {
    return {
      token: localStorage.getItem('token'),
      role: localStorage.getItem('role'),
      username: localStorage.getItem('username'),
    };
  }
};

// Queue & Department Services
export const queueService = {
  getDepartments: async () => {
    const response = await api.get('/api/departments/active');
    return response.data;
  },
  
  checkIn: async (patientId, departmentId, priorityLevel, doctorId = null) => {
    const response = await api.post('/api/queue/check-in', {
      patient_id: patientId,
      department_id: departmentId,
      priority_level: priorityLevel,
      doctor_id: doctorId
    });
    return response.data;
  },
  
  callNext: async (doctorId) => {
    const response = await api.post(`/api/queue/call-next?doctor_id=${doctorId}`);
    return response.data;
  },
  
  complete: async (queueId, symptoms, diagnosis, prescription, durationMinutes = 15, labRequests = [], disposition = {}) => {
    const payload = {
      patient_id: 0, // placeholder
      symptoms,
      diagnosis,
      prescription,
      duration_minutes: durationMinutes,
      lab_requests: labRequests,
      consultation_outcome: disposition.consultation_outcome || "Discharge",
      discharge_summary: disposition.discharge_summary || null,
      patient_instructions: disposition.patient_instructions || null,
      medical_certificate: disposition.medical_certificate || false,
      next_review_required: disposition.next_review_required || false,
      followup_date: disposition.followup_date || null,
      followup_time: disposition.followup_time || null,
      followup_reason: disposition.followup_reason || null,
      followup_priority: disposition.followup_priority || null,
      admission_reason: disposition.admission_reason || null,
      ward: disposition.ward || null,
      expected_stay: disposition.expected_stay || null,
      bed_number: disposition.bed_number || null,
      referral_department: disposition.referral_department || null,
      referral_doctor: disposition.referral_doctor || null,
      referral_reason: disposition.referral_reason || null,
      referral_notes: disposition.referral_notes || null
    };
    const response = await api.post(`/api/queue/complete/${queueId}`, payload);
    return response.data;
  },
  
  skip: async (queueId) => {
    const response = await api.post(`/api/queue/skip/${queueId}`);
    return response.data;
  },
  
  reschedule: async (queueId) => {
    const response = await api.post(`/api/queue/reschedule/${queueId}`);
    return response.data;
  },
  
  getDepartmentQueue: async (departmentId) => {
    const response = await api.get(`/api/queue/department/${departmentId}`);
    return response.data;
  }
};

// Dashboard Services
export const dashboardService = {
  getAdminStats: async () => {
    const response = await api.get('/api/dashboard/admin');
    return response.data;
  },

  getReceptionistStats: async () => {
    const response = await api.get('/api/dashboard/receptionist');
    return response.data;
  },
  
  getDoctorStats: async (doctorId) => {
    const response = await api.get(`/api/dashboard/doctor/${doctorId}`);
    return response.data;
  },
  
  getPatientStats: async (patientId) => {
    const response = await api.get(`/api/dashboard/patient/${patientId}`);
    return response.data;
  }
};

// Doctors Services
export const doctorService = {
  list: async (params = null) => {
    let url = '/api/doctors';
    if (typeof params === 'number') {
      url = `/api/doctors?department_id=${params}`;
    } else if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.department_id) searchParams.append('department_id', params.department_id);
      if (params.status && params.status !== 'All') searchParams.append('status', params.status);
      if (params.is_active !== undefined && params.is_active !== null) searchParams.append('is_active', params.is_active);
      if (params.is_available !== undefined && params.is_available !== null) searchParams.append('is_available', params.is_available);
      const queryStr = searchParams.toString();
      if (queryStr) url += `?${queryStr}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  getActive: async (departmentId = null) => {
    const url = departmentId ? `/api/doctors/active?department_id=${departmentId}` : '/api/doctors/active';
    const response = await api.get(url);
    return response.data;
  },
  
  create: async (payloadOrName, specialization, roomNumber, username, password, departmentId) => {
    let payload = {};
    if (typeof payloadOrName === 'object') {
      payload = payloadOrName;
    } else {
      payload = {
        name: payloadOrName,
        specialization,
        room_number: roomNumber,
        username,
        password,
        department_id: departmentId
      };
    }
    const response = await api.post('/api/doctors', payload);
    return response.data;
  },

  update: async (doctorId, updateData) => {
    const response = await api.put(`/api/doctors/${doctorId}`, updateData);
    return response.data;
  },

  updateSchedule: async (doctorId, scheduleData) => {
    const response = await api.put(`/api/doctors/${doctorId}/schedule`, scheduleData);
    return response.data;
  },
  
  updateAvailability: async (doctorId, isAvailable, statusText = null) => {
    const response = await api.put(`/api/doctors/${doctorId}/availability`, {
      is_available: isAvailable,
      status_text: statusText
    });
    return response.data;
  },

  setStatus: async (doctorId, isActive, force = false) => {
    const response = await api.put(`/api/doctors/${doctorId}/status?is_active=${isActive}&force=${force}`);
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/api/doctors/me');
    return response.data;
  }
};

// Receptionist Management Services
export const receptionistService = {
  getReceptionists: async (params = null) => {
    let url = '/api/receptionists';
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'all') {
        searchParams.append('is_active', params.is_active);
      }
      const queryStr = searchParams.toString();
      if (queryStr) url += `?${queryStr}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  createReceptionist: async (data) => {
    const response = await api.post('/api/receptionists', data);
    return response.data;
  },

  updateReceptionist: async (receptionistId, data) => {
    const response = await api.put(`/api/receptionists/${receptionistId}`, data);
    return response.data;
  },

  updateReceptionistStatus: async (receptionistId, isActive) => {
    const response = await api.put(`/api/receptionists/${receptionistId}/status?is_active=${isActive}`);
    return response.data;
  },

  resetReceptionistPassword: async (receptionistId, newPassword) => {
    const response = await api.put(`/api/receptionists/${receptionistId}/reset-password`, {
      password: newPassword
    });
    return response.data;
  }
};

// Department Management Services
export const departmentService = {
  getDepartments: async (params = null) => {
    let url = '/api/departments';
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'all') {
        searchParams.append('is_active', params.is_active);
      }
      const queryStr = searchParams.toString();
      if (queryStr) url += `?${queryStr}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  getActiveDepartments: async () => {
    const response = await api.get('/api/departments/active');
    return response.data;
  },

  createDepartment: async (data) => {
    const response = await api.post('/api/departments', data);
    return response.data;
  },

  updateDepartment: async (departmentId, data) => {
    const response = await api.put(`/api/departments/${departmentId}`, data);
    return response.data;
  },

  updateDepartmentStatus: async (departmentId, isActive) => {
    const response = await api.put(`/api/departments/${departmentId}/status?is_active=${isActive}`);
    return response.data;
  },

  deleteDepartment: async (departmentId) => {
    const response = await api.delete(`/api/departments/${departmentId}`);
    return response.data;
  }
};

// User & Role Management Services
export const userService = {
  getUsers: async (params = null) => {
    let url = '/api/users';
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.role && params.role !== 'all') searchParams.append('role', params.role);
      if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'all') {
        searchParams.append('is_active', params.is_active);
      }
      const queryStr = searchParams.toString();
      if (queryStr) url += `?${queryStr}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  getUser: async (userId) => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },

  createUser: async (data) => {
    const response = await api.post('/api/users', data);
    return response.data;
  },

  updateUser: async (userId, data) => {
    const response = await api.put(`/api/users/${userId}`, data);
    return response.data;
  },

  updateUserStatus: async (userId, isActive) => {
    const response = await api.put(`/api/users/${userId}/status?is_active=${isActive}`);
    return response.data;
  },

  resetUserPassword: async (userId, newPassword) => {
    const response = await api.put(`/api/users/${userId}/reset-password`, {
      password: newPassword
    });
    return response.data;
  }
};

// Patients Services
export const patientService = {
  list: async (search = '') => {
    const url = search ? `/api/patients?search=${encodeURIComponent(search)}` : '/api/patients';
    const response = await api.get(url);
    return response.data;
  },
  
  getByMobile: async (mobile) => {
    const response = await api.get(`/api/patients/by-mobile/${mobile}`);
    return response.data;
  },

  getById: async (patientId) => {
    const response = await api.get(`/api/patients/${patientId}`);
    return response.data;
  },

  checkDuplicate: async (duplicateData) => {
    const response = await api.post('/api/patients/check-duplicate', duplicateData);
    return response.data;
  },
  
  register: async (dataOrName, age = null, gender = null, mobileNumber = null, username = null, password = null) => {
    let payload = {};
    if (typeof dataOrName === 'object' && dataOrName !== null) {
      payload = { ...dataOrName };
      if (payload.age) payload.age = parseInt(payload.age);
    } else {
      payload = { name: dataOrName, age: parseInt(age), gender, mobile_number: mobileNumber };
      if (username && password) {
        payload.username = username;
        payload.password = password;
      }
    }
    const response = await api.post('/api/patients', payload);
    return response.data;
  },

  update: async (patientId, patientData) => {
    const response = await api.put(`/api/patients/${patientId}`, patientData);
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/api/patients/me');
    return response.data;
  },
  
  getConsultations: async (patientId) => {
    const response = await api.get(`/api/patients/${patientId}/consultations`);
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/api/patients/me/profile', profileData);
    return response.data;
  },

  getVisits: async () => {
    const response = await api.get('/api/patients/me/visits');
    return response.data;
  },

  getPrescriptions: async () => {
    const response = await api.get('/api/patients/me/prescriptions');
    return response.data;
  },

  getReports: async () => {
    const response = await api.get('/api/patients/me/reports');
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get('/api/patients/me/notifications');
    return response.data;
  },

  predictDisease: async (vitals, symptoms) => {
    const response = await api.post('/api/patients/predict-disease', { vitals, symptoms });
    return response.data;
  },

  getSymptoms: async () => {
    const response = await api.get('/api/patient/symptoms');
    return response.data;
  },

  predictPatientDisease: async (vitals, symptoms) => {
    const response = await api.post('/api/patient/predict', { vitals, symptoms });
    return response.data;
  },

  getPredictionHistory: async (params = {}) => {
    const response = await api.get('/api/patient/predictions', { params });
    return response.data;
  },

  getPredictionDetail: async (id) => {
    const response = await api.get(`/api/patient/predictions/${id}`);
    return response.data;
  },

  getPrescriptionPdfUrl: (visitId) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/patients/me/prescriptions/${visitId}/pdf?token=${token}`;
  },

  getReportPdfUrl: (reportId) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/patients/me/reports/${reportId}/pdf?token=${token}`;
  }
};

// Appointments Services
export const appointmentsService = {
  list: async (params = {}) => {
    const response = await api.get('/api/appointments', { params });
    return response.data;
  },

  getToday: async () => {
    const response = await api.get('/api/appointments/today');
    return response.data;
  },

  book: async (payloadOrDoctorId, appointmentTime, appointmentType = 'Scheduled') => {
    let payload = {};
    if (typeof payloadOrDoctorId === 'object' && payloadOrDoctorId !== null) {
      payload = { ...payloadOrDoctorId };
    } else {
      payload = {
        patient_id: 0, // Backend resolves from logged-in patient
        doctor_id: payloadOrDoctorId,
        appointment_time: appointmentTime,
        appointment_type: appointmentType
      };
    }
    const response = await api.post('/api/appointments', payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/api/appointments/${id}`, payload);
    return response.data;
  },

  cancel: async (id) => {
    const response = await api.put(`/api/appointments/${id}/cancel`);
    return response.data;
  },

  reschedule: async (id, appointmentTime) => {
    const response = await api.put(`/api/appointments/${id}/reschedule`, {
      appointment_time: appointmentTime
    });
    return response.data;
  },

  checkIn: async (id, priorityLevel = 3) => {
    const response = await api.post(`/api/appointments/${id}/check-in`, {
      priority_level: priorityLevel
    });
    return response.data;
  },

  getDoctorAvailability: async (doctorId, date = null) => {
    const params = { doctor_id: doctorId };
    if (date) params.date = date;
    const response = await api.get('/api/appointments/doctor-availability', { params });
    return response.data;
  }
};

// Reports & Analytics Services
export const reportsService = {
  getAnalytics: async () => {
    const response = await api.get('/api/reports/analytics');
    return response.data;
  },
  
  getExcelUrl: (start = '', end = '') => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/reports/excel?token=${token}&start=${start}&end=${end}`;
  },
  
  getPdfUrl: (start = '', end = '') => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/api/reports/pdf?token=${token}&start=${start}&end=${end}`;
  }
};

// Advanced Analytics Services
export const analyticsService = {
  getAdminAnalytics: async (params) => {
    const response = await api.get('/api/analytics/admin/analytics', { params });
    return response.data;
  },
  getAdminCharts: async (params) => {
    const response = await api.get('/api/analytics/admin/charts', { params });
    return response.data;
  },
  getHighRiskPatients: async () => {
    const response = await api.get('/api/analytics/admin/high-risk-patients');
    return response.data;
  },
  getRecentActivities: async () => {
    const response = await api.get('/api/analytics/admin/recent-activities');
    return response.data;
  },
  getDoctorAnalytics: async (doctorId, params) => {
    const response = await api.get('/api/analytics/doctor/analytics', {
      params: { doctor_id: doctorId, ...params }
    });
    return response.data;
  },
  getDoctorCharts: async (doctorId, params) => {
    const response = await api.get('/api/analytics/doctor/charts', {
      params: { doctor_id: doctorId, ...params }
    });
    return response.data;
  },
  getDoctorInsights: async (doctorId, params) => {
    const response = await api.get('/api/analytics/doctor/insights', {
      params: { doctor_id: doctorId, ...params }
    });
    return response.data;
  },
  getPredictionAnalytics: async (params) => {
    const response = await api.get('/api/analytics/predictions/analytics', { params });
    return response.data;
  }
};


// Smart Clinical Workspace Services
export const clinicalService = {
  getPatientSummary: async (patientId) => {
    const response = await api.get('/api/clinical/patient-summary', {
      params: { patient_id: patientId }
    });
    return response.data;
  },
  getTimeline: async (patientId) => {
    const response = await api.get('/api/clinical/timeline', {
      params: { patient_id: patientId }
    });
    return response.data;
  },
  getAssistantSummary: async (data) => {
    const response = await api.post('/api/clinical/assistant', data);
    return response.data;
  },
  getPrescriptionScreening: async (data) => {
    const response = await api.post('/api/clinical/prescription-assistant', data);
    return response.data;
  },
  getFollowupRecommendation: async (data) => {
    const response = await api.post('/api/clinical/followup', data);
    return response.data;
  },
  getPatientFlags: async (data) => {
    const response = await api.post('/api/clinical/flags', data);
    return response.data;
  },
  getClinicalDecisionSupport: async (data) => {
    const response = await api.post('/api/clinical/recommendations', data);
    return response.data;
  },
  getDiseaseRecommendations: async (diseaseName) => {
    const response = await api.get('/api/clinical/disease-recommendations', {
      params: { disease: diseaseName }
    });
    return response.data;
  }
};

// AI Intelligence Services
export const aiService = {
  getHealthScore: async (patientId) => {
    const response = await api.get(`/api/ai/health-score/${patientId}`);
    return response.data;
  },
  getTimeline: async (patientId) => {
    const response = await api.get(`/api/ai/timeline/${patientId}`);
    return response.data;
  },
  sendMessage: async (patientId, message) => {
    const response = await api.post('/api/ai/chat', { patient_id: patientId, message });
    return response.data;
  },
  uploadOcrReport: async (patientId, fileName, fileContent = null) => {
    const response = await api.post('/api/ai/ocr-report', { patient_id: patientId, file_name: fileName, file_content: fileContent });
    return response.data;
  },
  saveOcrReport: async (data) => {
    const response = await api.post('/api/ai/ocr-report/save', data);
    return response.data;
  },
  submitVoiceSymptoms: async (patientId, audioBase64) => {
    const response = await api.post('/api/ai/voice-symptoms', { patient_id: patientId, audio_base_64: audioBase64 });
    return response.data;
  },
  getCarePlan: async (patientId) => {
    const response = await api.get(`/api/ai/care-plan/${patientId}`);
    return response.data;
  },
  updateCarePlan: async (patientId, data) => {
    const response = await api.post(`/api/ai/care-plan/${patientId}`, data);
    return response.data;
  },
  getRiskAlerts: async (patientId) => {
    const response = await api.get(`/api/ai/risk-alerts/${patientId}`);
    return response.data;
  },
  getHealthInsights: async (patientId) => {
    const response = await api.get(`/api/ai/health-insights/${patientId}`);
    return response.data;
  },
  getPatientSummary: async (patientId) => {
    const response = await api.get(`/api/ai/patient-summary/${patientId}`);
    return response.data;
  }
};

// WebSocket Service Creator
export const createQueueWebSocket = (onMessageCallback) => {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${window.location.hostname}:8000/ws/queue`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessageCallback(data);
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('WS connection closed. Reconnecting in 3s...');
    setTimeout(() => createQueueWebSocket(onMessageCallback), 3000);
  };
  
  ws.onerror = (err) => {
    console.error('WS Error:', err);
    ws.close();
  };
  
  return ws;
};
