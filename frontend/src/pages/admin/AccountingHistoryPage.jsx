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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  History, Building2, Camera, TrendingUp, TrendingDown,
  DollarSign, Calculator, X, FileText, Tag, MessageSquare,
  ArrowRight, Users, Receipt
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatPeriod = (start, end) => {
  const s = new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const e = new Date(end).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${s} - ${e}`;
};

const typeConfig = {
  income: { label: 'Revenu', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: TrendingUp },
  expense: { label: 'Dépense', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: TrendingDown },
  salary: { label: 'Salaire', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: Users },
};

const AccountingHistoryPage = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterBusiness, setFilterBusiness] = useState('all');
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchSnapshots(); }, []);

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
      toast.success('Snapshot comptable enregistré');
      fetchSnapshots();
    } catch (error) {
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = async (snapshot) => {
    setSelectedSnapshot(snapshot);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const response = await axios.get(`${API}/admin/accounting-history/${snapshot.id}/details`);
      setDetailData(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des détails');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSnapshot(null);
    setDetailData(null);
  };

  const businessNames = useMemo(() => {
    return [...new Set(snapshots.map(s => s.business_name))].sort();
  }, [snapshots]);

  const filteredSnapshots = useMemo(() => {
    if (filterBusiness === 'all') return snapshots;
    return snapshots.filter(s => s.business_name === filterBusiness);
  }, [snapshots, filterBusiness]);

  const groupedByPeriod = useMemo(() => {
    const groups = {};
    for (const s of filteredSnapshots) {
      const key = s.created_at.split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSnapshots]);

  const totals = useMemo(() =>
    filteredSnapshots.reduce((acc, s) => ({
      income: acc.income + s.total_income,
      expenses: acc.expenses + s.total_expenses,
      salaries: acc.salaries + s.total_salaries,
      profit: acc.profit + s.gross_profit,
    }), { income: 0, expenses: 0, salaries: 0, profit: 0 }),
  [filteredSnapshots]);

  // Detail modal transactions grouped
  const groupedTransactions = useMemo(() => {
    if (!detailData?.transactions) return { income: [], expense: [], salary: [] };
    const groups = { income: [], expense: [], salary: [] };
    for (const t of detailData.transactions) {
      if (groups[t.type]) groups[t.type].push(t);
    }
    return groups;
  }, [detailData]);

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
              Archives hebdomadaires — cliquez sur une ligne pour voir le détail complet
            </p>
          </div>
          <Button
            onClick={handleCreateSnapshot}
            disabled={creating}
            className="uppercase tracking-wider btn-glow"
            data-testid="create-snapshot-btn"
          >
            <Camera className={`w-4 h-4 mr-2 ${creating ? 'animate-pulse' : ''}`} />
            {creating ? 'Création...' : 'Snapshot manuel'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'CA Total archivé', value: totals.income, color: 'green', icon: TrendingUp },
            { label: 'Dépenses archivées', value: totals.expenses, color: 'red', icon: TrendingDown },
            { label: 'Salaires archivés', value: totals.salaries, color: 'amber', icon: DollarSign },
            { label: 'Bénéfice archivé', value: totals.profit, color: totals.profit >= 0 ? 'green' : 'red', icon: Calculator, dynamic: true },
          ].map((stat, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-2xl font-bold font-mono mt-1 text-${stat.color}-400`}>
                      {formatCurrency(stat.value)}
                    </p>
                  </div>
                  <div className={`w-12 h-12 bg-${stat.color}-500/10 border border-${stat.color}-500/30 flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-500`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

        {/* Snapshots Table */}
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
                Les snapshots sont créés automatiquement chaque dimanche ou manuellement
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
                            <th>Période</th>
                            <th className="text-right">CA</th>
                            <th className="text-right">Dépenses</th>
                            <th className="text-right">Salaires</th>
                            <th className="text-right">Bénéfice brut</th>
                            <th className="text-center">Détails</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((snapshot) => (
                            <tr
                              key={snapshot.id}
                              className="cursor-pointer hover:bg-primary/5 transition-colors"
                              onClick={() => handleOpenDetail(snapshot)}
                              data-testid={`snapshot-row-${snapshot.id}`}
                            >
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
                              <td className="text-center">
                                <ArrowRight className="w-4 h-4 text-primary mx-auto" />
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-primary/10 font-bold">
                            <td colSpan="2" className="text-primary uppercase">Total semaine</td>
                            <td className="text-right text-green-400">{formatCurrency(items.reduce((s, i) => s + i.total_income, 0))}</td>
                            <td className="text-right text-red-400">{formatCurrency(items.reduce((s, i) => s + i.total_expenses, 0))}</td>
                            <td className="text-right text-amber-400">{formatCurrency(items.reduce((s, i) => s + i.total_salaries, 0))}</td>
                            <td className="text-right">{formatCurrency(items.reduce((s, i) => s + i.gross_profit, 0))}</td>
                            <td></td>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedSnapshot} onOpenChange={(open) => { if (!open) handleCloseDetail(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
          {selectedSnapshot && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl uppercase tracking-tight flex items-center gap-3" style={{ fontFamily: 'Chakra Petch' }}>
                  <Building2 className="w-6 h-6 text-primary" />
                  {selectedSnapshot.business_name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground font-mono">
                  Période : {formatPeriod(selectedSnapshot.period_start, selectedSnapshot.period_end)}
                </p>
              </DialogHeader>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detailData ? (
                <div className="space-y-6 mt-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border border-green-500/30 bg-green-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">CA</p>
                      <p className="text-xl font-bold font-mono text-green-400">{formatCurrency(selectedSnapshot.total_income)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{detailData.summary.income_count} transaction{detailData.summary.income_count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-4 border border-red-500/30 bg-red-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Dépenses</p>
                      <p className="text-xl font-bold font-mono text-red-400">{formatCurrency(selectedSnapshot.total_expenses)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{detailData.summary.expense_count} transaction{detailData.summary.expense_count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-4 border border-amber-500/30 bg-amber-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Salaires</p>
                      <p className="text-xl font-bold font-mono text-amber-400">{formatCurrency(selectedSnapshot.total_salaries)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{detailData.summary.salary_count} versement{detailData.summary.salary_count > 1 ? 's' : ''}</p>
                    </div>
                    <div className={`p-4 border ${selectedSnapshot.gross_profit >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Bénéfice</p>
                      <p className={`text-xl font-bold font-mono ${selectedSnapshot.gross_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(selectedSnapshot.gross_profit)}
                      </p>
                    </div>
                  </div>

                  {/* Transactions by type */}
                  {['income', 'expense', 'salary'].map((type) => {
                    const config = typeConfig[type];
                    const txs = groupedTransactions[type];
                    if (txs.length === 0) return null;

                    return (
                      <div key={type}>
                        <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${config.color}`}>
                          <config.icon className="w-4 h-4" />
                          {config.label}s ({txs.length})
                        </h3>
                        <div className="space-y-2">
                          {txs.map((tx) => (
                            <div
                              key={tx.id}
                              className={`p-3 border ${config.bg} transition-all`}
                              data-testid={`detail-tx-${tx.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm text-foreground">
                                      {tx.description || 'Sans description'}
                                    </span>
                                    {tx.category && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-secondary border border-border text-muted-foreground">
                                        <Tag className="w-3 h-3" />
                                        {tx.category}
                                      </span>
                                    )}
                                  </div>

                                  {/* Expense justification */}
                                  {tx.type === 'expense' && tx.details && (
                                    <div className="mt-2 pl-3 border-l-2 border-red-500/30">
                                      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                                        <span className="italic">{tx.details}</span>
                                      </p>
                                    </div>
                                  )}

                                  {/* Salary employee name */}
                                  {tx.type === 'salary' && tx.employee_name && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      Versé à : <span className="text-foreground font-medium">{tx.employee_name}</span>
                                    </p>
                                  )}

                                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                                    {formatDate(tx.created_at)}
                                  </p>
                                </div>

                                <span className={`text-lg font-bold font-mono shrink-0 ml-4 ${config.color}`}>
                                  {type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {detailData.transactions.length === 0 && (
                    <div className="text-center py-8">
                      <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Aucune transaction pour cette période</p>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AccountingHistoryPage;
