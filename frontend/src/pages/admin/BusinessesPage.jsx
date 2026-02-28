import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Building2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const BusinessesPage = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    owner_email: '',
    owner_name: '',
    owner_password: ''
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(`${API}/businesses`);
      setBusinesses(response.data);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Erreur lors du chargement des entreprises');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/businesses`, formData);
      toast.success('Entreprise créée avec succès');
      setDialogOpen(false);
      setFormData({ name: '', owner_email: '', owner_name: '', owner_password: '' });
      fetchBusinesses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleDelete = async (businessId, businessName) => {
    if (!window.confirm(`Supprimer l'entreprise "${businessName}" ? Cette action est irréversible.`)) {
      return;
    }
    try {
      await axios.delete(`${API}/businesses/${businessId}`);
      toast.success('Entreprise supprimée');
      fetchBusinesses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="businesses-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Entreprises
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérer les entreprises du serveur
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="uppercase tracking-wider btn-glow" data-testid="create-business-btn">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle entreprise
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                  Créer une entreprise
                </DialogTitle>
                <DialogDescription>
                  Créez une nouvelle entreprise et son compte patron
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Nom de l'entreprise</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Los Santos Customs"
                    className="bg-input border-border"
                    required
                    data-testid="business-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Nom du patron</Label>
                  <Input
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    placeholder="Ex: John Smith"
                    className="bg-input border-border"
                    required
                    data-testid="owner-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Email du patron</Label>
                  <Input
                    type="email"
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                    placeholder="patron@entreprise.rp"
                    className="bg-input border-border"
                    required
                    data-testid="owner-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.owner_password}
                      onChange={(e) => setFormData({ ...formData, owner_password: e.target.value })}
                      placeholder="••••••••"
                      className="bg-input border-border pr-10"
                      required
                      data-testid="owner-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-business-btn">
                  Créer l'entreprise
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Businesses Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : businesses.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune entreprise enregistrée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Créez votre première entreprise pour commencer
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((business) => {
              const profit = business.total_income - business.total_expenses - business.total_salaries;
              return (
                <Card key={business.id} className="border-border bg-card card-hover">
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{business.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{business.owner_name}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(business.id, business.name)}
                        data-testid={`delete-business-${business.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Chiffre d'affaires</span>
                      <span className="font-mono text-green-400">{formatCurrency(business.total_income)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Dépenses</span>
                      <span className="font-mono text-red-400">{formatCurrency(business.total_expenses)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Salaires</span>
                      <span className="font-mono text-amber-400">{formatCurrency(business.total_salaries)}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between items-center">
                      <span className="text-sm font-semibold">Bénéfice brut</span>
                      <span className={`font-mono font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(profit)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BusinessesPage;
