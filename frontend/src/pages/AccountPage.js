import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Heart, Search, CreditCard } from 'lucide-react';

const AccountPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!user) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">Se încarcă...</div>;
  }

  const tierBadge = {
    free: { label: 'Free', color: 'bg-gray-500/10 text-gray-700' },
    plus: { label: 'Plus', color: 'bg-blue-500/10 text-blue-700' },
    premium: { label: 'Premium', color: 'bg-amber-500/10 text-amber-700' }
  };

  const currentTier = tierBadge[user.tier] || tierBadge.free;

  return (
    <>
      <Helmet>
        <title>Contul meu | mFirme</title>
        <meta name="description" content="Dashboard-ul contului mFirme" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Contul meu</h1>
          <p className="text-sm text-muted-foreground">Gestionează-ți contul și abonamentul</p>
        </div>

        {/* User Info Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-1">{user.name}</h2>
              <p className="text-sm text-muted-foreground mb-3">{user.email}</p>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-lg ${currentTier.color}`}>
                  Plan {currentTier.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  Membru din {new Date(user.created_at).toLocaleDateString('ro-RO')}
                </span>
              </div>
            </div>
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/account/favorites')}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all text-left group"
          >
            <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Favorite</h3>
            <p className="text-xs text-muted-foreground">Firmele tale preferate</p>
          </button>

          <button
            onClick={() => navigate('/search')}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all text-left group"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Căutare</h3>
            <p className="text-xs text-muted-foreground">Căutare avansată firme</p>
          </button>

          <button
            onClick={() => navigate('/account/subscription')}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all text-left group"
          >
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
              <CreditCard className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Abonament</h3>
            <p className="text-xs text-muted-foreground">Gestionează planul tău</p>
          </button>
        </div>

        {/* Upgrade CTA for Free users */}
        {user.tier === 'free' && (
          <div className="mt-6 bg-gradient-to-r from-primary/10 to-accent border border-primary/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Upgrade la Premium</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Deblochează acces complet la toate datele firmelor, export și API
            </p>
            <button
              onClick={() => navigate('/account/subscription')}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Vezi planuri Premium
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AccountPage;