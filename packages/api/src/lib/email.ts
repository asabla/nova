import { env } from "./env";
import { logger } from "./logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const provider = env.EMAIL_PROVIDER ?? "console";

  if (provider === "console" || !env.SMTP_HOST) {
    logger.info({ to: options.to, subject: options.subject }, "[EMAIL] console provider");
    logger.info({ body: options.text ?? options.html.slice(0, 200) }, "[EMAIL] body");
    return true;
  }

  if (provider === "resend" && env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? "NOVA <noreply@nova.app>",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });
    return response.ok;
  }

  // SMTP via raw TCP socket (Bun-native, no external dependencies)
  if (provider === "smtp" && env.SMTP_HOST) {
    try {
      return await sendViaSMTP(options);
    } catch (err) {
      logger.error({ err }, "[EMAIL/SMTP] Failed to send");
      return false;
    }
  }

  return false;
}

export function buildMagicLinkEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Sign in to NOVA",
    text: `Click this link to sign in to NOVA: ${url}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; margin-bottom: 24px;">Sign in to NOVA</h2>
        <p style="color: #555; line-height: 1.6;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
        <a href="${url}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 24px 0;">
          Sign In
        </a>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

export function buildNotificationEmail(title: string, body: string, actionUrl?: string): { subject: string; html: string; text: string } {
  return {
    subject: `NOVA: ${title}`,
    text: `${title}\n\n${body}${actionUrl ? `\n\nView: ${actionUrl}` : ""}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; margin-bottom: 16px;">${title}</h2>
        <p style="color: #555; line-height: 1.6;">${body}</p>
        ${actionUrl ? `
          <a href="${actionUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 16px;">
            View Details
          </a>
        ` : ""}
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #888; font-size: 12px;">You're receiving this because of your notification preferences in NOVA.</p>
      </div>
    `,
  };
}

export function buildInviteEmail(orgName: string, inviteUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: `You've been invited to ${orgName} on NOVA`,
    text: `You've been invited to join ${orgName} on NOVA.\n\nAccept invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; margin-bottom: 16px;">You're invited!</h2>
        <p style="color: #555; line-height: 1.6;">You've been invited to join <strong>${orgName}</strong> on NOVA.</p>
        <a href="${inviteUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 24px 0;">
          Accept Invitation
        </a>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">This invitation expires in 7 days.</p>
      </div>
    `,
  };
}

async function sendViaSMTP(options: EmailOptions): Promise<boolean> {
  const host = env.SMTP_HOST!;
  const port = env.SMTP_PORT ?? 587;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.EMAIL_FROM ?? "NOVA <noreply@nova.app>";

  // Build RFC 2822 compliant email message
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const messageLines = [
    `From: ${from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@nova.app>`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    options.text ?? options.html.replace(/<[^>]*>/g, ""),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    options.html,
    "",
    `--${boundary}--`,
  ];
  const message = messageLines.join("\r\n");

  // Use Bun's TCP socket for SMTP
  return new Promise<boolean>((resolve) => {
    const steps: string[] = [];
    let stepIndex = 0;
    let resolved = false;

    // Build command sequence
    steps.push(`EHLO nova.app\r\n`);
    if (port === 587 || port === 25) {
      steps.push(`STARTTLS\r\n`);
    }
    if (user && pass) {
      const credentials = Buffer.from(`\0${user}\0${pass}`).toString("base64");
      steps.push(`AUTH PLAIN ${credentials}\r\n`);
    }
    // Extract email from "Name <email>" format
    const fromEmail = from.includes("<") ? from.match(/<(.+)>/)?.[1] ?? from : from;
    steps.push(`MAIL FROM:<${fromEmail}>\r\n`);
    steps.push(`RCPT TO:<${options.to}>\r\n`);
    steps.push(`DATA\r\n`);
    steps.push(`${message}\r\n.\r\n`);
    steps.push(`QUIT\r\n`);

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logger.error("[EMAIL/SMTP] Connection timeout");
        resolve(false);
      }
    }, 15_000);

    const socket = Bun.connect({
      hostname: host,
      port,
      socket: {
        data(_socket, data) {
          const response = data.toString();
          const code = parseInt(response.slice(0, 3), 10);

          if (code >= 400) {
            logger.error({ response: response.trim() }, "[EMAIL/SMTP] Error");
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(false);
            }
            return;
          }

          // Send next command
          if (stepIndex < steps.length) {
            _socket.write(steps[stepIndex]);
            stepIndex++;
          }

          // Check if QUIT response received
          if (response.startsWith("221") || stepIndex >= steps.length) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(true);
            }
          }
        },
        error(_socket, error) {
          logger.error({ err: error }, "[EMAIL/SMTP] Socket error");
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        },
        close() {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        },
        open(_socket) {
          // Wait for server greeting before sending commands
        },
      },
    }).catch((err) => {
      logger.error({ err }, "[EMAIL/SMTP] Connect error");
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
  });
}

export function buildBudgetAlertEmail(alertName: string, currentValue: number, threshold: number, unit: string): { subject: string; html: string; text: string } {
  const percentage = Math.round((currentValue / threshold) * 100);
  return {
    subject: `NOVA Budget Alert: ${alertName} (${percentage}%)`,
    text: `Budget alert "${alertName}" has reached ${percentage}% of its limit.\n\nCurrent: ${currentValue} ${unit}\nThreshold: ${threshold} ${unit}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #d97706; margin-bottom: 16px;">Budget Alert</h2>
        <p style="color: #555; line-height: 1.6;"><strong>${alertName}</strong> has reached <strong>${percentage}%</strong> of its limit.</p>
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e;">Current: <strong>${currentValue.toLocaleString()} ${unit}</strong></p>
          <p style="margin: 4px 0 0; color: #92400e;">Threshold: <strong>${threshold.toLocaleString()} ${unit}</strong></p>
        </div>
      </div>
    `,
  };
}
