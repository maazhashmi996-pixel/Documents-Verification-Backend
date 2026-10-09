const nodemailer = require('nodemailer');

let transporter;

const isConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
    if (transporter) return transporter;
    if (!isConfigured()) {
        throw new Error('Email is not configured. Set SMTP_USER and SMTP_PASS in the backend .env file.');
    }
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465, // 465 = SSL, 587 = STARTTLS
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return transporter;
};

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const shell = (inner) => `
<div style="background:#f4f6fa;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f0;border-radius:18px;overflow:hidden;">
    <div style="background:#0f1b33;padding:24px 32px;">
      <div style="color:#d9b36a;font-size:20px;font-weight:700;letter-spacing:.5px;">Qual Check</div>
      <div style="color:#9fb0cf;font-size:12px;margin-top:4px;">Document Verification Portal</div>
    </div>
    <div style="padding:32px;">${inner}</div>
  </div>
</div>`;

const send = async ({ to, subject, text, html }) => {
    const from = process.env.MAIL_FROM || `"Qual Check" <${process.env.SMTP_USER}>`;
    await getTransporter().sendMail({ from, to, subject, text, html });
};

const PURPOSE_TEXT = {
    signup: (role) => `Use this code to finish creating your ${role === 'admin' ? 'Admin' : 'Student'} account.`,
    reset: () => 'Use this code to reset your password.'
};

exports.isConfigured = isConfigured;

exports.sendOtpEmail = async ({ to, name, otp, role, minutes = 10, purpose = 'signup' }) => {
    const lead = (PURPOSE_TEXT[purpose] || PURPOSE_TEXT.signup)(role);
    await send({
        to,
        subject: `${otp} is your Qual Check verification code`,
        text: `Hello ${name}, your Qual Check verification code is ${otp}. It expires in ${minutes} minutes.`,
        html: shell(`
      <p style="margin:0 0 8px;color:#0f1b33;font-size:16px;">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 24px;color:#4b5876;font-size:14px;line-height:1.6;">${lead}</p>
      <div style="text-align:center;background:#f7f3ea;border:1px solid #ecdfc0;border-radius:14px;padding:20px;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0f1b33;">${otp}</span>
      </div>
      <p style="margin:24px 0 0;color:#4b5876;font-size:13px;line-height:1.6;">
        The code expires in ${minutes} minutes. If you didn't request it, you can ignore this email.
      </p>`)
    });
};

// Tells a student that one of their documents was verified or rejected
exports.sendDocumentStatusEmail = async ({ to, name, title, status, remarks }) => {
    const ok = status === 'Verified';
    const badge = ok ? '#1e6b5a' : '#b4233c';
    await send({
        to,
        subject: `Your document "${title}" was ${status.toLowerCase()}`,
        text: `Hello ${name}, your document "${title}" is now ${status}.${remarks ? ' Remarks: ' + remarks : ''}`,
        html: shell(`
      <p style="margin:0 0 8px;color:#0f1b33;font-size:16px;">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px;color:#4b5876;font-size:14px;line-height:1.6;">There is an update on one of your documents.</p>
      <div style="border:1px solid #e4e8f0;border-radius:14px;padding:18px;">
        <div style="color:#0f1b33;font-size:15px;font-weight:700;">${escapeHtml(title)}</div>
        <div style="margin-top:10px;"><span style="display:inline-block;background:${badge};color:#fff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${status}</span></div>
        ${remarks ? `<p style="margin:14px 0 0;color:#4b5876;font-size:13px;line-height:1.6;">Remarks: ${escapeHtml(remarks)}</p>` : ''}
      </div>
      <p style="margin:24px 0 0;color:#4b5876;font-size:13px;">Sign in to your student dashboard to see the details.</p>`)
    });
};
