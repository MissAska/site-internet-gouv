import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Calculator, 
  Building2, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileDown,
  Activity,
  Landmark
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const COLORS = ['#0ea5e9', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

const GlobalAccountingPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/accounting/global`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/accounting/global/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `comptabilite_globale_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF exporté avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
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

  const { businesses, totals } = data || { businesses: [], totals: {} };

  // Chart data
  const barChartData = businesses.map(b => ({
    name: b.name.length > 15 ? b.name.substring(0, 15) + '...' : b.name,
    CA: b.total_income,
    Dépenses: b.total_expenses,
    Salaires: b.total_salaries,
    Bénéfice: b.gross_profit
  }));

  const pieChartData = [
    { name: 'Chiffre d\'affaires', value: totals.total_income || 0 },
    { name: 'Dépenses', value: totals.total_expenses || 0 },
    { name: 'Salaires', value: totals.total_salaries || 0 },
    { name: 'Impôts', value: totals.total_taxes_paid || 0 },
  ].filter(d => d.value > 0);

  return (
    <Layout>
      <div className="space-y-8" data-testid="global-accounting-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Comptabilité globale
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble financière de toutes les entreprises
            </p>
          </div>

          <Button
            onClick={handleExportPDF}
            disabled={exporting}
            className="uppercase tracking-wider btn-glow"
            data-testid="export-global-pdf-btn"
          >
            <FileDown className={`w-4 h-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Export...' : 'Exporter PDF'}
          </Button>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">CA Total</p>
                  <p className="text-2xl font-bold font-mono text-green-400 mt-1">
                    {formatCurrency(totals.total_income || 0)}
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
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Dépenses totales</p>
                  <p className="text-2xl font-bold font-mono text-red-400 mt-1">
                    {formatCurrency(totals.total_expenses || 0)}
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
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Bénéfice brut</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${(totals.total_gross_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(totals.total_gross_profit || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Impôts collectés</p>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {formatCurrency(totals.total_taxes_paid || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Comparatif par entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-80">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '0',
                          fontFamily: 'JetBrains Mono'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="CA" fill="#22c55e" name="CA" />
                      <Bar dataKey="Dépenses" fill="#ef4444" />
                      <Bar dataKey="Salaires" fill="#f59e0b" />
                      <Bar dataKey="Bénéfice" fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Aucune donnée
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Répartition globale
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '12px'
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
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {pieChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              <Building2 className="w-5 h-5 text-primary" />
              Détail par entreprise ({businesses.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {businesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune entreprise enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entreprise</th>
                      <th>Patron</th>
                      <th className="text-center">Employés</th>
                      <th className="text-center">Transactions</th>
                      <th className="text-right">CA</th>
                      <th className="text-right">Dépenses</th>
                      <th className="text-right">Salaires</th>
                      <th className="text-right">Bénéfice brut</th>
                      <th className="text-right">Impôts payés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((business) => (
                      <tr key={business.id}>
                        <td className="font-medium text-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                          {business.name}
                        </td>
                        <td className="text-muted-foreground">{business.owner_name}</td>
                        <td className="text-center">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {business.employees_count}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="inline-flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {business.transactions_count}
                          </span>
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
                        <td className={`text-right font-semibold ${business.gross_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(business.gross_profit)}
                        </td>
                        <td className="text-right text-amber-400 font-semibold">
                          {formatCurrency(business.total_taxes_paid)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-primary/10 font-bold">
                      <td colSpan="2" className="text-primary uppercase">Total</td>
                      <td className="text-center">{totals.total_employees}</td>
                      <td className="text-center">{totals.total_transactions}</td>
                      <td className="text-right text-green-400">{formatCurrency(totals.total_income)}</td>
                      <td className="text-right text-red-400">{formatCurrency(totals.total_expenses)}</td>
                      <td className="text-right text-amber-400">{formatCurrency(totals.total_salaries)}</td>
                      <td className={`text-right ${totals.total_gross_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(totals.total_gross_profit)}
                      </td>
                      <td className="text-right text-amber-400">{formatCurrency(totals.total_taxes_paid)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default GlobalAccountingPage;
