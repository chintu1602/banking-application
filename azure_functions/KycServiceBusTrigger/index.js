const nodemailer = require("nodemailer");

module.exports = async function (context, myQueueItem) {
    context.log("[KycServiceBusTrigger] Received message from Service Bus queue.");

    let messageData;
    try {
        messageData = typeof myQueueItem === "string" ? JSON.parse(myQueueItem) : myQueueItem;
    } catch (parseErr) {
        context.log.error("[KycServiceBusTrigger Error] Failed to parse message body as JSON:", parseErr.message);
        return;
    }

    const { email, name, document_type, status, reason } = messageData;

    if (!email) {
        context.log.error("[KycServiceBusTrigger Error] Message is missing recipient email address. Aborting.");
        return;
    }

    context.log(`[KycServiceBusTrigger] Processing KYC alert for: Name=${name}, Email=${email}, Status=${status}`);

    const isApproved = String(status).toUpperCase() === "APPROVED";
    
    // HTML Template generation with premium banking aesthetics
    const subject = isApproved 
        ? "KYC Verification Approved - Welcome to Antigravity Bank" 
        : "Action Required: KYC Verification Update - Antigravity Bank";

    const accentColor = isApproved ? "#10b981" : "#ef4444"; // emerald green or crimson red
    const statusText = isApproved ? "APPROVED" : "REJECTED";
    const statusBg = isApproved ? "#d1fae5" : "#fee2e2";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1f2937;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a, #0f172a);
            padding: 32px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.05em;
        }
        .content {
            padding: 40px 32px;
        }
        .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 12px;
        }
        .body-text {
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            margin-bottom: 24px;
        }
        .badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 9999px;
            background-color: ${statusBg};
            color: ${accentColor};
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 0.05em;
            margin-bottom: 24px;
            border: 1px solid ${accentColor}22;
        }
        .details-box {
            background-color: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 28px;
            border: 1px solid #e5e7eb;
        }
        .details-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .details-row:last-child {
            margin-bottom: 0;
        }
        .details-label {
            font-weight: 600;
            color: #6b7280;
        }
        .details-value {
            color: #111827;
            font-weight: 500;
        }
        .reason-section {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #e5e7eb;
            font-size: 14px;
        }
        .reason-title {
            font-weight: 600;
            color: #ef4444;
            margin-bottom: 4px;
        }
        .reason-text {
            color: #4b5563;
            font-style: italic;
        }
        .btn-container {
            text-align: center;
            margin-top: 32px;
        }
        .btn {
            display: inline-block;
            padding: 12px 32px;
            background-color: #1e3a8a;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2);
            transition: background-color 0.2s;
        }
        .btn:hover {
            background-color: #1d4ed8;
        }
        .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ANTIGRAVITY BANK</h1>
        </div>
        <div class="content">
            <div class="greeting">Hello ${name || "Customer"},</div>
            <p class="body-text">
                Thank you for submitting your KYC verification documents. We have reviewed your files, and the status of your profile verification is detailed below:
            </p>
            
            <div style="text-align: center;">
                <div class="badge">${statusText}</div>
            </div>

            <div class="details-box">
                <div class="details-row">
                    <span class="details-label">Document Type:</span>
                    <span class="details-value">${document_type || "Identity Card"}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Recipient:</span>
                    <span class="details-value">${email}</span>
                </div>
                ${!isApproved && reason ? `
                <div class="reason-section">
                    <div class="reason-title">Reason for rejection:</div>
                    <div class="reason-text">"${reason}"</div>
                </div>
                ` : ""}
            </div>

            <p class="body-text">
                ${isApproved 
                    ? "Your profile is fully verified! You can now log into your online banking portal to open accounts, apply for credit lines/loans, or manage transactions." 
                    : "Please review the rejection reason and upload a new copy of your identification document through your customer dashboard."}
            </p>

            <div class="btn-container">
                <a href="https://antigravitybank.com/login" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            &copy; 2026 Antigravity Banking Group. All rights reserved.<br>
            This is an automated operational email. Please do not reply directly to this address.
        </div>
    </div>
</body>
</html>
    `;

    // Retrieve SMTP details
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || "587";
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || "kyc-alerts@antigravitybank.com";

    if (!smtpHost || !smtpUser || !smtpPass) {
        context.log.warn("[KycServiceBusTrigger] SMTP configuration details are missing. Mocking mail delivery.");
        context.log("[KycServiceBusTrigger Mock Output] EMAIL DELIVERED:");
        context.log(`  To: ${email}`);
        context.log(`  Subject: ${subject}`);
        context.log(`  HTML Code: \n${emailHtml}\n`);
        return;
    }

    try {
        context.log(`[KycServiceBusTrigger] Sending operational email to ${email} via SMTP ${smtpHost}...`);
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpPort === "465", // true for 465, false for other ports
            auth: {
                user: smtpUser,
                password: smtpPass
            }
        });

        const info = await transporter.sendMail({
            from: `"Antigravity Bank Support" <${smtpFrom}>`,
            to: email,
            subject: subject,
            html: emailHtml
        });

        context.log(`[KycServiceBusTrigger] Email successfully sent! Message ID: ${info.messageId}`);
    } catch (sendErr) {
        context.log.error(`[KycServiceBusTrigger Error] Failed to send email via nodemailer: ${sendErr.message}`);
    }
};
