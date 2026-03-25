import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { Search, Edit, Eye, Save, X, Building2, AlertCircle } from 'lucide-react';

const AdminCompaniesPage = () => {
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [fieldVisibility, setFieldVisibility] = useState({});
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/companies/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: searchQuery, limit: 50 })
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.companies || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyDetails = async (cui) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/companies/details/${cui}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setCompanyDetails(data);
        setSelectedCompany(data.raw_data);
        
        // Build overrides map
        const overridesMap = {};
        data.overrides?.forEach(o => {
          overridesMap[o.field_name] = o.override_value;
        });
        setOverrides(overridesMap);
        
        // Build visibility map
        const visibilityMap = {};
        data.field_visibility?.forEach(v => {
          visibilityMap[v.field_name] = v.visibility;
        });
        setFieldVisibility(visibilityMap);
      }
    } catch (error) {
      console.error('Failed to load company details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedCompany) return;

    setSaveLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/companies/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cui: selectedCompany.cui,
          overrides: overrides,
          notes: 'Updated from admin panel'
        })
      });

      if (res.ok) {
        alert('Modificările au fost salvate cu succes!');
        setEditMode(false);
        loadCompanyDetails(selectedCompany.cui); // Reload
      }
    } catch (error) {
      console.error('Failed to save overrides:', error);
      alert('Eroare la salvarea modificărilor');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSetFieldVisibility = async (fieldName, visibility) => {
    if (!selectedCompany) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/companies/field-visibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cui: selectedCompany.cui,
          field_name: fieldName,
          visibility: visibility
        })
      });

      if (res.ok) {
        setFieldVisibility(prev => ({ ...prev, [fieldName]: visibility }));
        alert(`Câmpul ${fieldName} setat ca ${visibility}`);
      }
    } catch (error) {
      console.error('Failed to set field visibility:', error);
    }
  };

  const renderFieldEditor = (fieldName, value) => {
    const currentVisibility = fieldVisibility[fieldName] || 'public';
    const hasOverride = fieldName in overrides;
    const displayValue = hasOverride ? overrides[fieldName] : value;

    return (
      <div key={fieldName} className="border-b border-border last:border-0 py-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-sm font-medium">{fieldName}</label>
              {hasOverride && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-700 rounded">
                  Override
                </span>
              )}
            </div>
            
            {editMode ? (
              <input
                type="text"
                value={displayValue || ''}
                onChange={(e) => setOverrides(prev => ({ ...prev, [fieldName]: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-background text-sm"
              />
            ) : (
              <div className="text-sm text-muted-foreground">{displayValue || '-'}</div>
            )}
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <select
              value={currentVisibility}
              onChange={(e) => handleSetFieldVisibility(fieldName, e.target.value)}
              className="text-xs px-2 py-1 border border-border rounded bg-background"
            >
              <option value="public">Public</option>
              <option value="premium">Premium</option>
              <option value="hidden">Ascuns</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <Helmet>
        <title>Gestionare Firme | Admin mFirme</title>
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Gestionare Firme</h1>
        <p className="text-muted-foreground">
          Căutare, editare și configurare vizibilitate date firme
        </p>
      </div>

      {/* Search */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <form onSubmit={handleSearch} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută după CUI sau denumire firmă..."
              className="w-full pl-10 pr-4 py-3 border border-border rounded-lg focus:outline-none focus:border-primary bg-background"
              data-testid="admin-company-search-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="admin-company-search-button"
          >
            {loading ? 'Căutare...' : 'Caută'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Results */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Rezultate ({searchResults.length})</h3>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Niciun rezultat</p>
              </div>
            ) : (
              searchResults.map((company) => (
                <button
                  key={company.cui}
                  onClick={() => loadCompanyDetails(company.cui)}
                  className={`w-full text-left p-4 border-b border-border hover:bg-accent transition-colors ${
                    selectedCompany?.cui === company.cui ? 'bg-accent' : ''
                  }`}
                  data-testid="admin-company-result-item"
                >
                  <div className="font-medium text-sm mb-1">{company.denumire}</div>
                  <div className="text-xs text-muted-foreground">CUI: {company.cui}</div>
                  {company.judet && (
                    <div className="text-xs text-muted-foreground">{company.judet}, {company.localitate}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Company Details & Editor */}
        <div className="lg:col-span-2">
          {!selectedCompany ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Selectează o firmă pentru a vedea detaliile</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold mb-1">{selectedCompany.denumire}</h2>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>CUI: {selectedCompany.cui}</span>
                      <span>•</span>
                      <span>{selectedCompany.judet}, {selectedCompany.localitate}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!editMode ? (
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        data-testid="admin-company-edit-button"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Editează</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleSaveOverrides}
                          disabled={saveLoading}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          data-testid="admin-company-save-button"
                        >
                          <Save className="w-4 h-4" />
                          <span>{saveLoading ? 'Salvare...' : 'Salvează'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditMode(false);
                            loadCompanyDetails(selectedCompany.cui);
                          }}
                          className="flex items-center space-x-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Anulează</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Fields Editor */}
              <div className="p-6 max-h-[600px] overflow-y-auto">
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <strong>Notă:</strong> Modificările se salvează ca override-uri și NU modifică datele originale din baza de date.
                  </div>
                </div>

                {selectedCompany && Object.entries(selectedCompany).map(([key, value]) => {
                  if (key === '_id') return null;
                  return renderFieldEditor(key, value);
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCompaniesPage;
