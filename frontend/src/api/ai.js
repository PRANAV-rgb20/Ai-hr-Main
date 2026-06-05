import { api } from './client';

// ── Resume Screener ───────────────────────────────────────────────────────────

export const screenResume = (resumeFile, jobDescription) => {
  const form = new FormData();
  form.append('resume_pdf', resumeFile);
  form.append('job_description', jobDescription);
  return api.post('/ai/screen-resume/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const screenAllCandidates = (jobId) =>
  api.post(`/ai/screen-resume/batch/${jobId}/`);

// ── Interview Bot ─────────────────────────────────────────────────────────────

export const startInterview = (data) =>
  api.post('/ai/interview/start/', data);

export const respondToInterview = (sessionId, answer) =>
  api.post('/ai/interview/respond/', { session_id: sessionId, answer });

export const getInterview = (sessionId) =>
  api.get(`/ai/interview/${sessionId}/`);

// ── ML Predictions ────────────────────────────────────────────────────────────

export const predictPerformance = (employeeId) =>
  api.post(`/ai/predict-performance/${employeeId}/`);

export const getAttritionRisk = (employeeId) =>
  api.get(`/ai/attrition-risk/${employeeId}/`);

export const getTeamAttritionRisk = (managerId) =>
  api.get(`/ai/attrition-risk/team/${managerId}/`);

// ── Sentiment Pulse ───────────────────────────────────────────────────────────

export const submitSentimentCheckin = (moodText) =>
  api.post('/ai/sentiment/checkin/', { mood_text: moodText });

export const getSentimentPulse = () =>
  api.get('/ai/sentiment/pulse/');

export const getMySentiment = () =>
  api.get('/ai/sentiment/my/');

// ── Payroll Anomaly Detector ──────────────────────────────────────────────────

export const detectPayrollAnomalies = (month, year) =>
  api.post(`/ai/payroll/detect-anomalies/${month}/${year}/`);

// ── Smart Leave Optimizer ─────────────────────────────────────────────────────

export const optimizeLeave = (durationDays) =>
  api.post('/ai/leave/optimize/', { duration_days: durationDays });

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const getAuditLogs = (params) =>
  api.get('/ai/audit-logs/', { params });

// ── Policy Chatbot (RAG) ──────────────────────────────────────────────────────

export const uploadPolicy = (pdfFile, title) => {
  const form = new FormData();
  form.append('pdf_file', pdfFile);
  form.append('title', title);
  return api.post('/ai/policy/upload/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const chatWithPolicy = (question) =>
  api.post('/ai/policy/chat/', { question });

export const getPolicyDocuments = () =>
  api.get('/ai/policy/documents/');

export const deletePolicy = (title) =>
  api.delete(`/ai/policy/documents/${encodeURIComponent(title)}/`);

// Workforce Insight Cards
export const getAdminAIInsight = () =>
  api.get('/ai/insights/admin-summary');

export const getWellnessScore = (employeeId) =>
  api.get(`/ai/insights/wellness/${employeeId}`);

export const getLearningRecommendations = () =>
  api.get('/ai/insights/learning-recommendations/my');

export const getPayrollNarrative = (month, year) =>
  api.get(`/ai/insights/payroll-narrative/${month}/${year}`);

export const getLeaveConflict = (leaveId) =>
  api.get(`/leave/${leaveId}/conflict`);
