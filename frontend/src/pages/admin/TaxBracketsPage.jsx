import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TaxBracketsPage = () => {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBrackets();
  }, []);

  const fetchBrackets = async () => {
    try {
      const response = await axios.get(`${API}/tax-brackets`);
      setBrackets(response.data);
    } catch (error) {
      console.error('Error fetching brackets:', error);
      toast.error('Erreur lors du chargement des tranches');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBracket = () => {
    const lastBracket = brackets[brackets.length - 1];
    const newMin = lastBracket ? (lastBracket.max_amount || lastBracket.min_amount + 100000) : 0;
    setBrackets([
      ...brackets,
      { min_amount: newMin, max_amount: null, rate: 0.1 }
    ]);
  };

  const handleRemoveBracket = (index) => {
    if (brackets.length <= 1) {
      toast.error('Vous devez avoir au moins une tranche');
      return;
    }
    setBrackets(brackets.filter((_, i) => i !== index));
  };

  const handleBracketChange = (index, field, value) => {
    const updated = [...brackets];
    if (field === 'rate') {
      updated[index][field] = parseFloat(value) / 100;
    } else if (field === 'max_amount' && value === '') {
      updated[index][field] = null;
    } else {
      updated[index][field] = parseFloat(value) || 0;
    }
    setBrackets(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/tax-brackets`, brackets);
      toast.success('Tranches d\'imposition mises à jour');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '∞';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="tax-brackets-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Tranches fiscales
            </h1>
            <p className="text-muted-foreground mt-1">
              Configurer les taux d'imposition par tranche de bénéfice
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleAddBracket}
              className="uppercase tracking-wider"
              data-testid="add-bracket-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="uppercase tracking-wider btn-glow"
              data-testid="save-brackets-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>

        {/* Brackets Table */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              <Settings className="w-5 h-5 text-primary" />
              Tableau des tranches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tranche</th>
                      <th>Montant minimum ($)</th>
                      <th>Montant maximum ($)</th>
                      <th>Taux (%)</th>
                      <th className="w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brackets.map((bracket, index) => (
                      <tr key={index}>
                        <td className="font-medium text-foreground" style={{ fontFamily: 'IBM Plex Sans' }}>
                          Tranche {index + 1}
                        </td>
                        <td>
                          <Input
                            type="number"
                            value={bracket.min_amount}
                            onChange={(e) => handleBracketChange(index, 'min_amount', e.target.value)}
                            className="bg-input border-border w-32"
                            min="0"
                            data-testid={`bracket-min-${index}`}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            value={bracket.max_amount ?? ''}
                            onChange={(e) => handleBracketChange(index, 'max_amount', e.target.value)}
                            className="bg-input border-border w-32"
                            placeholder="∞"
                            min="0"
                            data-testid={`bracket-max-${index}`}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={(bracket.rate * 100).toFixed(0)}
                              onChange={(e) => handleBracketChange(index, 'rate', e.target.value)}
                              className="bg-input border-border w-20"
                              min="0"
                              max="100"
                              data-testid={`bracket-rate-${index}`}
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveBracket(index)}
                            data-testid={`remove-bracket-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              Aperçu des tranches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {brackets.map((bracket, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-secondary/30 border border-border"
                >
                  <div>
                    <span className="font-mono">
                      {formatCurrency(bracket.min_amount)} - {formatCurrency(bracket.max_amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${bracket.rate * 100}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-primary w-16 text-right">
                      {(bracket.rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TaxBracketsPage;
