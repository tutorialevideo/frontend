import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { Users, TrendingUp, Heart, DollarSign, Activity, ArrowUp, ArrowDown, Building2, Coins, ToggleLeft, ToggleRight } from 'lucide-react';

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [creditsStats, setCreditsStats] = useState(null);
  const [togglingCredits, setTogglingCredits] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      loadAdminData();
    }
  }, [isAuthenticated, navigate]);

  const loadAdminData = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      
      const [statsRes, settingsRes, creditsStatsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/credits/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else if (statsRes.status === 403) {
        alert('Nu aveți permisiuni de admin');
        navigate('/account');
        return;
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      if (creditsStatsRes.ok) {
        const creditsData = await creditsStatsRes.json();
        setCreditsStats(creditsData);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCreditsSystem = async () => {
    setTogglingCredits(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const res = await fetch(`${API_URL}/api/admin/settings/credits-system/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, credits_system_enabled: data.credits_system_enabled }));
      }
    } catch (error) {
      console.error('Failed to toggle credits system:', error);
    } finally {
      setTogglingCredits(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Se încarcă datele...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!stats) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Acces interzis</h2>
          <p className="text-sm text-muted-foreground">Nu aveți permisiuni de administrator</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Admin Dashboard | mFirme</title>
        <meta name="description" content="Panoul de administrare mFirme" />
      </Helmet>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2" data-testid="admin-dashboard-title">
          Dashboard Administrativ
        </h1>
        <p className="text-muted-foreground">
          Vedere de ansamblu asupra platformei mFirme
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="admin-stats-cards">
        {/* Total Users */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="admin-stat-total-users">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center space-x-1 text-green-600 text-sm">
              <ArrowUp className="w-4 h-4" />
              <span>+{stats.users.new_last_30_days}</span>
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight mb-1">{stats.users.total}</div>
          <div className="text-sm text-muted-foreground">Total utilizatori</div>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            {stats.users.new_last_30_days} noi în ultimele 30 zile
          </div>
        </div>

        {/* Premium Users */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="admin-stat-premium-users">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight mb-1">{stats.users.premium + stats.users.plus}</div>
          <div className="text-sm text-muted-foreground">Utilizatori Premium</div>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            {stats.users.premium} Premium • {stats.users.plus} Plus
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="admin-stat-revenue">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight mb-1">{stats.revenue.total_revenue_ron} RON</div>
          <div className="text-sm text-muted-foreground">Venit total</div>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            {stats.revenue.paid_transactions} tranzacții completate
          </div>
        </div>

        {/* Engagement */}
        <div className="bg-card border border-border rounded-xl p-6" data-testid="admin-stat-favorites">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight mb-1">{stats.engagement.total_favorites}</div>
          <div className="text-sm text-muted-foreground">Total favorite</div>
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            {stats.engagement.avg_favorites_per_user.toFixed(1)} medie/utilizator
          </div>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* User Distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Distribuție utilizatori</span>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Free</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-gray-500 h-2 rounded-full" 
                    style={{ width: `${(stats.users.free / stats.users.total) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium w-12 text-right">{stats.users.free}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plus</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${(stats.users.plus / stats.users.total) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium w-12 text-right">{stats.users.plus}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Premium</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-amber-500 h-2 rounded-full" 
                    style={{ width: `${(stats.users.premium / stats.users.total) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium w-12 text-right">{stats.users.premium}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Stats */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Statistici platformă</span>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total companii</span>
              <span className="text-lg font-semibold">{stats.platform.total_companies.toLocaleString('ro-RO')}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total favorite</span>
              <span className="text-lg font-semibold">{stats.engagement.total_favorites}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Conversie la Premium</span>
              <span className="text-lg font-semibold">
                {((stats.users.premium / stats.users.total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Acțiuni rapide</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/companies')}
            className="flex flex-col items-center justify-center p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Building2 className="w-6 h-6 mb-2 text-primary" />
            <span className="text-sm font-medium">Gestionare firme</span>
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="flex flex-col items-center justify-center p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Users className="w-6 h-6 mb-2 text-primary" />
            <span className="text-sm font-medium">Gestionare utilizatori</span>
          </button>
          <button
            onClick={() => navigate('/admin/payments')}
            className="flex flex-col items-center justify-center p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <DollarSign className="w-6 h-6 mb-2 text-primary" />
            <span className="text-sm font-medium">Vezi plăți</span>
          </button>
          <button
            onClick={() => navigate('/admin/audit')}
            className="flex flex-col items-center justify-center p-4 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Activity className="w-6 h-6 mb-2 text-primary" />
            <span className="text-sm font-medium">Audit log</span>
          </button>
        </div>
      </div>

      {/* Credits System Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Coins className="w-5 h-5" />
          <span>Sistem de credite</span>
        </h3>
        
        <div className="flex items-center justify-between py-4 border-b border-border">
          <div>
            <p className="font-medium">Sistemul de credite</p>
            <p className="text-sm text-muted-foreground">
              {settings?.credits_system_enabled 
                ? 'Utilizatorii trebuie să aibă credite pentru a vizualiza firme' 
                : 'Accesul la firme este nelimitat pentru toți utilizatorii'}
            </p>
          </div>
          <button
            onClick={toggleCreditsSystem}
            disabled={togglingCredits}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            data-testid="toggle-credits-system"
          >
            {settings?.credits_system_enabled ? (
              <ToggleRight className="w-10 h-10 text-green-500" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-muted-foreground" />
            )}
          </button>
        </div>

        {settings?.credits_system_enabled && creditsStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold">{creditsStats.total_users_with_credits}</div>
              <div className="text-xs text-muted-foreground">Utilizatori cu credite</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold">{creditsStats.total_credits_in_circulation}</div>
              <div className="text-xs text-muted-foreground">Credite în circulație</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold">{creditsStats.total_company_views}</div>
              <div className="text-xs text-muted-foreground">Vizualizări firme</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-2xl font-bold">{creditsStats.total_credit_purchases}</div>
              <div className="text-xs text-muted-foreground">Achiziții credite</div>
            </div>
          </div>
        )}

        {settings && (
          <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Configurare actuală:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Credite bonus la înregistrare: <strong>{settings.default_bonus_credits}</strong></li>
              <li>• Vizualizări gratuite/zi: <strong>{settings.default_daily_free_views}</strong></li>
              <li>• Pachete: 50 ({settings.credit_packages?.[0]?.price} RON), 200 ({settings.credit_packages?.[1]?.price} RON), 500 ({settings.credit_packages?.[2]?.price} RON)</li>
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
