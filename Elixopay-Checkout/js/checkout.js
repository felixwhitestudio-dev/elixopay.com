// Elixopay Checkout Implementation

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://api.elixopay.com';

// Replace with Elixopay's actual Stripe Publishable Key
// We use the platform's publishable key. Connected accounts use Stripe Connect under the hood.
const STRIPE_PUBLISHABLE_KEY = 'pk_test_...'; // Ideally fetched from an API, but can be hardcoded for the frontend if it's public. Wait, the backend doesn't currently provide the PK. Let's assume we have it. Or better yet, we just initialize Stripe when we need to for card payments.
// Wait, the user already provided the keys in previous context: pk_test_... Let's leave a placeholder or fetch it if possible.

// But wait, the user's test key was: pk_live_51SJ4HvDzFy8OdkHYfYR4yX1jUxfZcesVHxvLvf4aoP8sj7c2TYN3TB0EJR4OmC7ijJVpKRpfNl4hhLT72ZRGuoh100qlmS5YNX
// Actually that's a live key. Let's just put the platform publishable key here.
const stripe = Stripe('pk_test_YOUR_PLATFORM_KEY'); 
let elements;
let transactionData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');

    if (!ref) {
        showError('รหัสอ้างอิงการชำระเงินไม่ถูกต้อง (Missing reference)');
        return;
    }

    await loadTransactionDetails(ref);
});

async function loadTransactionDetails(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/checkout/${id}`);
        const data = await response.json();

        if (!data.success) {
            showError('ไม่พบข้อมูลการชำระเงิน หรือหมดอายุแล้ว');
            return;
        }

        transactionData = data.data;
        renderUI(transactionData);

    } catch (error) {
        console.error('Error fetching transaction:', error);
        showError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
}

function renderUI(data) {
    // Hide loading
    document.getElementById('loadingState').style.display = 'none';

    // Set Merchant Info
    document.getElementById('merchantName').textContent = data.merchantName;
    document.getElementById('merchantLogo').textContent = data.merchantName.charAt(0).toUpperCase();
    document.getElementById('transactionDesc').textContent = data.description || 'Secure Payment';
    
    // Set Amount
    document.getElementById('paymentAmount').textContent = Number(data.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });

    if (data.status !== 'pending') {
        showError(`รายการนี้${data.status === 'completed' ? 'ชำระเงินเรียบร้อยแล้ว' : 'ถูกยกเลิกแล้ว'}`);
        return;
    }

    if (data.method === 'qr' || data.method === 'bank_transfer') {
        // Render QR Code
        document.getElementById('qr-container').style.display = 'block';
        document.getElementById('qr-image').src = data.qrCodeBase64.startsWith('http') 
            ? data.qrCodeBase64 
            : `data:image/png;base64,${data.qrCodeBase64}`;
    } else if (data.method === 'card') {
        // Render Stripe Elements
        document.getElementById('payment-form').style.display = 'block';
        initializeStripeElements(data.clientSecret);
    } else {
        showError('ช่องทางการชำระเงินนี้ยังไม่รองรับ');
    }
}

async function initializeStripeElements(clientSecret) {
    if (!clientSecret) {
        showError('ไม่สามารถโหลดข้อมูลช่องทางการชำระเงินด้วยบัตรได้');
        return;
    }

    const appearance = {
        theme: 'stripe',
        variables: {
            colorPrimary: '#4f46e5',
            colorBackground: '#ffffff',
            colorText: '#1e293b',
            fontFamily: 'Inter, sans-serif',
            borderRadius: '8px',
        }
    };

    elements = stripe.elements({ appearance, clientSecret });

    const paymentElementOptions = {
        layout: 'tabs',
    };

    const paymentElement = elements.create('payment', paymentElementOptions);
    paymentElement.mount('#payment-element');

    const form = document.getElementById('payment-form');
    form.addEventListener('submit', handlePaymentSubmit);
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            // Uncomment and use actual return URL from transaction metadata if needed. 
            // For now, redirect to a success page or merchant returnUrl.
            return_url: window.location.origin + `/Elixopay-Checkout/success.html?ref=${transactionData.id}`,
        },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`.
    if (error) {
        let errorMsg = error.message;
        if (error.type === "card_error" || error.type === "validation_error") {
            errorMsg = error.message;
        } else {
            errorMsg = "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง";
        }
        showMessage(errorMsg);
    } else {
        showMessage("Processing payment...");
    }

    setLoading(false);
}

function showMessage(messageText) {
    const messageContainer = document.getElementById('payment-message');
    messageContainer.classList.remove('hidden');
    messageContainer.textContent = messageText;
}

function showError(msg) {
    document.getElementById('loadingState').style.display = 'none';
    const container = document.getElementById('paymentSection');
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ef4444;">
            <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p style="font-weight: 500;">${msg}</p>
        </div>
    `;
}

function setLoading(isLoading) {
    if (isLoading) {
        document.querySelector("#submit-button").disabled = true;
        document.querySelector("#spinner").classList.remove("hidden");
        document.querySelector("#button-text").classList.add("hidden");
    } else {
        document.querySelector("#submit-button").disabled = false;
        document.querySelector("#spinner").classList.add("hidden");
        document.querySelector("#button-text").classList.remove("hidden");
    }
}
