import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Building2, Users, Activity, DollarSign, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ title, value, icon: Icon, color = 'primary' }) => {
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

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, businessesRes] = await Promise.all([
        axios.get(`${API}/stats/admin`),
        axios.get(`${API}/businesses`)
      ]);
      setStats(statsRes.data);
      setBusinesses(businessesRes.data);
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

  return (
    <Layout>
      <div className="space-y-8" data-testid="admin-dashboard">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble du système fiscal
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Entreprises"
            value={stats?.total_businesses || 0}
            icon={Building2}
            color="primary"
          />
          <StatCard
            title="Employés"
            value={stats?.total_employees || 0}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="Transactions"
            value={stats?.total_transactions || 0}
            icon={Activity}
            color="amber"
          />
          <StatCard
            title="Impôts collectés"
            value={formatCurrency(stats?.total_taxes_collected || 0)}
            icon={TrendingUp}
            color="green"
          />
        </div>

        {/* Businesses Overview */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              Aperçu des entreprises
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Patron</th>
                    <th className="text-right">Chiffre d'affaires</th>
                    <th className="text-right">Dépenses</th>
                    <th className="text-right">Salaires</th>
                    <th className="text-right">Bénéfice brut</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted-foreground py-8">
                        Aucune entreprise enregistrée
                      </td>
                    </tr>
                  ) : (
                    businesses.map((business) => {
                      const profit = business.total_income - business.total_expenses - business.total_salaries;
                      return (
                        <tr key={business.id}>
                          <td className="font-medium text-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                            {business.name}
                          </td>
                          <td className="text-muted-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                            {business.owner_name}
                          </td>
                          <td className="text-right text-green-400">
                            {formatCurrency(business.total_income)}
                          </td>
                          <td className="text-right text-red-400">
                            {formatCurrency(business.total_expenses)}
                          </td>
                          <td className="text-right text-amber-400">
                            {formatCurrency(business.total_salaries)}
                          </td>
                          <td className={`text-right font-semibold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(profit)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
