import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { ScrollText, Filter, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const AdminAuditPage = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, resourceFilter, adminFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (actionFilter) params.append('action', actionFilter);
      if (resourceFilter) params.append('resource_type', resourceFilter);
      if (adminFilter) params.append('admin_email', adminFilter);

      const res = await fetch(`${API_URL}/api/admin/audit/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/audit/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('delete')) return 'text-red-600 bg-red-500/10';
    if (action.includes('update') || action.includes('override')) return 'text-amber-600 bg-amber-500/10';
    if (action.includes('create')) return 'text-green-600 bg-green-500/10';
    return 'text-blue-600 bg-blue-500/10';
  };

  const getResourceIcon = (resourceType) => {
    switch (resourceType) {
      case 'company': return '🏢';
      case 'user': return '👤';
      case 'subscription': return '💳';
      default: return '📄';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <Helmet>
        <title>Audit Log | Admin mFirme</title>
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Audit Log</h1>
        <p className="text-muted-foreground">
          Istoric complet al tuturor modificărilor administrative
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Acțiuni</h3>
            <div className="space-y-2">
              {stats.by_action.slice(0, 3).map((item) => (
                <div key={item._id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item._id}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Admini</h3>
            <div className="space-y-2">
              {stats.by_admin.slice(0, 3).map((item) => (
                <div key={item._id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[180px]">{item._id}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Resurse Modificate</h3>
            <div className="space-y-2">
              {stats.by_resource_type.map((item) => (
                <div key={item._id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item._id}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Filtre</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Acțiune</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              data-testid="admin-audit-action-filter"
            >
              <option value="">Toate acțiunile</option>
              <option value="company_override">Company Override</option>
              <option value="field_visibility_change">Field Visibility</option>
              <option value="user_update">User Update</option>
              <option value="user_delete">User Delete</option>
              <option value="seo_metadata_update">SEO Update</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tip resursă</label>
            <select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              data-testid="admin-audit-resource-filter"
            >
              <option value="">Toate resursele</option>
              <option value="company">Company</option>
              <option value="user">User</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Admin</label>
            <input
              type="text"
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Email admin..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              data-testid="admin-audit-admin-filter"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="admin-audit-table">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-32">Data/Ora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Acțiune</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Resursă</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Modificări</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted-foreground">
                    Se încarcă...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted-foreground">
                    <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nicio înregistrare în audit log</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-accent/50 transition-colors" data-testid="admin-audit-row">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatTimestamp(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getResourceIcon(log.resource_type)}</span>
                        <div>
                          <div className="text-sm font-medium">{log.resource_type}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {log.resource_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {log.admin_email}
                    </td>
                    <td className="px-4 py-3">
                      <details className="cursor-pointer">
                        <summary className="text-xs text-primary hover:underline">
                          Vezi detalii
                        </summary>
                        <pre className="mt-2 text-xs bg-secondary p-2 rounded overflow-x-auto max-w-md">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Afișare {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} din {total} înregistrări
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                data-testid="admin-audit-prev-page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm px-4">
                Pagina {page} din {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                data-testid="admin-audit-next-page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAuditPage;
