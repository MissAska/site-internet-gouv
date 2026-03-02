import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  Car, Plus, Search, Phone, PhoneOff, Trash2, Pencil,
  Clock, Wrench, PackageCheck, Truck, MessageSquare, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATUS_CONFIG = {
  en_attente: { label: 'En attente', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20 border-gray-500/30' },
  fabrication: { label: 'Fabrication', icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  receptionne: { label: 'Réceptionné', icon: PackageCheck, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  livre: { label: 'Livré', icon: Truck, color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
};

const VehicleOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_enterprise: '',
    vehicle_id: '', reduction_percent: 0, reduction_exceptional: 0, commentary: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [oRes, vRes, cRes] = await Promise.all([
        axios.get(`${API}/vehicle-orders`),
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/vehicles/categories`)
      ]);
      setOrders(oRes.data);
      setVehicles(vRes.data);
      setCategories(cRes.data);
    } catch (e) { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatus !== 'all') list = list.filter(o => o.advancement === filterStatus);
    if (search) list = list.filter(o =>
      o.client_name.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicle_name.toLowerCase().includes(search.toLowerCase()) ||
      o.personnel_name.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [orders, filterStatus, search]);

  const filteredVehicles = useMemo(() => {
    if (selectedCategory === 'all') return vehicles;
    return vehicles.filter(v => v.category === selectedCategory);
  }, [vehicles, selectedCategory]);

  const selectedVehicle = useMemo(() =>
    vehicles.find(v => v.id === form.vehicle_id), [vehicles, form.vehicle_id]
  );

  const calcPrice = () => {
    if (!selectedVehicle) return 0;
    const base = selectedVehicle.price;
    return Math.max(0, base - base * (form.reduction_percent / 100) - form.reduction_exceptional);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) { toast.error('Sélectionnez un véhicule'); return; }
    try {
      await axios.post(`${API}/vehicle-orders`, form);
      toast.success('Commande créée');
      setShowCreate(false);
      setForm({ client_name: '', client_phone: '', client_enterprise: '', vehicle_id: '', reduction_percent: 0, reduction_exceptional: 0, commentary: '' });
      setSelectedCategory('all');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const handleToggleCall = async (orderId) => {
    try {
      await axios.put(`${API}/vehicle-orders/${orderId}/call`);
      fetchData();
    } catch (e) { toast.error('Erreur'); }
  };

  const handleDelete = async (orderId) => {
    try {
      await axios.delete(`${API}/vehicle-orders/${orderId}`);
      toast.success('Commande supprimée');
      fetchData();
    } catch (e) { toast.error('Erreur'); }
  };

  const handleAdvancement = async (orderId, status) => {
    try {
      await axios.put(`${API}/vehicle-orders/${orderId}/advancement?advancement=${status}`);
      toast.success('Statut mis à jour');
      fetchData();
    } catch (e) { toast.error('Erreur'); }
  };

  const isDna = user?.business_id && orders.length > 0 && orders.some(o => o.business_id !== user.business_id);

  return (
    <Layout>
      <div className="space-y-6" data-testid="vehicle-orders-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Commandes de véhicules
            </h1>
            <p className="text-muted-foreground mt-1">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>
          </div>
          {user?.role !== 'admin' && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button className="uppercase tracking-wider btn-glow" data-testid="new-order-btn">
                  <Plus className="w-4 h-4 mr-2" />Nouvelle commande
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>Nouvelle commande</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Client</Label>
                      <Input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} className="bg-input border-border" required data-testid="order-client-name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Téléphone</Label>
                      <Input value={form.client_phone} onChange={e => setForm({...form, client_phone: e.target.value})} className="bg-input border-border" data-testid="order-client-phone" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Entreprise du client</Label>
                    <Input value={form.client_enterprise} onChange={e => setForm({...form, client_enterprise: e.target.value})} className="bg-input border-border" data-testid="order-client-enterprise" />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Catégorie</Label>
                    <Select value={selectedCategory} onValueChange={v => { setSelectedCategory(v); setForm({...form, vehicle_id: ''}); }}>
                      <SelectTrigger className="bg-input border-border" data-testid="order-category-select"><SelectValue placeholder="Filtrer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes catégories</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Véhicule</Label>
                    <Select value={form.vehicle_id} onValueChange={v => setForm({...form, vehicle_id: v})}>
                      <SelectTrigger className="bg-input border-border" data-testid="order-vehicle-select"><SelectValue placeholder="Choisir un véhicule" /></SelectTrigger>
                      <SelectContent>
                        {filteredVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} — {fmt(v.price)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedVehicle && (
                    <div className="p-3 border border-primary/30 bg-primary/5 text-sm">
                      <p className="font-mono">Prix catalogue : <span className="text-green-400 font-bold">{fmt(selectedVehicle.price)}</span></p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Réduction (% max 30)</Label>
                      <Input type="number" value={form.reduction_percent} onChange={e => setForm({...form, reduction_percent: Math.min(30, Math.max(0, parseFloat(e.target.value) || 0))})} className="bg-input border-border" min="0" max="30" data-testid="order-reduction" />
                    </div>
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs">Réduc. exceptionnelle ($)</Label>
                      <Input type="number" value={form.reduction_exceptional} onChange={e => setForm({...form, reduction_exceptional: parseFloat(e.target.value) || 0})} className="bg-input border-border" min="0" data-testid="order-reduction-exc" />
                    </div>
                  </div>
                  {selectedVehicle && (
                    <div className="p-3 border border-green-500/30 bg-green-500/5 text-sm">
                      <p className="font-mono">Prix final : <span className="text-green-400 font-bold text-lg">{fmt(calcPrice())}</span></p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Commentaire</Label>
                    <Textarea value={form.commentary} onChange={e => setForm({...form, commentary: e.target.value})} className="bg-input border-border" rows={2} data-testid="order-commentary" />
                  </div>
                  <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-order-btn">Créer la commande</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher client, véhicule..." className="pl-10 bg-input border-border" data-testid="search-orders" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 bg-input border-border" data-testid="filter-order-status">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Orders table */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-border bg-card"><CardContent className="flex flex-col items-center justify-center py-12"><Car className="w-12 h-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Aucune commande</p></CardContent></Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table text-sm">
                  <thead>
                    <tr>
                      <th>Personnel</th>
                      <th>Client</th>
                      <th>Tél.</th>
                      <th>Modèle</th>
                      <th>Entreprise</th>
                      <th>Date</th>
                      <th className="text-right">Réduc.</th>
                      <th className="text-right">Prix vente</th>
                      <th className="text-center">Appel</th>
                      <th>Plaque</th>
                      <th>Avancement</th>
                      <th>DNA</th>
                      <th>Commentaire</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(order => {
                      const st = STATUS_CONFIG[order.advancement] || STATUS_CONFIG.en_attente;
                      const StIcon = st.icon;
                      return (
                        <tr key={order.id} data-testid={`order-row-${order.id}`}>
                          <td className="whitespace-nowrap">{order.personnel_name}</td>
                          <td className="font-medium whitespace-nowrap">{order.client_name}</td>
                          <td className="text-muted-foreground font-mono text-xs">{order.client_phone || '-'}</td>
                          <td className="whitespace-nowrap">
                            <span className="text-foreground">{order.vehicle_name}</span>
                            <span className="text-xs text-muted-foreground ml-1">({order.vehicle_category})</span>
                          </td>
                          <td className="text-muted-foreground">{order.client_enterprise || '-'}</td>
                          <td className="text-xs text-muted-foreground font-mono whitespace-nowrap">{fmtDate(order.created_at)}</td>
                          <td className="text-right font-mono text-xs">
                            {order.reduction_percent > 0 && <span className="text-amber-400">{order.reduction_percent}%</span>}
                            {order.reduction_exceptional > 0 && <span className="text-amber-400 ml-1">+{fmt(order.reduction_exceptional)}</span>}
                            {order.reduction_percent === 0 && order.reduction_exceptional === 0 && <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="text-right font-mono font-bold text-green-400">{fmt(order.final_price)}</td>
                          <td className="text-center">
                            <button
                              onClick={() => handleToggleCall(order.id)}
                              className={`p-1 rounded transition-colors ${order.client_called ? 'text-green-400' : 'text-muted-foreground hover:text-foreground'}`}
                              data-testid={`call-toggle-${order.id}`}
                            >
                              {order.client_called ? <Phone className="w-4 h-4" /> : <PhoneOff className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="font-mono text-xs">{order.plate_number || '-'}</td>
                          <td>
                            {user?.role === 'admin' ? (
                              <Select value={order.advancement} onValueChange={v => handleAdvancement(order.id, v)}>
                                <SelectTrigger className={`h-7 text-xs border ${st.bg} ${st.color} w-32`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border ${st.bg} ${st.color}`}>
                                <StIcon className="w-3 h-3" />{st.label}
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-muted-foreground max-w-[100px] truncate">{order.dna_comment || '-'}</td>
                          <td className="text-xs text-muted-foreground max-w-[120px] truncate">{order.commentary || '-'}</td>
                          <td className="text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => handleDelete(order.id)} data-testid={`delete-order-${order.id}`}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default VehicleOrdersPage;
