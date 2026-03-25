import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Check, Crown, Zap } from 'lucide-react';

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    loadPlans();
    
    // Check for payment success
    const sessionId = searchParams.get('session_id');
    if (sessionId && token) {
      checkPaymentStatus(sessionId);
    }
  }, [searchParams, token]);

  const loadPlans = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const res = await fetch(`${API_URL}/api/subscriptions/plans`);
      
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (sessionId) => {
    setCheckingPayment(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const res = await fetch(`${API_URL}/api/subscriptions/status/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.payment_status === 'paid') {
          // Reload page to update user tier
          window.location.href = '/account/subscription';
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleUpgrade = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (planId === 'free') return;

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const origin = window.location.origin;
      
      const res = await fetch(`${API_URL}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_id: planId,
          origin_url: origin
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        const error = await res.json();
        alert(error.detail || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Failed to upgrade:', error);
      alert('Failed to initiate checkout');
    }
  };

  const getPlanIcon = (planId) => {
    switch(planId) {
      case 'free': return <Zap className="w-6 h-6" />;
      case 'plus': return <Check className="w-6 h-6" />;
      case 'premium': return <Crown className="w-6 h-6" />;
      default: return <Check className="w-6 h-6" />;
    }
  };

  const getPlanColor = (planId) => {
    switch(planId) {
      case 'free': return 'border-gray-200';
      case 'plus': return 'border-blue-500/50 shadow-lg';
      case 'premium': return 'border-amber-500/50 shadow-xl';
      default: return 'border-border';
    }
  };

  if (checkingPayment) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Verificăm plata...</h2>
          <p className="text-sm text-muted-foreground">Te rugăm să aștepți</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Abonamente | mFirme</title>
        <meta name="description" content="Alege planul potrivit pentru nevoile tale" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Alege planul potrivit
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Deblocă acces complet la date despre firmele din România
          </p>
        </div>

        {user && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">Plan curent:</span>
              <span className="text-sm font-semibold text-primary capitalize">{user.tier}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Se încarcă...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-card border-2 rounded-xl p-6 ${getPlanColor(plan.id)} transition-all hover:shadow-lg`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  plan.id === 'free' ? 'bg-gray-500/10 text-gray-700' :
                  plan.id === 'plus' ? 'bg-blue-500/10 text-blue-700' :
                  'bg-amber-500/10 text-amber-700'
                }`}>
                  {getPlanIcon(plan.id)}
                </div>

                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">RON/lună</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={user?.tier === plan.id || plan.id === 'free'}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                    user?.tier === plan.id
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                      : plan.id === 'premium'
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {user?.tier === plan.id
                    ? 'Plan curent'
                    : plan.id === 'free'
                    ? 'Plan gratuit'
                    : `Upgrade la ${plan.name}`
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Toate planurile includ date actualizate zilnic din surse oficiale ANAF și Ministerul Finanțelor</p>
        </div>
      </div>
    </>
  );
};

export default SubscriptionPage;
