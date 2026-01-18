# Elixopay Project Summary

## Overview
Elixopay is a modern, secure payment gateway designed for high-performance and developer-friendly integration. It supports multiple payment methods, including credit cards and PromptPay (TH), and provides a robust dashboard for merchants.

## Architecture
- **Frontend**: HTML5, Tailwind CSS, Vanilla JS.
  - Multi-language support (TH, EN, ZH) via `i18n.js`.
  - Dynamic UI components in `ui.js`.
  - Secure authentication flow (JWT).
- **Backend**: Node.js (Express).
  - PostgreSQL database.
  - Stripe integration for payments.
  - Webhook handling for real-time updates.
  - Secure audit logging.

## Key Features
1.  **Payment Processing**: 
    - Full Stripe integration (Payment Intents, Webhooks).
    - PromptPay QR generation.
    - Commission accrual system for agencies.
2.  **Dashboard**:
    - Real-time transaction tracking.
    - Wallet management (Deeposit/Withdraw/Transfer).
    - Dynamic currency exchange (THB/USDT).
    - Analytics and reporting.
3.  **Security**:
    - JWT Authentication.
    - Role-based access control.
    - Webhook signature verification.
    - Audit logging for sensitive actions.
4.  **Developer Tools**:
    - Webhook configuration for merchants.
    - API keys management.
    - Comprehensive API documentation.

## Recent Updates
- **Internationalization**: Full translation support across all pages.
- **Wallet Features**: 
  - Instant Deposit via PromptPay (2-step verification).
  - USDT/THB Exchange logic.
  - Transfer system between users.
- **Backend Enhancements**:
  - Implementation of email notification system.
  - Merchant webhooks for post-payment notifications.
  - Audit logging system.

## Setup
See `START_HERE.md` for detailed instructions on how to run the project locally.
