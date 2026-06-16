import { useNavigate } from 'react-router-dom';
import { BarChart3, Banknote, Beer, Inbox, Landmark, User, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { Eyebrow, Glass } from '../components/primitives';
import { BackBar } from '../components/BackBar';
import { useAuth } from '../lib/auth';

// Admin-Hub (UI-Fix 3): reine Button-Übersicht. „Mitglied einladen" ist jetzt eine
// eigene Unterseite (/admin/einladen, AdminEinladen.tsx) statt eines offenen
// Formulars hier oben — erreichbar über den ersten Hub-Button.
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
        icon={UserPlus}
        kicker="Mitglieder"
        title="Mitglied einladen"
        sub="Magic-Link erzeugen, ausgestellte Invites sehen"
        onClick={() => navigate('/admin/einladen')}
        first
      />
      <HubButton
        icon={Users}
        kicker="Mitglieder"
        title="Mitglieder & Salden"
        sub="Saldo sehen, Guthaben korrigieren, Transaktionen stornieren"
        onClick={() => navigate('/admin/mitglieder')}
      />
      <HubButton
        icon={Beer}
        kicker="Katalog"
        title="Drink-Katalog"
        sub="Sorten pflegen, Preise ändern, ausblenden"
        onClick={() => navigate('/admin/drinks')}
      />
      <HubButton
        icon={Inbox}
        kicker="Kasse"
        title="Aufladungs-Anfragen"
        sub="Offene PayPal-Anfragen bestätigen oder ablehnen"
        onClick={() => navigate('/admin/aufladung-anfragen')}
      />
      <HubButton
        icon={Banknote}
        kicker="Kasse"
        title="Bargeld-Aufladung"
        sub="Einzahlung eines Mitglieds eintragen"
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
        icon={BarChart3}
        kicker="Statistik"
        title="Sortenstatistik"
        sub="Anzahl + Umsatz je Getränk (anonym, Zeitfilter)"
        onClick={() => navigate('/statistik')}
      />
      <HubButton
        icon={User}
        kicker="Profil"
        title="Mein PayPal-Link"
        sub="paypal.me-Link für zugewiesene Aufladungen pflegen"
        onClick={() => navigate('/admin/profil')}
      />
    </div>
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
