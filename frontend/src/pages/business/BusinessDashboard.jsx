import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, Activity, DollarSign, TrendingUp, TrendingDown, Building2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ title, value, icon: Icon, color = 'primary', subtitle }) => {
  const colorClasses = {
    primary: 'text-primary bg-primary/10 border-primary/30',
    green: 'text-green-500 bg-green-500/10 border-green-500/30',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    red: 'text-red-500 bg-red-500/10 border-red-500/30',
  };

  return (
    <Card className="border-border bg-card card-hover">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-3xl font-bold font-mono" style={{ fontFamily: 'JetBrains Mono' }}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 flex items-center justify-center border ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const BusinessDashboard = () => {
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.business_id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [businessRes, statsRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/businesses/${user.business_id}`),
        axios.get(`${API}/stats/business/${user.business_id}`),
        axios.get(`${API}/transactions?limit=10`)
      ]);
      setBusiness(businessRes.data);
      setStats(statsRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <Layout>
      <div className="space-y-8" data-testid="business-dashboard">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/20 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              {business?.name}
            </h1>
            <p className="text-muted-foreground">
              Tableau de bord de votre entreprise
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Employés"
            value={stats?.employees_count || 0}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="CA du mois"
            value={formatCurrency(stats?.monthly_income || 0)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Dépenses du mois"
            value={formatCurrency(stats?.monthly_expenses || 0)}
            icon={TrendingDown}
            color="red"
          />
          <StatCard
            title="Bénéfice brut du mois"
            value={formatCurrency(stats?.monthly_profit || 0)}
            icon={DollarSign}
            color={stats?.monthly_profit >= 0 ? 'green' : 'red'}
          />
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Stats */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Bilan global
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-500/10 border border-green-500/30">
                <span className="text-green-400">Chiffre d'affaires total</span>
                <span className="font-mono font-bold text-green-400">
                  {formatCurrency(business?.total_income || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-500/10 border border-red-500/30">
                <span className="text-red-400">Dépenses totales</span>
                <span className="font-mono font-bold text-red-400">
                  {formatCurrency(business?.total_expenses || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-amber-500/10 border border-amber-500/30">
                <span className="text-amber-400">Salaires versés</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(business?.total_salaries || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-primary/10 border border-primary/30">
                <span className="text-primary font-semibold">Bénéfice brut</span>
                <span className="font-mono font-bold text-primary text-xl">
                  {formatCurrency(
                    (business?.total_income || 0) - 
                    (business?.total_expenses || 0) - 
                    (business?.total_salaries || 0)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                <Activity className="w-5 h-5 text-primary" />
                Dernières transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune transaction</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <div className={`font-mono font-bold ${
                        transaction.type === 'income' 
                          ? 'text-green-400' 
                          : transaction.type === 'expense' 
                          ? 'text-red-400' 
                          : 'text-amber-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default BusinessDashboard;
