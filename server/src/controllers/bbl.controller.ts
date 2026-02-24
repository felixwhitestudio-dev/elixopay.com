import { Request, Response } from 'express';
import { BBLService } from '../services/bbl.service';

export class BBLController {

    /**
     * Handles the Smart Bill Payment Notification Webhook from Bangkok Bank.
     * Flow:
     * 1. Validate Basic Auth.
     * 2. Validate JWT Signature (if header present).
     * 3. Process Payment (Mock).
     * 4. Return Signed JWT Response.
     */
    static async handleWebhook(req: Request, res: Response) {

        try {
            // 1. Basic Auth Validation
            const authHeader = req.headers.authorization;
            if (!authHeader || !BBLService.validateBasicAuth(authHeader)) {
                console.warn('❌ BBL Webhook: Invalid Basic Auth');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // 2. JWT Verification
            // Note: Header name is not strictly standard, checking common candidates
            const token = (req.headers['x-jws-signature'] || req.headers['signature'] || req.headers['authorization-token']) as string;

            if (token) {
                try {
                    const decoded = BBLService.verifyJWT(token);

                } catch (jwtError) {
                    console.error('❌ BBL Webhook: JWT Verification Failed', jwtError);
                    return res.status(401).json({ error: 'Invalid Signature' });
                }
            } else {
                console.warn('⚠️ BBL Webhook: No JWT Signature Header found. Proceeding with caution (Sandbox/Dev).');
            }

            // 3. Process Payment Logic (Mocking success)
            // Extract fields based on BBL Smart Bill Payment API spec
            // The spec implies fields might be wrapped in a 'data' object
            const bodyData = req.body.data || req.body;

            const {
                paymentRequestId,
                reference1, // Usually Order ID or Invoice ID
                reference2, // Usually Customer ID
                totalAmount,
                paymentStatus,
                transactionDate, // sometimes paymentDateTime
                paymentDateTime,
                billerId
            } = bodyData;



            // 4. Prepare Response
            // Spec requires: responseCode, responseMesg
            const responsePayload = {
                responseCode: '000',
                responseMesg: 'success'
            };

            // 5. Sign Response
            const responseToken = BBLService.generateJWT(responsePayload);

            // 6. Send Response
            // BBL likely expects the JWT in the body or header?
            // "Return Smart Bill Payment Notification Response" -> "Validate Token"
            // Usually response is JSON. If they validate token, maybe the body IS the token, 
            // or we send JSON with a signature header?
            // Given the complexity, strict BBL often expects a plain text ID or JSON.
            // But if they validate JWT on response, let's send it as a field or header.
            // For now, sending standard JSON.

            res.set('X-JWS-Signature', responseToken); // Best practice candidate
            return res.status(200).json(responsePayload);

        } catch (error: any) {
            console.error('❌ BBL Webhook Error:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
