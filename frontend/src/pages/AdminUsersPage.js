import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { 
  Users, Search, Edit, Trash2, RotateCcw, 
  Crown, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';

const AdminUsersPage = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadUsers();
  }, [page, search, tierFilter, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search) params.append('search', search);
      if (tierFilter) params.append('tier', tierFilter);
      if (roleFilter) params.append('role', roleFilter);

      const res = await fetch(`${API_URL}/api/admin/users-management/list?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users-management/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId, ...updates })
      });

      if (res.ok) {
        alert('Utilizator actualizat cu succes!');
        loadUsers();
        setEditMode(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Eroare la actualizarea utilizatorului');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Sigur doriți să ștergeți acest utilizator?')) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/users-management/delete/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        alert('Utilizator șters cu succes!');
        loadUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Eroare la ștergerea utilizatorului');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <Helmet>
        <title>Gestionare Utilizatori | Admin mFirme</title>
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Gestionare Utilizatori</h1>
        <p className="text-muted-foreground">
          Administrare conturi utilizatori, tier-uri și roluri
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută după email sau nume..."
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:border-primary bg-background"
                data-testid="admin-users-search"
              />
            </div>
          </div>

          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            data-testid="admin-users-tier-filter"
          >
            <option value="">Toate tier-urile</option>
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="premium">Premium</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            data-testid="admin-users-role-filter"
          >
            <option value="">Toate rolurile</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="admin-users-table">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Utilizator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data înregistrării</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted-foreground">
                    Se încarcă...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Niciun utilizator găsit</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-accent/50 transition-colors" data-testid="admin-user-row">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
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
                        <span className="flex items-center space-x-1 text-xs">
                          <Shield className="w-3 h-3 text-red-600" />
                          <span className="font-medium text-red-600">Admin</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('ro-RO')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setEditMode(true);
                          }}
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                          title="Editează"
                          data-testid="admin-user-edit-button"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.active !== false && (
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="p-2 hover:bg-red-500/10 text-red-600 rounded-lg transition-colors"
                            title="Șterge"
                            data-testid="admin-user-delete-button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
              Afișare {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} din {total} utilizatori
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                data-testid="admin-users-prev-page"
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
                data-testid="admin-users-next-page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editMode && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Editare Utilizator</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nume</label>
                <input
                  type="text"
                  value={selectedUser.name}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tier</label>
                <select
                  value={selectedUser.tier}
                  onChange={(e) => setSelectedUser({...selectedUser, tier: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  data-testid="admin-user-edit-tier"
                >
                  <option value="free">Free</option>
                  <option value="plus">Plus</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rol</label>
                <select
                  value={selectedUser.role || 'user'}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  data-testid="admin-user-edit-role"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={() => handleUpdateUser(selectedUser._id, {
                  tier: selectedUser.tier,
                  role: selectedUser.role
                })}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="admin-user-save-changes"
              >
                Salvează
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsersPage;
