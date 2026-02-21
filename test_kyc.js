        // Check authentication
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('token');
            if (!token && !window.API_CONFIG.IS_DEMO) {
                window.location.href = '/login.html';
            }
        });

        // Handle file visual feedback
        function handleFileSelect(inputId, previewId, iconId) {
            const fileInput = document.getElementById(inputId);
            const previewLabel = document.getElementById(previewId);
            const icon = document.getElementById(iconId);

            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                let sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

                if (file.size > 5 * 1024 * 1024) {
                    alert('ขนาดไฟล์เกิน 5MB กรุณาเลือกไฟล์ที่เล็กลง');
                    fileInput.value = '';
                    return;
                }

                previewLabel.innerHTML = `<span class="text-indigo-700 font-bold">${file.name}</span> <span class="text-xs text-gray-500 block mt-1">${sizeStr}</span>`;
                icon.innerHTML = '<i class="fas fa-check-circle text-4xl text-green-500"></i>';
                fileInput.parentElement.classList.add('border-green-400', 'bg-green-50');
                fileInput.parentElement.classList.remove('border-indigo-400', 'bg-indigo-50');
            }
        }

        // Handle Form Submission (Mocked API since backend doesn't have an endpoint for this yet)
        async function handleKYCSubmit(e) {
            e.preventDefault();

            const idCard = document.getElementById('idCard').files[0];
            const statementDoc = document.getElementById('statementDoc').files[0];

            const btn = document.getElementById('submit-btn');
            const spinner = document.getElementById('submit-spinner');
            const icon = document.getElementById('submit-icon');
            const btnText = document.getElementById('submit-btn-text');
            const errorBox = document.getElementById('form-error');
            const errorMsg = document.getElementById('form-error-message');
            const successBox = document.getElementById('form-success');

            if (!idCard || !statementDoc) {
                errorMsg.textContent = 'กรุณาอัปโหลดเอกสารทั้ง 2 รายการให้ครบถ้วน';
                errorBox.classList.remove('hidden');
                return;
            }

            errorBox.classList.add('hidden');

            // UI Loading state
            btn.disabled = true;
            icon.classList.add('hidden');
            spinner.classList.remove('hidden');
            btnText.textContent = 'กำลังอัปโหลด...';

            try {
                // Prepare FormData for file upload
                const formData = new FormData();
                formData.append('idCard', idCard);
                formData.append('statement', statementDoc);

                // Send request to the new KYC API endpoint
                const response = await apiFetch('/api/v1/kyc/upload', {
                    method: 'POST',
                    body: formData // Note: Content-Type is intentionally omitted for FormData
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'การอัปโหลดล้มเหลว กรุณาลองใหม่');
                }

                successBox.classList.remove('hidden');

                // Change button state to "Return to Dashboard"
                btn.className = "w-full text-indigo-700 bg-indigo-100 hover:bg-indigo-200 py-3.5 px-4 rounded-xl font-bold text-base flex items-center justify-center mt-6 transition";
                icon.className = "fas fa-home mr-2 text-indigo-700";
                icon.classList.remove('hidden');
                btnText.textContent = 'กลับสู่แดชบอร์ด';

                // Override submit function to return to dashboard
                document.getElementById('kycForm').onsubmit = function (event) {
                    event.preventDefault();
                    window.location.href = '/dashboard.html';
                };

                // Store state that KYC is pending (for frontend logic)
                let user = JSON.parse(localStorage.getItem('user') || '{}');
                user.kycStatus = 'pending';
                localStorage.setItem('user', JSON.stringify(user));

            } catch (err) {
                console.error(err);
                errorMsg.textContent = err.message || 'การอัปโหลดล้มเหลว กรุณาลองใหม่';
                errorBox.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        }
