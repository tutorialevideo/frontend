import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, MapPin, Building2, TrendingUp, ChevronRight, X } from 'lucide-react';
import api from '../services/api';

const SearchPage = ({ initialFilters = {} }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialFilters.q || searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  // Filters
  const [selectedJudet, setSelectedJudet] = useState(initialFilters.judet || searchParams.get('judet') || '');
  const [selectedLocalitate, setSelectedLocalitate] = useState(initialFilters.localitate || searchParams.get('localitate') || '');
  const [selectedCaen, setSelectedCaen] = useState(initialFilters.caen || searchParams.get('caen') || '');
  const [judete, setJudete] = useState([]);
  const [localitati, setLocalitati] = useState([]);
  
  // Check if this is a nested component (used by JudetPage, etc)
  const isNested = Object.keys(initialFilters).length > 0;

  useEffect(() => {
    loadJudete();
  }, []);

  useEffect(() => {
    if (selectedJudet) {
      loadLocalitati(selectedJudet);
    }
  }, [selectedJudet]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const judet = searchParams.get('judet') || '';
    const localitate = searchParams.get('localitate') || '';
    const caen = searchParams.get('caen') || '';
    
    setQuery(q);
    setSelectedJudet(judet);
    setSelectedLocalitate(localitate);
    setSelectedCaen(caen);
    
    performSearch(q, judet, localitate, caen, 1);
  }, [searchParams]);

  const loadJudete = async () => {
    try {
      const data = await api.getJudete();
      setJudete(data.judete || []);
    } catch (error) {
      console.error('Failed to load judete:', error);
    }
  };

  const loadLocalitati = async (judet) => {
    try {
      const data = await api.getLocalitati(judet);
      setLocalitati(data.localitati || []);
    } catch (error) {
      console.error('Failed to load localitati:', error);
    }
  };

  const performSearch = async (q, judet, localitate, caen, pageNum) => {
    setLoading(true);
    try {
      const data = await api.search({
        q,
        judet,
        localitate,
        caen,
        page: pageNum,
        limit: 20
      });
      setResults(data.results || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateSearchParams({ q: query });
  };

  const updateSearchParams = (updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    setSearchParams(params);
  };

  const clearFilter = (filterName) => {
    const updates = { [filterName]: '' };
    if (filterName === 'judet') {
      updates.localitate = '';
      setSelectedLocalitate('');
      setLocalitati([]);
    }
    updateSearchParams(updates);
  };

  return (
    <>
      {!isNested && (
        <Helmet>
          <title>Căutare firme - {query || 'Toate companiile'} | mFirme</title>
          <meta name="description" content={`Rezultate căutare: ${query || 'toate companiile din România'}`} />
        </Helmet>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută firme..."
              className="w-full pl-12 pr-4 py-3 text-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors bg-card"
              data-testid="search-input"
            />
          </div>
        </form>

        {/* Active Filters */}
        {(selectedJudet || selectedLocalitate || selectedCaen) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedJudet && (
              <button
                onClick={() => clearFilter('judet')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
                data-testid="filter-chip-judet"
              >
                <span>Județ: {selectedJudet}</span>
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedLocalitate && (
              <button
                onClick={() => clearFilter('localitate')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
                data-testid="filter-chip-localitate"
              >
                <span>Localitate: {selectedLocalitate}</span>
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedCaen && (
              <button
                onClick={() => clearFilter('caen')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
                data-testid="filter-chip-caen"
              >
                <span>CAEN: {selectedCaen}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4">Filtre</h3>
              
              {/* Județ Filter */}
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground block mb-2">Județ</label>
                <select
                  value={selectedJudet}
                  onChange={(e) => updateSearchParams({ judet: e.target.value, localitate: '' })}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary bg-background"
                  data-testid="filter-judet"
                >
                  <option value="">Toate județele</option>
                  {judete.map((j, idx) => (
                    <option key={idx} value={j.judet}>{j.judet} ({j.count})</option>
                  ))}
                </select>
              </div>

              {/* Localitate Filter */}
              {selectedJudet && localitati.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Localitate</label>
                  <select
                    value={selectedLocalitate}
                    onChange={(e) => updateSearchParams({ localitate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary bg-background"
                    data-testid="filter-localitate"
                  >
                    <option value="">Toate localitățile</option>
                    {localitati.slice(0, 100).map((l, idx) => (
                      <option key={idx} value={l.localitate}>{l.localitate} ({l.count})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* CAEN Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Cod CAEN</label>
                <input
                  type="text"
                  value={selectedCaen}
                  onChange={(e) => setSelectedCaen(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && updateSearchParams({ caen: selectedCaen })}
                  onBlur={() => updateSearchParams({ caen: selectedCaen })}
                  placeholder="Ex: 4120"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary bg-background"
                  data-testid="filter-caen"
                />
              </div>
            </div>
          </aside>

          {/* Results */}
          <main className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="results-count">
                {loading ? 'Se caută...' : `${total.toLocaleString('ro-RO')} rezultate`}
              </p>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Se încarcă...</div>
              ) : results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-results">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Nu am găsit rezultate pentru această căutare</p>
                </div>
              ) : (
                results.map((company, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(`/firma/${company.slug}`)}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all text-left"
                    data-testid={`result-${index}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-base font-semibold">{company.denumire}</h3>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>CUI: {company.cui}</div>
                      <div>{company.forma_juridica}</div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{company.localitate}, {company.judet}</span>
                      </div>
                      {company.mf_cifra_afaceri && (
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>{company.mf_cifra_afaceri.toLocaleString('ro-RO')} RON</span>
                        </div>
                      )}
                    </div>
                    {company.anaf_stare && (
                      <div className="mt-2 text-xs text-muted-foreground">{company.anaf_stare}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default SearchPage;