import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { CreditsProvider } from './contexts/CreditsContext';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import CompanyPage from './pages/CompanyPage';
import JudetPage from './pages/JudetPage';
import LocalitatePage from './pages/LocalitatePage';
import CaenPage from './pages/CaenPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import FavoritesPage from './pages/FavoritesPage';
import SubscriptionPage from './pages/SubscriptionPage';
import CreditsPage from './pages/CreditsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAuditPage from './pages/AdminAuditPage';
import AdminSyncPage from './pages/AdminSyncPage';
import ApiKeysPage from './pages/ApiKeysPage';
import AdminApiKeysPage from './pages/AdminApiKeysPage';
import Header from './components/Header';
import Footer from './components/Footer';
import NoCreditsModal from './components/NoCreditsModal';

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdminRoute && <Header />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/firma/:slug" element={<CompanyPage />} />
          <Route path="/judet/:slug" element={<JudetPage />} />
          <Route path="/localitate/:slug" element={<LocalitatePage />} />
          <Route path="/caen/:code" element={<CaenPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/favorites" element={<FavoritesPage />} />
          <Route path="/account/subscription" element={<SubscriptionPage />} />
          <Route path="/account/credits" element={<CreditsPage />} />
          <Route path="/account/api-keys" element={<ApiKeysPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/companies" element={<AdminCompaniesPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
          <Route path="/admin/sync" element={<AdminSyncPage />} />
          <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
      <NoCreditsModal />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <CreditsProvider>
          <Router>
            <AppContent />
          </Router>
        </CreditsProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;