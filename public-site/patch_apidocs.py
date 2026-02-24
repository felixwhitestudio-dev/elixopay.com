import os

file_path = '/Users/felixonthecloud/Elixopay/public-site/apidocs.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Sidebar Navigation
sidebar_links = """            <a href="#refunds">การคืนเงิน (Refunds)</a>
            <a href="#subscriptions">ระบบสมาชิก (Subscriptions)</a>
"""
sidebar_target = '<a href="#downloads" data-i18n="nav.docs_downloads">'
content = content.replace(sidebar_target, sidebar_links + '            ' + sidebar_target)


# 2. Prepare Refunds API Content
refunds_section = """
          <!-- Refunds -->
          <div id="refunds" class="api-section">
            <div class="api-prose">
              <h2>การคืนเงิน (Refunds)</h2>
              <p>
                ใช้ Endpoint นี้เพื่อทำการคืนเงิน (Refund) ให้กับลูกค้า หลังจากที่ชำระเงินสำเร็จ (Succeeded)
                สามารถระบุจำนวนเงินคืนบางส่วน หรือคืนเต็มจำนวนก็ได้ยอดเงินจะถูกหักจากกระเป๋าเงิน (Wallet) ของคุณ.
              </p>

              <div class="endpoint-badge"><span class="method-post">POST</span> /api/v1/checkout/payments/:id/refund</div>

              <h3 style="margin-top: 3rem; margin-bottom: 0.5rem; font-size: 1.1rem; color: white;">พารามิเตอร์ของ Request</h3>
              
              <div class="table-container" style="overflow-x: auto;">
                <table class="params-table">
                  <thead>
                    <tr>
                      <th style="min-width:150px">พารามิเตอร์</th>
                      <th style="min-width:100px">ชนิดข้อมูล</th>
                      <th style="min-width:250px">คำอธิบาย</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>id</code> <span class="required-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:6px;">REQUIRED</span></td>
                      <td>string (URL)</td>
                      <td>ไอดีของการชำระเงินที่ต้องการคืนเงิน (Transaction ID)</td>
                    </tr>
                    <tr>
                      <td><code>amount</code> <span class="required-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:6px;">OPTIONAL</span></td>
                      <td>number</td>
                      <td>จำนวนเงินที่ต้องการคืน หากไม่ระบุจะเป็นการคืนเต็มจำนวน</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            <div class="api-code-blocks">
              <div class="code-block-wrapper">
                <div class="code-block-header">
                  <span>cURL Request</span>
                  <button class="copy-btn"><i class="far fa-copy"></i></button>
                </div>
                <div class="code-editor">
                  <pre><code class="language-bash">curl -X POST https://api.elixopay.com/api/v1/checkout/payments/999/refund \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Idempotency-Key: ref_12345" \\
  -d '{"amount": 500.00}'</code></pre>
                </div>
              </div>

              <div class="code-block-wrapper" style="margin-top: 2rem;">
                <div class="code-block-header">
                  <span>Response</span>
                </div>
                <div class="code-editor">
                  <pre><code class="language-json">{
  "success": true,
  "message": "Refund of ฿500.00 processed successfully."
}</code></pre>
                </div>
              </div>
            </div>
          </div>
"""

# 3. Prepare Subscriptions API Content
subscriptions_section = """
          <!-- Subscriptions -->
          <div id="subscriptions" class="api-section">
            <div class="api-prose">
              <h2>ระบบสมาชิก (Subscriptions)</h2>
              <p>
                API จัดการระบบ Subscription ซึ่งอนุญาตให้คุณสร้างสินค้ารายเดือน (Products), แผนราคา (Prices) และพ่วงผูกลูกค้าเข้ากับแพ็กเกจ เพื่อให้เกิดการเรียกเก็บเงินอัตโนมัติ 
              </p>

              <div class="endpoint-badge" style="margin-top:20px;margin-bottom:10px/"><span class="method-post">POST</span> /api/v1/billing/products</div>
              <p style="font-size:0.9rem; color:#94a3b8; margin-bottom: 20px;">สร้างสินค้าเพื่อใช้ในการสมัครสมาชิก (เช่น "Premium Plan")</p>
              
              <div class="endpoint-badge" style="margin-bottom:10px;"><span class="method-post">POST</span> /api/v1/billing/prices</div>
              <p style="font-size:0.9rem; color:#94a3b8; margin-bottom: 20px;">สร้างราคาและรอบบิล (เช่น เดือนละ 500 บาท) ผูกกับ Product ID</p>
              
              <div class="endpoint-badge" style="margin-bottom:10px;"><span class="method-post">POST</span> /api/v1/billing/customers</div>
              <p style="font-size:0.9rem; color:#94a3b8; margin-bottom: 20px;">ลงทะเบียนลูกค้าใหม่เข้าสู่ระบบ Billing</p>
              
              <div class="endpoint-badge" style="margin-bottom:10px;"><span class="method-post">POST</span> /api/v1/billing/subscriptions</div>
              <p style="font-size:0.9rem; color:#94a3b8;">สมัครสมาชิกลูกค้า (พ่วง Customer ID กับ Price ID)</p>

            </div>

            <div class="api-code-blocks">
              <div class="code-block-wrapper">
                <div class="code-block-header">
                  <span>cURL Request (Create Subscription)</span>
                  <button class="copy-btn"><i class="far fa-copy"></i></button>
                </div>
                <div class="code-editor">
                  <pre><code class="language-bash">curl -X POST https://api.elixopay.com/api/v1/billing/subscriptions \\
  -H "Authorization: Bearer sk_test_..." \\
  -d '{"customerId": "cus_123", "priceId": "price_456"}'</code></pre>
                </div>
              </div>

              <div class="code-block-wrapper" style="margin-top: 2rem;">
                <div class="code-block-header">
                  <span>Response</span>
                </div>
                <div class="code-editor">
                  <pre><code class="language-json">{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_789xyz",
      "status": "active",
      "currentPeriodEnd": "2024-04-01T00:00:00.000Z"
    }
  }
}</code></pre>
                </div>
              </div>
            </div>
          </div>
"""

# Insert before <!-- Payouts -->
main_target = '          <!-- Payouts -->'
content = content.replace(main_target, refunds_section + subscriptions_section + '\n' + main_target)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("API documentation updated successfully!")
