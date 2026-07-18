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
    const response = await api.get('/api/queue/departments');
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
  
  complete: async (queueId, symptoms, diagnosis, prescription, durationMinutes = 15) => {
    const response = await api.post(`/api/queue/complete/${queueId}`, {
      patient_id: 0, // placeholder
      symptoms,
      diagnosis,
      prescription,
      duration_minutes: durationMinutes
    });
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
  list: async (departmentId = null) => {
    const url = departmentId ? `/api/doctors?department_id=${departmentId}` : '/api/doctors';
    const response = await api.get(url);
    return response.data;
  },
  
  create: async (name, specialization, roomNumber, username, password, departmentId) => {
    const response = await api.post('/api/doctors', {
      name,
      specialization,
      room_number: roomNumber,
      username,
      password,
      department_id: departmentId
    });
    return response.data;
  },
  
  updateAvailability: async (doctorId, isAvailable) => {
    const response = await api.put(`/api/doctors/${doctorId}`, { is_available: isAvailable });
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/api/doctors/me');
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
  
  register: async (name, age, gender, mobileNumber, username = null, password = null) => {
    const payload = { name, age: parseInt(age), gender, mobile_number: mobileNumber };
    if (username && password) {
      payload.username = username;
      payload.password = password;
    }
    const response = await api.post('/api/patients', payload);
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
  list: async () => {
    const response = await api.get('/api/appointments');
    return response.data;
  },

  book: async (doctorId, appointmentTime, appointmentType = 'Scheduled') => {
    const response = await api.post('/api/appointments', {
      patient_id: 0, // Backend resolves from logged-in patient
      doctor_id: doctorId,
      appointment_time: appointmentTime,
      appointment_type: appointmentType
    });
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
  const wsUrl = `${wsProto}//${window.location.host}/ws/queue`;
  
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
