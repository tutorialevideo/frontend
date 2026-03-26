import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, BarChart3 } from 'lucide-react';

const FinancialChart = ({ cui }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState('approximated');

  useEffect(() => {
    loadFinancialData();
  }, [cui]);

  const loadFinancialData = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || '';
      const res = await fetch(`${API_URL}/api/company/${cui}/financials`);
      
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
        setDataSource(result.source || 'approximated');
      }
    } catch (error) {
      console.error('Failed to load financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mil`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)} k`;
    }
    return new Intl.NumberFormat('ro-RO').format(value);
  };

  const formatFullCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('ro-RO').format(value) + ' RON';
  };

  const formatTooltipValue = (value, name) => {
    if (value === null || value === undefined) return ['-', name];
    const label = name === 'cifra_afaceri' ? 'Cifra de afaceri' : 'Profit net';
    return [formatFullCurrency(value), label];
  };

  // Calculate KPIs from data
  const getKPIs = () => {
    if (!data || data.length === 0) return null;

    const lastYear = data[data.length - 1];
    const prevYear = data.length > 1 ? data[data.length - 2] : null;

    // Calculate growth percentages
    const cifraGrowth = prevYear && prevYear.cifra_afaceri 
      ? ((lastYear.cifra_afaceri - prevYear.cifra_afaceri) / prevYear.cifra_afaceri * 100)
      : null;

    const profitGrowth = prevYear && prevYear.profit_net !== null && prevYear.profit_net !== 0
      ? ((lastYear.profit_net - prevYear.profit_net) / Math.abs(prevYear.profit_net) * 100)
      : null;

    const angajatiGrowth = prevYear && prevYear.numar_angajati 
      ? ((lastYear.numar_angajati - prevYear.numar_angajati) / prevYear.numar_angajati * 100)
      : null;

    return {
      cifra_afaceri: lastYear.cifra_afaceri,
      cifra_growth: cifraGrowth,
      profit_net: lastYear.profit_net,
      profit_growth: profitGrowth,
      numar_angajati: lastYear.numar_angajati,
      angajati_growth: angajatiGrowth,
      year: lastYear.year
    };
  };

  const kpis = getKPIs();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-secondary rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="h-24 bg-secondary rounded"></div>
            <div className="h-24 bg-secondary rounded"></div>
            <div className="h-24 bg-secondary rounded"></div>
          </div>
          <div className="h-64 bg-secondary rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6" data-testid="financial-chart">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Date financiare
        </h3>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
          {data[0]?.year} - {data[data.length - 1]?.year}
        </span>
      </div>

      {/* KPI Cards - Similar to listafirme.ro */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Cifra de afaceri KPI */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4" data-testid="kpi-cifra-afaceri">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Cifra de afaceri</span>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatFullCurrency(kpis.cifra_afaceri)}
            </div>
            {kpis.cifra_growth !== null && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${kpis.cifra_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.cifra_growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{kpis.cifra_growth >= 0 ? '+' : ''}{kpis.cifra_growth.toFixed(1)}% vs anul anterior</span>
              </div>
            )}
          </div>

          {/* Profit net KPI */}
          <div className={`border rounded-lg p-4 ${
            kpis.profit_net >= 0 
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' 
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
          }`} data-testid="kpi-profit-net">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${kpis.profit_net >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {kpis.profit_net >= 0 ? 'Profit net' : 'Pierdere neta'}
              </span>
              <TrendingUp className={`w-4 h-4 ${kpis.profit_net >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className={`text-2xl font-bold ${kpis.profit_net >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
              {formatFullCurrency(Math.abs(kpis.profit_net))}
            </div>
            {kpis.profit_growth !== null && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${kpis.profit_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.profit_growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{kpis.profit_growth >= 0 ? '+' : ''}{kpis.profit_growth.toFixed(1)}% vs anul anterior</span>
              </div>
            )}
          </div>

          {/* Numar angajati KPI */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4" data-testid="kpi-angajati">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">Numar angajati</span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {kpis.numar_angajati || '-'}
            </div>
            {kpis.angajati_growth !== null && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${kpis.angajati_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.angajati_growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{kpis.angajati_growth >= 0 ? '+' : ''}{kpis.angajati_growth.toFixed(1)}% vs anul anterior</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Combined Line Chart - Cifra de afaceri + Profit net */}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-muted-foreground">Cifra de afaceri</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">Profit net</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="year" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip 
            formatter={formatTooltipValue}
            labelFormatter={(label) => `Anul ${label}`}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend 
            formatter={(value) => value === 'cifra_afaceri' ? 'Cifra de afaceri' : 'Profit net'}
          />
          <Line 
            type="monotone" 
            dataKey="cifra_afaceri" 
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="cifra_afaceri"
          />
          <Line 
            type="monotone" 
            dataKey="profit_net" 
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
            name="profit_net"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Year-by-Year Data Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">An</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cifra afaceri</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Profit net</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Angajati</th>
            </tr>
          </thead>
          <tbody>
            {data.slice().reverse().map((item, index) => (
              <tr key={item.year} className={`border-b border-border/50 ${index === 0 ? 'bg-primary/5' : ''}`}>
                <td className="py-2 px-3 font-medium">{item.year}</td>
                <td className="text-right py-2 px-3">{formatFullCurrency(item.cifra_afaceri)}</td>
                <td className={`text-right py-2 px-3 ${item.profit_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatFullCurrency(item.profit_net)}
                </td>
                <td className="text-right py-2 px-3">{item.numar_angajati || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Data Source Info */}
      {dataSource === 'real' ? (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
          <p className="text-xs text-green-800 dark:text-green-200">
            <strong>Date reale</strong> din bilanturile oficiale publicate la Ministerul Finantelor pentru toti anii afisati.
          </p>
        </div>
      ) : (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Nota:</strong> Datele pentru {data[data.length - 1]?.year} sunt reale (sursa: Ministerul Finantelor). 
            Valorile pentru anii anteriori sunt aproximate.
          </p>
        </div>
      )}
    </div>
  );
};

export default FinancialChart;
