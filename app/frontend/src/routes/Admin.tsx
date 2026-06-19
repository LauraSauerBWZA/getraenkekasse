import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beer, Download, Inbox, Landmark, User, Users, type LucideIcon } from 'lucide-react';
import { Eyebrow, Glass, GlassButton } from '../components/primitives';
import { BackBar } from '../components/BackBar';
import { api, ApiError, downloadJson } from '../lib/api';
import { useAuth } from '../lib/auth';

// Admin-Hub (Bündel 2, Einheit 4: verschlankt). Weniger Buttons, sinnvoll
// gruppiert — drei frühere Einstiege wandern unter verwandte Hub-Punkte und sind
// dort weiter voll erreichbar (Routen unverändert):
//   - „Mitglied einladen"  → unter „Mitglieder & Salden" (/admin/mitglieder)
//   - „Sortenstatistik"    → unter „Drink-Katalog" (/admin/drinks)
//   - „Bargeld-Aufladung"  → unter „Aufladungen" (/admin/aufladung-anfragen)
export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <BackBar />
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Admin-Bereich</div>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 30,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.4,
            marginTop: 4,
          }}
        >
          Verwaltung
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Mitglieder, Katalog, Kasse und mehr.
        </div>
      </div>

      <HubButton
        icon={Users}
        kicker="Mitglieder"
        title="Mitglieder & Salden"
        sub="Einladen, Saldo sehen, Guthaben korrigieren, stornieren, reaktivieren"
        onClick={() => navigate('/admin/mitglieder')}
        first
      />
      <HubButton
        icon={Beer}
        kicker="Katalog"
        title="Drink-Katalog"
        sub="Sorten pflegen, Preise ändern, ausblenden · Sortenstatistik"
        onClick={() => navigate('/admin/drinks')}
      />
      <HubButton
        icon={Inbox}
        kicker="Kasse"
        title="Aufladungen"
        sub="Einzahlung eintragen — Bar oder PayPal-direkt"
        onClick={() => navigate('/admin/aufladung-bargeld')}
      />
      <HubButton
        icon={Landmark}
        kicker="Kasse"
        title="Vereinskasse"
        sub="Töpfe, Box, Deckung, Einkauf · Einlage · Spende · Korrektur"
        onClick={() => navigate('/admin/kasse')}
      />
      <HubButton
        icon={User}
        kicker="Profil"
        title="Mein PayPal-Link"
        sub="paypal.me-Link für zugewiesene Aufladungen pflegen"
        onClick={() => navigate('/admin/profil')}
      />

      <GesamtExportCard />
    </div>
  );
}

// Gesamt-Export (Admin-exklusiv, §9): lädt /admin/export als JSON herunter —
// alle aktiven Mitglieder mit Transaktionen + Kassen-Transaktionen + Drink-
// Katalog. Eigene Stelle unter den Hub-Buttons (Verwaltung-Hub).
function GesamtExportCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const exportieren = async () => {
    setErr(null);
    setBusy(true);
    try {
      const data = await api.adminGesamtExport();
      downloadJson('getraenkekasse-gesamt-export.json', data);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Export fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 18 }}>
      <Eyebrow icon={Download}>Daten</Eyebrow>
      <div style={{ marginTop: 3, fontSize: 12, color: 'var(--bwza-ink-dim)', lineHeight: 1.45 }}>
        Gesamt-Export als JSON: alle aktiven Mitglieder mit Transaktionen, Kassen-Transaktionen
        und der Drink-Katalog.
      </div>
      {err && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--bwza-rescue-soft)' }}>{err}</div>}
      <div style={{ marginTop: 12 }}>
        <GlassButton variant="ghost" full size="sm" disabled={busy} onClick={() => void exportieren()}>
          {busy ? 'Exportiere …' : 'Alle Daten exportieren'}
        </GlassButton>
      </div>
    </Glass>
  );
}

// Eine Admin-Hub-Karte: Icon-Eyebrow + Titel + Subtext + Chevron. Einheitliches
// Design/Reihung für alle Einträge (inkl. „Mitglied einladen").
function HubButton({
  icon,
  kicker,
  title,
  sub,
  onClick,
  first,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  sub: string;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <Glass
      tone="dark"
      onClick={onClick}
      style={{
        borderRadius: 18,
        padding: '14px 16px',
        marginTop: first ? 0 : 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Eyebrow icon={icon}>{kicker}</Eyebrow>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            marginTop: 2,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{sub}</div>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: 'var(--bwza-ink-dim)', flexShrink: 0 }}
        aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Glass>
  );
}
