import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { hasCredentials, getRole } from './api/client'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StudentDetail from './pages/StudentDetail'
import CriteriaSettings from './pages/CriteriaSettings'
import ChallansPage from './pages/ChallansPage'
import MonthlyChallansPage from './pages/MonthlyChallansPage'
import FeeRecordPage from './pages/FeeRecordPage'
import StudentRecordsPage from './pages/StudentRecordsPage'
import DirectorDashboard from './pages/DirectorDashboard'
import CertificatesPage from './pages/CertificatesPage'

function PrivateRoute({ children }) {
  if (!hasCredentials()) return <Navigate to="/login" replace />
  return children
}

function DirectorRoute({ children }) {
  if (!hasCredentials()) return <Navigate to="/login" replace />
  if (getRole() !== 'director') return <Navigate to="/" replace />
  return children
}

function App() {
  const [authed, setAuthed] = useState(hasCredentials())

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => setAuthed(true)} />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="students/:id" element={<StudentDetail />} />
          <Route path="settings/criteria" element={<CriteriaSettings />} />
          <Route path="challans" element={<ChallansPage />} />
          <Route path="monthly-challans" element={<MonthlyChallansPage />} />
          <Route path="fee-record" element={<FeeRecordPage />} />
          <Route path="student-records" element={<StudentRecordsPage />} />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route
            path="director"
            element={
              <DirectorRoute>
                <DirectorDashboard />
              </DirectorRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
