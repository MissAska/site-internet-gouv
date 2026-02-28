import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

const AccountingPage = () => {
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.business_id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [businessRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/businesses/${user.business_id}`),
        axios.get(`${API}/transactions?limit=100`)
      ]);
      setBusiness(businessRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const profit = (business?.total_income || 0) - (business?.total_expenses || 0) - (business?.total_salaries || 0);
  const profitMargin = business?.total_income > 0 ? (profit / business.total_income * 100).toFixed(1) : 0;

  const pieData = [
    { name: 'Revenus', value: business?.total_income || 0 },
    { name: 'Dépenses', value: business?.total_expenses || 0 },
    { name: 'Salaires', value: business?.total_salaries || 0 },
  ].filter(d => d.value > 0);

  // Group transactions by day for chart
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTransactions = transactions.filter(t => t.created_at.split('T')[0] === dateStr);
    
    const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const salaries = dayTransactions.filter(t => t.type === 'salary').reduce((sum, t) => sum + t.amount, 0);
    
    last7Days.push({
      date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      revenus: income,
      depenses: expenses + salaries
    });
  }

  return (
    <Layout>
      <div className="space-y-8" data-testid="accounting-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            Comptabilité
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble financière de votre entreprise
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Chiffre d'affaires</p>
                  <p className="text-2xl font-bold font-mono text-green-400 mt-1">
                    {formatCurrency(business?.total_income || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Dépenses</p>
                  <p className="text-2xl font-bold font-mono text-red-400 mt-1">
                    {formatCurrency(business?.total_expenses || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Salaires versés</p>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {formatCurrency(business?.total_salaries || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Marge bénéficiaire</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {profitMargin}%
                  </p>
                </div>
                <div className={`w-12 h-12 flex items-center justify-center ${
                  profit >= 0 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  <Percent className={`w-6 h-6 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart - 7 days */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Activité des 7 derniers jours
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7Days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '0',
                        fontFamily: 'JetBrains Mono'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="revenus" fill="#22c55e" name="Revenus" />
                    <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Répartition
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '0',
                          fontFamily: 'JetBrains Mono'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Aucune donnée
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500" />
                  <span className="text-xs text-muted-foreground">Revenus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500" />
                  <span className="text-xs text-muted-foreground">Dépenses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500" />
                  <span className="text-xs text-muted-foreground">Salaires</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit Summary */}
        <Card className={`border-2 ${profit >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 flex items-center justify-center ${
                  profit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <Calculator className={`w-8 h-8 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="text-lg uppercase tracking-wider text-muted-foreground">Bénéfice net total</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    CA - Dépenses - Salaires = Bénéfice
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold font-mono ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(profit)}
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-mono">
                  {formatCurrency(business?.total_income || 0)} - {formatCurrency(business?.total_expenses || 0)} - {formatCurrency(business?.total_salaries || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AccountingPage;
