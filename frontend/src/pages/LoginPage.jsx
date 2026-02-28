import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Landmark, Eye, EyeOff, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      redirectUser(user);
    }
  }, [isAuthenticated, user]);

  const redirectUser = (userData) => {
    if (userData.role === 'admin') {
      navigate('/admin');
    } else if (userData.role === 'patron') {
      navigate('/business');
    } else {
      navigate('/cash-register');
    }
  };

  // Initialize admin account silently
  useEffect(() => {
    axios.post(`${API}/admin/init`).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(email, password);
      redirectUser(userData);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(https://images.unsplash.com/photo-1697402918472-3fc44c607cce?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwyfHxuaWdodCUyMGNpdHklMjBza3lsaW5lJTIwYmx1ZSUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3NzIzMTc2NDN8MA&ixlib=rb-4.1.0&q=85)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md animate-slide-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 border border-primary/30 mb-4 glow-pulse">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <h1 
            className="text-4xl font-bold tracking-tight uppercase text-foreground"
            style={{ fontFamily: 'Chakra Petch' }}
          >
            Eyefind
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest mt-1">
            Portail Fiscal - Gouvernement
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border bg-card/95 backdrop-blur-md">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl uppercase tracking-wide" style={{ fontFamily: 'Chakra Petch' }}>
              Connexion
            </CardTitle>
            <CardDescription>
              Accédez au système de gestion fiscale
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@eyefinds.entreprise.info"
                  className="bg-input border-border focus:border-primary"
                  required
                  data-testid="login-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm uppercase tracking-wider">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border focus:border-primary pr-10"
                    required
                    data-testid="login-password-input"
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

              <Button
                type="submit"
                className="w-full uppercase tracking-wider font-semibold btn-glow"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 uppercase tracking-wider">
          Système de gestion fiscale - GTA RP
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
