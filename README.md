# Multi-Mailbox Management System

A powerful and modern email management system that consolidates multiple email accounts (IMAP, Gmail) into a single, unified interface. Built with a focus on performance, user experience, and extensibility.

## Features

- **Unified Inbox**: Manage multiple email accounts from different providers in one place.
- **Protocol Support**:
  - Full IMAP support for standard email providers.
  - Google/Gmail OAuth2 integration for secure access.
- **Real-time Updates**: WebSocket-based real-time notifications for new emails and sync status.
- **Email Management**:
  - Organize with Labels and custom folders.
  - Star/Unstar emails.
  - Mark as Read/Unread.
  - Powerful filtering and search capabilities.
- **Attachment Handling**: Automatic extraction and secure storage of attachments (S3 compatible).
- **Background Sync**: Robust background services for polling and syncing emails.
- **Developer API**: RESTful API with API Key management for external integrations.
- **Modern UI**: Beautiful, responsive interface built with React 19, Tailwind CSS, and Radix UI.

## Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS, Tailwind Animate
- **Components**: Radix UI, Shadcn/ui ecosystem
- **State Management**: TanStack Query (React Query), tRPC Client
- **Routing**: wouter
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Server**: Express
- **API**: tRPC (Type-safe API), WebSocket (Real-time)
- **Validation**: Zod
- **Auth**: JOSE (JWT/Session)
- **Email Engine**: imapflow, mailparser, Google APIs

### Database & Storage
- **Database**: MySQL
- **ORM**: Drizzle ORM
- **Storage**: AWS S3 SDK (compatible with AWS S3, MinIO, Cloudflare R2, etc.)

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- pnpm (Package Manager)
- MySQL Database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-mailbox
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:

   ```env
   # Database Configuration
   DATABASE_URL=mysql://user:password@host:port/dbname

   # Security
   JWT_SECRET=your_secure_jwt_secret
   # User with this OpenID will be automatically granted admin/owner privileges
   OWNER_OPEN_ID=your_admin_openid

   # Optional: local default admin seed (username/password), disabled by default
   ADMIN_SEED_ENABLED=false
   ADMIN_SEED_USERNAME=admin
   ADMIN_SEED_PASSWORD=change_me_to_a_strong_password
   ADMIN_SEED_DISPLAY_NAME=Administrator

   # Server Configuration
   PORT=3000
   NODE_ENV=development
   VITE_APP_ID=your_app_id
   OAUTH_SERVER_URL=http://localhost:3000

   # Google OAuth2 (Optional, for Gmail support)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # AWS S3 / Storage (Optional, for attachments)
   # AWS_ACCESS_KEY_ID=...
   # AWS_SECRET_ACCESS_KEY=...
   # AWS_REGION=...
   # AWS_BUCKET_NAME=...
   ```

   Notes for `ADMIN_SEED_*`:
   - Keep `ADMIN_SEED_ENABLED=false` unless you want bootstrap initialization.
   - Seed runs at server startup and is idempotent (safe on restart, no duplicate credential creation).
   - Avoid hardcoding weak passwords; use a strong password and disable seed after initialization.
   - The server logs a security reminder after seed succeeds to help you close bootstrap mode.

   Login rate limiting:
   - Password login failures are throttled per `username + client IP`.
   - After 5 failed attempts within 10 minutes, login is blocked for 15 minutes.

4. **Database Setup**
   Apply migrations to your MySQL database:
   ```bash
   pnpm db:migrate
   ```

   If you changed schema definitions and need to generate migration files first:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

### Running the Application

**Development Mode**
Starts the frontend and backend with hot-reloading.
```bash
pnpm dev
```

**Production Build**
Builds the frontend and backend for production.
```bash
pnpm build
```

**Start Production Server**
```bash
pnpm start
```

## Project Structure

- `client/`: Frontend React application
  - `components/`: Reusable UI components
  - `pages/`: Application routes and views
  - `hooks/`: Custom React hooks
- `server/`: Backend Node.js application
  - `_core/`: Core infrastructure (Auth, WebSocket, Config)
  - `services/`: Business logic (IMAP sync, polling, email processing)
  - `api/`: REST API endpoints
  - `routers.ts`: tRPC router definitions
- `shared/`: Shared types and constants between client and server
- `drizzle/`: Database schema and migrations

## License

MIT
