# Hamasui Kirokukai (浜水記録会)

## Overview
A record search and admin PDF generation app for swimming meets. Built with Next.js 14, Prisma ORM, and PostgreSQL.

## Project Architecture
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **PDF Generation**: Playwright (Chromium)
- **Styling**: CSS (globals.css)

## Project Structure
```
app/           - Next.js app router pages and API routes
  admin/       - Admin login and management pages
  api/         - API endpoints
lib/           - Utility modules (storage, prisma, csv, pdf, etc.)
prisma/        - Prisma schema
samples/       - Sample CSV files for import
tests/         - Vitest test files
```

## Key Configuration
- **Dev server**: `npm run dev` (port 5000, host 0.0.0.0)
- **Production**: `npm run build && npm run start` (port 5000)
- **Database**: PostgreSQL via `DATABASE_URL` env var
- **Admin access**: Protected by `ADMIN_PASSWORD` env var

## Recent Changes
- 2026-02-07: Initial Replit setup - configured port 5000, Prisma DB push, deployment config
