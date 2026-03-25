import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/account');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/account');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login | mFirme</title>
        <meta name="description" content="Autentificare în contul mFirme" />
      </Helmet>

      <div className="min-h-[80vh] flex items-center justify-center bg-secondary/30 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Autentificare</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Conectează-te la contul tău mFirme
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary transition-colors bg-background"
                  placeholder="email@example.com"
                  data-testid="login-email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Parolă</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary transition-colors bg-background"
                  placeholder="••••••••"
                  data-testid="login-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
                data-testid="login-submit"
              >
                {loading ? 'Se conectează...' : 'Autentificare'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Nu ai cont? </span>
              <Link to="/register" className="text-primary hover:underline">
                Înregistrează-te
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;