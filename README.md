# vendomat KI Analytics

KI-gestützte Kassendaten-Analyse für Lightspeed G-Serie.

## Setup

### 1. Repository klonen und Dependencies installieren
```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren
```bash
cp .env.example .env
```
Tragen Sie Ihre Schlüssel ein:
- `VITE_SUPABASE_URL` – Ihre Supabase Projekt-URL
- `VITE_SUPABASE_ANON_KEY` – Ihr Supabase anon key
- `VITE_OPENAI_API_KEY` – Ihr OpenAI API-Schlüssel

### 3. Supabase Datenbank einrichten
Führen Sie `supabase_schema.sql` im Supabase SQL-Editor aus.

### 4. Entwicklungsserver starten
```bash
npm run dev
```

### 5. Produktions-Build
```bash
npm run build
```

## Deployment auf Vercel
1. Repository auf GitHub pushen
2. In Vercel importieren
3. Umgebungsvariablen in Vercel konfigurieren
4. Deploy

## Unterstützte Dateiformate
- CSV (UTF-8 oder Windows-1252)
- Excel (XLSX, XLS)

## Berichtstypen
- Umsatzberichte (Datum, Umsatz, Transaktionen)
- Artikelberichte (Artikelname, Menge, Umsatz)
- Mitarbeiterberichte (Name, Umsatz, Transaktionen)
- Zahlungsartenberichte (Zahlungsart, Betrag, Anteil)
- Warengruppenberichte (Gruppe, Umsatz)
