# Solana Tracer

> If you just need this for once and don't want the hassle to set up, just use [neighbor-wallet-checker](neighbor-wallet-checker/).

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- Solana Web3.js
- PostgreSQL database

### Frontend
- React 19
- TypeScript
- Vite
- TailwindCSS
- React Router

## Prerequisites

Before you begin, ensure you have the following installed:
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- An Alchemy API key for Solana ([Get yours free at Alchemy](https://www.alchemy.com/solana))

## Setup

### 1. Environment Variables

First, create your environment configuration file:

```bash
cp .env.example .env
```

Then edit the `.env` file and configure the following variables:

- **`ALCHEMY_API_KEY`** (required): Your Alchemy Solana API key
- **`POSTGRES_PASSWORD`** (required): Set a secure password for your database
- Other variables are optional with sensible defaults

Example `.env` file:
```env
ALCHEMY_API_KEY=your_alchemy_api_key_here
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=solana_tools
POSTGRES_USER=solana_user
DATABASE_URL=postgresql://solana_user:your_secure_password_here@localhost:5432/solana_tools
```

### 2. Run Setup Script

The automated setup script will handle everything for you:

```bash
bash setup.sh
```

This script will:
- Check for required dependencies (Docker, Docker Compose)
- Start PostgreSQL container via Docker Compose
- Install all npm dependencies (root, backend, and frontend)
- Run Prisma migrations to set up the database schema
- Generate Prisma client

## Usage

### Starting the Application

To start both the backend and frontend in development mode:

```bash
npm run dev
```

This will start:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173

### Using the Application

1. Navigate to http://localhost:5173 in your browser
2. Enter a Solana wallet address in the search bar
3. The application will analyze the wallet's transactions and store the results
4. Navigate to the "Data Explorer" tab to view saved wallet data and relationships

### Standalone CLI Tool

If you need a quick command-line analysis without setting up the full application, See [neighbor-wallet-checker/README.md](neighbor-wallet-checker/README.md) for detailed usage.

## Database Management

### Accessing the Database

To connect to the PostgreSQL database directly:

```bash
docker exec -it solana-tools-postgres psql -U solana_user -d solana_tools
```

### Viewing Docker Logs

```bash
docker compose logs -f
```

### Stopping the Database

```bash
docker compose down
```

### Resetting the Database

To completely reset the database and remove all data:

```bash
docker compose down -v
npm run prisma:reset  # Or: npx prisma migrate reset
```

## Database Schema

The application uses the following main tables:

- **`wallets`**: Store wallet addresses, balances, and metadata
- **`transactions`**: Individual transaction records
- **`wallet_relationships`**: Aggregated data about interactions between wallets
- **`wallet_labels`**: Custom labels and categories for wallets
- **`wallet_analysis_cache`**: Cache for analysis results to improve performance

See [prisma/schema.prisma](prisma/schema.prisma) for the complete schema definition.

## Project Structure

```
solana-tracer/
├── backend/              # Express API server
│   ├── src/
│   │   ├── app.ts       # Main application entry
│   │   ├── services/    # Business logic (WalletAnalyzer, etc.)
│   │   └── utils/       # Utility functions
│   └── tests/           # Backend tests
├── frontend/            # React frontend
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       └── App.tsx      # Main app component
├── prisma/              # Database schema and migrations
│   └── schema.prisma    # Prisma schema definition
├── neighbor-wallet-checker/  # Standalone CLI tool
├── docker-compose.yml   # Docker services configuration
└── setup.sh            # Automated setup script
```

## Troubleshooting

### Docker Permission Issues

If you encounter Docker permission errors:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Then run the setup script again.

### Port Already in Use

If ports 3000 or 5173 are already in use, you can:
1. Stop the conflicting service
2. Modify the ports in `backend/src/app.ts` and `frontend/vite.config.ts`

### Database Connection Issues

Ensure Docker is running and the PostgreSQL container is up:

```bash
docker ps | grep solana-tools-postgres
```

If not running, start it with:

```bash
docker compose up -d
```

## Acknowledgments

- Built with [Solana Web3.js](https://github.com/solana-labs/solana-web3.js)
- Powered by [Alchemy Solana API](https://www.alchemy.com/solana)