import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { Car, Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const VehicleCatalogPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', price: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [vRes, cRes] = await Promise.all([
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/vehicles/categories`)
      ]);
      setVehicles(vRes.data);
      setCategories(cRes.data);
    } catch (e) { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let list = vehicles;
    if (filterCategory !== 'all') list = list.filter(v => v.category === filterCategory);
    if (search) list = list.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [vehicles, filterCategory, search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const v of filtered) {
      if (!g[v.category]) g[v.category] = [];
      g[v.category].push(v);
    }
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/vehicles`, form);
      toast.success('Véhicule ajouté');
      setShowAdd(false);
      setForm({ name: '', category: '', price: 0 });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/vehicles/${editVehicle.id}`, form);
      toast.success('Véhicule modifié');
      setEditVehicle(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/vehicles/${id}`);
      toast.success('Véhicule supprimé');
      fetchData();
    } catch (e) { toast.error('Erreur suppression'); }
  };

  const openEdit = (v) => {
    setEditVehicle(v);
    setForm({ name: v.name, category: v.category, price: v.price });
  };

  const VehicleForm = ({ onSubmit, title }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="uppercase tracking-wider text-xs">Nom du véhicule</Label>
        <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-input border-border" required data-testid="vehicle-name-input" />
      </div>
      <div className="space-y-2">
        <Label className="uppercase tracking-wider text-xs">Catégorie</Label>
        <Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-input border-border" required placeholder="Ex: Commercial, Compacts..." data-testid="vehicle-category-input" list="cat-list" />
        <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
      </div>
      <div className="space-y-2">
        <Label className="uppercase tracking-wider text-xs">Prix ($)</Label>
        <Input type="number" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} className="bg-input border-border" min="0" required data-testid="vehicle-price-input" />
      </div>
      <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-vehicle-btn">{title}</Button>
    </form>
  );

  return (
    <Layout>
      <div className="space-y-6" data-testid="vehicle-catalog-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>Catalogue véhicules</h1>
            <p className="text-muted-foreground mt-1">{vehicles.length} véhicules · {categories.length} catégories</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="uppercase tracking-wider btn-glow" data-testid="add-vehicle-btn"><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle className="uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>Nouveau véhicule</DialogTitle></DialogHeader>
              <VehicleForm onSubmit={handleAdd} title="Ajouter" />
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 bg-input border-border" data-testid="search-vehicle" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48 bg-input border-border" data-testid="filter-vehicle-category">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : grouped.length === 0 ? (
          <Card className="border-border bg-card"><CardContent className="flex flex-col items-center justify-center py-12"><Car className="w-12 h-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Aucun véhicule trouvé</p></CardContent></Card>
        ) : (
          grouped.map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-lg font-bold uppercase tracking-wide mb-3 flex items-center gap-2 text-primary" style={{ fontFamily: 'Chakra Petch' }}>
                <Tag className="w-4 h-4" />{cat} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
              </h2>
              <Card className="border-border bg-card">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Véhicule</th><th className="text-right">Prix</th><th className="text-center w-24">Actions</th></tr></thead>
                      <tbody>
                        {items.map(v => (
                          <tr key={v.id}>
                            <td className="font-medium">{v.name}</td>
                            <td className="text-right font-mono text-green-400">{fmt(v.price)}</td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)} data-testid={`edit-vehicle-${v.id}`}><Pencil className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => handleDelete(v.id)} data-testid={`delete-vehicle-${v.id}`}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!editVehicle} onOpenChange={(o) => { if (!o) setEditVehicle(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>Modifier véhicule</DialogTitle></DialogHeader>
          <VehicleForm onSubmit={handleEdit} title="Enregistrer" />
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VehicleCatalogPage;
