import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getPayPalClient } from "@/lib/paypal";
import { parseWebhookEvent, readWebhookHeaders } from "@/lib/paypal/webhook";
import {
  processWebhookEvent,
  recordWebhookEvent,
} from "@/lib/repositories/webhook-repository";

/**
 * PayPal webhook. Verifies the signature, stores the event once (deduped by
 * event ID), answers 200, then processes it in `after()`.
 *
 * Non-2xx answers make PayPal redeliver, so only a server-side problem
 * (missing config, PayPal unreachable) returns 500. Bad requests get 400/401.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = readWebhookHeaders(request.headers);
  const event = parseWebhookEvent(rawBody);
  if (!headers || !event) {
    return NextResponse.json(
      { error: "Not a PayPal webhook." },
      { status: 400 },
    );
  }

  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PayPal webhook received but PAYPAL_WEBHOOK_ID is not set.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  let verified: boolean;
  try {
    verified = await getPayPalClient().verifyWebhookSignature({
      headers,
      webhookId,
      rawBody,
    });
  } catch (error) {
    console.error("PayPal webhook verification failed to run.", error);
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const { needsProcessing } = await recordWebhookEvent(event);
  if (needsProcessing) {
    after(async () => {
      try {
        const { commissionId } = await processWebhookEvent(event.id);
        if (commissionId) {
          revalidateTag("commissions", { expire: 0 });
          revalidateTag(`commission-${commissionId}`, { expire: 0 });
        }
      } catch (error) {
        console.error(`PayPal webhook ${event.id} failed to process.`, error);
      }
    });
  }

  return NextResponse.json({ received: true });
}
