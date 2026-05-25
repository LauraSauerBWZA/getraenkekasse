// app.jsx — Bergwacht Zollernalb · Getränkekasse · v2
// Statisches Screen-Set für Produkt-Design. State minimal, Screen-Switch über Tweaks oder Bottom-Nav.

const { useState, useEffect, useMemo } = React;

const SCREEN_OPTIONS = [
  // user
  { id: 'login',      group: 'Auth',  label: '1 · Login' },
  { id: 'set-pw',     group: 'Auth',  label: '2 · Passwort setzen' },
  { id: 'forgot',     group: 'Auth',  label: '3 · Passwort vergessen' },
  { id: 'home',       group: 'User',  label: '4 · Theke (Home)' },
  { id: 'buchen',     group: 'User',  label: '5 · Buchen' },
  { id: 'confirm-pos',group: 'User',  label: '5a · Buchen-Bestätigung' },
  { id: 'confirm-neg',group: 'User',  label: '5b · Im Minus buchen' },
  { id: 'aufladen',   group: 'User',  label: '6 · Aufladung anfragen' },
  { id: 'aufladen-sent', group: 'User', label: '6a · Anfrage gestellt' },
  { id: 'statistik',  group: 'User',  label: '7 · Statistik & Verlauf' },
  { id: 'drawer',     group: 'User',  label: '7a · Profil-Drawer' },
  // admin
  { id: 'a-members',  group: 'Admin', label: '8 · Mitglieder' },
  { id: 'a-invite',   group: 'Admin', label: '9 · Einladen' },
  { id: 'a-requests', group: 'Admin', label: '10 · Anfragen' },
  { id: 'a-log',      group: 'Admin', label: '11 · Log' },
  { id: 'a-adjust',   group: 'Admin', label: '12 · Anpassen' },
];

function App() {
  const [t, setTweak] = window.useTweaks(/*EDITMODE-BEGIN*/{
    "screen": "home",
    "mode": "auto",
    "ambience": "evening",
    "negative": false
  }/*EDITMODE-END*/);

  // Mock state — these screens are static mockups, but a few states are useful
  const [flash, setFlash] = useState(null);
  const [pendingDrink, setPendingDrink] = useState(null);

  const me = t.negative ? ME_NEG : ME;

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(id);
  }, [flash]);

  // Setup synthetic history for stats (consistent regardless of screen)
  const history = useMemo(() => seedHistory(me.id), [me.id]);

  const screen = t.screen;
  const isAdminScreen = screen.startsWith('a-');
  const navMode = t.mode === 'auto'
    ? (isAdminScreen ? 'admin' : 'user')
    : t.mode;

  const showBottomNav = ['home', 'buchen', 'aufladen', 'aufladen-sent', 'statistik', 'a-members', 'a-requests', 'a-log'].includes(screen);
  const showTopBarAvatar = !['login', 'set-pw', 'forgot'].includes(screen);

  const navigate = (s) => setTweak('screen', s);

  const onAvatarTap = () => navigate('drawer');
  const onDrawerClose = () => navigate('home');
  const onDrawerAction = (a) => {
    if (a === 'admin') navigate('a-members');
    else if (a === 'logout') navigate('login');
    else { setFlash({ title: 'Demo-Aktion', sub: a, glyph: 'ℹ️' }); navigate('home'); }
  };

  const bookDrink = (d) => {
    setFlash({ title: d.name + ' angeschrieben', sub: 'Wohl bekomm\'s.', glyph: d.glyph });
    setPendingDrink(null);
  };

  const sendTopup = (req) => {
    setFlash({ title: 'Anfrage gestellt', sub: fmt(req.amount) + ' € · warten auf Bestätigung', glyph: '✉️' });
    setTweak('screen', 'aufladen-sent');
  };

  const onApproveRequest = (r) => {
    const m = ALL_MEMBERS.find(x => x.id === r.memberId);
    setFlash({ title: fmt(r.amount) + ' € aufgeladen', sub: 'bei ' + (m?.name.split(' ')[0] || 'Mitglied'), glyph: '✓' });
  };
  const onRejectRequest = (r) => {
    const m = ALL_MEMBERS.find(x => x.id === r.memberId);
    setFlash({ title: 'Anfrage abgelehnt', sub: m?.name.split(' ')[0] + ' wurde informiert', glyph: '✕', tone: 'danger' });
  };

  const onInviteSend = ({ first, last, email }) => {
    setFlash({ title: 'Einladung verschickt', sub: first + ' ' + last + ' · ' + email, glyph: '✉️' });
    navigate('a-members');
  };

  const onAdjustSave = () => {
    setFlash({ title: 'Anpassung gespeichert', sub: 'Im Transaktions-Log abgelegt.', glyph: '✓' });
    navigate('a-members');
  };

  // Pre-set drink for confirm overlays
  const sampleDrink = DRINKS_DATA[0]; // Pils

  // For admin-adjust we need a target member
  const [adjustTarget, setAdjustTarget] = useState(ALL_MEMBERS[1]);

  return (
    <>
      <IOSDevice width={390} height={844} dark={true}>
        <BarBackdrop ambience={t.ambience} />

        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
          {showTopBarAvatar && (
            <TopBar
              member={me}
              onAvatar={onAvatarTap}
              admin={isAdminScreen}
              sub={subFor(screen)}
              onBack={screen === 'a-adjust' ? () => navigate('a-members') : null}
            />
          )}

          {!showTopBarAvatar && (
            <div style={{ height: 54 }} /> /* status bar spacer */
          )}

          <div className="screen-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {/* Auth */}
            {screen === 'login'  && <EmailLoginScreen onLogin={() => navigate('home')} onForgot={() => navigate('forgot')} />}
            {screen === 'set-pw' && <SetPasswordScreen firstName={me.name.split(' ')[0]} onActivate={() => navigate('home')} />}
            {screen === 'forgot' && <PasswortVergessenScreen onBack={() => navigate('login')} />}

            {/* User */}
            {screen === 'home' && (
              <HomeScreen
                member={me}
                todayCount={4}
                monthCount={28}
                onQuick={(d) => setPendingDrink(d)}
                onNav={navigate}
              />
            )}
            {screen === 'buchen' && (
              <BuchenScreen member={me} onTap={(d) => setPendingDrink(d)} />
            )}
            {screen === 'aufladen' && (
              <AufladungAnfragenScreen member={me} onSend={sendTopup} />
            )}
            {screen === 'aufladen-sent' && (
              <AufladungAnfragenScreen
                member={me}
                onSend={sendTopup}
                lastRequest={{ amount: 10, method: 'cash' }}
              />
            )}
            {screen === 'statistik' && (
              <StatistikScreen member={me} history={history} />
            )}

            {/* Admin */}
            {screen === 'a-members' && (
              <AdminMembersScreen
                onPickMember={(m) => { setAdjustTarget(m); navigate('a-adjust'); }}
                onInvite={() => navigate('a-invite')}
              />
            )}
            {screen === 'a-invite' && <AdminInviteScreen onBack={() => navigate('a-members')} onSend={onInviteSend} />}
            {screen === 'a-requests' && <AdminRequestsScreen onApprove={onApproveRequest} onReject={onRejectRequest} />}
            {screen === 'a-log' && <AdminLogScreen />}
            {screen === 'a-adjust' && (
              <AdminAdjustScreen member={adjustTarget} onBack={() => navigate('a-members')} onSave={onAdjustSave} />
            )}

            {/* Synthetic preview screens */}
            {screen === 'confirm-pos' && (
              <HomeScreen member={me} todayCount={4} monthCount={28} onQuick={() => {}} onNav={navigate} />
            )}
            {screen === 'confirm-neg' && (
              <HomeScreen member={ME_NEG} todayCount={4} monthCount={28} onQuick={() => {}} onNav={navigate} />
            )}
            {screen === 'drawer' && (
              <HomeScreen member={me} todayCount={4} monthCount={28} onQuick={() => {}} onNav={navigate} />
            )}
          </div>

          {showBottomNav && (
            <BottomNav
              active={screen}
              mode={navMode}
              onChange={navigate}
            />
          )}
        </div>

        {/* Overlays */}
        <Flash flash={flash} />

        {pendingDrink && (
          <DrinkConfirm
            drink={pendingDrink}
            balance={me.balance}
            onConfirm={() => bookDrink(pendingDrink)}
            onCancel={() => setPendingDrink(null)}
          />
        )}

        {/* Synthetic overlays for tweaks-picked previews */}
        {screen === 'confirm-pos' && (
          <DrinkConfirm drink={sampleDrink} balance={me.balance} onConfirm={() => navigate('home')} onCancel={() => navigate('home')} />
        )}
        {screen === 'confirm-neg' && (
          <DrinkConfirm drink={sampleDrink} balance={ME_NEG.balance} onConfirm={() => navigate('home')} onCancel={() => navigate('home')} />
        )}
        {screen === 'drawer' && (
          <ProfileDrawer
            member={me}
            open
            isAdmin={me.isAdmin}
            onClose={onDrawerClose}
            onAction={onDrawerAction}
          />
        )}
      </IOSDevice>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Screen" />
          <window.TweakSelect
            label="Anzeigen"
            value={t.screen}
            options={SCREEN_OPTIONS.map(s => ({ value: s.id, label: s.label }))}
            onChange={(v) => setTweak('screen', v)}
          />
          <window.TweakSection label="Demo-Konto" />
          <window.TweakToggle
            label="Guthaben im Minus"
            value={t.negative}
            onChange={(v) => setTweak('negative', v)}
          />
          <window.TweakSection label="Stimmung" />
          <window.TweakRadio
            label="Lichtstimmung"
            value={t.ambience}
            options={['evening', 'morning']}
            onChange={(v) => setTweak('ambience', v)}
          />
          <window.TweakRadio
            label="Bottom-Nav-Modus"
            value={t.mode}
            options={['auto', 'user', 'admin']}
            onChange={(v) => setTweak('mode', v)}
          />
        </window.TweaksPanel>
      )}

      <style>{`
        @keyframes flashIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadein {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes shimmer {
          from { background-position: -200% 0; }
          to   { background-position: 200% 0; }
        }
      `}</style>
    </>
  );
}

function subFor(screen) {
  const map = {
    home: 'Theke',
    buchen: 'Buchen',
    aufladen: 'Aufladen',
    'aufladen-sent': 'Aufladen',
    statistik: 'Statistik',
    'a-members':  'Mitglieder',
    'a-invite':   'Einladen',
    'a-requests': 'Anfragen',
    'a-log':      'Log',
    'a-adjust':   'Anpassen',
    drawer: 'Theke',
  };
  return map[screen] || 'Getränkekasse';
}

function BarBackdrop({ ambience }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'url(assets/bar-bg.png) center / cover no-repeat, #0c0a08',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: ambience === 'morning'
          ? 'linear-gradient(180deg, rgba(20,16,12,0.55) 0%, rgba(20,16,12,0.35) 50%, rgba(45,30,20,0.4) 100%)'
          : 'linear-gradient(180deg, rgba(15,11,8,0.85) 0%, rgba(15,11,8,0.55) 30%, rgba(35,22,15,0.6) 70%, rgba(50,30,18,0.55) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 60% at 50% 100%, transparent 30%, rgba(0,0,0,0.55) 90%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -30, left: -40, width: 220, height: 220, borderRadius: 999,
        background: 'radial-gradient(circle, rgba(255,180,90,0.28), transparent 60%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function seedHistory(memberId) {
  const drinks = ['Pils','Spezi','Weizen','Apfelschorle','Pils','Cola','Kaffee','Pils','Wasser','Pils','Weizen','Spezi'];
  const glyphs = { Pils:'🍺', Spezi:'🥤', Weizen:'🍻', Apfelschorle:'🍏', Cola:'🥃', Kaffee:'☕', Wasser:'💧', Limonade:'🍋' };
  const out = [];
  const now = Date.now();
  // 12 drinks over 14 days
  drinks.forEach((name, i) => {
    const hoursAgo = (i + 1) * 6 + (i % 3) * 2;
    out.push({
      id: 'h_'+i, memberId, type:'drink', label:name, amount:-1.5, glyph: glyphs[name],
      ts: now - hoursAgo * 3600 * 1000,
      when: new Date(now - hoursAgo * 3600 * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }),
    });
  });
  out.push({
    id: 'h_t1', memberId, type:'topup', label:'Aufladung', amount:20,
    ts: now - 26 * 3600 * 1000,
    when: new Date(now - 26 * 3600 * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }),
  });
  out.push({
    id: 'h_a1', memberId, type:'adjust', label:'Korrektur Doppelbuchung', amount:1.5,
    ts: now - 36 * 3600 * 1000,
    when: new Date(now - 36 * 3600 * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }),
  });
  return out.sort((a,b) => b.ts - a.ts);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
