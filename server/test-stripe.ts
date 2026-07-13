import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function test() {
    console.log("Starting Stripe create session...");
    try {
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'thb',
                    product_data: {
                        name: 'Elixopay Payment',
                    },
                    unit_amount: 890000,
                },
                quantity: 1,
            }],
            mode: 'payment' as any,
            success_url: 'https://example.com/success',
            cancel_url: 'https://example.com/cancel',
        };
        const session = await stripe.checkout.sessions.create(sessionParams as any);
        console.log("Success! Session ID:", session.id);
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
