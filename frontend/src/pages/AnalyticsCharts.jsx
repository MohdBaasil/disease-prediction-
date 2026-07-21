import React from 'react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler 
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
);

// Common chart options helper for dark mode theme matching
const getChartOptions = (isDarkMode, extraOptions = {}) => {
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)';
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: {
            family: 'Inter, sans-serif',
            size: 11,
            weight: '500'
          }
        },
        position: 'top',
        ...extraOptions.legend
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        titleColor: isDarkMode ? '#f8fafc' : '#0f172a',
        bodyColor: isDarkMode ? '#cbd5e1' : '#334155',
        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { family: 'Inter, sans-serif', weight: 'bold' },
        bodyFont: { family: 'Inter, sans-serif' },
        ...extraOptions.tooltip
      }
    },
    scales: {
      x: {
        grid: {
          color: 'transparent'
        },
        ticks: {
          color: textColor,
          font: { family: 'Inter, sans-serif', size: 10 }
        }
      },
      y: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor,
          font: { family: 'Inter, sans-serif', size: 10 }
        }
      },
      ...extraOptions.scales
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    ...extraOptions.root
  };
};

// 1. Monthly Patient Registration (Line Chart)
export const MonthlyRegistrationChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.month ?? ''),
    datasets: [
      {
        label: 'Registrations',
        data: safeData.map(item => item?.count ?? 0),
        borderColor: '#0066f5',
        backgroundColor: 'rgba(0, 102, 245, 0.05)',
        borderWidth: 3,
        pointBackgroundColor: '#0066f5',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true
      }
    ]
  };

  const options = getChartOptions(isDarkMode);
  return <Line data={chartData} options={options} />;
};

// 2. Monthly Appointment Trend (Area Chart)
export const AppointmentTrendChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.month ?? ''),
    datasets: [
      {
        label: 'Appointments',
        data: safeData.map(item => item?.count ?? 0),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 3,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true
      }
    ]
  };

  const options = getChartOptions(isDarkMode);
  return <Line data={chartData} options={options} />;
};

// 3. Most Common Predicted Diseases (Bar Chart)
export const CommonPredictedDiseasesChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.disease ?? ''),
    datasets: [
      {
        label: 'Cases Predicted',
        data: safeData.map(item => item?.count ?? 0),
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        hoverBackgroundColor: '#2563eb',
        borderRadius: 8,
        barThickness: 24
      }
    ]
  };

  const options = getChartOptions(isDarkMode, {
    scales: {
      x: {
        grid: { color: 'transparent' },
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 9 } }
      },
      y: {
        grid: { color: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)' }
      }
    }
  });

  return <Bar data={chartData} options={options} />;
};

// 4. Department-wise Patient Distribution (Pie Chart)
export const DepartmentDistributionChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const colorsList = ['#0066f5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];
  const chartData = {
    labels: safeData.map(item => item?.department ?? ''),
    datasets: [
      {
        data: safeData.map(item => item?.count ?? 0),
        backgroundColor: colorsList.slice(0, Math.max(safeData.length, 1)),
        borderWidth: isDarkMode ? 2 : 1,
        borderColor: isDarkMode ? '#1e293b' : '#ffffff'
      }
    ]
  };

  const options = getChartOptions(isDarkMode, {
    legend: { position: 'right' }
  });

  return <Pie data={chartData} options={options} />;
};

// 5. Doctor Workload (Horizontal Bar Chart)
export const DoctorWorkloadChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.doctor_name ?? ''),
    datasets: [
      {
        label: 'Total Handled',
        data: safeData.map(item => item?.patients_handled ?? 0),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        barThickness: 10
      },
      {
        label: "Today's Consultations",
        data: safeData.map(item => item?.todays_consultations ?? 0),
        backgroundColor: '#10b981',
        borderRadius: 6,
        barThickness: 10
      }
    ]
  };

  const options = getChartOptions(isDarkMode, {
    scales: {
      x: {
        grid: { color: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)' }
      },
      y: {
        grid: { color: 'transparent' }
      }
    },
    root: {
      indexAxis: 'y'
    }
  });

  return <Bar data={chartData} options={options} />;
};

// 6. Prediction Risk Distribution (Donut Chart)
export const RiskDistributionChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const riskColors = {
    'Low': '#10b981',
    'Medium': '#f59e0b',
    'High': '#f43f5e',
    'Critical': '#991b1b'
  };

  const labels = safeData.map(item => item?.risk_level ?? 'Unknown');
  const bgColors = safeData.map(item => riskColors[item?.risk_level] || '#64748b');

  const chartData = {
    labels: labels,
    datasets: [
      {
        data: safeData.map(item => item?.count ?? 0),
        backgroundColor: bgColors,
        borderWidth: isDarkMode ? 2 : 1,
        borderColor: isDarkMode ? '#1e293b' : '#ffffff',
        hoverOffset: 4
      }
    ]
  };

  const options = getChartOptions(isDarkMode, {
    legend: { position: 'bottom' }
  });

  return <Doughnut data={chartData} options={options} />;
};

// 7. Daily Consultation Trend (Line Chart)
export const DailyConsultationTrendChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.date ?? ''),
    datasets: [
      {
        label: 'Consultations',
        data: safeData.map(item => item?.count ?? 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const options = getChartOptions(isDarkMode);
  return <Line data={chartData} options={options} />;
};

// 8. Weekly Consultation Trend (Bar Chart)
export const WeeklyConsultationTrendChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.day ?? ''),
    datasets: [
      {
        label: 'Consultations Completed',
        data: safeData.map(item => item?.count ?? 0),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        hoverBackgroundColor: '#8b5cf6',
        borderRadius: 6,
        barThickness: 20
      }
    ]
  };

  const options = getChartOptions(isDarkMode);
  return <Bar data={chartData} options={options} />;
};

// 9. Patient Age Distribution (Bar Chart)
export const AgeDistributionChart = ({ data = [], isDarkMode }) => {
  const safeData = Array.isArray(data) ? data : [];
  const chartData = {
    labels: safeData.map(item => item?.age_group ?? ''),
    datasets: [
      {
        label: 'Patients Count',
        data: safeData.map(item => item?.count ?? 0),
        backgroundColor: '#ec4899',
        borderRadius: 6,
        barThickness: 24
      }
    ]
  };

  const options = getChartOptions(isDarkMode);
  return <Bar data={chartData} options={options} />;
};
