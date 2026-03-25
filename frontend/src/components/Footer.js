import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-border bg-secondary/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-sm mb-4">mFirme</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Platforma premium de informații despre firmele din România.
              Date publice agregate și actualizate zilnic.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4">Platformă</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/search" className="hover:text-foreground transition-colors">Căutare</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Județe</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Topuri</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">API</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4">Companie</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Despre noi</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Prețuri</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Termeni și condiții</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Politică de confidențialitate</Link></li>
              <li><Link to="/" className="hover:text-foreground transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} mFirme. Toate drepturile rezervate.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;