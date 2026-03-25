import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, TrendingUp, Heart, DollarSign, Building2 } from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      loadAdminData();
    }
  }, [isAuthenticated, navigate]);

  const loadAdminData = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      // Load stats
      const statsRes = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else if (statsRes.status === 403) {
        alert('Nu aveți permisiuni de admin');
        navigate('/account');
        return;
      }

      // Load users
      const usersRes = await fetch(`${API_URL}/api/admin/users?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      // Load transactions
      const transRes = await fetch(`${API_URL}/api/admin/transactions?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (transRes.ok) {
        const transData = await transRes.json();
        setTransactions(transData.transactions || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        Se încarcă datele admin...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-xl font-semibold mb-2">Acces interzis</h2>
        <p className="text-sm text-muted-foreground">Nu aveți permisiuni de administrator</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | mFirme</title>
        <meta name="description" content="Panoul de administrare mFirme" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panou de control și statistici</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{stats.users.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total utilizatori</div>
            <div className="text-xs text-green-600 mt-2">+{stats.users.new_last_30_days} în 30 zile</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{stats.users.premium}</div>
            <div className="text-xs text-muted-foreground mt-1">Utilizatori Premium</div>
            <div className="text-xs text-muted-foreground mt-2">{stats.users.plus} Plus</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{stats.revenue.total_revenue_ron} RON</div>
            <div className="text-xs text-muted-foreground mt-1">Venit total</div>
            <div className="text-xs text-muted-foreground mt-2">{stats.revenue.paid_transactions} plăți</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{stats.engagement.total_favorites}</div>
            <div className="text-xs text-muted-foreground mt-1">Total favorite</div>
            <div className="text-xs text-muted-foreground mt-2">{stats.engagement.avg_favorites_per_user} medie/user</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="flex space-x-8">
            {['overview', 'users', 'transactions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'overview' && 'Prezentare generală'}
                {tab === 'users' && 'Utilizatori'}
                {tab === 'transactions' && 'Tranzacții'}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Statistici platformă</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Distribuție utilizatori</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Free</span>
                      <span className="font-medium">{stats.users.free}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Plus</span>
                      <span className="font-medium">{stats.users.plus}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Premium</span>
                      <span className="font-medium">{stats.users.premium}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-3">Date platformă</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total companii</span>
                      <span className="font-medium">{stats.platform.total_companies.toLocaleString('ro-RO')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total favorite</span>
                      <span className="font-medium">{stats.engagement.total_favorites}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nume</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-sm">{user.name}</td>
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          user.tier === 'premium' ? 'bg-amber-500/10 text-amber-700' :
                          user.tier === 'plus' ? 'bg-blue-500/10 text-blue-700' :
                          'bg-gray-500/10 text-gray-700'
                        }`}>
                          {user.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'admin' && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/10 text-red-700">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('ro-RO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Sumă</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((trans) => (
                    <tr key={trans.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 text-sm">{trans.user_email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-500/10 text-blue-700">
                          {trans.plan_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{trans.amount} {trans.currency?.toUpperCase()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          trans.payment_status === 'paid' ? 'bg-green-500/10 text-green-700' :
                          'bg-yellow-500/10 text-yellow-700'
                        }`}>
                          {trans.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(trans.created_at).toLocaleDateString('ro-RO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminPage;