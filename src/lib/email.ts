import nodemailer from 'nodemailer';

export async function sendVerificationEmail(toEmail: string, name: string, code: string) {
  const EMAIL_FROM = process.env.EMAIL_FROM;
  const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

  if (!EMAIL_FROM || !EMAIL_APP_PASSWORD) {
    throw new Error(
      `Email env vars missing. EMAIL_FROM=${EMAIL_FROM || 'MISSING'}, EMAIL_APP_PASSWORD=${EMAIL_APP_PASSWORD ? 'SET' : 'MISSING'}`
    );
  }

  // Create transporter inside the function so env vars are always fresh
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_FROM,
      pass: EMAIL_APP_PASSWORD,
    },
  });

  const subject = `Your AI Interview Pro Verification Code: ${code}`;

  const safeName = name.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m] as string;
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid rgba(99,102,241,0.25);border-radius:24px;overflow:hidden;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 40px;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">🧠</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">AI Interview Pro</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Verify your email to get started</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Hi <strong style="color:#f1f5f9;">${safeName}</strong>,</p>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Welcome to AI Interview Pro! Use the 6-digit verification code below to confirm your email address and unlock your account.
              </p>

              <!-- OTP Code Box -->
              <div style="background:rgba(99,102,241,0.1);border:2px dashed rgba(99,102,241,0.4);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Your Verification Code</p>
                <div style="font-size:40px;font-weight:900;letter-spacing:14px;color:#818cf8;font-family:monospace;">${code}</div>
                <p style="margin:10px 0 0;color:#64748b;font-size:12px;">⏱ This code expires in <strong style="color:#fbbf24;">15 minutes</strong></p>
              </div>

              <p style="margin:0 0 20px;color:#64748b;font-size:13px;line-height:1.6;">
                Enter this code on the verification page to complete your registration. If you didn't create an account, you can safely ignore this email.
              </p>

              <!-- Security Notice -->
              <div style="background:rgba(251,191,36,0.08);border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:12px 16px;">
                <p style="margin:0;color:#fbbf24;font-size:12px;">🔒 <strong>Security tip:</strong> AI Interview Pro will never ask for your password or this code via phone or email.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#475569;font-size:11px;">© 2024 AI Interview Pro. All rights reserved.</p>
              <p style="margin:4px 0 0;color:#334155;font-size:11px;">This is an automated message, please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const info = await transporter.sendMail({
    from: `"AI Interview Pro" <${EMAIL_FROM}>`,
    to: toEmail,
    subject,
    html,
  });

  return info;
}
