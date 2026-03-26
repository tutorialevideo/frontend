import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { Building2, MapPin, Phone, Calendar, TrendingUp, Users, Briefcase, Lock, Heart, FileText, DollarSign, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../contexts/CreditsContext';
import api from '../services/api';
import FinancialChart from '../components/FinancialChart';

const CompanyPage = () => {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const { user, isAuthenticated, token } = useAuth();
  const { consumeCredit, systemEnabled } = useCredits();
  const creditConsumedRef = useRef(false);

  useEffect(() => {
    loadCompany();
    if (isAuthenticated) {
      checkIfFavorite();
    }
    creditConsumedRef.current = false;
  }, [slug, isAuthenticated]);

  useEffect(() => {
    if (company && isAuthenticated && systemEnabled && !creditConsumedRef.current) {
      creditConsumedRef.current = true;
      consumeCredit(company.cui);
    }
  }, [company, isAuthenticated, systemEnabled]);

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
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const res = await fetch(`${API_URL}/api/favorites/check/${company.cui}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsFavorite(data.is_favorite);
      }
    } catch (err) {
      console.error('Failed to check favorite:', err);
    }
  };

  const toggleFavorite = async () => {
    if (!token) return;
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      if (isFavorite) {
        await fetch(`${API_URL}/api/favorites/remove/${company.cui}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        await fetch(`${API_URL}/api/favorites/add`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ cui: company.cui, denumire: company.denumire })
        });
      }
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const isPhoneMasked = company?.anaf_telefon?.includes('***');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Firma nu a fost găsită</h1>
        <p className="text-muted-foreground mb-6">Verifică URL-ul sau caută altă firmă</p>
        <Link to="/search" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg">
          Caută firme
        </Link>
      </div>
    );
  }

  const pageTitle = company.denumire ? `${company.denumire} - CUI ${company.cui} | mFirme` : 'Profil Firmă | mFirme';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`${company.denumire || 'Firmă'} din ${company.localitate || ''}, ${company.judet || ''}. CUI: ${company.cui || ''}. Date financiare, contact și informații complete.`} />
      </Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="company-header">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <Building2 className="w-8 h-8 text-primary" />
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="company-name">
                  {company.denumire}
                </h1>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                <span className="font-mono" data-testid="company-cui">CUI: {company.cui}</span>
                <span className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span data-testid="company-location">{company.localitate}, {company.judet}</span>
                </span>
                {company.anaf_data_inregistrare && (
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>Din {company.anaf_data_inregistrare}</span>
                  </span>
                )}
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {company.anaf_stare_startswith_inregistrat && (
                  <span className="px-3 py-1 bg-green-500/10 text-green-700 text-xs font-medium rounded-full">
                    Activ ANAF
                  </span>
                )}
                {(company.anaf_platitor_tva || company.mf_platitor_tva) && (
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-700 text-xs font-medium rounded-full">
                    Plătitor TVA
                  </span>
                )}
                {company.mf_an_bilant && (
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-700 text-xs font-medium rounded-full">
                    Bilanț {company.mf_an_bilant}
                  </span>
                )}
                {company.forma_juridica && (
                  <span className="px-3 py-1 bg-gray-500/10 text-gray-700 text-xs font-medium rounded-full">
                    {company.forma_juridica}
                  </span>
                )}
              </div>
            </div>

            {/* Favorite button */}
            {isAuthenticated && (
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg border transition-colors ${
                  isFavorite 
                    ? 'bg-red-50 border-red-200 text-red-500' 
                    : 'border-border hover:bg-muted'
                }`}
                data-testid="favorite-button"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4" data-testid="metric-revenue">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-xs text-muted-foreground">Cifra de afaceri</span>
            </div>
            <div className="text-xl font-semibold tracking-tight">
              {company.mf_cifra_afaceri 
                ? `${company.mf_cifra_afaceri.toLocaleString('ro-RO')} RON`
                : 'N/A'}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4" data-testid="metric-profit">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Profit net</span>
            </div>
            <div className="text-xl font-semibold tracking-tight">
              {company.mf_profit_net 
                ? `${company.mf_profit_net.toLocaleString('ro-RO')} RON`
                : 'N/A'}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4" data-testid="metric-employees">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-xs text-muted-foreground">Angajați</span>
            </div>
            <div className="text-xl font-semibold tracking-tight">
              {company.mf_numar_angajati ?? 'N/A'}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Briefcase className="w-5 h-5 text-orange-600" />
              <span className="text-xs text-muted-foreground">Cod CAEN</span>
            </div>
            <div className="text-xl font-semibold tracking-tight font-mono">
              {company.anaf_cod_caen || 'N/A'}
            </div>
            {company.caen_denumire && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{company.caen_denumire}</div>
            )}
          </div>
        </div>

        {/* Financial Chart */}
        <FinancialChart cui={company.cui} />

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Informații de contact
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground mb-1">Adresă</dt>
                <dd className="text-sm" data-testid="company-address">
                  {company.anaf_adresa || (
                    <>
                      {company.strada && `${company.strada} ${company.numar || ''}`}
                      {company.strada && <br />}
                      {company.localitate}, {company.judet}
                      {company.cod_postal && `, ${company.cod_postal}`}
                    </>
                  )}
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

              {company.anaf_fax && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Fax</dt>
                  <dd className="text-sm">{company.anaf_fax}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* General Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Informații generale
            </h3>
            <dl className="space-y-3">
              {company.forma_juridica && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Formă juridică</dt>
                  <dd className="text-sm">{company.anaf_forma_juridica || company.forma_juridica}</dd>
                </div>
              )}

              {company.anaf_cod_caen && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Cod CAEN</dt>
                  <dd className="text-sm">
                    <span className="font-mono font-medium">{company.anaf_cod_caen}</span>
                    {company.caen_denumire && (
                      <span className="ml-2 text-muted-foreground">- {company.caen_denumire}</span>
                    )}
                  </dd>
                </div>
              )}

              {company.caen_sectiune && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Secțiune CAEN</dt>
                  <dd className="text-sm">
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-700 rounded text-xs">
                      {company.caen_sectiune}: {company.caen_sectiune_denumire}
                    </span>
                  </dd>
                </div>
              )}

              {company.anaf_stare && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Stare ANAF</dt>
                  <dd className="text-sm">{company.anaf_stare}</dd>
                </div>
              )}

              {company.anaf_data_inregistrare && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Data înregistrare</dt>
                  <dd className="text-sm">{company.anaf_data_inregistrare}</dd>
                </div>
              )}

              {company.anaf_organ_fiscal && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-1">Organ fiscal</dt>
                  <dd className="text-sm">{company.anaf_organ_fiscal}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Financial Details */}
        {(company.mf_venituri_totale || company.mf_cheltuieli_totale || company.mf_capitaluri_proprii || company.mf_datorii) && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Detalii financiare ({company.mf_an_bilant || 'Ultimul an'})
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {company.mf_venituri_totale && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Venituri totale</span>
                  <span className="text-sm font-medium">{company.mf_venituri_totale.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
              {company.mf_cheltuieli_totale && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Cheltuieli totale</span>
                  <span className="text-sm font-medium">{company.mf_cheltuieli_totale.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
              {company.mf_capitaluri_proprii && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Capitaluri proprii</span>
                  <span className="text-sm font-medium">{company.mf_capitaluri_proprii.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
              {company.mf_datorii && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Datorii</span>
                  <span className="text-sm font-medium">{company.mf_datorii.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
              {company.mf_active_circulante && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Active circulante</span>
                  <span className="text-sm font-medium">{company.mf_active_circulante.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
              {company.mf_active_imobilizate && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Active imobilizate</span>
                  <span className="text-sm font-medium">{company.mf_active_imobilizate.toLocaleString('ro-RO')} RON</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Premium CTA */}
        <div className="bg-gradient-to-r from-primary/10 to-accent border border-primary/20 rounded-xl p-6 text-center">
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
