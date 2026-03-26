import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { 
  Key, Search, ToggleLeft, ToggleRight, Activity, 
  TrendingUp, Users, Clock, Filter, RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const AdminApiKeysPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchAllKeys();
  }, [isAuthenticated, user, navigate, authLoading]);

  const fetchAllKeys = async () => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys/admin/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleKey = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys/admin/${keyId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAllKeys();
      }
    } catch (error) {
      console.error('Failed to toggle key:', error);
    }
  };

  const getPlanBadgeColor = (planId) => {
    switch (planId) {
      case 'basic': return 'bg-gray-100 text-gray-700';
      case 'pro': return 'bg-blue-100 text-blue-700';
      case 'enterprise': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter keys
  const filteredKeys = keys.filter(key => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!key.name?.toLowerCase().includes(query) && 
          !key.user_email?.toLowerCase().includes(query) &&
          !key.key_preview?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Plan filter
    if (filterPlan !== 'all' && key.plan_id !== filterPlan) {
      return false;
    }
    
    // Status filter
    if (filterStatus === 'active' && !key.active) return false;
    if (filterStatus === 'inactive' && key.active) return false;
    if (filterStatus === 'revoked' && !key.revoked) return false;
    
    return true;
  });

  if (loading || authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Helmet>
        <title>Gestionare Chei API | Admin mFirme</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Gestionare Chei API</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vizualizează și gestionează toate cheile API ale utilizatorilor
            </p>
          </div>
          <button
            onClick={fetchAllKeys}
            className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reîncarcă
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.total_keys}</div>
                  <div className="text-xs text-muted-foreground">Total chei</div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <ToggleRight className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.active_keys}</div>
                  <div className="text-xs text-muted-foreground">Chei active</div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{stats.total_requests_today.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Requests azi</div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {new Set(keys.map(k => k.user_id)).size}
                  </div>
                  <div className="text-xs text-muted-foreground">Utilizatori cu chei</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Caută după nume, email sau cheie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                data-testid="search-keys-input"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              >
                <option value="all">Toate planurile</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              >
                <option value="all">Toate statusurile</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="revoked">Revocate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Keys Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cheie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Utilizator</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requests azi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requests lună</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ultima utilizare</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredKeys.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      {searchQuery || filterPlan !== 'all' || filterStatus !== 'all'
                        ? 'Nicio cheie găsită cu filtrele selectate'
                        : 'Nu există chei API create încă'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-sm">{key.name}</div>
                          <code className="text-xs text-muted-foreground">{key.key_preview}</code>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{key.user_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getPlanBadgeColor(key.plan_id)}`}>
                          {key.plan_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{key.requests_today.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{key.requests_this_month.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-muted-foreground">{key.requests_total.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {key.last_used_at 
                            ? new Date(key.last_used_at).toLocaleString('ro-RO')
                            : 'Niciodată'
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {key.revoked ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-700">
                            Revocat
                          </span>
                        ) : key.active ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-green-100 text-green-700">
                            Activ
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700">
                            Inactiv
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!key.revoked && (
                          <button
                            onClick={() => toggleKey(key.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              key.active 
                                ? 'hover:bg-amber-100 text-amber-600' 
                                : 'hover:bg-green-100 text-green-600'
                            }`}
                            title={key.active ? 'Dezactivează' : 'Activează'}
                            data-testid={`toggle-key-${key.id}`}
                          >
                            {key.active ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-muted-foreground text-center">
          Afișare {filteredKeys.length} din {keys.length} chei API
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminApiKeysPage;
