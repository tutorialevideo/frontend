import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Key, Copy, Eye, EyeOff, RefreshCw, Trash2, Plus, 
  Check, AlertCircle, Activity, Clock, Shield, Zap,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const ApiKeysPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  
  const [keys, setKeys] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  
  // Form state
  const [keyName, setKeyName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('basic');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchKeys();
    fetchPlans();
  }, [isAuthenticated, navigate]);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys/my-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const createKey = async () => {
    if (!keyName.trim()) return;
    
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/api-keys/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: keyName, plan_id: selectedPlan })
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewKeyData(data);
        setShowCreateModal(false);
        setKeyName('');
        fetchKeys();
      } else {
        const error = await res.json();
        alert(error.detail || 'Failed to create key');
      }
    } catch (error) {
      console.error('Failed to create key:', error);
      alert('Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const toggleKeyActive = async (keyId, currentActive) => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !currentActive })
      });
      
      if (res.ok) {
        fetchKeys();
      }
    } catch (error) {
      console.error('Failed to toggle key:', error);
    }
  };

  const deleteKey = async (keyId) => {
    if (!window.confirm('Sigur vrei să revoci această cheie? Această acțiune este ireversibilă.')) {
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchKeys();
      }
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };

  const regenerateKey = async (keyId) => {
    if (!window.confirm('Regenerarea va invalida cheia curentă. Continuă?')) {
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/api-keys/${keyId}/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewKeyData(data);
        fetchKeys();
      }
    } catch (error) {
      console.error('Failed to regenerate key:', error);
    }
  };

  const copyToClipboard = (text, keyId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getPlanColor = (planId) => {
    switch (planId) {
      case 'basic': return 'bg-gray-500/10 text-gray-700 border-gray-200';
      case 'pro': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'enterprise': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Chei API | mFirme</title>
        <meta name="description" content="Gestionează cheile tale API pentru acces programatic la datele mFirme" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Chei API</h1>
            <p className="text-sm text-muted-foreground">
              Gestionează cheile API pentru acces programatic la datele firmelor
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            data-testid="create-api-key-btn"
          >
            <Plus className="w-4 h-4" />
            Creează cheie nouă
          </button>
        </div>

        {/* New Key Alert */}
        {newKeyData && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-6" data-testid="new-key-alert">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Key className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800 mb-1">Cheie API creată cu succes!</h3>
                <p className="text-sm text-green-700 mb-3">
                  Copiază cheia acum - nu o vei mai putea vedea din nou!
                </p>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg p-3">
                  <code className="flex-1 text-sm font-mono text-green-800 break-all">
                    {newKeyData.api_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeyData.api_key, 'new')}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                    data-testid="copy-new-key-btn"
                  >
                    {copiedKey === 'new' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => setNewKeyData(null)}
                  className="mt-3 text-sm text-green-700 hover:text-green-800 underline"
                >
                  Am salvat cheia, închide
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Plans Info */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-card border rounded-xl p-5 ${
                plan.id === 'pro' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.id === 'pro' && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">Popular</span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground"> {plan.currency}/lună</span>
              </div>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {plan.requests_per_day.toLocaleString()} req/zi
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-blue-500" />
                  {plan.requests_per_month.toLocaleString()} req/lună
                </li>
              </ul>
              <ul className="space-y-1.5">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Keys List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Cheile tale API</h2>
          </div>
          
          {keys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">Nicio cheie API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Creează prima ta cheie API pentru a accesa datele programatic
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Creează cheie
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {keys.map((key) => (
                <div key={key.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        key.active ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Key className={`w-5 h-5 ${key.active ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{key.name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-lg border ${getPlanColor(key.plan_id)}`}>
                            {key.plan_name}
                          </span>
                          {!key.active && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-red-100 text-red-700">
                              Dezactivată
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <code className="text-xs text-muted-foreground font-mono">{key.key_preview}</code>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            Creat {new Date(key.created_at).toLocaleDateString('ro-RO')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Usage indicator */}
                      <div className="hidden sm:flex items-center gap-4 mr-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Azi</div>
                          <div className="text-sm font-medium">
                            {key.requests_today} / {key.requests_per_day}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Luna</div>
                          <div className="text-sm font-medium">
                            {key.requests_this_month} / {key.requests_per_month}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <button
                        onClick={() => setExpandedKey(expandedKey === key.id ? null : key.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Detalii"
                      >
                        {expandedKey === key.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleKeyActive(key.id, key.active)}
                        className={`p-2 rounded-lg transition-colors ${
                          key.active ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-green-100 text-green-600'
                        }`}
                        title={key.active ? 'Dezactivează' : 'Activează'}
                      >
                        {key.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => regenerateKey(key.id)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        title="Regenerează"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteKey(key.id)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        title="Șterge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {expandedKey === key.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">Requests azi</div>
                          <div className="flex items-end gap-2">
                            <span className="text-xl font-semibold">{key.requests_today}</span>
                            <span className="text-sm text-muted-foreground">/ {key.requests_per_day}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min((key.requests_today / key.requests_per_day) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">Requests luna aceasta</div>
                          <div className="flex items-end gap-2">
                            <span className="text-xl font-semibold">{key.requests_this_month}</span>
                            <span className="text-sm text-muted-foreground">/ {key.requests_per_month}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${Math.min((key.requests_this_month / key.requests_per_month) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-1">Ultima utilizare</div>
                          <div className="text-sm">
                            {key.last_used_at 
                              ? new Date(key.last_used_at).toLocaleString('ro-RO')
                              : 'Niciodată'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Documentation Link */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Documentație API</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Află cum să folosești API-ul mFirme în aplicația ta. Exemple de cod, endpoint-uri disponibile și ghiduri de integrare.
              </p>
              <div className="flex flex-wrap gap-3">
                <code className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono">
                  GET /api/v1/company/{'{cui}'}
                </code>
                <code className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono">
                  GET /api/v1/search?q=...
                </code>
                <code className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono">
                  POST /api/v1/companies/bulk
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6" data-testid="create-key-modal">
            <h2 className="text-xl font-semibold mb-4">Creează cheie API nouă</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Nume cheie</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="ex: Aplicația mea, Server producție"
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  data-testid="key-name-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">Plan API</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  data-testid="plan-select"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {plan.price} {plan.currency}/lună ({plan.requests_per_day} req/zi)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    Cheia API va fi afișată o singură dată după creare. Asigură-te că o salvezi într-un loc sigur.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors font-medium text-sm"
              >
                Anulează
              </button>
              <button
                onClick={createKey}
                disabled={!keyName.trim() || creating}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50"
                data-testid="confirm-create-key-btn"
              >
                {creating ? 'Se creează...' : 'Creează cheie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApiKeysPage;
