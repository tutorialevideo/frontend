import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

const Header = () => {
  const navigate = useNavigate();

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
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-pricing">
              Prețuri
            </Link>
          </nav>

          <button
            onClick={() => navigate('/search')}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:border-primary/50 transition-colors"
            data-testid="header-search-button"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Caută firmă...</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;