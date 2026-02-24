import * as mailer from '../src/utils/mailer';

async function main() {
    console.log('Sending test email...');
    await mailer.sendVerificationEmail('test@elixopay.com', 'Demo User', 'http://localhost:8081/verify-email.html?token=test1234');
    console.log('Test email sent! Check the Ethereal link above.');
}

main().catch(console.error);
