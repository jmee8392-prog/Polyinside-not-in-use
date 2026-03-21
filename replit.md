# Polymarket Insider Tracker

## Overview
A 24/7 wallet monitoring system that detects fresh wallets, behavioral shifts, and whale clustering on Polymarket prediction markets. Includes real-time WebSocket updates, SQLite persistence, and optional Telegram bot alerts.

## Architecture

- **Backend**: Node.js (Express + WebSocket + SQLite) on port 3001
- **Frontend**: React + Vite + Tailwind CSS on port 5000 (dev)
- **Database**: SQLite (`polymarket_tracker.db`)

## Key Files

- `polymarket_backend.js` — Express REST API, WebSocket server, detection logic, SQLite DB
- `frontend/src/App.jsx` — React dashboard (wallets, alerts, clusters, markets tabs)
- `frontend/vite.config.js` — Vite dev server config with proxy to backend

## Running Locally

Two workflows are configured:
1. **Backend API** — `node polymarket_backend.js` (port 3001)
2. **Start application** — `cd frontend && npm run dev` (port 5000)

## Environment Variables

See `.env.example` for all options. Key ones:
- `PORT` — Backend port (default: 3001)
- `TELEGRAM_BOT_TOKEN` — Optional: enables Telegram alerts
- `NODE_ENV` — Environment mode

## Features

- Real-time wallet detection via WebSocket
- Fresh wallet detection (0 previous bets)
- Behavioral shift detection (hold time pattern changes)
- Whale clustering (behavior similarity grouping)
- Market metrics (volume, dominance per market)
- Alert system with severity levels
- Optional Telegram bot with free/pro tiers
- SQLite persistent storage

## Deployment

Configured for VM deployment (always-on, needed for WebSocket + SQLite).
