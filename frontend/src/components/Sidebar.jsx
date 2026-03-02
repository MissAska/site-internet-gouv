import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Users,
  Landmark,
  FileText,
  Activity,
  LogOut,
  Settings,
  DollarSign,
  LayoutDashboard,
  Calculator,
  History,
  Car,
  ClipboardList,
  Wrench
} from 'lucide-react';
import { Button } from './ui/button';

const Sidebar = () => {
  const { user, logout, isAdmin, isPatron, isEmployee } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/admin/businesses', icon: Building2, label: 'Entreprises' },
    { to: '/admin/users', icon: Users, label: 'Comptes' },
    { to: '/admin/accounting', icon: Calculator, label: 'Comptabilité' },
    { to: '/admin/accounting-history', icon: History, label: 'Historique comptable' },
    { to: '/admin/expenses', icon: Activity, label: 'Dépenses' },
    { to: '/admin/tax-notices', icon: FileText, label: 'Avis d\'impôts' },
    { to: '/admin/tax-brackets', icon: Settings, label: 'Tranches fiscales' },
  ];

  const patronLinks = [
    { to: '/business', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/cash-register', icon: DollarSign, label: 'Caisse' },
    { to: '/business/vehicle-orders', icon: ClipboardList, label: 'Commandes véhicules' },
    { to: '/business/dna-orders', icon: Wrench, label: 'Suivi DNA' },
    { to: '/business/vehicle-catalog', icon: Car, label: 'Catalogue véhicules' },
    { to: '/business/employees', icon: Users, label: 'Employés' },
    { to: '/business/transactions', icon: Activity, label: 'Transactions' },
    { to: '/business/accounting', icon: Calculator, label: 'Comptabilité' },
    { to: '/business/tax-notices', icon: FileText, label: 'Avis d\'impôts' },
  ];

  // Dynamic employee links based on permissions
  const getEmployeeLinks = () => {
    const permissions = user?.permissions || {};
    const links = [];
    
    if (permissions.cash_register !== false) {
      links.push({ to: '/cash-register', icon: DollarSign, label: 'Caisse enregistreuse' });
      links.push({ to: '/employee/vehicle-orders', icon: ClipboardList, label: 'Commandes véhicules' });
      links.push({ to: '/employee/dna-orders', icon: Wrench, label: 'Suivi DNA' });
    }
    if (permissions.view_transactions) {
      links.push({ to: '/employee/transactions', icon: Activity, label: 'Transactions' });
    }
    if (permissions.view_accounting) {
      links.push({ to: '/employee/accounting', icon: Calculator, label: 'Comptabilité' });
    }
    if (permissions.view_tax_notices) {
      links.push({ to: '/employee/tax-notices', icon: FileText, label: 'Avis d\'impôts' });
    }
    if (permissions.manage_employees) {
      links.push({ to: '/employee/manage', icon: Users, label: 'Employés' });
    }
    
    // Always show at least one link
    if (links.length === 0) {
      links.push({ to: '/cash-register', icon: DollarSign, label: 'Caisse enregistreuse' });
    }
    
    return links;
  };

  const employeeLinks = getEmployeeLinks();

  const links = isAdmin() ? adminLinks : isPatron() ? patronLinks : employeeLinks;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
            <Landmark className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight uppercase" style={{ fontFamily: 'Chakra Petch' }}>
              Eyefind
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              Portail Fiscal
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <p className="text-sm font-medium truncate">{user?.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        <span className="inline-block mt-2 px-2 py-0.5 text-xs uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
          {user?.role === 'admin' ? 'Gouvernement' : user?.role === 'patron' ? 'Patron' : 'Employé'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/admin' || link.to === '/business'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground border-l-4 border-transparent'
                  }`
                }
                data-testid={`nav-link-${link.to.replace(/\//g, '-').replace(/^-/, '')}`}
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
