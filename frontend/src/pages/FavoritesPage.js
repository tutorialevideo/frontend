import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Trash2 } from 'lucide-react';

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, token } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      loadFavorites();
    }
  }, [isAuthenticated, navigate]);

  const loadFavorites = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const res = await fetch(`${API_URL}/api/user/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (companyCui) => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const res = await fetch(`${API_URL}/api/user/favorites/${companyCui}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        setFavorites(favorites.filter(f => f.company_id !== companyCui));
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  return (
    <>
      <Helmet>
        <title>Favorite | mFirme</title>
        <meta name="description" content="Firmele tale favorite" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Favorite</h1>
          <p className="text-sm text-muted-foreground">Firmele tale preferate</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Se încarcă...</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Nicio firmă favorită</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adaugă firme la favorite pentru a le găsi mai ușor
            </p>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Căutare firme
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/50 transition-all"
              >
                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/firma/${favorite.company_name?.toLowerCase().replace(/\s+/g, '-')}-${favorite.company_cui}`)}>
                  <h3 className="text-base font-semibold mb-1">{favorite.company_name}</h3>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>CUI: {favorite.company_cui}</span>
                    {favorite.company_localitate && (
                      <span>{favorite.company_localitate}, {favorite.company_judet}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFavorite(favorite.company_id)}
                  className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Șterge din favorite"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default FavoritesPage;