import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  DollarSign,
  Key,
  FileText,
  BarChart3,
  ScrollText,
  LogOut,
  Menu,
  X,
  Home
} from 'lucide-react';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigationItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Firme', path: '/admin/companies', icon: Building2 },
    { name: 'Utilizatori', path: '/admin/users', icon: Users },
    { name: 'Abonamente', path: '/admin/subscriptions', icon: CreditCard },
    { name: 'Plăți', path: '/admin/payments', icon: DollarSign },
    { name: 'API Keys', path: '/admin/api-keys', icon: Key },
    { name: 'SEO', path: '/admin/seo', icon: FileText },
    { name: 'Statistici', path: '/admin/stats', icon: BarChart3 },
    { name: 'Audit Log', path: '/admin/audit', icon: ScrollText },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
            data-testid="admin-sidebar-toggle"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <Link to="/" className="flex items-center space-x-2" data-testid="admin-home-link">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">m</span>
            </div>
            <span className="text-lg font-semibold hidden sm:inline">mFirme Admin</span>
          </Link>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="admin-view-site"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Vezi site</span>
          </Link>
          
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-secondary rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">{user?.name || user?.email}</span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-14 bottom-0 w-64 bg-card border-r border-border transition-transform duration-300 z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        data-testid="admin-sidebar"
      >
        <nav className="flex flex-col h-full p-4">
          <div className="flex-1 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                               (item.path !== '/admin' && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`admin-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mt-4"
            data-testid="admin-logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Deconectare</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-14 transition-all duration-300 ${
          sidebarOpen ? 'lg:pl-64' : 'pl-0'
        }`}
      >
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
