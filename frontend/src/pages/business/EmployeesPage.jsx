import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
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
import { Users, Plus, Trash2, Eye, EyeOff, DollarSign, Pencil, Shield, ShieldCheck, ShieldX, Check } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
};

const PERMISSIONS_CONFIG = [
  { key: 'cash_register', label: 'Caisse (revenus)', description: 'Enregistrer des revenus' },
  { key: 'record_expenses', label: 'Dépenses', description: 'Enregistrer des dépenses' },
  { key: 'record_salaries', label: 'Salaires', description: 'Enregistrer des salaires' },
  { key: 'view_transactions', label: 'Voir transactions', description: 'Consulter l\'historique' },
  { key: 'view_accounting', label: 'Comptabilité', description: 'Accéder aux données comptables' },
  { key: 'view_tax_notices', label: 'Impôts', description: 'Consulter les avis d\'imposition' },
  { key: 'manage_employees', label: 'Gérer employés', description: 'Ajouter/modifier des employés' },
];

const DEFAULT_PERMISSIONS = {
  cash_register: true,
  record_expenses: false,
  record_salaries: false,
  view_transactions: false,
  view_accounting: false,
  view_tax_notices: false,
  manage_employees: false
};

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    salary: 0,
    permissions: { ...DEFAULT_PERMISSIONS }
  });
  const [editData, setEditData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    salary: 0,
    permissions: { ...DEFAULT_PERMISSIONS }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, businessRes] = await Promise.all([
        axios.get(`${API}/employees`),
        user?.business_id ? axios.get(`${API}/businesses/${user.business_id}`) : Promise.resolve({ data: null })
      ]);
      setEmployees(employeesRes.data);
      setBusiness(businessRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des employés');
    } finally {
      setLoading(false);
    }
  };

  // Generate email placeholder based on business name
  const getEmailPlaceholder = () => {
    if (business?.name) {
      const cleanName = business.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return `employe@eyefinds.${cleanName}.info`;
    }
    return 'employe@eyefinds.nomdelentreprise.info';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/employees`, {
        ...formData,
        permissions: formData.permissions
      });
      toast.success('Employé créé avec succès');
      setDialogOpen(false);
      setFormData({ name: '', email: '', password: '', salary: 0, permissions: { ...DEFAULT_PERMISSIONS } });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const openEditDialog = (employee) => {
    setEditData({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      password: '',
      salary: employee.salary,
      permissions: employee.permissions || { ...DEFAULT_PERMISSIONS }
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editData.name,
        email: editData.email,
        salary: editData.salary,
        permissions: editData.permissions
      };
      if (editData.password) {
        payload.password = editData.password;
      }
      await axios.put(`${API}/employees/${editData.id}`, payload);
      toast.success('Employé modifié');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (employeeId, employeeName) => {
    try {
      await axios.delete(`${API}/employees/${employeeId}`);
      toast.success('Employé supprimé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const togglePermission = (permissions, setPermissions, key) => {
    setPermissions({
      ...permissions,
      [key]: !permissions[key]
    });
  };

  const countActivePermissions = (permissions) => {
    if (!permissions) return 0;
    return Object.values(permissions).filter(Boolean).length;
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="employees-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Employés
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérer les employés et leurs accès
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="uppercase tracking-wider btn-glow" data-testid="add-employee-btn">
                <Plus className="w-4 h-4 mr-2" />
                Nouvel employé
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                  Ajouter un employé
                </DialogTitle>
                <DialogDescription>
                  Créez un compte et définissez les accès
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Nom</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Jean Dupont"
                    className="bg-input border-border"
                    required
                    data-testid="employee-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={getEmailPlaceholder()}
                    className="bg-input border-border"
                    required
                    data-testid="employee-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="bg-input border-border pr-10"
                      required
                      data-testid="employee-password-input"
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
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Salaire mensuel ($)</Label>
                  <Input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-input border-border"
                    min="0"
                    data-testid="employee-salary-input"
                  />
                </div>

                {/* Permissions */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="uppercase tracking-wider text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Permissions d'accès
                  </Label>
                  <div className="space-y-3">
                    {PERMISSIONS_CONFIG.map((perm) => (
                      <div
                        key={perm.key}
                        className={`flex items-center justify-between p-3 border transition-all cursor-pointer ${
                          formData.permissions[perm.key]
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary/30 border-border hover:border-primary/20'
                        }`}
                        onClick={() => setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [perm.key]: !formData.permissions[perm.key] }
                        })}
                      >
                        <div>
                          <p className="font-medium text-sm">{perm.label}</p>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                        <Checkbox
                          checked={!!formData.permissions[perm.key]}
                          className="pointer-events-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-employee-btn">
                  Créer l'employé
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Employees Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun employé enregistré</p>
              <p className="text-sm text-muted-foreground mt-1">
                Créez votre premier employé pour commencer
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((employee) => (
              <Card key={employee.id} className="border-border bg-card card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => openEditDialog(employee)}
                        data-testid={`edit-employee-${employee.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(employee.id, employee.name)}
                        data-testid={`delete-employee-${employee.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Salary */}
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Salaire
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(employee.salary)}
                    </span>
                  </div>

                  {/* Permissions Summary */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Accès
                      </span>
                      <span className="text-xs text-primary">
                        {countActivePermissions(employee.permissions)}/{PERMISSIONS_CONFIG.length} permissions
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PERMISSIONS_CONFIG.map((perm) => (
                        <span
                          key={perm.key}
                          className={`px-2 py-0.5 text-xs ${
                            employee.permissions?.[perm.key]
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-secondary text-muted-foreground border border-border'
                          }`}
                          title={perm.description}
                        >
                          {employee.permissions?.[perm.key] ? (
                            <ShieldCheck className="w-3 h-3 inline mr-1" />
                          ) : (
                            <ShieldX className="w-3 h-3 inline mr-1" />
                          )}
                          {perm.label.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Modifier l'employé
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Nom</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="bg-input border-border"
                  required
                  data-testid="edit-employee-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Email</Label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="bg-input border-border"
                  required
                  data-testid="edit-employee-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
                <Input
                  type="password"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="••••••••"
                  className="bg-input border-border"
                  data-testid="edit-employee-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Salaire mensuel ($)</Label>
                <Input
                  type="number"
                  value={editData.salary}
                  onChange={(e) => setEditData({ ...editData, salary: parseFloat(e.target.value) || 0 })}
                  className="bg-input border-border"
                  min="0"
                  data-testid="edit-employee-salary-input"
                />
              </div>

              {/* Edit Permissions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="uppercase tracking-wider text-xs flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Permissions d'accès
                </Label>
                <div className="space-y-3">
                  {PERMISSIONS_CONFIG.map((perm) => (
                    <div
                      key={perm.key}
                      className={`flex items-center justify-between p-3 border transition-all cursor-pointer ${
                        editData.permissions[perm.key]
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-secondary/30 border-border hover:border-primary/20'
                      }`}
                      onClick={() => setEditData({
                        ...editData,
                        permissions: { ...editData.permissions, [perm.key]: !editData.permissions[perm.key] }
                      })}
                    >
                      <div>
                        <p className="font-medium text-sm">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                      <Checkbox
                        checked={!!editData.permissions[perm.key]}
                        className="pointer-events-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-edit-employee-btn">
                Enregistrer les modifications
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default EmployeesPage;
