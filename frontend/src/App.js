import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import CompanyPage from './pages/CompanyPage';
import JudetPage from './pages/JudetPage';
import LocalitatePage from './pages/LocalitatePage';
import CaenPage from './pages/CaenPage';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <HelmetProvider>
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
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </HelmetProvider>
  );
}

export default App;