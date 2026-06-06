# OneMail — Bulk Email Marketing Platform

A professional bulk email marketing platform with Firebase backend, built with React + Vite + Tailwind CSS + Node.js/Express.

## Features

- **Authentication** — Firebase Auth (email/password) with admin/sender roles
- **SMTP Account Management** — Add/edit/delete SMTP accounts, test connection, round-robin rotation
- **Contact Management** — Manual add, Excel import (XLSX/CSV), AI business card scanner (Claude API)
- **Email Templates** — Rich text editor (TipTap), variable placeholders, preview mode
- **Campaign Manager** — Create campaigns, select recipients & template, schedule & rate limiting
- **Sending Engine** — Nodemailer SMTP (SSL/TLS port 465), round-robin account rotation, retry logic
- **Analytics Dashboard** — Recharts charts, success rate, daily stats, campaign stats
- **Bilingual RTL** — Arabic/French with full RTL layout support
- **Dark Theme** — Professional dark navy/slate design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Database | Firebase Firestore |
| Auth | Firebase Auth |
| AI | Claude API (Anthropic) |
| Charts | Recharts |
| Editor | TipTap |
| Email | Nodemailer |
| Excel | SheetJS (xlsx) |

## Project Structure

```
onemail/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/        # Layout, Sidebar, Modal
│   │   ├── contexts/          # AuthContext
│   │   ├── hooks/             # Custom hooks
│   │   ├── i18n/              # Arabic/French translations
│   │   ├── lib/               # Firebase config
│   │   └── pages/             # Dashboard, Contacts, Templates, Campaigns, SMTP, Logs
│   ├── .env.example
│   ├── tailwind.config.js
│   └── package.json
├── backend/                   # Node.js Express API
│   ├── src/
│   │   ├── config/            # Firebase admin
│   │   ├── routes/            # API routes (test-smtp, scan-card, send-campaign)
│   │   ├── services/          # Email sender, account rotator
│   │   └── workers/           # Campaign processing worker
│   ├── .env.example
│   └── package.json
├── firestore.rules
├── .env.example
└── README.md
```

## Setup

### Prerequisites
- Node.js 18+
- Firebase project (Firestore + Auth)
- Anthropic API key (for AI card scanner)

### 1. Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Enable **Firestore Database** (start in test mode, then apply `firestore.rules`)
4. Generate a **service account** key (Project Settings → Service Accounts → Generate New Private Key)
5. Copy the service account JSON to `backend/service-account.json`

### 2. Frontend Setup
```bash
cd frontend
cp .env.example .env
# Edit .env with your Firebase config
npm install
npm run dev
```

### 3. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your settings
# Place service-account.json in backend/
npm install
npm start
```

## Environment Variables

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `CLIENT_URL` | Frontend URL for CORS |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON |
| `ANTHROPIC_API_KEY` | Claude API key for AI card scanning |

## Firestore Structure

```
users/{userId}
  ├── email, role, createdAt

smtpAccounts/{accountId}
  ├── name, username, password(encrypted), host, port, secure
  ├── dailyLimit, sentToday, status

contacts/{contactId}
  ├── name, email, phone, company, title, tags[], listId, createdAt

contactLists/{listId}
  ├── name, count, createdAt

templates/{templateId}
  ├── name, subject, htmlBody, createdAt

campaigns/{campaignId}
  ├── name, status, listId, templateId, smtpAccounts[]
  ├── ratePerMinute, scheduledAt, stats{sent,failed,pending}, createdAt

emailLogs/{logId}
  ├── campaignId, recipientEmail, status, smtpAccount, timestamp, error
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test-smtp` | Test SMTP connection |
| POST | `/api/send-campaign` | Start sending a campaign |
| POST | `/api/scan-card` | Scan business card with AI |
| GET | `/api/health` | Health check |

## License

MIT
