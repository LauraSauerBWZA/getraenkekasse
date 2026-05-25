// screens-user.jsx — User-facing screens

const { useState: useStateU, useMemo: useMemoU } = React;

// ─────────── 1. Email Login ───────────
function EmailLoginScreen({ onLogin, onForgot }) {
  const [email, setEmail] = useStateU('lukas.mayer@bergwacht-zollernalb.de');
  const [pw, setPw] = useStateU('');
  const [err, setErr] = useStateU(null);

  const submit = () => {
    if (!email || !pw) { setErr('Bitte Email und Passwort eingeben.'); return; }
    setErr(null);
    onLogin();
  };

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 40px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ marginTop: 30, marginBottom: 22, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 18, borderRadius: 24,
          background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
          boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.08), 0 0 60px rgba(217,138,74,0.18)',
        }}>
          <BergMark size={42} color="#d98a4a" />
        </div>
      </div>

      <Glass tone="dark" style={{ borderRadius: 26, padding: '22px 20px 18px', position: 'relative' }}>
        <ShineEdge radius={26} />
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 26, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4 }}>
            Willkommen zurück.
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
            Bergwacht Zollernalb · Getränkekasse
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GlassInput
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vorname.nachname@…"
          />
          <PasswordInput
            label="Passwort"
            value={pw}
            onChange={e => setPw(e.target.value)}
            error={err}
          />
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <button onClick={onForgot} style={{
              all: 'unset', cursor: 'pointer', fontSize: 11.5, color: 'var(--bwza-ink-mute)', fontWeight: 500,
            }}>Passwort vergessen?</button>
          </div>
          <GlassButton full size="lg" onClick={submit}>Anmelden</GlassButton>
        </div>
      </Glass>

      <div style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--bwza-ink-mute)', lineHeight: 1.5 }}>
        Noch keinen Zugang?<br />
        Sprich deinen Getränkeverwalter an.
      </div>
    </div>
  );
}

// ─────────── 2. Set Password (Magic-Link Landing) ───────────
function SetPasswordScreen({ firstName = 'Lukas', onActivate }) {
  const [pw, setPw] = useStateU('');
  const [pw2, setPw2] = useStateU('');

  const strength = useMemoU(() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw]);

  const strColors = ['oklch(58% 0.18 25)','oklch(70% 0.15 50)','oklch(78% 0.16 70)','oklch(72% 0.14 145)'];
  const strLabels = ['schwach','okay','gut','stark'];

  const match = pw && pw === pw2;
  const ready = strength >= 2 && match;

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 40px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ marginTop: 30, marginBottom: 22, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 16, borderRadius: 22,
          background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
          boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.08), 0 0 60px rgba(217,138,74,0.18)',
        }}>
          <BergMark size={36} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4, lineHeight: 1.05 }}>
          Setze dein Passwort.
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
          Willkommen, {firstName} — leg los.
        </div>
      </div>

      <Glass tone="dark" style={{ borderRadius: 22, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <PasswordInput
            label="Neues Passwort"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 4,
                background: i < strength ? strColors[strength - 1] : 'rgba(255,225,180,0.08)',
                transition: 'background var(--bwza-dur) var(--bwza-ease)',
              }} />
            ))}
            <span style={{ fontSize: 10.5, fontWeight: 600, color: strength > 0 ? strColors[strength - 1] : 'var(--bwza-ink-mute)', marginLeft: 6, minWidth: 50, textAlign: 'right' }}>
              {pw ? strLabels[strength - 1] || strLabels[0] : ''}
            </span>
          </div>
        </div>
        <PasswordInput
          label="Bestätigung"
          value={pw2}
          onChange={e => setPw2(e.target.value)}
          error={pw2 && !match ? 'Passwörter stimmen nicht überein.' : null}
        />
      </Glass>

      <div style={{ marginTop: 16 }}>
        <GlassButton full size="lg" disabled={!ready} onClick={onActivate}>Account aktivieren</GlassButton>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--bwza-ink-mute)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        Der Einladungs-Link ist nur einmal gültig.
      </div>
    </div>
  );
}

// ─────────── 3. Passwort vergessen ───────────
function PasswortVergessenScreen({ onBack, onSent }) {
  const [email, setEmail] = useStateU('');
  const [sent, setSent] = useStateU(false);

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 40px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <button onClick={onBack} style={{
        all: 'unset', cursor: 'pointer', fontSize: 13, color: 'var(--bwza-ink-dim)',
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 18,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        Zurück
      </button>

      {!sent ? (
        <>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4, lineHeight: 1.05 }}>
              Passwort vergessen.
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--bwza-ink-dim)' }}>
              Wir schicken dir einen Link per Mail.
            </div>
          </div>

          <Glass tone="dark" style={{ borderRadius: 22, padding: '18px 16px' }}>
            <GlassInput
              label="E-Mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vorname.nachname@…"
              autoFocus
            />
          </Glass>

          <div style={{ marginTop: 16 }}>
            <GlassButton full size="lg" disabled={!email.includes('@')} onClick={() => setSent(true)}>
              Link senden
            </GlassButton>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            width: 76, height: 76, borderRadius: 999,
            background: 'rgba(120,160,90,0.18)', border: '1px solid rgba(120,160,90,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 60px rgba(120,160,90,0.3)',
            marginBottom: 22,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b8d49a" strokeWidth="2"><path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 26, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4 }}>
            Mail ist raus.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--bwza-ink-dim)', lineHeight: 1.5, maxWidth: 280 }}>
            Wir haben dir einen Link an <strong style={{ color: 'var(--bwza-ink)' }}>{email || 'deine Email'}</strong> geschickt. Schau auch im Spam-Ordner.
          </div>
          <div style={{ marginTop: 22, width: '100%' }}>
            <GlassButton full variant="ghost" onClick={onBack}>Zurück zum Login</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── 4. Home (overhauled) ───────────
function HomeScreen({ member, todayCount, monthCount, onQuick, onNav }) {
  const low = member.balance < 3 && member.balance >= 0;
  const neg = member.balance < 0;
  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)', letterSpacing: 0.3 }}>
          {greeting()},
        </div>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 30, fontWeight: 600, color: 'var(--bwza-ink)', lineHeight: 1.05, letterSpacing: -0.4 }}>
          {member.name.split(' ')[0]}.
        </div>
      </div>

      {/* Balance card */}
      <Glass tone={neg ? 'dark' : 'amber'} style={{ borderRadius: 26, padding: '20px 22px 18px', position: 'relative', overflow: 'hidden' }}>
        <ShineEdge radius={26} />
        <div style={{
          position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: 999,
          background: neg
            ? 'radial-gradient(circle, rgba(216,90,70,0.30), transparent 65%)'
            : 'radial-gradient(circle, rgba(255,180,90,0.45), transparent 65%)',
          filter: 'blur(8px)', pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div className="bwza-eyebrow" style={{ color: neg ? '#ffb89e' : 'var(--bwza-ink-dim)' }}>
              {neg ? 'Im Minus' : 'Dein Guthaben'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              {neg && <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 52, fontWeight: 600, color: '#ff8b6e', lineHeight: 1, letterSpacing: -1.5 }}>−</span>}
              <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 52, fontWeight: 600, color: neg ? '#ff8b6e' : '#fef3d8', lineHeight: 1, letterSpacing: -1.5 }}>
                {fmt(member.balance).split(',')[0]}
              </span>
              <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 500, color: neg ? 'rgba(255,139,110,0.85)' : 'rgba(254,243,216,0.85)', lineHeight: 1 }}>
                ,{fmt(member.balance).split(',')[1]}
              </span>
              <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 22, fontWeight: 500, color: neg ? 'rgba(255,139,110,0.7)' : 'rgba(254,243,216,0.7)', marginLeft: 4 }}>€</span>
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
            background: neg ? 'rgba(216,90,70,0.18)' : low ? 'rgba(232,150,90,0.18)' : 'rgba(0,0,0,0.25)',
            color: neg ? '#ffb89e' : low ? '#ffd2a0' : 'rgba(254,243,216,0.75)',
            border: neg ? '1px solid rgba(216,90,70,0.45)' : low ? '1px solid rgba(232,150,90,0.4)' : '1px solid var(--bwza-glass-line)',
            textTransform: 'uppercase',
          }}>
            {neg ? 'Schulden' : low ? 'Niedrig' : 'Aktiv'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, position: 'relative' }}>
          <GlassButton full variant="primary" onClick={() => onNav('aufladen')}>Aufladen anfragen</GlassButton>
          <GlassButton variant="ghost" onClick={() => onNav('statistik')} style={{ flex: 0.6 }}>Verlauf</GlassButton>
        </div>
      </Glass>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <StatCard eyebrow="Heute" value={todayCount} sub={todayCount === 1 ? 'Getränk' : 'Getränke'} />
        <StatCard eyebrow="Diesen Monat" value={monthCount} sub="×" />
        <StatCard eyebrow="Pro Stk." value="1,50" sub="€" />
      </div>

      {/* Quick book section */}
      <div style={{ marginTop: 22, marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 18, fontWeight: 600, color: 'var(--bwza-ink)' }}>
          Was darf's sein?
        </div>
        <button onClick={() => onNav('buchen')} style={{
          all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--bwza-amber-glow)', fontWeight: 600,
        }}>alle anzeigen ›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {DRINKS_DATA.slice(0, 6).map(d => (
          <DrinkTile key={d.id} drink={d} onTap={() => onQuick(d)} />
        ))}
      </div>
    </div>
  );
}

function DrinkTile({ drink, onTap }) {
  const [pressed, setPressed] = useStateU(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onTap}
      style={{
        all: 'unset', cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
        padding: '14px 8px 12px', borderRadius: 18,
        background: 'rgba(20,14,10,0.55)',
        border: '1px solid var(--bwza-glass-line)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.07), 0 8px 18px rgba(0,0,0,0.3)',
        textAlign: 'center',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform .12s ease, background .15s ease',
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, filter: 'saturate(1.1)' }}>{drink.glyph}</div>
      <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: 0.1 }}>{drink.name}</div>
      <div style={{ fontSize: 9.5, color: 'var(--bwza-ink-mute)', marginTop: 1 }}>1,50 €</div>
    </button>
  );
}

// ─────────── 5. Buchen ───────────
function BuchenScreen({ member, onTap }) {
  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', lineHeight: 1.05, letterSpacing: -0.4 }}>
          An der Theke.
        </div>
        <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)', marginTop: 4 }}>
          Tippe dein Getränk — wird sofort von deinem Guthaben abgezogen.
        </div>
      </div>

      <Glass tone="raise" style={{ borderRadius: 18, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="bwza-eyebrow">Guthaben</div>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 20, fontWeight: 600, color: member.balance < 0 ? '#ff8b6e' : 'var(--bwza-ink)' }}>
          {fmtBal(member.balance)} €
        </div>
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {DRINKS_DATA.map(d => (
          <button key={d.id} onClick={() => onTap(d)} style={{
            all: 'unset', cursor: 'pointer',
            position: 'relative', overflow: 'hidden',
            padding: '16px 14px 14px', borderRadius: 20,
            background: 'rgba(20,14,10,0.6)',
            border: '1px solid var(--bwza-glass-line)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgba(255,225,180,0.07), 0 10px 22px rgba(0,0,0,0.35)',
            transition: 'transform .12s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{d.glyph}</div>
              <div style={{
                padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                background: 'rgba(217,138,74,0.18)', color: '#f4b56a',
                border: '1px solid rgba(217,138,74,0.3)',
              }}>1,50 €</div>
            </div>
            <div style={{ marginTop: 12, fontFamily: 'var(--bwza-font-display)', fontSize: 17, fontWeight: 600, color: 'var(--bwza-ink)' }}>{d.name}</div>
            <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)', marginTop: 2 }}>{d.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────── 6. Aufladung anfragen (request-based) ───────────
function AufladungAnfragenScreen({ member, onSend, lastRequest }) {
  const [amount, setAmount] = useStateU(10);
  const [custom, setCustom] = useStateU('');
  const [method, setMethod] = useStateU('cash');
  const [note, setNote] = useStateU('');

  const finalAmount = custom ? Number(custom.replace(',','.')) || 0 : amount;

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', lineHeight: 1.05, letterSpacing: -0.4 }}>
          Guthaben aufladen.
        </div>
        <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)', marginTop: 4 }}>
          Anfrage an den Getränkeverwalter.
        </div>
      </div>

      {lastRequest && (
        <Glass tone="raise" style={{ borderRadius: 16, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 999,
            background: 'rgba(232,180,90,0.18)', border: '1px solid rgba(232,180,90,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f4b56a" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bwza-ink)' }}>Anfrage gestellt</div>
            <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>
              {fmt(lastRequest.amount)} € · {lastRequest.method === 'cash' ? 'Bargeld' : 'PayPal'} · wartet auf Bestätigung
            </div>
          </div>
        </Glass>
      )}

      <Glass tone="amber" style={{ borderRadius: 24, padding: '18px 20px', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
        <ShineEdge radius={24} />
        <div className="bwza-eyebrow" style={{ color: 'rgba(243,227,200,0.7)' }}>
          Aktuell · {fmtBal(member.balance)} €
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 16, color: 'rgba(254,243,216,0.75)' }}>Nach Aufladen</span>
          <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 36, fontWeight: 600, color: '#fef3d8', letterSpacing: -0.8 }}>
            {fmt(member.balance + finalAmount)} €
          </span>
        </div>
      </Glass>

      <div className="bwza-eyebrow" style={{ marginBottom: 10 }}>Betrag wählen</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[5,10,20,50].map(a => {
          const on = a === amount && !custom;
          return (
            <button key={a} onClick={() => { setAmount(a); setCustom(''); }} style={{
              all: 'unset', cursor: 'pointer', textAlign: 'center',
              padding: '14px 0', borderRadius: 14,
              background: on ? 'linear-gradient(180deg, rgba(217,138,74,0.4), rgba(217,138,74,0.12))' : 'rgba(20,14,10,0.55)',
              border: on ? '1px solid rgba(244,181,106,0.55)' : '1px solid var(--bwza-glass-line)',
              boxShadow: on ? 'inset 0 1px 0 rgba(255,225,180,0.25), 0 0 22px rgba(217,138,74,0.22)' : 'inset 0 1px 0 rgba(255,225,180,0.06)',
              backdropFilter: 'blur(12px)',
            }}>
              <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 22, fontWeight: 600, color: on ? '#fef3d8' : 'var(--bwza-ink)' }}>{a}</span>
              <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 13, color: 'var(--bwza-ink-dim)', marginLeft: 2 }}>€</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <GlassInput
          label="Eigener Betrag"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          placeholder="z. B. 15"
          suffix={<span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 15, color: 'var(--bwza-ink-mute)' }}>€</span>}
        />
      </div>

      <div className="bwza-eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>Methode</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'cash', label: 'Bargeld', icon: '💶' },
          { id: 'paypal', label: 'PayPal manuell', icon: '🅿️' },
        ].map(m => {
          const on = method === m.id;
          return (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              all: 'unset', cursor: 'pointer', flex: 1,
              padding: '12px 14px', borderRadius: 14,
              background: on ? 'linear-gradient(180deg, rgba(217,138,74,0.3), rgba(217,138,74,0.08))' : 'rgba(20,14,10,0.55)',
              border: on ? '1px solid rgba(244,181,106,0.5)' : '1px solid var(--bwza-glass-line)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink)' }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <GlassInput
          label="Notiz (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="z. B. lade heute Abend an der Hütte auf"
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <GlassButton
          full
          size="lg"
          disabled={finalAmount <= 0}
          onClick={() => onSend({ amount: finalAmount, method, note })}
        >
          Anfrage senden
        </GlassButton>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--bwza-ink-mute)', textAlign: 'center' }}>
          Guthaben wird gutgeschrieben, sobald die Hüttenwartin bestätigt.
        </div>
      </div>
    </div>
  );
}

// ─────────── 7. Statistik (Verlauf + Stats + Achievements) ───────────
function StatistikScreen({ member, history }) {
  // last 30 days bars
  const days = useMemoU(() => {
    const arr = [];
    const now = new Date(); now.setHours(0,0,0,0);
    const byDay = {};
    history.filter(h => h.memberId === member.id && h.type === 'drink').forEach(h => {
      const d = new Date(h.ts); d.setHours(0,0,0,0);
      const k = d.getTime();
      byDay[k] = (byDay[k] || 0) + 1;
    });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      arr.push({ d, count: byDay[d.getTime()] || 0 });
    }
    return arr;
  }, [history, member.id]);

  const maxCount = Math.max(1, ...days.map(d => d.count));
  const myHistory = history.filter(h => h.memberId === member.id);

  // favorite drink
  const fav = useMemoU(() => {
    const counts = {};
    myHistory.filter(h => h.type === 'drink').forEach(h => { counts[h.label] = (counts[h.label] || 0) + 1; });
    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
    if (!top) return null;
    const drink = DRINKS_DATA.find(d => d.name === top[0]);
    return { name: top[0], glyph: drink?.glyph || '🥃', count: top[1] };
  }, [myHistory]);

  const monthCount = myHistory.filter(h => h.type === 'drink' && new Date(h.ts).getMonth() === new Date().getMonth()).length;
  const streak = useMemoU(() => {
    const dayKeys = new Set(days.filter(d => d.count > 0).map(d => d.d.getTime()));
    let s = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dayKeys.has(d.getTime())) s++;
      else if (i > 0) break;
    }
    return s;
  }, [days]);

  const achievements = [
    { id: 'first', label: 'Erste Aufladung', glyph: '🎉', earned: true },
    { id: 'ten',   label: '10 Getränke',     glyph: '🍻', earned: true },
    { id: 'month', label: '1 Monat dabei',   glyph: '📆', earned: true },
    { id: 'all8',  label: 'Alle 8 probiert', glyph: '🎯', earned: false },
    { id: 'streak7', label: '7 Tage Streak', glyph: '🔥', earned: streak >= 7 },
    { id: 'rescuer', label: 'Bergretter',    glyph: '⛰️', earned: true },
  ];

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <div style={{ marginTop: 6, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', lineHeight: 1.05, letterSpacing: -0.4 }}>
          Deine Statistik.
        </div>
      </div>

      {/* Top stat cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Glass style={{ borderRadius: 18, padding: '12px 14px', flex: 1 }}>
          <div className="bwza-eyebrow">Diesen Monat</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 30, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.5 }}>{monthCount}</span>
            <span style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>Getränke</span>
          </div>
        </Glass>
        <Glass style={{ borderRadius: 18, padding: '12px 14px', flex: 1 }}>
          <div className="bwza-eyebrow">Streak</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 30, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.5 }}>{streak}</span>
            <span style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{streak === 1 ? 'Tag' : 'Tage'}</span>
          </div>
        </Glass>
      </div>

      {fav && (
        <Glass tone="amber" style={{ borderRadius: 18, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
          <ShineEdge radius={18} />
          <div style={{ fontSize: 38, lineHeight: 1 }}>{fav.glyph}</div>
          <div style={{ flex: 1 }}>
            <div className="bwza-eyebrow" style={{ color: 'rgba(243,227,200,0.7)' }}>Lieblingsgetränk</div>
            <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 22, fontWeight: 600, color: '#fef3d8', letterSpacing: -0.3 }}>{fav.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(254,243,216,0.7)' }}>{fav.count}× insgesamt</div>
          </div>
        </Glass>
      )}

      {/* 30-day chart */}
      <Glass style={{ borderRadius: 20, padding: '14px 14px 12px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div className="bwza-eyebrow">Letzte 30 Tage</div>
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>{days.reduce((s,d)=>s+d.count,0)} Getränke</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70 }}>
          {days.map((d, i) => {
            const h = Math.max(2, (d.count / maxCount) * 64);
            const isWeekStart = d.d.getDay() === 1;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch' }}>
                <div style={{
                  height: h,
                  borderRadius: 3,
                  background: d.count > 0
                    ? 'linear-gradient(180deg, #f4b56a, rgba(217,138,74,0.5))'
                    : 'rgba(255,225,180,0.08)',
                  boxShadow: d.count > 0 ? '0 0 8px rgba(217,138,74,0.3)' : 'none',
                  borderBottom: isWeekStart ? '1px solid rgba(255,225,180,0.18)' : 'none',
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: 'var(--bwza-ink-mute)' }}>
          <span>vor 30 T.</span>
          <span>heute</span>
        </div>
      </Glass>

      {/* Achievements */}
      <div className="bwza-eyebrow" style={{ marginBottom: 8, paddingLeft: 2 }}>Auszeichnungen</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginLeft: -2, marginRight: -2, scrollbarWidth: 'none' }}>
        {achievements.map(a => (
          <div key={a.id} style={{
            flex: '0 0 96px',
            padding: '12px 8px 10px', borderRadius: 16,
            background: a.earned ? 'rgba(20,14,10,0.6)' : 'rgba(20,14,10,0.3)',
            border: a.earned ? '1px solid rgba(244,181,106,0.3)' : '1px dashed rgba(255,225,180,0.1)',
            textAlign: 'center',
            opacity: a.earned ? 1 : 0.4,
            backdropFilter: 'blur(12px)',
            boxShadow: a.earned ? 'inset 0 1px 0 rgba(255,225,180,0.08), 0 0 14px rgba(217,138,74,0.12)' : 'none',
          }}>
            <div style={{ fontSize: 28, lineHeight: 1, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.glyph}</div>
            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: 'var(--bwza-ink)', lineHeight: 1.2 }}>{a.label}</div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="bwza-eyebrow" style={{ marginTop: 18, marginBottom: 8, paddingLeft: 2 }}>Verlauf</div>
      {myHistory.length === 0 ? (
        <Glass style={{ borderRadius: 20, padding: 0 }}>
          <EmptyState title="Noch nichts gebucht." sub="Wenn du was trinkst, taucht's hier auf." />
        </Glass>
      ) : (
        <Glass style={{ borderRadius: 22, padding: 6, overflow: 'hidden' }}>
          {myHistory.slice(0, 12).map((h, i) => (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px',
              borderBottom: i < Math.min(11, myHistory.length - 1) ? '1px solid rgba(255,210,160,0.08)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flex: '0 0 36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: h.type === 'topup' ? 'rgba(120,160,90,0.18)' : h.type === 'adjust' ? 'rgba(140,140,180,0.18)' : 'rgba(217,138,74,0.16)',
                border: h.type === 'topup' ? '1px solid rgba(120,160,90,0.35)' : h.type === 'adjust' ? '1px solid rgba(140,140,180,0.35)' : '1px solid rgba(217,138,74,0.3)',
                fontSize: 18,
              }}>
                {h.type === 'topup' ? '＋' : h.type === 'adjust' ? '≈' : h.glyph}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink)' }}>{h.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--bwza-ink-mute)' }}>{h.when}</div>
              </div>
              <div style={{
                fontFamily: 'var(--bwza-font-display)', fontSize: 15, fontWeight: 600,
                color: h.amount > 0 ? '#a8c98a' : 'var(--bwza-ink)',
              }}>
                {fmtSigned(h.amount)} €
              </div>
            </div>
          ))}
        </Glass>
      )}
    </div>
  );
}

Object.assign(window, {
  EmailLoginScreen, SetPasswordScreen, PasswortVergessenScreen,
  HomeScreen, BuchenScreen, AufladungAnfragenScreen, StatistikScreen,
});
