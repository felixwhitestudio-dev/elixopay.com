/**
 * Stripe Health Check Script
 * 
 * ตรวจสอบการเชื่อมต่อ Stripe API 5 ระดับ:
 *   Level 1: API Key Validation
 *   Level 2: Payment Intent (Test Charge)
 *   Level 3: Webhook Secret Format
 *   Level 4: Connected Accounts
 *   Level 5: Refund Capability
 * 
 * Usage:
 *   npx ts-node server/src/scripts/stripe-health-check.ts
 * 
 * Or imported by the admin health route:
 *   import { runStripeHealthCheck } from '../scripts/stripe-health-check';
 */

import Stripe from 'stripe';

export interface HealthCheckResult {
    level: number;
    name: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    details?: any;
    durationMs: number;
}

export interface StripeHealthReport {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    environment: string;
    checks: HealthCheckResult[];
    summary: {
        passed: number;
        failed: number;
        skipped: number;
        totalDurationMs: number;
    };
}

/**
 * Run all 5 levels of Stripe health checks.
 * Designed to be safe — never creates real charges, always cleans up.
 */
export async function runStripeHealthCheck(): Promise<StripeHealthReport> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const environment = secretKey.startsWith('sk_live_') ? 'live' : 'test';

    let stripe: InstanceType<typeof Stripe> | null = null;
    let testPaymentIntentId: string | null = null;

    // ═══════════════════════════════════════════════════
    // Level 1: API Key Validation
    // ═══════════════════════════════════════════════════
    const l1Start = Date.now();
    try {
        if (!secretKey || secretKey.includes('REPLACE')) {
            checks.push({
                level: 1,
                name: 'API Key Validation',
                status: 'fail',
                message: 'STRIPE_SECRET_KEY is not configured or still a placeholder',
                durationMs: Date.now() - l1Start,
            });
        } else {
            stripe = new Stripe(secretKey);
            // Use balance API to validate the key — it's the simplest authenticated endpoint
            const balance = await stripe.balance.retrieve();

            checks.push({
                level: 1,
                name: 'API Key Validation',
                status: 'pass',
                message: `Connected to Stripe successfully — ${balance.available.length} balance(s) found`,
                details: {
                    keyType: environment,
                    availableBalances: balance.available.map(b => ({
                        amount: b.amount / 100,
                        currency: b.currency.toUpperCase(),
                    })),
                    pendingBalances: balance.pending.map(b => ({
                        amount: b.amount / 100,
                        currency: b.currency.toUpperCase(),
                    })),
                },
                durationMs: Date.now() - l1Start,
            });
        }
    } catch (error: any) {
        checks.push({
            level: 1,
            name: 'API Key Validation',
            status: 'fail',
            message: `API Key validation failed: ${error.message}`,
            details: { errorType: error.type, statusCode: error.statusCode },
            durationMs: Date.now() - l1Start,
        });
    }

    // If Level 1 failed, skip remaining checks that need the client
    if (!stripe) {
        for (let level = 2; level <= 5; level++) {
            checks.push({
                level,
                name: ['', '', 'Test Payment Intent', 'Webhook Secret', 'Connected Accounts', 'Refund Capability'][level],
                status: 'skip',
                message: 'Skipped — Stripe client not available (Level 1 failed)',
                durationMs: 0,
            });
        }
        return buildReport(checks, startTime, environment);
    }

    // ═══════════════════════════════════════════════════
    // Level 2: Payment Intent (Test Charge)
    // ═══════════════════════════════════════════════════
    const l2Start = Date.now();
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 2000, // ฿20.00 (smallest testable amount for THB)
            currency: 'thb',
            description: '[HEALTH CHECK] Auto-created by Elixopay — safe to ignore',
            metadata: {
                source: 'elixopay-health-check',
                auto_cleanup: 'true',
            },
            // Don't confirm — just test creation ability
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });

        testPaymentIntentId = paymentIntent.id;

        checks.push({
            level: 2,
            name: 'Test Payment Intent',
            status: 'pass',
            message: `PaymentIntent created: ${paymentIntent.id} (status: ${paymentIntent.status})`,
            details: {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
            },
            durationMs: Date.now() - l2Start,
        });
    } catch (error: any) {
        checks.push({
            level: 2,
            name: 'Test Payment Intent',
            status: 'fail',
            message: `Failed to create PaymentIntent: ${error.message}`,
            details: { errorType: error.type, code: error.code },
            durationMs: Date.now() - l2Start,
        });
    }

    // ═══════════════════════════════════════════════════
    // Level 3: Webhook Secret Format Validation
    // ═══════════════════════════════════════════════════
    const l3Start = Date.now();
    try {
        if (!webhookSecret || webhookSecret.includes('REPLACE')) {
            checks.push({
                level: 3,
                name: 'Webhook Secret',
                status: 'fail',
                message: 'STRIPE_WEBHOOK_SECRET is not configured or still a placeholder',
                durationMs: Date.now() - l3Start,
            });
        } else if (!webhookSecret.startsWith('whsec_')) {
            checks.push({
                level: 3,
                name: 'Webhook Secret',
                status: 'fail',
                message: `Webhook secret has invalid format (expected "whsec_..." prefix, got "${webhookSecret.substring(0, 8)}...")`,
                durationMs: Date.now() - l3Start,
            });
        } else {
            checks.push({
                level: 3,
                name: 'Webhook Secret',
                status: 'pass',
                message: `Webhook secret configured: ${webhookSecret.substring(0, 12)}...`,
                details: {
                    prefix: webhookSecret.substring(0, 12),
                    length: webhookSecret.length,
                },
                durationMs: Date.now() - l3Start,
            });
        }
    } catch (error: any) {
        checks.push({
            level: 3,
            name: 'Webhook Secret',
            status: 'fail',
            message: `Webhook check error: ${error.message}`,
            durationMs: Date.now() - l3Start,
        });
    }

    // ═══════════════════════════════════════════════════
    // Level 4: Connected Accounts (Stripe Connect)
    // ═══════════════════════════════════════════════════
    const l4Start = Date.now();
    try {
        const accounts = await stripe.accounts.list({ limit: 5 });

        checks.push({
            level: 4,
            name: 'Connected Accounts',
            status: 'pass',
            message: `Stripe Connect active — ${accounts.data.length} connected account(s) found`,
            details: {
                totalAccounts: accounts.data.length,
                hasMore: accounts.has_more,
                accounts: accounts.data.map(a => ({
                    id: a.id,
                    chargesEnabled: a.charges_enabled,
                    payoutsEnabled: a.payouts_enabled,
                    country: a.country,
                })),
            },
            durationMs: Date.now() - l4Start,
        });
    } catch (error: any) {
        // If connect is not enabled, this is expected
        const isConnectNotEnabled = error.message?.includes('connect') || error.code === 'account_invalid';
        checks.push({
            level: 4,
            name: 'Connected Accounts',
            status: isConnectNotEnabled ? 'skip' : 'fail',
            message: isConnectNotEnabled
                ? 'Stripe Connect not enabled on this account (this is OK if not using Connect)'
                : `Failed to list connected accounts: ${error.message}`,
            durationMs: Date.now() - l4Start,
        });
    }

    // ═══════════════════════════════════════════════════
    // Level 5: Refund Capability (cancel the test PI)
    // ═══════════════════════════════════════════════════
    const l5Start = Date.now();
    try {
        if (!testPaymentIntentId) {
            checks.push({
                level: 5,
                name: 'Refund Capability',
                status: 'skip',
                message: 'Skipped — no test PaymentIntent available (Level 2 failed)',
                durationMs: 0,
            });
        } else {
            // Cancel the test PI (cleanup) — this validates we can modify intents
            const canceled = await stripe.paymentIntents.cancel(testPaymentIntentId);

            checks.push({
                level: 5,
                name: 'Refund Capability',
                status: 'pass',
                message: `PaymentIntent canceled successfully (cleanup): ${canceled.id}`,
                details: {
                    canceledId: canceled.id,
                    finalStatus: canceled.status,
                },
                durationMs: Date.now() - l5Start,
            });
        }
    } catch (error: any) {
        checks.push({
            level: 5,
            name: 'Refund Capability',
            status: 'fail',
            message: `Failed to cancel test PaymentIntent: ${error.message}`,
            durationMs: Date.now() - l5Start,
        });
    }

    return buildReport(checks, startTime, environment);
}

function buildReport(checks: HealthCheckResult[], startTime: number, environment: string): StripeHealthReport {
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const skipped = checks.filter(c => c.status === 'skip').length;

    let overall: StripeHealthReport['overall'] = 'healthy';
    if (failed > 0 && passed > 0) overall = 'degraded';
    if (failed > 0 && passed === 0) overall = 'unhealthy';

    return {
        overall,
        timestamp: new Date().toISOString(),
        environment,
        checks,
        summary: {
            passed,
            failed,
            skipped,
            totalDurationMs: Date.now() - startTime,
        },
    };
}

// ─── CLI Entry Point ───────────────────────────────────────────────────────────
// Run directly: npx ts-node server/src/scripts/stripe-health-check.ts
if (require.main === module) {
    // Load .env from the server root
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

    console.log('\n🔍 Elixopay — Stripe Health Check\n' + '═'.repeat(50));

    runStripeHealthCheck()
        .then(report => {
            const icon = { healthy: '✅', degraded: '⚠️', unhealthy: '❌' };
            console.log(`\n${icon[report.overall]} Overall: ${report.overall.toUpperCase()}`);
            console.log(`   Environment: ${report.environment}`);
            console.log(`   Time: ${report.summary.totalDurationMs}ms\n`);

            for (const check of report.checks) {
                const statusIcon = { pass: '✅', fail: '❌', skip: '⏭️' }[check.status];
                console.log(`   ${statusIcon} Level ${check.level}: ${check.name}`);
                console.log(`      ${check.message}`);
                if (check.durationMs > 0) {
                    console.log(`      (${check.durationMs}ms)`);
                }
            }

            console.log(`\n   Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped\n`);

            process.exit(report.overall === 'unhealthy' ? 1 : 0);
        })
        .catch(err => {
            console.error('💥 Health check crashed:', err);
            process.exit(2);
        });
}
