import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Glass, GlassButton, GlassInput, Loading, StatusChip } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import { api, ApiError, type AdminInvite } from '../lib/api';
import { useAuth } from '../lib/auth';

interface InviteSuccess {
  firstName: string;
  email: string;
  inviteUrl: string | null;
}

const STATUS_LABEL: Record<AdminInvite['status'], string> = {
  offen: 'offen',
  eingeloest: 'eingelöst',
  abgelaufen: 'abgelaufen',
};

const STATUS_TONE: Record<AdminInvite['status'], 'gold' | 'green' | 'coral'> = {
  offen: 'gold',
  eingeloest: 'green',
  abgelaufen: 'coral',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  const [invites, setInvites] = useState<AdminInvite[] | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setInvitesError(null);
    try {
      const r = await api.adminInvites();
      setInvites(r.invites);
    } catch (e) {
      setInvitesError(e instanceof ApiError ? e.message : 'Liste konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErr('Bitte alle Felder ausfüllen.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await api.adminInvite({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      const inviteUrl = res.devToken
        ? `${window.location.origin}/set-password?token=${encodeURIComponent(res.devToken)}`
        : null;
      setSuccess({ firstName: res.user.firstName, email: res.user.email, inviteUrl });
      setFirstName('');
      setLastName('');
      setEmail('');
      setCopied(false);
      void loadInvites();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invite fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!success?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(success.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard nicht verfügbar (z.B. http ohne localhost) — Nutzer kann manuell markieren.
    }
  };

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Phase B2a · Verwaltung</div>
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
          Mitglied einladen
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Neue Mitglieder bekommen einen Magic-Link, mit dem sie ein Passwort setzen.
        </div>
      </div>

      <form onSubmit={submit}>
        <Glass
          tone="dark"
          style={{
            borderRadius: 22,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <GlassInput
            label="Vorname"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Max"
            autoFocus
          />
          <GlassInput
            label="Nachname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Mustermann"
          />
          <GlassInput
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="max@bergwacht-zollernalb.de"
            error={err}
          />
        </Glass>

        <div style={{ marginTop: 16 }}>
          <GlassButton type="submit" full size="lg" disabled={busy}>
            {busy ? 'Sende …' : 'Magic-Link erzeugen'}
          </GlassButton>
        </div>
      </form>

      {success && (
        <Glass
          tone="amber"
          style={{ borderRadius: 22, padding: '18px 16px', marginTop: 18 }}
        >
          <div className="bwza-eyebrow">Magic-Link erzeugt</div>
          <div
            style={{
              marginTop: 6,
              fontFamily: 'var(--bwza-font-display)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--bwza-ink)',
              letterSpacing: -0.2,
            }}
          >
            {success.firstName} ist eingeladen.
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            {success.email}
          </div>

          {success.inviteUrl ? (
            <>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  color: 'var(--bwza-ink-dim)',
                  paddingLeft: 2,
                }}
              >
                MAGIC-LINK ZUM WEITERGEBEN
              </div>
              <div
                style={{
                  marginTop: 6,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.30)',
                  border: '1px solid var(--bwza-glass-line)',
                  fontSize: 12,
                  wordBreak: 'break-all',
                  fontFamily: 'var(--bwza-font-ui)',
                }}
              >
                <a
                  href={success.inviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--bwza-ink)', textDecoration: 'underline' }}
                >
                  {success.inviteUrl}
                </a>
              </div>
              <div style={{ marginTop: 12 }}>
                <GlassButton variant="ghost" size="sm" full onClick={() => void copyLink()}>
                  {copied ? 'Kopiert' : 'Link kopieren'}
                </GlassButton>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
              Der Magic-Link wurde per E-Mail versendet.
            </div>
          )}
        </Glass>
      )}

      <InviteList invites={invites} error={invitesError} />

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/mitglieder')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 28,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">👥 Mitglieder</div>
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
            Mitglieder & Salden
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Saldo sehen, Guthaben korrigieren, Transaktionen stornieren
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/drinks')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">🍺 Katalog</div>
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
            Drink-Katalog
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Sorten pflegen, Preise ändern, ausblenden
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/aufladung-anfragen')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">💳 Kasse</div>
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
            Aufladungs-Anfragen
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Offene PayPal-Anfragen bestätigen oder ablehnen
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/aufladung-bargeld')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">💶 Kasse</div>
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
            Bargeld-Aufladung
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Einzahlung eines Mitglieds eintragen
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/kasse')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">🏦 Kasse</div>
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
            Vereinskasse
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Töpfe, Box, Deckung, Einkauf · Einlage · Spende · Korrektur
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/statistik')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">📊 Statistik</div>
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
            Sortenstatistik
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            Anzahl + Umsatz je Getränk (anonym, Zeitfilter)
          </div>
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

      <Glass
        tone="dark"
        onClick={() => navigate('/admin/profil')}
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          marginTop: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div className="bwza-eyebrow">👤 Profil</div>
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
            Mein PayPal-Link
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            paypal.me-Link für zugewiesene Aufladungen pflegen
          </div>
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

      <div style={{ marginTop: 22 }}>
        <GlassButton variant="ghost" full onClick={() => navigate('/')}>
          Zurück
        </GlassButton>
      </div>
    </div>
  );
}

function InviteList({
  invites,
  error,
}: {
  invites: AdminInvite[] | null;
  error: string | null;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.2,
          }}
        >
          Ausgestellte Invites
        </div>
        {invites && (
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
            {invites.length} {invites.length === 1 ? 'Eintrag' : 'Einträge'}
          </div>
        )}
      </div>

      {error ? (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{error}</div>
        </Glass>
      ) : invites === null ? (
        <Loading />
      ) : invites.length === 0 ? (
        <EmptyState title="Noch keine Invites" sub="Lade oben das erste Mitglied ein." />
      ) : (
        <ScrollList>
          {invites.map((inv) => (
            <InviteRow key={inv.id} invite={inv} />
          ))}
        </ScrollList>
      )}
    </div>
  );
}

function InviteRow({ invite }: { invite: AdminInvite }) {
  const dateLine =
    invite.status === 'eingeloest' && invite.redeemedAt
      ? `Eingelöst am ${formatDate(invite.redeemedAt)}`
      : invite.status === 'abgelaufen'
        ? `Abgelaufen am ${formatDate(invite.expiresAt)}`
        : `Läuft ab am ${formatDate(invite.expiresAt)}`;

  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--bwza-font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--bwza-ink)',
            letterSpacing: -0.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {invite.firstName} {invite.lastName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--bwza-ink-mute)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {invite.email}
        </div>
        <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--bwza-ink-mute)' }}>
          {dateLine}
        </div>
      </div>
      <StatusChip label={STATUS_LABEL[invite.status]} tone={STATUS_TONE[invite.status]} />
    </Glass>
  );
}
