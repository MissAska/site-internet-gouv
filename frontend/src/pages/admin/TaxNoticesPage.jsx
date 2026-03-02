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
import { FileText, RefreshCw, Building2, Calendar, DollarSign, Trash2, FileDown, ArrowUpDown, CheckCircle, XCircle } from 'lucide-react';
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

const TaxNoticesPage = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterBusiness, setFilterBusiness] = useState('all');

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const response = await axios.get(`${API}/tax-notices`);
      setNotices(response.data);
    } catch (error) {
      console.error('Error fetching notices:', error);
      toast.error('Erreur lors du chargement des avis');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNotices = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(`${API}/tax-notices/generate`);
      toast.success(`${response.data.length} avis d'impôts générés`);
      fetchNotices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  // Get unique business names for filter
  const businessNames = useMemo(() => {
    const names = [...new Set(notices.map(n => n.business_name))];
    return names.sort();
  }, [notices]);

  // Filter and sort notices
  const filteredAndSortedNotices = useMemo(() => {
    let result = [...notices];
    
    // Filter by business
    if (filterBusiness !== 'all') {
      result = result.filter(n => n.business_name === filterBusiness);
    }
    
    // Sort
    switch (sortBy) {
      case 'date_desc':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'date_asc':
        result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'amount_desc':
        result.sort((a, b) => b.tax_amount - a.tax_amount);
        break;
      case 'amount_asc':
        result.sort((a, b) => a.tax_amount - b.tax_amount);
        break;
      case 'business':
        result.sort((a, b) => a.business_name.localeCompare(b.business_name));
        break;
      default:
        break;
    }
    
    return result;
  }, [notices, sortBy, filterBusiness]);

  const handleExportPDF = async (noticeId) => {
    try {
      const response = await axios.get(`${API}/tax-notices/${noticeId}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `avis_impot_${noticeId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF exporté');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleDeleteNotice = async (noticeId, businessName) => {
    try {
      await axios.delete(`${API}/tax-notices/${noticeId}`);
      toast.success('Avis d\'impôt supprimé');
      fetchNotices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleToggleStatus = async (noticeId) => {
    try {
      const response = await axios.put(`${API}/tax-notices/${noticeId}/status`);
      const newStatus = response.data.status;
      toast.success(newStatus === 'paid' ? 'Marqué comme payé' : 'Marqué comme non payé');
      setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, status: newStatus } : n));
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="tax-notices-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Avis d'impôts
            </h1>
            <p className="text-muted-foreground mt-1">
              Génération et historique des avis fiscaux
            </p>
          </div>

          <Button
            onClick={handleGenerateNotices}
            disabled={generating}
            className="uppercase tracking-wider btn-glow"
            data-testid="generate-notices-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Génération...' : 'Générer les avis'}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Génération automatique</p>
              <p className="text-sm text-muted-foreground">
                Les avis d'impôts sont générés automatiquement chaque dimanche à 23h59. 
                <span className="text-amber-400 font-semibold"> Minimum: 5 000 $US même en cas de bénéfice négatif.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-input border-border" data-testid="sort-select">
                <SelectValue placeholder="Trier par..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (récent → ancien)</SelectItem>
                <SelectItem value="date_asc">Date (ancien → récent)</SelectItem>
                <SelectItem value="amount_desc">Montant (↓)</SelectItem>
                <SelectItem value="amount_asc">Montant (↑)</SelectItem>
                <SelectItem value="business">Entreprise (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={filterBusiness} onValueChange={setFilterBusiness}>
              <SelectTrigger className="w-56 bg-input border-border" data-testid="filter-business-select">
                <SelectValue placeholder="Filtrer par entreprise..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les entreprises</SelectItem>
                {businessNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {filteredAndSortedNotices.length} avis affichés
          </div>
        </div>

        {/* Notices List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAndSortedNotices.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun avis d'impôt</p>
              <p className="text-sm text-muted-foreground mt-1">
                {notices.length > 0 ? 'Modifiez les filtres pour voir plus de résultats' : 'Cliquez sur "Générer les avis" pour créer les premiers avis'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredAndSortedNotices.map((notice) => (
              <Card key={notice.id} className="border-border bg-card overflow-hidden">
                {/* Tax Notice Header - Paper style */}
                <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-wide text-amber-500" style={{ fontFamily: 'Chakra Petch' }}>
                          Avis d'imposition
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatDate(notice.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-xs uppercase tracking-wider border border-amber-500/30">
                      {(notice.tax_rate * 100).toFixed(0)}% Taux
                    </span>
                    <span
                      className={`px-3 py-1 text-xs uppercase tracking-wider border cursor-pointer transition-all ${
                        notice.status === 'paid'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                      }`}
                      onClick={() => handleToggleStatus(notice.id)}
                      data-testid={`toggle-status-${notice.id}`}
                    >
                      {notice.status === 'paid' ? (
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Payé</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Non payé</span>
                      )}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Business Info */}
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold">{notice.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Période: {formatDate(notice.period_start).split(' ')[0]} - {formatDate(notice.period_end).split(' ')[0]}
                      </p>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chiffre d'affaires brut</span>
                      <span className="font-mono text-green-400">{formatCurrency(notice.gross_revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dépenses</span>
                      <span className="font-mono text-red-400">- {formatCurrency(notice.total_expenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Salaires</span>
                      <span className="font-mono text-amber-400">- {formatCurrency(notice.total_salaries)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="font-semibold">Bénéfice brut imposable</span>
                      <span className="font-mono font-semibold">{formatCurrency(notice.taxable_income)}</span>
                    </div>
                  </div>

                  {/* Tax Amount - Highlighted */}
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold uppercase tracking-wider text-amber-500">
                          Impôt à payer
                        </span>
                      </div>
                      <span className="text-2xl font-bold font-mono text-amber-500">
                        {formatCurrency(notice.tax_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-border flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-primary hover:bg-primary/10"
                      onClick={() => handleExportPDF(notice.id)}
                      data-testid={`export-pdf-${notice.id}`}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Exporter PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteNotice(notice.id, notice.business_name)}
                      data-testid={`delete-notice-${notice.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
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

export default TaxNoticesPage;
