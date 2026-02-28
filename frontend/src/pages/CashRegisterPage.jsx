import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Users, Plus, Activity, Check } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const EXPENSE_CATEGORIES = [
  { value: 'fournitures', label: 'Fournitures et matériel' },
  { value: 'vehicules', label: 'Véhicules et transport' },
  { value: 'loyer', label: 'Loyer et charges' },
  { value: 'maintenance', label: 'Maintenance et réparations' },
  { value: 'marketing', label: 'Marketing et publicité' },
  { value: 'services', label: 'Services externes' },
  { value: 'equipement', label: 'Équipement professionnel' },
  { value: 'autre', label: 'Autre' },
];

const CashRegisterPage = () => {
  const { user, isPatron, isEmployee } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'income',
    amount: '',
    description: '',
    employee_id: '',
    expense_category: '',
    expense_details: ''
  });

  // Check permissions for employees
  const permissions = user?.permissions || {};
  const canRecordIncome = isPatron() || permissions.cash_register !== false;
  const canRecordExpense = isPatron() || permissions.record_expenses === true;
  const canRecordSalary = isPatron() || permissions.record_salaries === true;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/employees`),
        axios.get(`${API}/transactions?limit=10`)
      ]);
      setEmployees(employeesRes.data);
      setRecentTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Veuillez entrer une description');
      return;
    }
    // Validate expense fields
    if (formData.type === 'expense') {
      if (!formData.expense_category) {
        toast.error('Veuillez sélectionner une catégorie de dépense');
        return;
      }
      if (!formData.expense_details.trim()) {
        toast.error('Veuillez détailler la dépense (justification obligatoire)');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        employee_id: formData.type === 'salary' ? formData.employee_id : null,
        expense_category: formData.type === 'expense' ? formData.expense_category : null,
        expense_details: formData.type === 'expense' ? formData.expense_details : null
      };
      await axios.post(`${API}/transactions`, payload);
      toast.success('Transaction enregistrée');
      setFormData({ type: 'income', amount: '', description: '', employee_id: '', expense_category: '', expense_details: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [100, 500, 1000, 5000, 10000, 50000];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="cash-register-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            Caisse enregistreuse
          </h1>
          <p className="text-muted-foreground mt-1">
            Enregistrer les transactions de l'entreprise
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transaction Form */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                <DollarSign className="w-5 h-5 text-primary" />
                Nouvelle transaction
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Transaction Type */}
                <div className="space-y-3">
                  <Label className="uppercase tracking-wider text-xs">Type de transaction</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {canRecordIncome && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'income', employee_id: '' })}
                        className={`p-4 flex flex-col items-center gap-2 border transition-all ${
                          formData.type === 'income'
                            ? 'bg-green-500/20 border-green-500/50 text-green-400'
                            : 'bg-secondary border-border text-muted-foreground hover:border-green-500/30'
                        }`}
                        data-testid="type-income-btn"
                      >
                        <TrendingUp className="w-6 h-6" />
                        <span className="text-sm font-semibold uppercase">Revenu</span>
                      </button>
                    )}
                    {canRecordExpense && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'expense', employee_id: '' })}
                        className={`p-4 flex flex-col items-center gap-2 border transition-all ${
                          formData.type === 'expense'
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-secondary border-border text-muted-foreground hover:border-red-500/30'
                        }`}
                        data-testid="type-expense-btn"
                      >
                        <TrendingDown className="w-6 h-6" />
                        <span className="text-sm font-semibold uppercase">Dépense</span>
                      </button>
                    )}
                    {canRecordSalary && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'salary' })}
                        className={`p-4 flex flex-col items-center gap-2 border transition-all ${
                          formData.type === 'salary'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-secondary border-border text-muted-foreground hover:border-amber-500/30'
                        }`}
                        data-testid="type-salary-btn"
                      >
                        <Users className="w-6 h-6" />
                        <span className="text-sm font-semibold uppercase">Salaire</span>
                      </button>
                    )}
                  </div>
                  {!canRecordIncome && !canRecordExpense && !canRecordSalary && (
                    <p className="text-sm text-destructive">Vous n'avez aucune permission pour enregistrer des transactions.</p>
                  )}
                </div>

                {/* Employee Select (for salary) */}
                {formData.type === 'salary' && (
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Employé</Label>
                    <Select
                      value={formData.employee_id}
                      onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                    >
                      <SelectTrigger className="bg-input border-border" data-testid="employee-select">
                        <SelectValue placeholder="Sélectionner un employé" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Montant ($)</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                    className="bg-input border-border text-2xl font-mono h-14"
                    min="0"
                    step="0.01"
                    data-testid="amount-input"
                  />
                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setFormData({ ...formData, amount: amount.toString() })}
                        className="px-3 py-1 text-sm bg-secondary border border-border hover:bg-primary/20 hover:border-primary/50 transition-all font-mono"
                        data-testid={`quick-amount-${amount}`}
                      >
                        ${amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Vente de véhicule, Achat de fournitures..."
                    className="bg-input border-border resize-none"
                    rows={3}
                    data-testid="description-input"
                  />
                </div>

                {/* Expense Details (only for expenses) */}
                {formData.type === 'expense' && (
                  <div className="space-y-4 p-4 bg-red-500/5 border border-red-500/20">
                    <p className="text-sm text-red-400 font-semibold uppercase tracking-wider">
                      Détails de la dépense (obligatoire)
                    </p>
                    
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Catégorie</Label>
                      <Select
                        value={formData.expense_category}
                        onValueChange={(value) => setFormData({ ...formData, expense_category: value })}
                      >
                        <SelectTrigger className="bg-input border-border" data-testid="expense-category-select">
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Justification détaillée</Label>
                      <Textarea
                        value={formData.expense_details}
                        onChange={(e) => setFormData({ ...formData, expense_details: e.target.value })}
                        placeholder="Décrivez en détail la nature de cette dépense, son utilité pour l'entreprise, et joignez toute information pertinente..."
                        className="bg-input border-border resize-none"
                        rows={4}
                        data-testid="expense-details-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ces informations seront visibles par le gouvernement lors du contrôle fiscal.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-14 text-lg uppercase tracking-wider font-bold ${
                    formData.type === 'income'
                      ? 'bg-green-600 hover:bg-green-700'
                      : formData.type === 'expense'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                  data-testid="submit-transaction-btn"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enregistrement...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5" />
                      Enregistrer la transaction
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-3 uppercase tracking-wide text-sm" style={{ fontFamily: 'Chakra Petch' }}>
                <Activity className="w-4 h-4 text-primary" />
                Récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  Aucune transaction
                </div>
              ) : (
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="p-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs uppercase tracking-wider px-2 py-0.5 ${
                          transaction.type === 'income'
                            ? 'bg-green-500/20 text-green-400'
                            : transaction.type === 'expense'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {transaction.type === 'income' ? 'Revenu' : transaction.type === 'expense' ? 'Dépense' : 'Salaire'}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDate(transaction.created_at)}
                        </span>
                      </div>
                      <p className="text-sm truncate">{transaction.description}</p>
                      <p className={`font-mono font-bold text-right ${
                        transaction.type === 'income' ? 'text-green-400' : transaction.type === 'expense' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
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

export default CashRegisterPage;
