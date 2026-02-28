import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { TrendingDown, Building2, FileText, Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EXPENSE_CATEGORIES = {
  'fournitures': 'Fournitures et matériel',
  'vehicules': 'Véhicules et transport',
  'loyer': 'Loyer et charges',
  'maintenance': 'Maintenance et réparations',
  'marketing': 'Marketing et publicité',
  'services': 'Services externes',
  'equipement': 'Équipement professionnel',
  'autre': 'Autre',
};

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

const ExpensesReviewPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBusiness, setFilterBusiness] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${API}/admin/expenses`);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Erreur lors du chargement des dépenses');
    } finally {
      setLoading(false);
    }
  };

  // Get unique business names
  const businessNames = useMemo(() => {
    const names = [...new Set(expenses.map(e => e.business_name))];
    return names.sort();
  }, [expenses]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    
    if (filterBusiness !== 'all') {
      result = result.filter(e => e.business_name === filterBusiness);
    }
    
    if (filterCategory !== 'all') {
      result = result.filter(e => e.expense_category === filterCategory);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(term) ||
        e.expense_details?.toLowerCase().includes(term) ||
        e.business_name.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [expenses, filterBusiness, filterCategory, searchTerm]);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <Layout>
      <div className="space-y-8" data-testid="expenses-review-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            Contrôle des dépenses
          </h1>
          <p className="text-muted-foreground mt-1">
            Revue détaillée de toutes les dépenses des entreprises
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Total dépenses</p>
                  <p className="text-2xl font-bold font-mono text-red-400 mt-1">
                    {formatCurrency(totalAmount)}
                  </p>
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
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Nombre de dépenses</p>
                  <p className="text-2xl font-bold font-mono mt-1">
                    {filteredExpenses.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Entreprises</p>
                  <p className="text-2xl font-bold font-mono mt-1">
                    {businessNames.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-64 bg-input border-border"
              data-testid="search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={filterBusiness} onValueChange={setFilterBusiness}>
              <SelectTrigger className="w-48 bg-input border-border" data-testid="filter-business">
                <SelectValue placeholder="Entreprise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les entreprises</SelectItem>
                {businessNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48 bg-input border-border" data-testid="filter-category">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingDown className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune dépense trouvée</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredExpenses.map((expense) => (
              <Card key={expense.id} className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Main Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-500/20 flex items-center justify-center">
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{expense.description}</h3>
                          <p className="text-sm text-muted-foreground">
                            {expense.business_name} • {formatDate(expense.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Category Badge */}
                      {expense.expense_category && (
                        <span className="inline-block px-3 py-1 text-xs uppercase tracking-wider bg-secondary text-muted-foreground border border-border mb-3">
                          {EXPENSE_CATEGORIES[expense.expense_category] || expense.expense_category}
                        </span>
                      )}

                      {/* Details */}
                      {expense.expense_details && (
                        <div className="mt-3 p-4 bg-secondary/30 border border-border">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                            Justification fournie
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{expense.expense_details}</p>
                        </div>
                      )}

                      {!expense.expense_details && (
                        <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/30">
                          <p className="text-sm text-amber-400">
                            ⚠️ Aucune justification fournie (ancienne transaction)
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="lg:text-right">
                      <p className="text-3xl font-bold font-mono text-red-400">
                        -{formatCurrency(expense.amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ExpensesReviewPage;
