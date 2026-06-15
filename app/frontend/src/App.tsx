import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Login from './routes/Login';
import SetPassword from './routes/SetPassword';
import Dashboard from './routes/Dashboard';
import Admin from './routes/Admin';
import AdminDrinks from './routes/AdminDrinks';
import AdminAufladungBargeld from './routes/AdminAufladungBargeld';
import AdminAufladungAnfragen from './routes/AdminAufladungAnfragen';
import AdminMitglieder from './routes/AdminMitglieder';
import AdminMitgliedDetail from './routes/AdminMitgliedDetail';
import AdminKasse from './routes/AdminKasse';
import LeitungKasse from './routes/LeitungKasse';
import Buchen from './routes/Buchen';
import Aufladen from './routes/Aufladen';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="bwza-stage" style={{ padding: '60px var(--bwza-page-x)', color: 'var(--bwza-ink-mute)' }}>
        Lade …
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AdminOrLeitungOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user?.isAdmin && !user?.isLeitung) return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/buchen"
        element={
          <Protected>
            <Buchen />
          </Protected>
        }
      />
      <Route
        path="/aufladen"
        element={
          <Protected>
            <Aufladen />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminOnly>
              <Admin />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/drinks"
        element={
          <Protected>
            <AdminOnly>
              <AdminDrinks />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/aufladung-bargeld"
        element={
          <Protected>
            <AdminOnly>
              <AdminAufladungBargeld />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/aufladung-anfragen"
        element={
          <Protected>
            <AdminOnly>
              <AdminAufladungAnfragen />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/mitglieder"
        element={
          <Protected>
            <AdminOnly>
              <AdminMitglieder />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/mitglieder/:id"
        element={
          <Protected>
            <AdminOnly>
              <AdminMitgliedDetail />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/admin/kasse"
        element={
          <Protected>
            <AdminOnly>
              <AdminKasse />
            </AdminOnly>
          </Protected>
        }
      />
      <Route
        path="/leitung"
        element={
          <Protected>
            <AdminOrLeitungOnly>
              <LeitungKasse />
            </AdminOrLeitungOnly>
          </Protected>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
