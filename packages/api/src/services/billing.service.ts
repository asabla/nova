import { db } from "../lib/db";
import { orgSettings } from "@nova/shared/schemas";
import { eq, and } from "drizzle-orm";
import { orgService } from "./org.service";
import { logger } from "../lib/logger";

/**
 * Billing service for Stripe integration (Story #16).
 *
 * Handles plan management, checkout sessions, and webhook processing.
 * When STRIPE_SECRET_KEY is not set, operates in "self-hosted mode"
 * where plan changes are free/local-only.
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripeEnabled = !!STRIPE_SECRET_KEY;

// Plan definitions
export const PLANS = {
  free: {
    name: "Free",
    maxUsers: 5,
    maxStorageGb: 1,
    maxModels: 3,
    priceMonthly: 0,
    stripePriceId: process.env.STRIPE_PRICE_FREE,
  },
  team: {
    name: "Team",
    maxUsers: 50,
    maxStorageGb: 100,
    maxModels: -1, // unlimited
    priceMonthly: 29,
    stripePriceId: process.env.STRIPE_PRICE_TEAM,
  },
  enterprise: {
    name: "Enterprise",
    maxUsers: -1,
    maxStorageGb: -1,
    maxModels: -1,
    priceMonthly: 99,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
  },
} as const;

export type PlanType = keyof typeof PLANS;

async function stripeRequest(path: string, options: RequestInit = {}) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe not configured");

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Stripe error: ${error?.error?.message ?? response.statusText}`);
  }

  return response.json();
}

export async function createCheckoutSession(orgId: string, plan: PlanType, successUrl: string, cancelUrl: string) {
  if (!stripeEnabled) {
    // Self-hosted mode: just change the plan directly
    await orgService.update(orgId, { billingPlan: plan });
    return { url: successUrl, sessionId: "local" };
  }

  const planConfig = PLANS[plan];
  if (!planConfig.stripePriceId) {
    throw new Error(`No Stripe price configured for plan: ${plan}`);
  }

  // Get or create Stripe customer
  const org = await orgService.get(orgId);
  let customerId = (org as any).billingCustomerId;

  if (!customerId) {
    const customer = await stripeRequest("/customers", {
      method: "POST",
      body: new URLSearchParams({
        name: org.name ?? `Org ${orgId}`,
        "metadata[orgId]": orgId,
      }),
    }) as { id: string };
    customerId = customer.id;
    await orgService.update(orgId, { billingCustomerId: customerId });
  }

  // Create checkout session
  const session = await stripeRequest("/checkout/sessions", {
    method: "POST",
    body: new URLSearchParams({
      customer: customerId,
      mode: "subscription",
      "line_items[0][price]": planConfig.stripePriceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[orgId]": orgId,
      "metadata[plan]": plan,
    }),
  }) as { id: string; url: string };

  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(orgId: string, returnUrl: string) {
  if (!stripeEnabled) {
    return { url: returnUrl };
  }

  const org = await orgService.get(orgId);
  const customerId = (org as any).billingCustomerId;
  if (!customerId) {
    throw new Error("No billing customer found. Please subscribe to a plan first.");
  }

  const session = await stripeRequest("/billing_portal/sessions", {
    method: "POST",
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    }),
  }) as { url: string };

  return { url: session.url };
}

export async function handleStripeWebhook(body: string, signature: string) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not configured");
  }

  // Verify webhook signature using Stripe's signing scheme
  const payload = body;
  const elements = signature.split(",");
  const timestampStr = elements.find((e) => e.startsWith("t="))?.slice(2);
  const signatureStr = elements.find((e) => e.startsWith("v1="))?.slice(3);

  if (!timestampStr || !signatureStr) {
    throw new Error("Invalid Stripe webhook signature format");
  }

  // Verify with HMAC-SHA256
  const crypto = await import("crypto");
  const signedPayload = `${timestampStr}.${payload}`;
  const expectedSig = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");

  if (expectedSig !== signatureStr) {
    throw new Error("Invalid webhook signature");
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, any> };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.metadata?.orgId;
      const plan = session.metadata?.plan as PlanType | undefined;
      if (orgId && plan) {
        await orgService.update(orgId, {
          billingPlan: plan,
          billingCustomerId: session.customer,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      // Find org by customer ID and update status
      const status = subscription.status;
      if (status === "canceled" || status === "unpaid") {
        // Downgrade to free plan
        const orgs = await db.select().from(orgSettings)
          .where(and(eq(orgSettings.key, "stripe_customer_id")));
        // In production this would query the orgs table
        logger.info({ status, customerId }, "[billing] Subscription status changed");
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      logger.warn({ customerId: invoice.customer }, "[billing] Payment failed");
      break;
    }
  }

  return { received: true };
}

export async function getPaymentMethod(orgId: string) {
  const org = await orgService.get(orgId);
  const customerId = (org as any).billingCustomerId;

  if (!stripeEnabled || !customerId) {
    return null;
  }

  try {
    const customer = await stripeRequest(`/customers/${customerId}`) as {
      invoice_settings?: { default_payment_method?: string };
    };

    const pmId = customer.invoice_settings?.default_payment_method;
    if (!pmId) return null;

    const pm = await stripeRequest(`/payment_methods/${pmId}`) as {
      id: string;
      type: string;
      card?: { brand: string; last4: string; exp_month: number; exp_year: number };
    };

    if (!pm.card) return null;

    return {
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  } catch (err) {
    logger.warn({ err, orgId, customerId }, "[billing] Failed to fetch payment method");
    return null;
  }
}

export async function getInvoices(orgId: string, limit = 10) {
  const org = await orgService.get(orgId);
  const customerId = (org as any).billingCustomerId;

  if (!stripeEnabled || !customerId) {
    return [];
  }

  try {
    const result = await stripeRequest(
      `/invoices?customer=${customerId}&limit=${limit}&status=paid`,
    ) as {
      data: Array<{
        id: string;
        number: string;
        amount_paid: number;
        currency: string;
        status: string;
        created: number;
        hosted_invoice_url: string;
        invoice_pdf: string;
      }>;
    };

    return result.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amountCents: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      date: new Date(inv.created * 1000).toISOString(),
      url: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));
  } catch (err) {
    logger.warn({ err, orgId, customerId }, "[billing] Failed to fetch invoices");
    return [];
  }
}

export async function getBillingStatus(orgId: string) {
  const org = await orgService.get(orgId);
  const plan = ((org as any).billingPlan ?? "free") as PlanType;
  const planConfig = PLANS[plan];

  return {
    plan,
    planName: planConfig.name,
    stripeEnabled,
    customerId: (org as any).billingCustomerId ?? null,
    limits: {
      maxUsers: planConfig.maxUsers,
      maxStorageGb: planConfig.maxStorageGb,
      maxModels: planConfig.maxModels,
    },
    pricing: {
      monthlyPrice: planConfig.priceMonthly,
    },
  };
}

export const billingService = {
  createCheckoutSession,
  createBillingPortalSession,
  handleStripeWebhook,
  getBillingStatus,
  getPaymentMethod,
  getInvoices,
  PLANS,
};
