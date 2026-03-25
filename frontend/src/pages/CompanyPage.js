import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Building2, MapPin, Phone, Calendar, TrendingUp, Users, Briefcase, Lock, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const CompanyPage = () => {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const { user, isAuthenticated, token } = useAuth();

  useEffect(() => {
    loadCompany();
    if (isAuthenticated) {
      checkIfFavorite();
    }
  }, [slug, isAuthenticated]);

  const loadCompany = async () => {
    setLoading(true);
    try {
      const data = await api.getCompanyBySlug(slug);
      setCompany(data);
    } catch (error) {
      console.error('Failed to load company:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfFavorite = async () => {
    if (!token || !company) return;
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const res = await fetch(`${API_URL}/api/user/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const isFav = data.favorites.some(f => f.company_id === company.cui);
        setIsFavorite(isFav);
      }
    } catch (error) {
      console.error('Failed to check favorite:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      alert('Trebuie să fii autentificat pentru a adăuga favorite');
      return;
    }

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const method = isFavorite ? 'DELETE' : 'POST';
      
      const res = await fetch(`${API_URL}/api/user/favorites/${company.cui}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-muted-foreground">Se încarcă...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Compania nu a fost găsită</h2>
          <Link to="/search" className="text-primary hover:underline">
            Înapoi la căutare
          </Link>
        </div>
      </div>
    );
  }

  const isPhoneMasked = company.anaf_telefon && company.anaf_telefon.includes('***');

  return (
    <>
      <Helmet>
        <title>{company?.denumire ? `${company.denumire} - CUI ${company.cui} | mFirme` : 'Companie | mFirme'}</title>
        <meta 
          name="description" 
          content={company ? `Informații complete despre ${company.denumire}, CUI ${company.cui}, ${company.localitate}, ${company.judet}. Date financiare, juridice și de contact.` : 'Informații complete despre companie'}
        />
      </Helmet>

      <div className="bg-secondary/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <nav className="text-xs text-muted-foreground mb-4">
            <Link to="/" className="hover:text-foreground">Acasă</Link>
            {company && (
              <>
                <span className="mx-2">/</span>
                <Link to={`/judet/${company.judet}`} className="hover:text-foreground">{company.judet}</Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{company.denumire}</span>
              </>
            )}
          </nav>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" data-testid="company-name">
                {company.denumire}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Building2 className="w-4 h-4" />
                  <span>CUI: {company.cui}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{company.localitate}, {company.judet}</span>
                </div>
                {company.forma_juridica && (
                  <div className="flex items-center space-x-1">
                    <Briefcase className="w-4 h-4" />
                    <span>{company.forma_juridica}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isAuthenticated && (
                <button
                  onClick={toggleFavorite}
                  className={`p-2 rounded-lg transition-colors ${
                    isFavorite 
                      ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={isFavorite ? 'Elimină din favorite' : 'Adaugă la favorite'}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}
              
              {company.anaf_stare && (
                <div className="hidden md:block px-3 py-1.5 bg-green-500/10 text-green-700 text-xs font-medium rounded-lg">
                  Activ
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="flex space-x-8">
            {['overview', 'financials', 'juridic'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`tab-${tab}`}
              >
                {tab === 'overview' && 'Prezentare'}
                {tab === 'financials' && 'Financiar'}
                {tab === 'juridic' && 'Juridic'}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Informații de contact</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Adresă</dt>
                  <dd className="text-sm" data-testid="company-address">
                    {company.strada && `${company.strada} ${company.numar || ''}`}
                    {company.strada && <br />}
                    {company.localitate}, {company.judet}
                    {company.cod_postal && `, ${company.cod_postal}`}
                  </dd>
                </div>

                {company.anaf_telefon && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Telefon</dt>
                    <dd className="text-sm flex items-center space-x-2" data-testid="company-phone">
                      <Phone className="w-4 h-4" />
                      <span>{company.anaf_telefon}</span>
                      {isPhoneMasked && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500/10 text-amber-700 text-xs rounded">
                          <Lock className="w-3 h-3" />
                          <span>Premium</span>
                        </span>
                      )}
                    </dd>
                  </div>
                )}

                {company.data_inregistrare && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Data înregistrare</dt>
                    <dd className="text-sm flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{company.data_inregistrare}</span>
                    </dd>
                  </div>
                )}

                {company.cod_inregistrare && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Număr registrul comerțului</dt>
                    <dd className="text-sm font-mono">{company.cod_inregistrare}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Business Info */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Informații generale</h3>
              <dl className="space-y-3">
                {company.anaf_forma_juridica && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Formă juridică</dt>
                    <dd className="text-sm">{company.anaf_forma_juridica}</dd>
                  </div>
                )}

                {company.anaf_cod_caen && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Cod CAEN</dt>
                    <dd className="text-sm font-mono">{company.anaf_cod_caen}</dd>
                  </div>
                )}

                {company.anaf_platitor_tva !== undefined && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Plătitor TVA</dt>
                    <dd className="text-sm">
                      {company.anaf_platitor_tva ? (
                        <span className="text-green-600">Da</span>
                      ) : (
                        <span className="text-muted-foreground">Nu</span>
                      )}
                    </dd>
                  </div>
                )}

                {company.anaf_stare && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-1">Stare</dt>
                    <dd className="text-sm">{company.anaf_stare}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}

        {/* Financials Tab */}
        {activeTab === 'financials' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-6" data-testid="metric-revenue">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground">Cifră de afaceri</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {company.mf_cifra_afaceri ? `${company.mf_cifra_afaceri.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
                {company.mf_an_bilant && (
                  <div className="text-xs text-muted-foreground mt-1">An {company.mf_an_bilant}</div>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-6" data-testid="metric-profit">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-xs text-muted-foreground">Profit net</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {company.mf_profit_net ? `${company.mf_profit_net.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6" data-testid="metric-employees">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Angajați</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {company.mf_numar_angajati || 'N/A'}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-2">
                  <Building2 className="w-5 h-5 text-orange-600" />
                  <span className="text-xs text-muted-foreground">Active totale</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {company.mf_active_circulante && company.mf_active_imobilizate 
                    ? `${(company.mf_active_circulante + company.mf_active_imobilizate).toLocaleString('ro-RO')} RON`
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Financial Details Table */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Detalii financiare</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {company.mf_venituri_totale && (
                      <tr>
                        <td className="py-3 text-muted-foreground">Venituri totale</td>
                        <td className="py-3 text-right font-medium">{company.mf_venituri_totale.toLocaleString('ro-RO')} RON</td>
                      </tr>
                    )}
                    {company.mf_cheltuieli_totale && (
                      <tr>
                        <td className="py-3 text-muted-foreground">Cheltuieli totale</td>
                        <td className="py-3 text-right font-medium">{company.mf_cheltuieli_totale.toLocaleString('ro-RO')} RON</td>
                      </tr>
                    )}
                    {company.mf_capitaluri_proprii && (
                      <tr>
                        <td className="py-3 text-muted-foreground">Capitaluri proprii</td>
                        <td className="py-3 text-right font-medium">{company.mf_capitaluri_proprii.toLocaleString('ro-RO')} RON</td>
                      </tr>
                    )}
                    {company.mf_datorii && (
                      <tr>
                        <td className="py-3 text-muted-foreground">Datorii</td>
                        <td className="py-3 text-right font-medium">{company.mf_datorii.toLocaleString('ro-RO')} RON</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Juridic Tab */}
        {activeTab === 'juridic' && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Informații juridice</h3>
            <dl className="space-y-4">
              {company.anaf_organ_fiscal && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Organ fiscal</dt>
                  <dd className="text-sm">{company.anaf_organ_fiscal}</dd>
                </div>
              )}
              {company.anaf_data_inregistrare && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Data înregistrare ANAF</dt>
                  <dd className="text-sm">{company.anaf_data_inregistrare}</dd>
                </div>
              )}
              {company.anaf_forma_organizare && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Formă de organizare</dt>
                  <dd className="text-sm">{company.anaf_forma_organizare}</dd>
                </div>
              )}
              {company.anaf_forma_proprietate && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Formă de proprietate</dt>
                  <dd className="text-sm">{company.anaf_forma_proprietate}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Premium CTA */}
        <div className="mt-8 bg-gradient-to-r from-primary/10 to-accent border border-primary/20 rounded-xl p-6 text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Deblochează informații premium</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Accesează date complete despre administratori, acționari, contacte și mult mai mult
          </p>
          <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm">
            Vezi planuri Premium
          </button>
        </div>
      </div>
    </>
  );
};

export default CompanyPage;
