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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Users, Plus, Trash2, Pencil, Eye, EyeOff, Shield, Building2, UserCircle, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
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
    year: 'numeric'
  });
};

const getRoleBadge = (role) => {
  switch (role) {
    case 'admin':
      return <span className="px-2 py-1 text-xs uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">Gouvernement</span>;
    case 'patron':
      return <span className="px-2 py-1 text-xs uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">Patron</span>;
    case 'employee':
      return <span className="px-2 py-1 text-xs uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">Employé</span>;
    default:
      return <span className="px-2 py-1 text-xs uppercase tracking-wider bg-secondary text-muted-foreground">{role}</span>;
  }
};

const UsersManagementPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  
  // Create admin dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: ''
  });
  
  // Edit user dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    salary: ''
  });
  const [editingUser, setEditingUser] = useState(null);
  
  // Change password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (filterRole === 'all') return true;
    return u.role === filterRole;
  });

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/users`, createForm);
      toast.success('Compte gouvernement créé');
      setCreateDialogOpen(false);
      setCreateForm({ name: '', email: '', password: '' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setEditForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      salary: user.salary?.toString() || ''
    });
    setEditDialogOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      if (editForm.salary && editingUser?.role === 'employee') {
        payload.salary = parseFloat(editForm.salary);
      }
      
      await axios.put(`${API}/admin/users/${editForm.id}`, payload);
      toast.success('Utilisateur modifié');
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      toast.success('Utilisateur supprimé');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    try {
      await axios.put(`${API}/admin/change-password`, null, {
        params: {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        }
      });
      toast.success('Mot de passe modifié');
      setPasswordDialogOpen(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du changement de mot de passe');
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="users-management-page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Chakra Petch' }}>
              Gestion des comptes
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérer tous les utilisateurs du système
            </p>
          </div>

          <div className="flex gap-3">
            {/* Change own password */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="uppercase tracking-wider" data-testid="change-password-btn">
                  <Key className="w-4 h-4 mr-2" />
                  Mon mot de passe
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                    Changer mon mot de passe
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Mot de passe actuel</Label>
                    <Input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="bg-input border-border"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="bg-input border-border"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Confirmer le mot de passe</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="bg-input border-border"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full uppercase tracking-wider">
                    Changer le mot de passe
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Create admin */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="uppercase tracking-wider btn-glow" data-testid="create-admin-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Compte gouvernement
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                    Créer un compte gouvernement
                  </DialogTitle>
                  <DialogDescription>
                    Créer un nouveau compte administrateur
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAdmin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Nom</Label>
                    <Input
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="Ex: Agent Fiscal"
                      className="bg-input border-border"
                      required
                      data-testid="admin-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Email</Label>
                    <Input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="agent@eyefinds.entreprise.info"
                      className="bg-input border-border"
                      required
                      data-testid="admin-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="uppercase tracking-wider text-xs">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="bg-input border-border pr-10"
                        required
                        data-testid="admin-password-input"
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
                  <Button type="submit" className="w-full uppercase tracking-wider" data-testid="submit-admin-btn">
                    Créer le compte
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-48 bg-input border-border" data-testid="filter-role">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Gouvernement</SelectItem>
              <SelectItem value="patron">Patrons</SelectItem>
              <SelectItem value="employee">Employés</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} utilisateur(s)
          </span>
        </div>

        {/* Users Table */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-3 uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              <Users className="w-5 h-5 text-primary" />
              Tous les utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Entreprise</th>
                      <th>Salaire</th>
                      <th>Date création</th>
                      <th className="w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-500/20' : user.role === 'patron' ? 'bg-primary/20' : 'bg-amber-500/20'
                            }`}>
                              {user.role === 'admin' ? (
                                <Shield className="w-4 h-4 text-purple-400" />
                              ) : user.role === 'patron' ? (
                                <Building2 className="w-4 h-4 text-primary" />
                              ) : (
                                <UserCircle className="w-4 h-4 text-amber-400" />
                              )}
                            </div>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">{user.email}</td>
                        <td>{getRoleBadge(user.role)}</td>
                        <td>
                          {user.business_name ? (
                            <span className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              {user.business_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-amber-400">{formatCurrency(user.salary)}</td>
                        <td className="text-muted-foreground">{formatDate(user.created_at)}</td>
                        <td>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => openEditDialog(user)}
                              data-testid={`edit-user-${user.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                data-testid={`delete-user-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
                Modifier l'utilisateur
              </DialogTitle>
              <DialogDescription>
                {editingUser && getRoleBadge(editingUser.role)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Nom</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-input border-border"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="bg-input border-border"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase tracking-wider text-xs">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
                <Input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="bg-input border-border"
                />
              </div>
              {editingUser?.role === 'employee' && (
                <div className="space-y-2">
                  <Label className="uppercase tracking-wider text-xs">Salaire ($)</Label>
                  <Input
                    type="number"
                    value={editForm.salary}
                    onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                    className="bg-input border-border"
                    min="0"
                  />
                </div>
              )}
              <Button type="submit" className="w-full uppercase tracking-wider">
                Enregistrer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UsersManagementPage;
