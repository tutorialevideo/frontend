import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
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
import AdminPage from './pages/AdminPage';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Header />
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
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;