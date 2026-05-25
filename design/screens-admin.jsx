// screens-admin.jsx — Admin-Bereich

const { useState: useStateA, useMemo: useMemoA } = React;

// Sample admin data
const TOPUP_REQUESTS_OPEN = [
  { id: 'r1', memberId: 'anna',   amount: 10, method: 'cash',   note: 'lade heute Abend an der Hütte auf', ts: Date.now() - 2 * 3600 * 1000 },
  { id: 'r2', memberId: 'marie',  amount: 20, method: 'paypal', note: 'bitte schnell — Konto im Minus',     ts: Date.now() - 5 * 3600 * 1000 },
  { id: 'r3', memberId: 'jonas',  amount: 50, method: 'cash',   note: '',                                   ts: Date.now() - 18 * 3600 * 1000 },
  { id: 'r4', memberId: 'vroni',  amount: 5,  method: 'paypal', note: 'für die nächste Übung',              ts: Date.now() - 30 * 3600 * 1000 },
];
const TOPUP_REQUESTS_DONE = [
  { id: 'r5', memberId: 'florian', amount: 50, method: 'paypal', note: '', ts: Date.now() - 4 * 24 * 3600 * 1000, status: 'approved' },
  { id: 'r6', memberId: 'tobias',  amount: 20, method: 'cash',   note: '', ts: Date.now() - 5 * 24 * 3600 * 1000, status: 'approved' },
  { id: 'r7', memberId: 'sabine',  amount: 10, method: 'cash',   note: 'doppelt eingegeben', ts: Date.now() - 6 * 24 * 3600 * 1000, status: 'rejected' },
];

const LOG_ENTRIES = [
  { id: 'l1', kind: 'drink', memberId: 'lukas',   label: 'Pils',        amount: -1.5, ts: Date.now() - 2 * 3600 * 1000, glyph: '🍺' },
  { id: 'l2', kind: 'topup', memberId: 'florian', label: 'Aufladung',   amount: 50,   ts: Date.now() - 4 * 3600 * 1000 },
  { id: 'l3', kind: 'drink', memberId: 'anna',    label: 'Kaffee',      amount: -1.5, ts: Date.now() - 5 * 3600 * 1000, glyph: '☕' },
  { id: 'l4', kind: 'drink', memberId: 'florian', label: 'Pils',        amount: -1.5, ts: Date.now() - 6 * 3600 * 1000, glyph: '🍺' },
  { id: 'l5', kind: 'adjust',memberId: 'marie',   label: 'Korrektur Doppelbuchung', amount: 1.5, ts: Date.now() - 8 * 3600 * 1000, note: 'lukas hat ausversehen 2x gedrückt' },
  { id: 'l6', kind: 'drink', memberId: 'tobias',  label: 'Weizen',      amount: -1.5, ts: Date.now() - 9 * 3600 * 1000, glyph: '🍻' },
  { id: 'l7', kind: 'topup', memberId: 'tobias',  label: 'Aufladung',   amount: 20,   ts: Date.now() - 11 * 3600 * 1000 },
  { id: 'l8', kind: 'drink', memberId: 'jonas',   label: 'Apfelschorle',amount: -1.5, ts: Date.now() - 14 * 3600 * 1000, glyph: '🍏' },
  { id: 'l9', kind: 'drink', memberId: 'lukas',   label: 'Spezi',       amount: -1.5, ts: Date.now() - 16 * 3600 * 1000, glyph: '🥤' },
  { id: 'l10',kind: 'drink', memberId: 'sabine',  label: 'Wasser',      amount: -1.5, ts: Date.now() - 22 * 3600 * 1000, glyph: '💧' },
  { id: 'l11',kind: 'adjust',memberId: 'vroni',   label: 'Manuelle Anpassung', amount: -3, ts: Date.now() - 28 * 3600 * 1000, note: 'Schulden aus letztem Monat' },
  { id: 'l12',kind: 'drink', memberId: 'anna',    label: 'Pils',        amount: -1.5, ts: Date.now() - 30 * 3600 * 1000, glyph: '🍺' },
];

function relTime(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return Math.floor(diff/60) + ' Min.';
  if (diff < 86400) return 'vor ' + Math.floor(diff/3600) + ' Std.';
  return 'vor ' + Math.floor(diff/86400) + ' Tagen';
}
const memberOf = (id) => ALL_MEMBERS.find(m => m.id === id);

// ─────────── 8. Admin · Members list ───────────
function AdminMembersScreen({ onPickMember, onInvite }) {
  const [q, setQ] = useStateA('');
  const filtered = ALL_MEMBERS.filter(m => m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <AdminBanner />
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4 }}>
          Mitglieder.
        </div>
        <div style={{ fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
          {ALL_MEMBERS.length} aktiv
        </div>
      </div>

      <GlassInput
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Suchen…"
        suffix={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bwza-ink-mute)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
        }
      />

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(m => (
          <Glass key={m.id} interactive style={{ borderRadius: 16, padding: '12px 14px', cursor: 'pointer' }}
            onClick={() => onPickMember(m)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar member={m} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--bwza-ink)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
              <div style={{
                fontFamily: 'var(--bwza-font-display)', fontSize: 17, fontWeight: 600,
                color: m.balance < 0 ? '#ff8b6e' : 'var(--bwza-ink)',
              }}>{fmtBal(m.balance)} €</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bwza-ink-mute)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </Glass>
        ))}
        {filtered.length === 0 && (
          <Glass style={{ borderRadius: 18, padding: 0 }}>
            <EmptyState title="Keine Treffer." sub={`Niemand mit "${q}" gefunden.`} />
          </Glass>
        )}
      </div>

      {/* FAB */}
      <button onClick={onInvite} style={{
        all: 'unset', cursor: 'pointer', position: 'absolute', right: 24, bottom: 110, zIndex: 25,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '14px 18px 14px 16px', borderRadius: 999,
        background: 'linear-gradient(180deg, #f4b56a, #d98a4a)',
        color: '#3a200a', fontSize: 13.5, fontWeight: 700,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 12px 30px rgba(217,138,74,0.5)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Einladen
      </button>
    </div>
  );
}

// ─────────── 9. Admin · Invite member ───────────
function AdminInviteScreen({ onBack, onSend }) {
  const [first, setFirst] = useStateA('');
  const [last, setLast] = useStateA('');
  const [email, setEmail] = useStateA('');
  const ready = first && last && email.includes('@');
  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <AdminBanner />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4, lineHeight: 1.05 }}>
          Mitglied einladen.
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--bwza-ink-mute)' }}>
          Magic-Link per Email — Account wird beim ersten Login erstellt.
        </div>
      </div>

      <Glass style={{ borderRadius: 22, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <GlassInput label="Vorname" value={first} onChange={e => setFirst(e.target.value)} placeholder="Anna" />
          </div>
          <div style={{ flex: 1 }}>
            <GlassInput label="Nachname" value={last} onChange={e => setLast(e.target.value)} placeholder="Schober" />
          </div>
        </div>
        <GlassInput
          label="E-Mail"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="vorname.nachname@bw-za.de"
        />
      </Glass>

      <Glass tone="raise" style={{ borderRadius: 16, padding: '12px 14px', marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 1, color: 'var(--bwza-amber-glow)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
        </div>
        <div style={{ fontSize: 12, color: 'var(--bwza-ink-dim)', lineHeight: 1.5 }}>
          Es wird ein Magic-Link an die Email-Adresse geschickt. Der Link ist <strong style={{ color: 'var(--bwza-ink)' }}>7 Tage gültig</strong> und kann nur einmal verwendet werden.
        </div>
      </Glass>

      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <GlassButton variant="ghost" onClick={onBack}>Abbrechen</GlassButton>
        <GlassButton full size="lg" disabled={!ready} onClick={() => onSend({ first, last, email })}>
          Einladung verschicken
        </GlassButton>
      </div>
    </div>
  );
}

// ─────────── 10. Admin · Topup requests ───────────
function AdminRequestsScreen({ onApprove, onReject }) {
  const [tab, setTab] = useStateA('open');
  const list = tab === 'open' ? TOPUP_REQUESTS_OPEN : TOPUP_REQUESTS_DONE;

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <AdminBanner />
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4, lineHeight: 1.05 }}>
          Aufladungs-Anfragen.
        </div>
      </div>

      {/* Tab switch */}
      <div style={{
        display: 'flex', padding: 4, borderRadius: 14,
        background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
        marginBottom: 14,
      }}>
        {[
          { id: 'open', label: 'Offen', count: TOPUP_REQUESTS_OPEN.length },
          { id: 'done', label: 'Erledigt', count: TOPUP_REQUESTS_DONE.length },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
              padding: '10px 0', borderRadius: 10,
              background: on ? 'linear-gradient(180deg, rgba(217,138,74,0.35), rgba(217,138,74,0.1))' : 'transparent',
              border: on ? '1px solid rgba(244,181,106,0.4)' : '1px solid transparent',
              fontSize: 12.5, fontWeight: 600, color: on ? 'var(--bwza-ink)' : 'var(--bwza-ink-mute)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 999,
                background: on ? 'rgba(255,225,180,0.15)' : 'rgba(255,225,180,0.07)',
                color: on ? 'var(--bwza-ink-dim)' : 'var(--bwza-ink-mute)',
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <Glass style={{ borderRadius: 20, padding: 0 }}>
          <EmptyState title="Nichts offen." sub="Alle Anfragen sind bearbeitet — Feierabend, Wartin." />
        </Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(r => {
            const m = memberOf(r.memberId);
            if (!m) return null;
            const done = r.status === 'approved' || r.status === 'rejected';
            return (
              <Glass key={r.id} style={{ borderRadius: 20, padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar member={m} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bwza-ink)' }}>{m.name}</div>
                      <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 20, fontWeight: 600, color: '#fef3d8', letterSpacing: -0.2 }}>
                        {fmt(r.amount)} €
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                        background: r.method === 'cash' ? 'rgba(120,160,90,0.15)' : 'rgba(80,120,180,0.18)',
                        color: r.method === 'cash' ? '#b8d49a' : '#a8c0e0',
                        border: r.method === 'cash' ? '1px solid rgba(120,160,90,0.3)' : '1px solid rgba(80,120,180,0.35)',
                      }}>
                        {r.method === 'cash' ? '💶 Bargeld' : '🅿️ PayPal'}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--bwza-ink-mute)' }}>· {relTime(r.ts)}</span>
                    </div>
                    {r.note && (
                      <div style={{
                        marginTop: 8, padding: '8px 10px', borderRadius: 10,
                        background: 'rgba(0,0,0,0.25)', border: '1px solid var(--bwza-glass-line)',
                        fontSize: 12, color: 'var(--bwza-ink-dim)', fontStyle: 'italic',
                      }}>"{r.note}"</div>
                    )}
                  </div>
                </div>
                {!done && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <GlassButton full variant="ghost" size="sm" onClick={() => onReject(r)}>Ablehnen</GlassButton>
                    <GlassButton full variant="primary" size="sm" onClick={() => onApprove(r)}>Bestätigen</GlassButton>
                  </div>
                )}
                {done && (
                  <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10,
                    background: r.status === 'approved' ? 'rgba(120,160,90,0.12)' : 'rgba(216,90,70,0.10)',
                    color: r.status === 'approved' ? '#b8d49a' : '#ffb89e',
                    fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {r.status === 'approved' ? '✓ Bestätigt' : '✕ Abgelehnt'}
                  </div>
                )}
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────── 11. Admin · Transaction log ───────────
function AdminLogScreen() {
  const [filter, setFilter] = useStateA('all');
  const [q, setQ] = useStateA('');

  const filtered = LOG_ENTRIES.filter(e => {
    if (filter === 'drink' && e.kind !== 'drink') return false;
    if (filter === 'topup' && e.kind !== 'topup') return false;
    if (filter === 'adjust' && e.kind !== 'adjust') return false;
    if (q) {
      const m = memberOf(e.memberId);
      if (!m?.name.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const filters = [
    { id: 'all', label: 'Alle' },
    { id: 'drink', label: 'Käufe' },
    { id: 'topup', label: 'Aufladungen' },
    { id: 'adjust', label: 'Anpassungen' },
  ];

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <AdminBanner />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--bwza-ink)', letterSpacing: -0.4 }}>
          Transaktionen.
        </div>
        <button style={{
          all: 'unset', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 999,
          background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
          fontSize: 11.5, color: 'var(--bwza-ink-dim)', fontWeight: 600,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
          CSV
        </button>
      </div>

      <GlassInput
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Nach Mitglied suchen…"
        suffix={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bwza-ink-mute)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
        }
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {filters.map(f => {
          const on = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              all: 'unset', cursor: 'pointer', whiteSpace: 'nowrap',
              padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: on ? 'linear-gradient(180deg, rgba(217,138,74,0.35), rgba(217,138,74,0.1))' : 'rgba(20,14,10,0.55)',
              border: on ? '1px solid rgba(244,181,106,0.45)' : '1px solid var(--bwza-glass-line)',
              color: on ? 'var(--bwza-ink)' : 'var(--bwza-ink-dim)',
            }}>{f.label}</button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        {filtered.length === 0 ? (
          <Glass style={{ borderRadius: 18, padding: 0 }}>
            <EmptyState title="Nichts gefunden." sub="Filter ändern oder Suche anpassen." />
          </Glass>
        ) : (
          <Glass style={{ borderRadius: 20, padding: 6 }}>
            {filtered.map((e, i) => {
              const m = memberOf(e.memberId);
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 10px',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,210,160,0.07)' : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flex: '0 0 32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: e.kind === 'topup' ? 'rgba(120,160,90,0.18)'
                      : e.kind === 'adjust' ? 'rgba(140,140,180,0.18)'
                      : 'rgba(217,138,74,0.16)',
                    border: e.kind === 'topup' ? '1px solid rgba(120,160,90,0.35)'
                      : e.kind === 'adjust' ? '1px solid rgba(140,140,180,0.35)'
                      : '1px solid rgba(217,138,74,0.3)',
                    fontSize: 14,
                  }}>
                    {e.kind === 'topup' ? '＋' : e.kind === 'adjust' ? '≈' : e.glyph}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bwza-ink)' }}>{m?.name.split(' ')[0]}</span>
                      <span style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>· {e.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--bwza-ink-mute)' }}>{relTime(e.ts)}</div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--bwza-font-display)', fontSize: 14.5, fontWeight: 600,
                    color: e.amount > 0 ? '#a8c98a' : 'var(--bwza-ink)',
                  }}>{fmtSigned(e.amount)} €</div>
                </div>
              );
            })}
          </Glass>
        )}
      </div>
    </div>
  );
}

// ─────────── 12. Admin · Adjust balance ───────────
function AdminAdjustScreen({ member, onBack, onSave }) {
  const [delta, setDelta] = useStateA('');
  const [note, setNote] = useStateA('');
  const parsed = Number(String(delta).replace(',','.').replace(/\s/g,'')) || 0;
  const after = member.balance + parsed;
  const ready = parsed !== 0 && note.trim().length > 0;

  return (
    <div style={{ padding: '0 var(--bwza-page-x) 110px' }}>
      <AdminBanner />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          all: 'unset', cursor: 'pointer', padding: 6, marginLeft: -6,
          borderRadius: 999, color: 'var(--bwza-ink)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <Avatar member={member} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bwza-ink)' }}>{member.name}</div>
          <div style={{ fontSize: 11, color: 'var(--bwza-ink-mute)' }}>Guthaben anpassen</div>
        </div>
      </div>

      {/* Current balance */}
      <Glass tone="raise" style={{ borderRadius: 22, padding: '16px 18px', marginBottom: 14, textAlign: 'center' }}>
        <div className="bwza-eyebrow">Aktuell</div>
        <div style={{
          fontFamily: 'var(--bwza-font-display)', fontSize: 42, fontWeight: 600, letterSpacing: -1, marginTop: 4,
          color: member.balance < 0 ? '#ff8b6e' : 'var(--bwza-ink)',
        }}>
          {fmtBal(member.balance)} €
        </div>
      </Glass>

      {/* Delta input */}
      <div style={{ marginBottom: 12 }}>
        <GlassInput
          label="Betrag (signed, z. B. +5 oder -2,50)"
          value={delta}
          onChange={e => setDelta(e.target.value)}
          placeholder="+5  oder  -2,50"
          suffix={<span style={{ fontFamily: 'var(--bwza-font-display)', fontSize: 16, color: 'var(--bwza-ink-mute)' }}>€</span>}
          autoFocus
        />
      </div>

      {/* Quick steppers */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[-5, -1.5, +1.5, +5, +10].map(v => (
          <button key={v} onClick={() => setDelta((parsed + v).toString().replace('.',','))} style={{
            all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center',
            padding: '8px 0', borderRadius: 10,
            fontFamily: 'var(--bwza-font-display)', fontSize: 13, fontWeight: 600,
            color: v < 0 ? '#ff8b6e' : '#a8c98a',
            background: 'rgba(20,14,10,0.55)', border: '1px solid var(--bwza-glass-line)',
          }}>{v > 0 ? '+' : ''}{String(v).replace('.', ',')}</button>
        ))}
      </div>

      {/* After preview */}
      {parsed !== 0 && (
        <Glass tone={parsed > 0 ? 'amber' : 'dark'} style={{ borderRadius: 18, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="bwza-eyebrow" style={{ color: parsed > 0 ? 'rgba(254,243,216,0.8)' : 'var(--bwza-ink-dim)' }}>Nach Anpassung</div>
          <div style={{
            fontFamily: 'var(--bwza-font-display)', fontSize: 22, fontWeight: 600,
            color: after < 0 ? '#ff8b6e' : parsed > 0 ? '#fef3d8' : 'var(--bwza-ink)',
          }}>{fmtBal(after)} €</div>
        </Glass>
      )}

      {/* Required note */}
      <GlassInput
        label="Warum? (Pflichtfeld)"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="z. B. Bar bezahlt, Korrektur Doppelbuchung"
        hint="Wird im Transaktions-Log gespeichert."
      />

      <div style={{ marginTop: 18 }}>
        <GlassButton full size="lg" disabled={!ready} variant={parsed < 0 ? 'danger' : 'primary'} onClick={onSave}>
          Anpassung speichern
        </GlassButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminMembersScreen, AdminInviteScreen, AdminRequestsScreen, AdminLogScreen, AdminAdjustScreen,
});
