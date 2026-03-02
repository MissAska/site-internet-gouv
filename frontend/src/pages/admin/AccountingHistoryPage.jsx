import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { History, Building2, Camera, TrendingUp, TrendingDown, DollarSign, Calculator } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatPeriod = (start, end) => {
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${s} - ${e}`;
};

const AccountingHistoryPage = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterBusiness, setFilterBusiness] = useState('all');

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const response = await axios.get(`${API}/admin/accounting-history`);
      setSnapshots(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      await axios.post(`${API}/admin/accounting-snapshot`);
      toast.success('Snapshot comptable enregistre');
      fetchSnapshots();
    } catch (error) {
      toast.error('Erreur lors de la creation');
    } finally {
      setCreating(false);
    }
  };

  const businessNames = useMemo(() => {
    const names = [...new Set(snapshots.map(s => s.business_name))];
    return names.sort();
  }, [snapshots]);

  const filteredSnapshots = useMemo(() => {
    if (filterBusiness === 'all') return snapshots;
    return snapshots.filter(s => s.business_name === filterBusiness);
  }, [snapshots, filterBusiness]);

  // Group by period
  const groupedByPeriod = useMemo(() => {
    const groups = {};
    for (const s of filteredSnapshots) {
      const key = s.created_at.split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSnapshots]);

  const totals = useMemo(() => {
    return filteredSnapshots.reduce((acc, s) => ({
      income: acc.income + s.total_income,
      expenses: acc.expenses + s.total_expenses,
      salaries: acc.salaries + s.total_salaries,
      profit: acc.profit + s.gross_profit,
    }), { income: 0, expenses: 0, salaries: 0, profit: 0 });
  }, [filteredSnapshots]);

  return (
    <Layout>
      <div className="space-y-8" data-testid="accounting-history-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Historique comptable
            </h1>
            <p className="text-muted-foreground mt-1">
              Archives hebdomadaires de la comptabilite de chaque entreprise
            </p>
          </div>
          <Button
            onClick={handleCreateSnapshot}
            disabled={creating}
            className="uppercase tracking-wider btn-glow"
            data-testid="create-snapshot-btn"
          >
            <Camera className={`w-4 h-4 mr-2 ${creating ? 'animate-pulse' : ''}`} />
            {creating ? 'Creation...' : 'Snapshot manuel'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">CA Total archive</p>
                  <p className="text-2xl font-bold font-mono text-green-400 mt-1">{formatCurrency(totals.income)}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Depenses archivees</p>
                  <p className="text-2xl font-bold font-mono text-red-400 mt-1">{formatCurrency(totals.expenses)}</p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Salaires archives</p>
                  <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{formatCurrency(totals.salaries)}</p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Benefice archive</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(totals.profit)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select value={filterBusiness} onValueChange={setFilterBusiness}>
            <SelectTrigger className="w-64 bg-input border-border" data-testid="filter-business-history">
              <SelectValue placeholder="Filtrer par entreprise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les entreprises</SelectItem>
              {businessNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredSnapshots.length} enregistrement{filteredSnapshots.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Snapshots */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groupedByPeriod.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <History className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun historique comptable</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les snapshots sont crees automatiquement chaque dimanche ou manuellement
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedByPeriod.map(([dateKey, items]) => (
              <div key={dateKey}>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-4 text-primary" style={{ fontFamily: 'Chakra Petch' }}>
                  Semaine du {new Date(dateKey).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </h2>
                <Card className="border-border bg-card">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Entreprise</th>
                            <th>Periode</th>
                            <th className="text-right">CA</th>
                            <th className="text-right">Depenses</th>
                            <th className="text-right">Salaires</th>
                            <th className="text-right">Benefice brut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((snapshot) => (
                            <tr key={snapshot.id}>
                              <td className="font-medium text-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                                {snapshot.business_name}
                              </td>
                              <td className="text-muted-foreground text-sm font-mono">
                                {formatPeriod(snapshot.period_start, snapshot.period_end)}
                              </td>
                              <td className="text-right text-green-400 font-mono">
                                {formatCurrency(snapshot.total_income)}
                              </td>
                              <td className="text-right text-red-400 font-mono">
                                {formatCurrency(snapshot.total_expenses)}
                              </td>
                              <td className="text-right text-amber-400 font-mono">
                                {formatCurrency(snapshot.total_salaries)}
                              </td>
                              <td className={`text-right font-bold font-mono ${snapshot.gross_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(snapshot.gross_profit)}
                              </td>
                            </tr>
                          ))}
                          {/* Period totals */}
                          <tr className="bg-primary/10 font-bold">
                            <td colSpan="2" className="text-primary uppercase">Total semaine</td>
                            <td className="text-right text-green-400">{formatCurrency(items.reduce((s, i) => s + i.total_income, 0))}</td>
                            <td className="text-right text-red-400">{formatCurrency(items.reduce((s, i) => s + i.total_expenses, 0))}</td>
                            <td className="text-right text-amber-400">{formatCurrency(items.reduce((s, i) => s + i.total_salaries, 0))}</td>
                            <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.gross_profit, 0))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountingHistoryPage;
