import { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, ExternalLink, MessageCircle } from 'lucide-react';
import { Eyebrow, EmptyState, Glass, GlassButton, Loading, StatusChip } from '../components/primitives';
import { ScrollList } from '../components/ScrollList';
import {
  api,
  ApiError,
  formatGuthaben,
  paypalMeUrlOhneBetrag,
  waMeUrl,
  type AufladungsStatus,
  type MeineAnfrage,
  type VerwalterPublic,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRefreshOnFocus } from '../lib/useRefreshOnFocus';

function formatBetrag(cent: number): string {
  return (cent / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

const STATUS_LABEL: Record<AufladungsStatus, string> = {
  OFFEN: 'offen',
  BESTAETIGT: 'bestätigt',
  ABGELEHNT: 'abgelehnt',
};

const STATUS_TONE: Record<AufladungsStatus, 'gold' | 'green' | 'coral'> = {
  OFFEN: 'gold',
  BESTAETIGT: 'green',
  ABGELEHNT: 'coral',
};

// Nach dem Melden gesetzte Rückmeldung: an wen + (falls Nummer hinterlegt) der
// fertige wa.me-Link als Fallback, falls window.open vom Browser geblockt wurde.
interface Benachrichtigung {
  verwalterName: string;
  waUrl: string | null;
}

export default function Aufladen() {
  const { user, refresh } = useAuth();
  const [verwalter, setVerwalter] = useState<VerwalterPublic | null>(null);
  const [anfragen, setAnfragen] = useState<MeineAnfrage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [benachrichtigung, setBenachrichtigung] = useState<Benachrichtigung | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [v, m] = await Promise.all([
        api.aufladungZustaendigerVerwalter(),
        api.aufladungMeine(),
      ]);
      setVerwalter(v.verwalter);
      setAnfragen(m.anfragen);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Aufladen-Seite konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Beim Zurückkehren in die App frisch (Guthaben + Status der eigenen Anfragen).
  useRefreshOnFocus(() => {
    void load();
    void refresh();
  });

  // „Überweisung erledigt — Verwalter benachrichtigen": legt die betraglose Anfrage
  // an und öffnet (falls Nummer hinterlegt) WhatsApp mit vorgefertigtem Text.
  const melden = async () => {
    if (!user) return;
    setErr(null);
    setBenachrichtigung(null);
    setBusy(true);
    try {
      const r = await api.aufladungPaypal();
      const v = r.verwalter;
      const meinName = `${user.firstName} ${user.lastName}`.trim();
      const text =
        `Hallo ${v.firstName}, ich habe gerade per PayPal Geld für die Getränkekasse ` +
        `überwiesen. Bitte freischalten. Grüße, ${meinName}`;
      const waUrl = v.whatsappNummer ? waMeUrl(v.whatsappNummer, text) : null;
      if (waUrl) window.open(waUrl, '_blank', 'noopener');
      setBenachrichtigung({ verwalterName: v.firstName, waUrl });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Anfrage fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const hatLink = Boolean(verwalter?.paypalMeLink);

  return (
    <div className="bwza-stage" style={{ padding: '0 var(--bwza-page-x) 40px' }}>
      <div style={{ paddingTop: 30, paddingBottom: 18 }}>
        <div className="bwza-eyebrow">Aufladen</div>
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
          Guthaben aufladen
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Aktuelles Guthaben:{' '}
          <span
            style={{
              fontWeight: 600,
              color: user.guthabenCent < 0 ? 'var(--bwza-rescue-soft)' : 'var(--bwza-ink)',
            }}
          >
            {formatGuthaben(user.guthabenCent)}
          </span>
        </div>
      </div>

      {loadError && (
        <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{loadError}</div>
        </Glass>
      )}

      {/* PayPal-Aufladung — betraglos, Mitglied wählt den Betrag selbst in PayPal */}
      <Glass tone="amber" style={{ borderRadius: 22, padding: '18px 16px' }}>
        <Eyebrow icon={CreditCard}>PayPal</Eyebrow>
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
          {verwalter ? `Zahlung an ${verwalter.firstName} ${verwalter.lastName}` : 'PayPal-Aufladung'}
        </div>

        {verwalter && hatLink ? (
          <>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)', lineHeight: 1.5 }}>
              Überweise einen <strong>frei gewählten Betrag</strong> an{' '}
              <span style={{ color: 'var(--bwza-ink)' }}>paypal.me/{verwalter.paypalMeLink}</span>.
              Danach den Verwalter benachrichtigen — er schaltet die Aufladung mit der
              tatsächlich überwiesenen Summe frei.
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GlassButton
                full
                size="lg"
                onClick={() =>
                  window.open(paypalMeUrlOhneBetrag(verwalter.paypalMeLink!), '_blank', 'noopener')
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ExternalLink size={18} strokeWidth={2} aria-hidden />
                  PayPal öffnen
                </span>
              </GlassButton>
              <GlassButton variant="ghost" full size="lg" disabled={busy} onClick={() => void melden()}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <MessageCircle size={18} strokeWidth={2} aria-hidden />
                  {busy ? 'Sende …' : 'Überweisung erledigt — Verwalter benachrichtigen'}
                </span>
              </GlassButton>
            </div>

            {err && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--bwza-rescue-soft)' }}>{err}</div>
            )}
          </>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--bwza-rescue-soft)', lineHeight: 1.45 }}>
            Aktuell ist kein PayPal-Link hinterlegt — bitte per Bargeld aufladen (unten) oder
            deinen Verwalter ansprechen.
          </div>
        )}

        {benachrichtigung && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid var(--bwza-glass-line)',
              fontSize: 12,
              color: 'var(--bwza-ink-dim)',
              lineHeight: 1.5,
            }}
          >
            Anfrage gestellt — {benachrichtigung.verwalterName} kann jetzt freischalten.
            {benachrichtigung.waUrl ? (
              <>
                {' '}WhatsApp sollte sich geöffnet haben; falls nicht:{' '}
                <a
                  href={benachrichtigung.waUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--bwza-ink)', textDecoration: 'underline' }}
                >
                  WhatsApp öffnen
                </a>
                .
              </>
            ) : (
              <> Sag {benachrichtigung.verwalterName} kurz persönlich Bescheid, dass du überwiesen hast
                {' '}(keine WhatsApp-Nummer hinterlegt).</>
            )}
          </div>
        )}
      </Glass>

      {/* Bargeld-Hinweis */}
      <Glass tone="dark" style={{ borderRadius: 18, padding: '14px 16px', marginTop: 14 }}>
        <Eyebrow icon={Banknote}>Bargeld</Eyebrow>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--bwza-ink)', fontWeight: 600 }}>
          Lieber bar?
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--bwza-ink-mute)', lineHeight: 1.45 }}>
          Sprich deinen Verwalter an — er trägt die Bargeld-Aufladung direkt ein, dein Guthaben
          steigt sofort.
        </div>
      </Glass>

      {/* Eigene Anfragen */}
      <EigeneAnfragen anfragen={anfragen} />
    </div>
  );
}

function EigeneAnfragen({ anfragen }: { anfragen: MeineAnfrage[] | null }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: 'var(--bwza-font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--bwza-ink)',
          letterSpacing: -0.2,
          marginBottom: 10,
        }}
      >
        Meine Anfragen
      </div>

      {anfragen === null ? (
        <Loading />
      ) : anfragen.length === 0 ? (
        <EmptyState title="Noch keine Anfragen" sub="Überweise per PayPal und melde dich beim Verwalter." />
      ) : (
        <ScrollList>
          {anfragen.map((a) => (
            <AnfrageRow key={a.id} anfrage={a} />
          ))}
        </ScrollList>
      )}
    </div>
  );
}

function AnfrageRow({ anfrage }: { anfrage: MeineAnfrage }) {
  const datum = new Date(anfrage.requestedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const kannErneutOeffnen =
    anfrage.status === 'OFFEN' && Boolean(anfrage.zugewiesenerVerwalter.paypalMeLink);

  // Bestätigte Anfragen tragen die vom Verwalter eingegebene Summe; offene sind betraglos.
  const titel = anfrage.betragCent != null ? formatBetrag(anfrage.betragCent) : 'PayPal-Aufladung';

  return (
    <Glass
      tone="dark"
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
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
          }}
        >
          {titel}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
          {datum} · an {anfrage.zugewiesenerVerwalter.firstName}
        </div>
        {kannErneutOeffnen && (
          <a
            href={paypalMeUrlOhneBetrag(anfrage.zugewiesenerVerwalter.paypalMeLink!)}
            target="_blank"
            rel="noreferrer"
            style={{
              marginTop: 4,
              display: 'inline-block',
              fontSize: 11,
              color: 'var(--bwza-ink-dim)',
              textDecoration: 'underline',
            }}
          >
            PayPal erneut öffnen
          </a>
        )}
      </div>
      <StatusChip label={STATUS_LABEL[anfrage.status]} tone={STATUS_TONE[anfrage.status]} />
    </Glass>
  );
}
