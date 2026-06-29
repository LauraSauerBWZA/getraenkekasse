import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useRepaintOnVisible } from './lib/useRepaintOnVisible';
import { MemberLayout } from './components/MemberLayout';
import Login from './routes/Login';
import SetPassword from './routes/SetPassword';
import Dashboard from './routes/Dashboard';
import Admin from './routes/Admin';
import AdminEinladen from './routes/AdminEinladen';
import AdminDrinks from './routes/AdminDrinks';
import AdminAufladungBargeld from './routes/AdminAufladungBargeld';
import AdminMitglieder from './routes/AdminMitglieder';
import AdminMitgliedDetail from './routes/AdminMitgliedDetail';
import AdminKasse from './routes/AdminKasse';
import AdminProfil from './routes/AdminProfil';
import LeitungKasse from './routes/LeitungKasse';
import Sortenstatistik from './routes/Sortenstatistik';
import Buchen from './routes/Buchen';
import Aufladen from './routes/Aufladen';
import Verlauf from './routes/Verlauf';

// Spiel-Route lazy/code-gesplittet (B_GAME_INTEGRATION §2.4): lädt erst beim
// Öffnen — Nicht-Spieler tragen den Aufwand nicht (das Phaser-Bundle steckt zudem
// im iframe-Build /game/, nie im Haupt-App-Bundle).
const Spiel = lazy(() => import('./routes/Spiel'));

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
  // Globaler Repaint-Nudge gegen den „weißen Screen" beim Zurückwechseln in die
  // iOS-PWA (Bündel 6, Einheit 2) — einmal im App-Root, kein Reload/State-Verlust.
  useRepaintOnVisible();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Protected>
            <MemberLayout>
              <Dashboard />
            </MemberLayout>
          </Protected>
        }
      />
      <Route
        path="/buchen"
        element={
          <Protected>
            <MemberLayout>
              <Buchen />
            </MemberLayout>
          </Protected>
        }
      />
      <Route
        path="/aufladen"
        element={
          <Protected>
            <MemberLayout>
              <Aufladen />
            </MemberLayout>
          </Protected>
        }
      />
      <Route
        path="/verlauf"
        element={
          <Protected>
            <MemberLayout>
              <Verlauf />
            </MemberLayout>
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
        path="/admin/einladen"
        element={
          <Protected>
            <AdminOnly>
              <AdminEinladen />
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
      {/* Alt-Route (Bündel 4, Einheit 1): „Aufladungen" ist jetzt der Einzahlungs-Flow
          mit den offenen Anfragen oben — Bookmarks/Deep-Links umleiten. */}
      <Route path="/admin/aufladung-anfragen" element={<Navigate to="/admin/aufladung-bargeld" replace />} />
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
        path="/admin/profil"
        element={
          <Protected>
            <AdminOnly>
              <AdminProfil />
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
        path="/statistik"
        element={
          <Protected>
            <AdminOrLeitungOnly>
              <Sortenstatistik />
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
      <Route
        path="/spiel"
        element={
          <Protected>
            <Suspense
              fallback={
                <div
                  className="bwza-stage"
                  style={{ padding: '60px var(--bwza-page-x)', color: 'var(--bwza-ink-mute)' }}
                >
                  Spiel lädt …
                </div>
              }
            >
              <Spiel />
            </Suspense>
          </Protected>
        }
      />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
