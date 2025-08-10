#!/bin/sh
set -e

echo "Waiting for Postgres..."
until pg_isready -h postgres -U postgres; do
  sleep 2
done

echo "Generating migrations if none exist..."
if [ ! -d "./prisma/migrations" ] || [ -z "$(ls -A ./prisma/migrations)" ]; then
  npx prisma migrate dev --name init --create-only
fi

echo "Applying migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate

echo "Starting application..."
exec node server.js
