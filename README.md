# Sarcoma Investigative Research Network

This repository contains a bare‑bones Next.js 14 application scaffolded
manually due to network restrictions in the build environment. It lays out
the basic file structure, configuration and TypeScript setup for a research
project management platform. You will need to install dependencies and
integrate with Supabase and other services in your own environment.

## Getting Started

1. **Install Node.js** (version ≥ 18). Use your package manager or
   [nvm](https://github.com/nvm-sh/nvm) to install.
2. **Install dependencies**. In the root of `sig-research-network`, run:

   ```bash
   npm install
   ```

   This will install Next.js, React, TailwindCSS, and other dependencies
   defined in `package.json`. You may choose to use `pnpm` or `yarn` if
   preferred by adding a lockfile.

3. **Run the development server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to
   see the result.

4. **Configure Supabase**. Create a `.env.local` file at the root of
   `sig-research-network` with the following environment variables:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://njdymuybmsffblxrkmzg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZHltdXlibXNmZmJseHJrbXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMjY3MTEsImV4cCI6MjA3MTkwMjcxMX0.JY999tX87NMo-pKDP106DKHGtHw7quENeE3cty03hio
   ```

   These values point to your Supabase project and allow the client
   libraries to connect. **Do not commit your secret keys** to version
   control.

## File Structure

The key files created in this scaffold are:

- `package.json` – lists dependencies and scripts for building and running
  the app.
- `tsconfig.json` – configures the TypeScript compiler with path aliases.
- `next.config.js` – enables Next.js app directory support.
- `postcss.config.js` & `tailwind.config.js` – configure TailwindCSS.
- `src/app/layout.tsx` – defines the root layout and imports global
  styles.
- `src/app/page.tsx` – placeholder home page.
- `src/app/globals.css` – imports Tailwind base styles.
- `src/db/schema.ts` – defines the PostgreSQL schema using Drizzle ORM.
- `src/lib/supabase-*.ts` – helpers for creating Supabase clients.

You can expand on this by adding pages under `src/app` (e.g.
`/specialty/[slug]/page.tsx`), components under `src/components`, and API
routes under `src/app/api`.

## Next Steps

Due to the lack of internet access in this build environment, packages
could not be downloaded. After cloning this repository into your own
machine, run `npm install` (or `pnpm install` if you add a `pnpm-lock.yaml`)
to fetch dependencies. Then you can begin implementing the pages,
components and Supabase integration as outlined in the project plan.

Refer to the `schema.ts` file for a TypeScript representation of the
database schema and `schema.sql` for a raw SQL migration you can run
in the Supabase SQL editor. After running the migration, define
appropriate Row Level Security (RLS) policies and triggers (e.g. to
enforce senior student supervision).

You will need to configure Supabase credentials via environment
variables (see `.env.local`) and install the `@supabase/auth-helpers-nextjs`
package to use the provided client helpers.