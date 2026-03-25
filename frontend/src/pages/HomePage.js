import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, MapPin, TrendingUp, Users } from 'lucide-react';
import api from '../services/api';

const HomePage = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stats, setStats] = useState(null);
  const [judete, setJudete] = useState([]);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  useEffect(() => {
    loadStats();
    loadJudete();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadJudete = async () => {
    try {
      const data = await api.getJudete();
      setJudete(data.judete.slice(0, 12));
    } catch (error) {
      console.error('Failed to load counties:', error);
    }
  };

  const handleSearchInput = async (value) => {
    setQuery(value);
    
    if (value.length >= 2) {
      try {
        const data = await api.searchSuggest(value);
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search suggest failed:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setShowSuggestions(false);
    navigate(`/firma/${suggestion.slug}`);
  };

  return (
    <>
      <Helmet>
        <title>mFirme - Baza de date complete despre firmele din România</title>
        <meta 
          name="description" 
          content="Caută și analizează peste 1.2 milioane de firme din România. Date actualizate zilnic: CUI, adresă, date financiare, indicatori."
        />
      </Helmet>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-secondary/50 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance mb-6" data-testid="hero-title">
              Descoperă firmele din România
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-10 text-balance" data-testid="hero-subtitle">
              Peste {stats?.total_companies?.toLocaleString('ro-RO') || '1,2 milioane'} de companii, date actualizate zilnic
            </p>

            {/* Search Box */}
            <div className="relative max-w-2xl mx-auto" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                    placeholder="Caută după nume, CUI, registrul comerțului..."
                    className="w-full pl-12 pr-4 py-4 text-base border-2 border-border rounded-xl focus:outline-none focus:border-primary transition-colors bg-card shadow-sm"
                    data-testid="hero-search-input"
                  />
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden" data-testid="search-suggestions">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
                        data-testid={`suggestion-${index}`}
                      >
                        <div className="font-medium text-sm">{suggestion.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          CUI: {suggestion.cui} • {suggestion.location}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </form>

              <div className="mt-4 text-xs text-muted-foreground text-center">
                Încearcă: <button onClick={() => handleSearchInput('transport')} className="text-primary hover:underline">transport</button>, <button onClick={() => handleSearchInput('construct')} className="text-primary hover:underline">construcții</button>, <button onClick={() => handleSearchInput('SRL')} className="text-primary hover:underline">SRL</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm" data-testid="stat-total">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight">{stats.total_companies.toLocaleString('ro-RO')}</div>
              <div className="text-xs text-muted-foreground mt-1">Companii totale</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm" data-testid="stat-active">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight">{stats.active_companies.toLocaleString('ro-RO')}</div>
              <div className="text-xs text-muted-foreground mt-1">Firme active</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm" data-testid="stat-counties">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight">{stats.counties}</div>
              <div className="text-xs text-muted-foreground mt-1">Județe</div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm" data-testid="stat-financials">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight">{stats.with_financials.toLocaleString('ro-RO')}</div>
              <div className="text-xs text-muted-foreground mt-1">Cu date financiare</div>
            </div>
          </div>
        </div>
      )}

      {/* Popular Counties */}
      {judete.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-6">Explorează după județ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {judete.map((judet, index) => (
              <button
                key={index}
                onClick={() => navigate(`/judet/${encodeURIComponent(judet.judet)}`)}
                className="px-4 py-3 bg-card border border-border rounded-lg hover:border-primary hover:shadow-sm transition-all text-sm text-left"
                data-testid={`county-${index}`}
              >
                <div className="font-medium">{judet.judet}</div>
                <div className="text-xs text-muted-foreground mt-1">{judet.count.toLocaleString('ro-RO')} firme</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center" data-testid="feature-updated">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-2">Date actualizate zilnic</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Informații sincronizate automat din surse oficiale ANAF și Ministerul Finanțelor
            </p>
          </div>

          <div className="text-center" data-testid="feature-search">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-2">Căutare rapidă</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Găsește orice firmă după nume, CUI, județ, localitate sau domeniu de activitate
            </p>
          </div>

          <div className="text-center" data-testid="feature-comprehensive">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-2">Informații complete</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Date juridice, financiare, contact și indicatori de performanță pentru fiecare companie
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;
