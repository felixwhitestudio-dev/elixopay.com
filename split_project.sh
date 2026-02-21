#!/bin/bash
set -e

# Rename backend to app-server
mv backend app-server

# Create public directories
mkdir -p public-site
mkdir -p app-server/public

# Copy shared frontend assets
cp -R assets images js styles public-site/
cp -R assets images js styles app-server/public/

# Move S1 (Public) HTML files
S1_FILES="index.html about.html pricing.html docs.html contact.html usecases.html partners.html blog.html help.html privacy.html terms.html status.html security.html developer.html quickstart.html 404.html"
for f in $S1_FILES; do
  if [ -f "$f" ]; then
    mv "$f" "public-site/"
  fi
done

# Move S2 (App) HTML files
S2_FILES="login.html signup.html dashboard.html admin-dashboard.html admin-liquidity.html admin-payouts.html admin-pending.html partner-dashboard.html partner-management.html partner-portal.html profile.html complete-profile.html checkout.html transactions.html transfer.html kyc.html kbank-test.html stripe-test.html test-api.html template.html print-template.html api-keys.html partner.html"
for f in $S2_FILES; do
  if [ -f "$f" ]; then
    mv "$f" "app-server/public/"
  fi
done

# Move directories docs, kyc
if [ -d "docs" ]; then mv docs public-site/; fi
if [ -d "kyc" ]; then mv kyc app-server/public/; fi

# Rename references in root files or package.json
# Note: we might need to manually update import paths using another step, just moving now.

echo "Splitting completed successfully!"
