import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, ShieldAlert, Sparkles, MessageSquare, Mic, MicOff, Send, 
  TrendingUp, TrendingDown, RefreshCw, Calendar, CheckCircle2, 
  Activity, AlertTriangle, AlertCircle, FileText, ArrowRight, HelpCircle
} from 'lucide-react';
import { aiService } from '../services/api';

function PatientAIPortal({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  
  // Chat Assistant State
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Voice Assistant State
  const [recording, setRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState('');

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setLoading(true);
      const scoreRes = await aiService.getHealthScore(patientId);
      setHealthScore(scoreRes);
      
      const timelineRes = await aiService.getTimeline(patientId);
      setTimelineData(timelineRes);
      
      // Initialize chat history if empty
      if (scoreRes && chatHistory.length === 0) {
        setChatHistory([
          {
            sender: 'assistant',
            message: `**AI Medical Disclaimer:** This assistant provides educational explanations based on your charts. It is NOT a diagnostic tool and does NOT replace doctor consultations. Contact emergency care if you feel severe chest pain or breathing difficulties.\n\nHello! I am your AI Medical Assistant. I have analyzed your clinical history and current vitals. Ask me anything about your diagnoses, medications, or preventive care.`,
            created_at: new Date()
          }
        ]);
      }
    } catch (err) {
      console.error('Error fetching patient AI portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  useEffect(() => {
    // Scroll to bottom of chat
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { sender: 'user', message: userMsg, created_at: new Date() }]);
    setChatLoading(true);

    try {
      const res = await aiService.sendMessage(patientId, userMsg);
      // Backend returns full updated history
      if (res && res.history) {
        setChatHistory(res.history);
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleVoiceRecord = () => {
    if (recording) {
      // Stop recording and simulate transcription
      setRecording(false);
      setVoiceLoading(true);
      
      setTimeout(async () => {
        try {
          // Send a simulated voice tags
          const sampleAudios = ['chest', 'stomach', 'general'];
          const randomTag = sampleAudios[Math.floor(randomTagGenerator())];
          const res = await aiService.submitVoiceSymptoms(patientId, randomTag);
          setVoiceResult(res);
          setEditedTranscription(res.transcription);
        } catch (err) {
          console.error(err);
        } finally {
          setVoiceLoading(false);
        }
      }, 2000);
    } else {
      setRecording(true);
      setVoiceResult(null);
    }
  };

  const randomTagGenerator = () => {
    return Math.random() * 3;
  };

  const handleSaveEditedVoiceResult = () => {
    if (!voiceResult) return;
    setVoiceResult(prev => ({
      ...prev,
      transcription: editedTranscription
    }));
    alert("Voice symptom transcription updated! Ready for doctor submission.");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-3xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-3xl lg:col-span-2"></div>
          <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  // Get color coding details for the gauge
  const getScoreDetails = (score) => {
    if (score >= 80) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Excellent Health', emoji: '🟢' };
    if (score >= 60) return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Moderate / Watchful', emoji: '🟡' };
    if (score >= 40) return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'High Risk Alert', emoji: '🟠' };
    return { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Critical Condition', emoji: '🔴' };
  };

  const scoreDetails = healthScore ? getScoreDetails(healthScore.current_score) : {};

  // Custom SVG line generator helper
  const generateSvgPath = (data) => {
    if (!data || data.length === 0) return '';
    const width = 500;
    const height = 150;
    const padding = 20;
    
    const xStep = (width - padding * 2) / (data.length > 1 ? data.length - 1 : 1);
    
    // Find min and max
    const values = data.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 100);
    const valRange = maxVal - minVal || 1;

    const points = data.map((d, index) => {
      const x = padding + index * xStep;
      const y = height - padding - ((d.value - minVal) / valRange) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP HEADER HEALTH SCORE GAUGE BANNER */}
      <div className={`border rounded-3xl p-6 shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Gauge Widget */}
          <div className="flex items-center space-x-6">
            <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
              {/* SVG Circular Progress Bar */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * (healthScore?.current_score || 0)) / 100}
                  className={`${scoreDetails.color} transition-all duration-1000 ease-out`}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black tracking-tight">{healthScore?.current_score}</span>
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Score</span>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${scoreDetails.bg} ${scoreDetails.color} ${scoreDetails.border} border`}>
                  {scoreDetails.emoji} {healthScore?.risk_category}
                </span>
                
                {healthScore?.trend === 'Improving' && (
                  <span className="text-emerald-500 text-xs font-bold flex items-center space-x-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Improving</span>
                  </span>
                )}
                {healthScore?.trend === 'Declining' && (
                  <span className="text-rose-500 text-xs font-bold flex items-center space-x-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>Declining</span>
                  </span>
                )}
                {healthScore?.trend === 'Stable' && (
                  <span className="text-slate-400 text-xs font-bold">Stable Trend</span>
                )}
              </div>
              <h2 className="text-lg font-black mt-2">AI Health Indicator Evaluation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mt-1">
                Calculated in real-time by analyzing blood sugars, blood pressure history, active chronic illness profiles, consultation compliance, and ML prediction risks.
              </p>
            </div>
          </div>

          {/* Verification Indicators */}
          <div className="text-right border-t md:border-t-0 md:border-l border-slate-150 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
            <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-widest">Model Confidence</span>
            <span className="text-xl font-black text-slate-800 dark:text-white block mt-0.5">
              {(healthScore?.confidence * 100).toFixed(0)}%
            </span>
            <button 
              onClick={fetchData} 
              className="mt-2 text-xs font-bold text-hospital-500 hover:text-hospital-600 inline-flex items-center space-x-1.5"
            >
              <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Refresh Metrics</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. CHAT ASSISTANT & TIMELINE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: AI Medical Chat Assistant (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Medical Assistant Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="bg-hospital-50 dark:bg-hospital-950 p-2 rounded-xl text-hospital-500">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">AI In-System Medical Chat</h3>
                  <span className="text-[10px] text-slate-400 font-bold block">Answers medical questions based on your clinical files</span>
                </div>
              </div>
            </div>

            {/* Conversation list container */}
            <div className="flex-grow overflow-y-auto pr-1 space-y-4 mb-4 text-xs">
              {chatHistory.map((chat, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-3.5 ${
                    chat.sender === 'user' 
                      ? 'bg-hospital-500 text-white font-semibold rounded-tr-none' 
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850/80 text-slate-700 dark:text-slate-300 rounded-tl-none font-medium leading-relaxed'
                  }`}>
                    {/* Format disclaimer differently */}
                    {chat.message.includes('AI Medical Disclaimer:') ? (
                      <div>
                        <div className="p-2 border border-amber-500/20 bg-amber-500/10 rounded-xl mb-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center space-x-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Educational AI Agent. Consult your physician.</span>
                        </div>
                        <p>{chat.message.replace(/.*?AI Medical Disclaimer:.*?\n\n/s, '')}</p>
                      </div>
                    ) : (
                      <p>{chat.message}</p>
                    )}
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 font-extrabold mt-1 block text-right">
                      {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl rounded-tl-none p-4 text-slate-400 flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Helper Questions */}
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-t border-slate-100 dark:border-slate-850 pt-2">
              <button 
                onClick={() => setChatMessage("Explain my diagnoses from my clinical history.")}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-950 hover:bg-slate-150 dark:hover:bg-slate-850 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors"
              >
                Explain diagnoses
              </button>
              <button 
                onClick={() => setChatMessage("List my medications and common rules to take them.")}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-950 hover:bg-slate-150 dark:hover:bg-slate-850 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors"
              >
                Explain medications
              </button>
              <button 
                onClick={() => setChatMessage("Show my latest logged vital ranges.")}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-950 hover:bg-slate-150 dark:hover:bg-slate-850 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors"
              >
                Summarize vitals
              </button>
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-grow px-4 py-2.5 border border-slate-350 dark:border-slate-800 bg-transparent text-xs rounded-xl focus:outline-none focus:border-hospital-500"
                placeholder="Ask about medications, prescriptions, diagnoses..."
              />
              <button
                type="submit"
                className="p-2.5 bg-hospital-500 hover:bg-hospital-600 text-white rounded-xl transition-all shadow-sm flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Voice Symptom Input assistant */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black mb-4 flex items-center space-x-2">
              <Mic className="h-4 w-4 text-hospital-500" />
              <span>Voice Symptom Assistant</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Mic buttons panel */}
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={handleVoiceRecord}
                  className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
                    recording 
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/20' 
                      : 'bg-hospital-50 hover:bg-hospital-100 text-hospital-500 dark:bg-hospital-950'
                  }`}
                >
                  {recording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <span className="text-[10px] font-bold text-slate-400 mt-2 block">
                  {recording ? "Recording... Click to stop" : "Click to record symptoms"}
                </span>
              </div>

              {/* Transcription & diagnosis predictions column (Span 2) */}
              <div className="md:col-span-2 space-y-3">
                {voiceLoading ? (
                  <div className="space-y-2 py-4 text-center">
                    <div className="w-6 h-6 border-2 border-hospital-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <span className="text-xs text-slate-400 font-semibold block">Transcribing and analyzing speech...</span>
                  </div>
                ) : voiceResult ? (
                  <div className="space-y-3 text-xs animate-fadeIn">
                    <div>
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase">Transcription (Click to edit)</span>
                      <textarea
                        value={editedTranscription}
                        onChange={(e) => setEditedTranscription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl mt-1 focus:outline-none"
                      />
                      <button 
                        onClick={handleSaveEditedVoiceResult} 
                        className="text-[9px] font-bold text-hospital-500 underline mt-1"
                      >
                        Update Transcription
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900">
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block mb-1">Parsed Symptoms</span>
                        <div className="flex flex-wrap gap-1">
                          {voiceResult.extracted_symptoms.map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-hospital-50 dark:bg-hospital-950 text-hospital-600 dark:text-hospital-400 font-semibold text-[9px]">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block mb-1">Clinic Referral</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">{voiceResult.recommended_department}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] mt-1 inline-block ${
                          voiceResult.urgency_level === 'Critical' 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>{voiceResult.urgency_level} Urgency</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => alert("Symptoms submitted to queue priority evaluation!")}
                      className="w-full py-2 bg-hospital-500 hover:bg-hospital-600 text-white font-bold rounded-xl shadow-sm text-center"
                    >
                      Submit Symptoms to Queue Manager
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 border border-slate-100 dark:border-slate-900 rounded-2xl text-xs flex flex-col items-center justify-center space-y-1 bg-slate-50/20">
                    <HelpCircle className="h-5 w-5 text-slate-400" />
                    <span>No active transcription. Hold mic and say: "I have had a sudden heavy chest pain and feeling short of breath" or "My stomach hurts".</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Timeline & Charts (Span 1) */}
        <div className="space-y-6">
          
          {/* Disease progression charts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black flex items-center space-x-2">
              <Activity className="h-4 w-4 text-hospital-500" />
              <span>Recovery & Risk Trend</span>
            </h3>

            {/* Health Score Trend SVG */}
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider mb-2">AI Health score trend</span>
              <div className="relative h-[150px] bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 500 150">
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2="480" y2="20" stroke="rgba(148, 163, 184, 0.1)" />
                  <line x1="20" y1="75" x2="480" y2="75" stroke="rgba(148, 163, 184, 0.1)" />
                  <line x1="20" y1="130" x2="480" y2="130" stroke="rgba(148, 163, 184, 0.1)" />
                  
                  {/* Path */}
                  <path
                    d={generateSvgPath(timelineData?.health_trend_data)}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Disease Severity Indicator */}
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider mb-2">Progressive disease severity (100 - score)</span>
              <div className="relative h-[150px] bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 500 150">
                  <line x1="20" y1="20" x2="480" y2="20" stroke="rgba(148, 163, 184, 0.1)" />
                  <line x1="20" y1="75" x2="480" y2="75" stroke="rgba(148, 163, 184, 0.1)" />
                  <line x1="20" y1="130" x2="480" y2="130" stroke="rgba(148, 163, 184, 0.1)" />
                  
                  <path
                    d={generateSvgPath(timelineData?.progression_chart_data)}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Recovery list tags */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-3">
              <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">Clinical Recovery Parameters</span>
              {timelineData?.recovery_indicators.map((ind, i) => (
                <div key={i} className="flex items-start space-x-2 text-[11px] font-semibold text-slate-600 dark:text-slate-450 leading-tight">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{ind}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Timeline */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[520px]">
            <h3 className="text-sm font-black mb-4 flex items-center space-x-2 border-b border-slate-100 dark:border-slate-850 pb-4">
              <Calendar className="h-4 w-4 text-hospital-500" />
              <span>Interactive Clinical Timeline</span>
            </h3>

            {/* Vertical Timeline container */}
            <div className="flex-grow overflow-y-auto pr-1 relative pl-4 space-y-6 text-xs">
              
              {/* Timeline Center Line */}
              <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-slate-150 dark:bg-slate-800"></div>

              {timelineData && timelineData.timeline.length > 0 ? (
                timelineData.timeline.map((event, idx) => {
                  let iconBg = "bg-slate-100 text-slate-500 dark:bg-slate-850";
                  if (event.event_type === 'Registration') iconBg = "bg-blue-100 text-blue-500 dark:bg-blue-950/45";
                  if (event.event_type === 'Consultation') iconBg = "bg-emerald-100 text-emerald-500 dark:bg-emerald-950/45";
                  if (event.event_type === 'Prescription') iconBg = "bg-indigo-100 text-indigo-500 dark:bg-indigo-950/45 font-semibold";
                  if (event.event_type === 'AI Prediction') iconBg = "bg-amber-100 text-amber-500 dark:bg-amber-950/45";
                  if (event.event_type === 'Lab Report') iconBg = "bg-rose-100 text-rose-500 dark:bg-rose-950/45";
                  
                  return (
                    <div key={event.id} className="relative pl-6 animate-fadeIn">
                      
                      {/* Circle Tag Icon Indicator */}
                      <div className={`absolute -left-1.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${iconBg.replace(/text-.*? /, 'bg-').replace(/dark:.*?$/, '')}`}></div>
                      
                      <div className="space-y-1">
                        <span className="text-[8px] text-slate-400 font-extrabold uppercase block tracking-widest">
                          {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-block mb-1 ${iconBg}`}>
                          {event.event_type}
                        </span>

                        <h4 className="font-bold text-slate-700 dark:text-slate-350">{event.title}</h4>
                        <p className="text-slate-550 dark:text-slate-450 leading-relaxed font-medium">{event.description}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400">No events logged.</div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default PatientAIPortal;
