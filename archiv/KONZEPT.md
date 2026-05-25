# Bergwacht Getränkekasse – Konzept & Spezifikation

**Projekt:** Bergwacht Getränkekasse – Digitale Kneipentheke  
**Version:** 1.0  
**Datum:** Mai 2026  
**Status:** ✅ Fertig

---

## 📋 Überblick

Die **Bergwacht Getränkekasse** ist eine mobile-first Web-App für die DRK Bergwacht Zollernalb. Sie digitalisiert die traditionelle Bargeld-Getränkekasse und transformiert sie in eine gamifizierte, spaßige Erfahrung – gestaltet wie eine **digitale Berghütten-Kneipentheke**.

**Ziel:** Getränkekauf einfacher, lustiger und kostenloses Tracking ermöglichen. Mitglieder laden Guthaben auf (via PayPal/Bar), kaufen Getränke und konkurrieren um den Titel "Bierkönig des Monats".

---

## 🎯 Kern-Features (MVP)

### 1. **Authentifizierung**
- Registrierung mit E-Mail + Passwort
- Login/Logout
- Passwort-Reset
- Session-Management mit JWT

### 2. **Dashboard (Startseite)**
- Aktuelles Guthaben anzeigen (rot wenn negativ)
- Schneller Zugriff auf Getränk-Kauf
- "Rund geben"-Button
- Aktueller Status in Leaderboard
- Ranking-Toggle (Opt-In/Opt-Out)
- Animierte Willkommens-Nachricht

### 3. **Getränk-Kauf**
- 3 Kategorien zur Auswahl
- Ein Klick = Getränk kaufen
- Instant-Feedback mit Animation + Sound
- Guthaben wird sofort reduziert
- Negatives Guthaben erlaubt (mit Erinnerung)

### 4. **Guthaben-Aufladung**
- Dialog: "Wie viel aufladen?" (€5, €10, €20, custom)
- PayPal (manuell) oder Bargeld-Option
- Nachricht an Getränkeverwalter
- Admin bestätigt in Panel
- Transaktion wird geloggt

### 5. **Admin-Panel (Getränkeverwalter)**
- Sicht aller Mitglieder + Guthaben
- Guthaben manuell aufladen (mit Notiz)
- Auflädungs-Anfragen verwalten
- Transaktions-Log / Audit Trail
- Statistiken exportieren

### 6. **Leaderboard**
- Top 5 Konsumenten diesen Monat
- Anonymisiert (Vorname + Anfangsbuchstabe)
- Bierkönig-Krone mit Animation
- Nur für angemeldete Mitglieder
- Opt-In/Opt-Out möglich

### 7. **Gamification**
- Bierkönig/Königin des Monats (Krone, Fanfare)
- Achievements/Badges
- Wöchentliche Challenges
- Statistik-Seite mit Charts
- Rund-Geben Feature

### 8. **Besonderheit: Negatives Guthaben**
- User können mit negativem Guthaben weitermachen
- Bei Kauf mit Minus: Erinnerungs-Dialog
- Warning-Sound
- Rote Anzeige im Dashboard
- Admin sieht Schulden-Übersicht

### 9. **Besonderheit: Ranking-Opt-In**
- User können selbst entscheiden ob sichtbar
- Default: Opt-In (aber User können abschalten)
- Opt-Out User sind "Anonym #X"
- Keine Bierkönig-Benachrichtigung wenn Opt-Out

### 10. **Besonderheit: Zahlungs-Methoden**
- PayPal: Manuell (User überweist, Admin bestätigt)
- Bargeld: User zahlt bar, Admin trägt in App ein
- Kein direkter PayPal-Checkout (zu komplex für MVP)

---

## 🎨 Design-Konzept

### **Ästhetik: "Digitale Bergwacht-Kneipentheke"**

**Farbpalette:**
- Bergwacht-Grün: #00784b (Primär)
- Orange: #f59100 (Akzent)
- Warm-Creme: #f5f1e8 (Hintergrund)
- Dunkles Braun: #3d2817 (Holz)
- DRK-Rot: #e60005 (Warnungen)

**Typografie:**
- Headlines: Merriweather (Serif, warm)
- Body: Helvetica/Arial (Sans, lesbar)

**Elemente:**
- Holz-Rahmen um alle Komponenten
- Karabiner-Icons
- Berg-Silhouetten
- Höhenlinien als Wasserzeichen
- Seil-Muster als Divider

**Sound-Design:**
- Glass-Clink (Getränk-Kauf, 0,5s)
- Fanfare (Bierkönig, 2s)
- Warning (Negatives Guthaben, 1s)
- Success (Guthaben aufgeladen, 0,5s)

**Animationen:**
- Konfetti-Effekt (Getränk-Kauf)
- Krone-Blink (Bierkönig)
- Smooth Transitions überall

---

## 💾 Datenmodell

```sql
-- USERS
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  guthaben DECIMAL(10,2) DEFAULT 0.00,  -- KANN NEGATIV SEIN!
  is_admin BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_opt_in_ranking BOOLEAN DEFAULT TRUE,  -- Sichtbar im Ranking?
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- GETRAENKE
CREATE TABLE getraenke (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  kategorie VARCHAR(50),  -- 'alkoholfrei', 'alkoholisch', 'wasser'
  preis DECIMAL(5,2) NOT NULL,
  icon VARCHAR(10),  -- Emoji
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRANSAKTIONEN
CREATE TABLE transaktionen (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  typ VARCHAR(50),  -- 'kauf', 'aufladung', 'rund_geben', 'admin_anpassung'
  betrag DECIMAL(10,2),
  getraenk_id INT,
  empfaenger_user_id INT,  -- Für 'rund_geben'
  zahlungs_methode VARCHAR(50),  -- 'paypal', 'bar', 'bankueberweisung'
  notiz TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (getraenk_id) REFERENCES getraenke(id)
);

-- AUFLADUNGS_ANFRAGEN
CREATE TABLE aufladungs_anfragen (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  betrag DECIMAL(10,2) NOT NULL,
  status VARCHAR(50),  -- 'pending', 'bestätigt', 'abgelehnt'
  zahlungs_methode VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  bestätigt_am TIMESTAMP,
  bestätigt_von INT,
  notiz TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (bestätigt_von) REFERENCES users(id)
);

-- ACHIEVEMENTS
CREATE TABLE achievements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  beschreibung TEXT,
  bedingung VARCHAR(255),
  kategorie VARCHAR(50),  -- 'monthly', 'weekly', 'once'
  created_at TIMESTAMP DEFAULT NOW()
);

-- USER_ACHIEVEMENTS
CREATE TABLE user_achievements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);
```

---

## 🚀 Tech-Stack

**Frontend:**
- React 18
- Vite
- TailwindCSS + Custom CSS
- Framer Motion (Animationen)
- React Router v6
- PWA-fähig

**Backend:**
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL / SQLite
- JWT Auth + bcrypt
- CORS, Error-Handler

**Infrastructure:**
- Hetzner (Server)
- Let's Encrypt (SSL)
- Daily Backups

---

## 🎯 Projektphasen

### **Phase 1: Grundgerüst (1-2 Tage)**
Frontend + Backend Setup, Login, DB-Schema

### **Phase 2: MVP-Features (2-3 Tage)**
Getränk-Kauf, Guthaben, Admin-Panel

### **Phase 3: Gamification (2-3 Tage)**
Leaderboard, Achievements, Sound, Statistiken

### **Phase 4: Design-Integration (1-2 Tage)**
CSS, Farben, Icons, PWA-Config

### **Phase 5: Testphase (3-5 Tage)**
Live Testing mit Mitgliedern, Bugs fixen

### **Phase 6: Go-Live (1 Tag)**
Domain, SSL, Backup, Launch

**Gesamt: ~2-3 Wochen**

---

## ✅ ALLE ENTSCHEIDUNGEN GEKLÄRT

### **Server & Domain**
- ✅ Server: Hetzner (ready)
- ✅ Domain: Noch zu registrieren (z.B. bergwacht-getraenke.de)
- ✅ SSL: Let's Encrypt (kostenlos)

### **Admin-Verwaltung**
- ✅ Eine Admin-Person (Getränkeverwalter)
- ✅ Berechtigungen: Guthaben aufladen, Nutzer sehen, Reports

### **Getränke-Katalog (FINAL)**
- ✅ Alkoholfrei: €1,50
- ✅ Alkoholisch: €2,00
- ✅ Wasser: €0,50

### **Datenschutz**
- ✅ Nur Mitglieder sichtbar
- ✅ Anonymisierung: "Markus M." (nicht "Markus Meier")
- ✅ Admin sieht volle Namen

### **Zahlungs-Methoden**
- ✅ PayPal: Manuell (kein Direct Checkout)
- ✅ Bargeld: Weiterhin möglich
- ✅ Gebühren: Minimal

### **Ranking**
- ✅ Opt-In/Opt-Out (User entscheiden)
- ✅ Default: Opt-In
- ✅ Opt-Out User: Anonym

### **Guthaben-System**
- ✅ Negativ erlaubt (nicht blockiert)
- ✅ Erinnerungsdialog bei Minus
- ✅ Warning-Sound
- ✅ Rote Farbe im Dashboard

---

## 📝 Akzeptanzkriterien (MVP)

- [ ] Login/Registrierung funktioniert
- [ ] Getränk-Kauf funktioniert (Guthaben wird reduziert)
- [ ] Guthaben-Aufladung mit Admin-Bestätigung
- [ ] Leaderboard zeigt Top 5 (anonymisiert)
- [ ] Negatives Guthaben erlaubt (nicht blockiert)
- [ ] Erinnerungsdialog bei Guthaben < €0
- [ ] Admin-Panel funktioniert
- [ ] Transaktions-Log ist sichtbar
- [ ] Sound + Animationen funktionieren
- [ ] Mobile-First (optimiert für Smartphone)
- [ ] PWA-fähig ("Add to Home Screen")
- [ ] HTTPS (SSL-Zertifikat)

---

**Stand:** 19.05.2026 | **Status:** ✅ KONZEPT FERTIG
