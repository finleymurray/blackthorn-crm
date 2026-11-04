#!/usr/bin/env bash
# Netlify build. Set SEED_ON_BUILD=1 in the site's environment variables to
# reset the demo data as part of the deploy (migrations always run; they are
# a no-op when the database is up to date).
set -euo pipefail
npm run db:migrate
if [ "${SEED_ON_BUILD:-}" = "1" ]; then
  echo "SEED_ON_BUILD=1: resetting the demo data"
  npm run db:seed
fi
npm run build
