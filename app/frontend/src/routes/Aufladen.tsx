import { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, ExternalLink, MessageCircle } from 'lucide-react';
import { Eyebrow, Glass, GlassButton } from '../components/primitives';
import {
  api,
  ApiError,
  formatGuthaben,
  paypalMeUrlOhneBetrag,
  waMeUrl,
  type VerwalterPublic,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRefreshOnFocus } from '../lib/useRefreshOnFocus';

// Aufladen-Tab (Bündel 5): KEINE Anfrage-Maschinerie mehr. Das Mitglied überweist
// direkt per paypal.me an den zuständigen Verwalter (neuer Tab → App friert nicht
// ein) und gibt ihm/ihr per WhatsApp Bescheid; der Verwalter bucht dann admin-
// direkt. Reines Anzeigen + zwei „Öffnen"-Knöpfe, kein Stell-/Status-Zustand.
export default function Aufladen() {
  const { user, refresh } = useAuth();
  const [verwalter, setVerwalter] = useState<VerwalterPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const v = await api.aufladungZustaendigerVerwalter();
      setVerwalter(v.verwalter);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Aufladen-Seite konnte nicht geladen werden.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Beim Zurückkehren in die App frisch (Guthaben + zuständiger Verwalter).
  useRefreshOnFocus(() => {
    void load();
    void refresh();
  });

  if (!user) return null;

  const hatLink = Boolean(verwalter?.paypalMeLink);
  const verwalterName = verwalter ? verwalter.firstName : '';
  const waText = `Hi ${verwalterName}, ich hab dir gerade per PayPal Geld für die Getränkekasse überwiesen. 🙂`;
  const waUrl = verwalter?.whatsappNummer ? waMeUrl(verwalter.whatsappNummer, waText) : null;

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

      {/* PayPal — direkt überweisen, danach dem Verwalter Bescheid geben. */}
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
              Gleich geht's zu PayPal. Überweise einen <strong>beliebigen Betrag</strong> an{' '}
              <span style={{ color: 'var(--bwza-ink)' }}>paypal.me/{verwalter.paypalMeLink}</span> — und
              gib {verwalter.firstName} danach kurz per WhatsApp Bescheid, dann wird dein Guthaben
              aufgeladen.
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Neuer Tab (_blank): paypal.me öffnet, ohne die App zu verlassen/einzufrieren. */}
              <GlassButton
                full
                size="lg"
                onClick={() =>
                  window.open(paypalMeUrlOhneBetrag(verwalter.paypalMeLink!), '_blank', 'noopener')
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ExternalLink size={18} strokeWidth={2} aria-hidden />
                  Zu PayPal
                </span>
              </GlassButton>

              {waUrl ? (
                <GlassButton
                  variant="ghost"
                  full
                  size="lg"
                  onClick={() => window.open(waUrl, '_blank', 'noopener')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MessageCircle size={18} strokeWidth={2} aria-hidden />
                    {verwalter.firstName} per WhatsApp Bescheid geben
                  </span>
                </GlassButton>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--bwza-ink-mute)', lineHeight: 1.45 }}>
                  Für {verwalter.firstName} ist keine WhatsApp-Nummer hinterlegt — sag ihr/ihm nach der
                  Überweisung kurz persönlich Bescheid.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--bwza-rescue-soft)', lineHeight: 1.45 }}>
            Aktuell ist kein PayPal-Link hinterlegt — bitte per Bargeld aufladen (unten) oder
            deinen Verwalter ansprechen.
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
    </div>
  );
}
