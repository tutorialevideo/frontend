import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Heart, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">m</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">Firme</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-search">
              Căutare
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-about">
              Despre
            </Link>
            <Link to="/account/subscription" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-pricing">
              Prețuri
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/search')}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:border-primary/50 transition-colors"
              data-testid="header-search-button"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Caută firmă...</span>
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  data-testid="user-menu-button"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.name || user?.email}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                    {user?.role === 'admin' && (
                      <>
                        <Link
                          to="/admin"
                          className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-accent transition-colors bg-red-500/5"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <span className="text-red-600 font-medium">⚡ Admin Panel</span>
                        </Link>
                        <div className="border-t border-border my-1"></div>
                      </>
                    )}
                    <Link
                      to="/account"
                      className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-4 h-4" />
                      <span>Contul meu</span>
                    </Link>
                    <Link
                      to="/account/favorites"
                      className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Heart className="w-4 h-4" />
                      <span>Favorite</span>
                    </Link>
                    <Link
                      to="/account/subscription"
                      className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Abonament</span>
                    </Link>
                    <div className="border-t border-border my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm hover:bg-accent transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Deconectare</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="login-link"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  data-testid="register-link"
                >
                  Înregistrare
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;