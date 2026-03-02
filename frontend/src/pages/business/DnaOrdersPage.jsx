import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Wrench, Search, Clock, PackageCheck, Truck,
  Building2, MessageSquare, Car
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATUS_CONFIG = {
  en_attente: { label: 'En attente', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20 border-gray-500/30' },
  fabrication: { label: 'Fabrication', icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  receptionne: { label: 'Réceptionné', icon: PackageCheck, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  livre: { label: 'Livré', icon: Truck, color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
};
const STATUSES = ['en_attente', 'fabrication', 'receptionne', 'livre'];

const DnaOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dnaComment, setDnaComment] = useState('');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/vehicle-orders`);
      setOrders(res.data);
    } catch (e) { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatus !== 'all') list = list.filter(o => o.advancement === filterStatus);
    if (search) list = list.filter(o =>
      o.client_name.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicle_name.toLowerCase().includes(search.toLowerCase()) ||
      o.business_name.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [orders, filterStatus, search]);

  const stats = useMemo(() => ({
    total: orders.length,
    en_attente: orders.filter(o => o.advancement === 'en_attente').length,
    fabrication: orders.filter(o => o.advancement === 'fabrication').length,
    receptionne: orders.filter(o => o.advancement === 'receptionne').length,
    livre: orders.filter(o => o.advancement === 'livre').length,
  }), [orders]);

  const handleUpdateStatus = async (orderId, status) => {
    try {
      const params = new URLSearchParams({ advancement: status });
      if (dnaComment) params.append('dna_comment', dnaComment);
      await axios.put(`${API}/vehicle-orders/${orderId}/advancement?${params}`);
      toast.success('Statut mis à jour');
      setSelectedOrder(null);
      setDnaComment('');
      fetchOrders();
    } catch (e) { toast.error('Erreur'); }
  };

  const openStatusDialog = (order) => {
    setSelectedOrder(order);
    setDnaComment(order.dna_comment || '');
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="dna-orders-page">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
            <Wrench className="inline w-8 h-8 mr-2 text-primary" />DN Automotive — Suivi fabrication
          </h1>
          <p className="text-muted-foreground mt-1">Gérer l'avancement des commandes de véhicules</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'primary' },
            { label: 'En attente', value: stats.en_attente, color: 'gray' },
            { label: 'Fabrication', value: stats.fabrication, color: 'red' },
            { label: 'Réceptionné', value: stats.receptionne, color: 'amber' },
            { label: 'Livré', value: stats.livre, color: 'green' },
          ].map((s, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-bold font-mono mt-1 text-${s.color}-400`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 bg-input border-border" data-testid="dna-search" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48 bg-input border-border" data-testid="dna-filter-status">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-border bg-card"><CardContent className="flex flex-col items-center justify-center py-12"><Car className="w-12 h-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Aucune commande</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const st = STATUS_CONFIG[order.advancement] || STATUS_CONFIG.en_attente;
              const StIcon = st.icon;
              return (
                <Card key={order.id} className={`border-border bg-card hover:border-primary/30 transition-colors cursor-pointer`} onClick={() => openStatusDialog(order)} data-testid={`dna-order-${order.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-foreground">{order.vehicle_name}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary border border-border">{order.vehicle_category}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs border ${st.bg} ${st.color}`}>
                            <StIcon className="w-3 h-3" />{st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{order.business_name}</span>
                          <span>Client : <span className="text-foreground">{order.client_name}</span></span>
                          <span className="font-mono">{fmtDate(order.created_at)}</span>
                          {order.plate_number && <span className="font-mono text-foreground">Plaque : {order.plate_number}</span>}
                        </div>
                        {order.dna_comment && (
                          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-primary" />{order.dna_comment}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold font-mono text-green-400">{fmt(order.final_price)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Update Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) { setSelectedOrder(null); setDnaComment(''); }}}>
        <DialogContent className="bg-card border-border max-w-md">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
                  Mettre à jour — {selectedOrder.vehicle_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 border border-border bg-secondary/30 text-sm space-y-1">
                  <p>Client : <span className="text-foreground font-medium">{selectedOrder.client_name}</span></p>
                  <p>Concessionnaire : <span className="text-foreground">{selectedOrder.business_name}</span></p>
                  <p>Prix : <span className="text-green-400 font-mono font-bold">{fmt(selectedOrder.final_price)}</span></p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Avancement</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUSES.map(s => {
                      const cfg = STATUS_CONFIG[s];
                      const Icon = cfg.icon;
                      const isActive = selectedOrder.advancement === s;
                      return (
                        <button
                          key={s}
                          onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                          className={`flex items-center gap-2 p-3 border transition-all text-left text-sm ${isActive ? `${cfg.bg} ${cfg.color} font-bold` : 'border-border hover:border-primary/30 text-muted-foreground'}`}
                          data-testid={`dna-status-${s}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Commentaire DNA</p>
                  <Textarea
                    value={dnaComment}
                    onChange={e => setDnaComment(e.target.value)}
                    placeholder="Note sur l'avancement..."
                    className="bg-input border-border"
                    rows={2}
                    data-testid="dna-comment-input"
                  />
                  <Button
                    className="w-full uppercase tracking-wider"
                    onClick={() => handleUpdateStatus(selectedOrder.id, selectedOrder.advancement)}
                    data-testid="dna-save-comment-btn"
                  >
                    Enregistrer le commentaire
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default DnaOrdersPage;
