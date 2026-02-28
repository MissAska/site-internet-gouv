import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FileText, Building2, DollarSign, Calendar } from 'lucide-react';

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

const BusinessTaxNoticesPage = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.business_id) {
      fetchNotices();
    }
  }, [user]);

  const fetchNotices = async () => {
    try {
      const response = await axios.get(`${API}/tax-notices/business/${user.business_id}`);
      setNotices(response.data);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="business-tax-notices-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            Avis d'impôts
          </h1>
          <p className="text-muted-foreground mt-1">
            Historique de vos avis d'imposition
          </p>
        </div>

        {/* Info Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Périodicité</p>
              <p className="text-sm text-muted-foreground">
                Les avis d'impôts sont générés chaque dimanche à 23h59 par le gouvernement.
                <span className="text-amber-400 font-semibold"> Minimum: 5 000 $US même en cas de bénéfice négatif.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notices List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun avis d'impôt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vous n'avez pas encore reçu d'avis d'imposition
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {notices.map((notice) => (
              <Card key={notice.id} className="border-border bg-card overflow-hidden">
                {/* Tax Notice Header */}
                <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold uppercase tracking-wide text-amber-500" style={{ fontFamily: 'Chakra Petch' }}>
                          Avis d'imposition
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono mt-1">
                          Émis le {formatDate(notice.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-amber-500/20 text-amber-500 text-sm uppercase tracking-wider border border-amber-500/30 font-bold">
                      Taux: {(notice.tax_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Period */}
                  <div className="mb-6 pb-4 border-b border-border">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Période fiscale</p>
                    <p className="font-mono">
                      Du {formatDate(notice.period_start).split(' ')[0]} au {formatDate(notice.period_end).split(' ')[0]}
                    </p>
                  </div>

                  {/* Financial Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold uppercase tracking-wider text-sm">Détail des revenus</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between p-3 bg-green-500/10 border border-green-500/30">
                          <span>Chiffre d'affaires brut</span>
                          <span className="font-mono font-bold text-green-400">{formatCurrency(notice.gross_revenue)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-red-500/10 border border-red-500/30">
                          <span>Dépenses</span>
                          <span className="font-mono font-bold text-red-400">- {formatCurrency(notice.total_expenses)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-amber-500/10 border border-amber-500/30">
                          <span>Salaires versés</span>
                          <span className="font-mono font-bold text-amber-400">- {formatCurrency(notice.total_salaries)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-primary/10 border border-primary/30">
                          <span className="font-semibold">Bénéfice brut imposable</span>
                          <span className="font-mono font-bold text-primary">{formatCurrency(notice.taxable_income)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold uppercase tracking-wider text-sm">Calcul de l'impôt</h4>
                      <div className="p-6 bg-amber-500/10 border-2 border-amber-500/30 text-center">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Montant à payer</p>
                        <div className="flex items-center justify-center gap-3">
                          <DollarSign className="w-8 h-8 text-amber-500" />
                          <span className="text-4xl font-bold font-mono text-amber-500">
                            {formatCurrency(notice.tax_amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 font-mono">
                          {formatCurrency(notice.taxable_income)} × {(notice.tax_rate * 100).toFixed(0)}% = {formatCurrency(notice.tax_amount)}
                        </p>
                      </div>
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

export default BusinessTaxNoticesPage;
