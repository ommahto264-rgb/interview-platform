import { BrowserRouter, Link, Route, Routes } from 'react-router'

import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/landing/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import OrganizationPage from './pages/organizations/OrganizationPage'
import ChallengePage from './pages/challenges/ChallengePage'
import CreateChallengePage from './pages/challenges/CreateChallengePage'
import CreateInterviewPage from './pages/interviews/CreateInterviewPage'
import InterviewDetailsPage from './pages/interviews/InterviewDetailsPage'
import AcceptInvitationPage from './pages/interviews/AcceptInvitationPage'
import CandidateInterviewPage from './pages/candidate/CandidateInterviewPage'
import CreateOrganizationPage from './pages/organizations/CreateOrganizationPage'
import AcceptOrganizationInvitationPage from './pages/organizations/AcceptOrganizationInvitationPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

import './App.css'
import './pages/landing/LandingPage.css'
import './pages/dashboard/DashboardPage.css'
import './pages/challenges/ChallengePage.css'
import './pages/challenges/CreateChallengePage.css'
import './pages/interviews/CreateInterviewPage.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<LoginPage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/register" element={<RegisterPage />} />

        <Route path="/organization-invitations/accept" element={<AcceptOrganizationInvitationPage />}/>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route
            path="/organizations/:organizationId"
            element={<OrganizationPage />}
          />

          <Route
            path="/organizations/:organizationId/challenges/new"
            element={<CreateChallengePage />}
          />

          <Route
            path="/organizations/:organizationId/challenge-versions/:versionId"
            element={<ChallengePage />}
          />

          <Route
            path="/organizations/:organizationId/interviews/new"
            element={<CreateInterviewPage />}
          />

          <Route
            path="/organizations/:organizationId/interviews/:interviewId"
            element={<InterviewDetailsPage />}
          />

          <Route
            path="/invitations/accept"
            element={<AcceptInvitationPage />}
          />

          <Route
            path="/candidate/interviews/:interviewId"
            element={<CandidateInterviewPage />}
          />

          <Route
            path="/organizations/new"
            element={<CreateOrganizationPage />}
          />
        </Route>

        <Route
          path="*"
          element={
            <main className="login-page">
              <section className="login-card">
                <h1>Page not found</h1>

                <p className="subtitle">
                  This page does not exist.
                </p>

                <Link to="/">Return to home</Link>
              </section>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}