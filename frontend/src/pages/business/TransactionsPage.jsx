import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Activity, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

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

const TransactionsPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    try {
      let url = `${API}/transactions?limit=100`;
      if (filter !== 'all') {
        url += `&type=${filter}`;
      }
      const response = await axios.get(url);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'income':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'expense':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'salary':
        return <DollarSign className="w-4 h-4 text-amber-400" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'income':
        return 'Revenu';
      case 'expense':
        return 'Dépense';
      case 'salary':
        return 'Salaire';
      default:
        return type;
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'income':
        return 'badge-income';
      case 'expense':
        return 'badge-expense';
      case 'salary':
        return 'badge-salary';
      default:
        return 'bg-secondary text-foreground';
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="transactions-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Transactions
            </h1>
            <p className="text-muted-foreground mt-1">
              Historique des transactions de votre entreprise
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'income', 'expense', 'salary'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 text-sm uppercase tracking-wider transition-all ${
                  filter === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`filter-${type}`}
              >
                {type === 'all' ? 'Toutes' : getTypeLabel(type) + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              <Activity className="w-5 h-5 text-primary" />
              Historique ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune transaction</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Employé</th>
                      <th className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="text-muted-foreground">
                          {formatDate(transaction.created_at)}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-wider ${getTypeBadgeClass(transaction.type)}`}>
                            {getTypeIcon(transaction.type)}
                            {getTypeLabel(transaction.type)}
                          </span>
                        </td>
                        <td className="font-medium text-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                          {transaction.description}
                        </td>
                        <td className="text-muted-foreground">
                          {transaction.employee_name || '-'}
                        </td>
                        <td className={`text-right font-bold ${
                          transaction.type === 'income' 
                            ? 'text-green-400' 
                            : transaction.type === 'expense' 
                            ? 'text-red-400' 
                            : 'text-amber-400'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </td>
                      </tr>
                    ))}
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

export default TransactionsPage;
