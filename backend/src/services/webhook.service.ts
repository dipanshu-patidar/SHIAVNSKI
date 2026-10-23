import Retell from 'retell-sdk';
import { prisma } from '../db/prisma.js';
import { getRetellWebhookKey } from '../config/index.js';
import { RetellWebhookPayload } from '../schemas/webhook.schema.js';

export interface WebhookProcessResult {
  idempotent: boolean;
  duplicate: boolean;
  status: 'PROCESSED' | 'DUPLICATE' | 'PENDING_ORPHAN' | 'FAILED' | 'IGNORED';
  providerCallId: string;
  internalCallId?: string;
  message: string;
}

export class WebhookService {
  /**
   * Cryptographically verify Retell webhook signature using the official Retell SDK.
   * Compares the HMAC-SHA256 signature against the exact raw request payload and signing key.
   */
  async verifySignature(rawBody: string, signature: string): Promise<boolean> {
    if (!signature || signature.trim() === '') {
      return false;
    }

    const signingKey = getRetellWebhookKey();
    if (!signingKey || signingKey.trim() === '') {
      // Cannot verify without a configured Retell webhook key / API key
      return false;
    }

    try {
      // Official Retell SDK verification method
      return await Retell.verify(rawBody, signingKey, signature);
    } catch {
      return false;
    }
  }

  /**
   * Process incoming Retell webhook event with strict deduplication and idempotent DB persistence.
   */
  async processRetellWebhook(
    payload: RetellWebhookPayload,
    headers?: Record<string, unknown>
  ): Promise<WebhookProcessResult> {
    const { event, call } = payload;
    const providerCallId = call.call_id;

    // Determine event timestamp for deterministic deduplication
    const rawTimestamp = call.end_timestamp || call.start_timestamp;
    const eventTimestamp = rawTimestamp ? new Date(rawTimestamp) : null;

    // 1. Idempotency Check: Verify if this event was already ingested
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        provider: 'retell',
        providerCallId,
        eventType: event,
        ...(eventTimestamp ? { eventTimestamp } : {}),
      },
    });

    if (existingEvent) {
      // Duplicate event detected from Retell webhook retry mechanism
      await prisma.webhookEvent.update({
        where: { id: existingEvent.id },
        data: {
          retryCount: { increment: 1 },
          status: existingEvent.status === 'PROCESSED' ? 'PROCESSED' : 'DUPLICATE',
        },
      });

      return {
        idempotent: true,
        duplicate: true,
        status: 'DUPLICATE',
        providerCallId,
        message: 'Duplicate event received and acknowledged idempotently without re-execution',
      };
    }

    // 2. Persist the raw event in PostgreSQL webhook_events table
    let recordedEvent;
    try {
      recordedEvent = await prisma.webhookEvent.create({
        data: {
          provider: 'retell',
          providerCallId,
          eventType: event,
          status: 'PENDING',
          payload: payload as any,
          headers: headers ? (headers as any) : undefined,
          eventTimestamp,
        },
      });
    } catch {
      // In case of parallel race condition hitting unique constraint
      return {
        idempotent: true,
        duplicate: true,
        status: 'DUPLICATE',
        providerCallId,
        message: 'Race condition duplicate caught by database constraint',
      };
    }

    // 3. Locate the corresponding Call record in PostgreSQL
    const callRecord = await prisma.call.findUnique({
      where: { providerCallId },
    });

    if (!callRecord) {
      // Orphan event: Call was not initiated from this system or is an untracked external call
      await prisma.webhookEvent.update({
        where: { id: recordedEvent.id },
        data: {
          status: 'PENDING_ORPHAN',
          errorMessage: 'No matching Call record found for providerCallId',
        },
      });

      return {
        idempotent: true,
        duplicate: false,
        status: 'PENDING_ORPHAN',
        providerCallId,
        message: 'Webhook acknowledged; no matching Call record found in local database',
      };
    }

    // 4. State Transition & Telemetry Updates (with Terminal State Protection)
    try {
      const updateData: any = {};
      const isTerminal = callRecord.status === 'ENDED' || callRecord.status === 'FAILED';

      if (event === 'call_started') {
        // Enforce terminal state protection: do NOT regress if call is already ENDED or FAILED
        if (!isTerminal && callRecord.status === 'INITIATED') {
          updateData.status = 'ONGOING';
        }
        if (call.start_timestamp && Number.isFinite(call.start_timestamp) && call.start_timestamp > 0) {
          updateData.startedAt = new Date(call.start_timestamp);
        }
      } else if (event === 'call_ended') {
        // Only set status to ENDED if not in FAILED terminal state
        if (callRecord.status !== 'FAILED') {
          updateData.status = 'ENDED';
        }

        // Safe duration calculation: validate finite, non-negative, and fallback to timestamps
        if (typeof call.duration_ms === 'number' && Number.isFinite(call.duration_ms)) {
          updateData.durationSeconds = Math.max(0, Math.round(call.duration_ms / 1000));
        } else if (
          call.start_timestamp &&
          call.end_timestamp &&
          Number.isFinite(call.start_timestamp) &&
          Number.isFinite(call.end_timestamp) &&
          call.end_timestamp >= call.start_timestamp
        ) {
          updateData.durationSeconds = Math.max(0, Math.round((call.end_timestamp - call.start_timestamp) / 1000));
        } else if (callRecord.startedAt && call.end_timestamp && Number.isFinite(call.end_timestamp)) {
          const startedMs = callRecord.startedAt.getTime();
          updateData.durationSeconds = Math.max(0, Math.round((call.end_timestamp - startedMs) / 1000));
        }

        if (call.disconnection_reason) {
          updateData.disconnectionReason = call.disconnection_reason;
        }
        if (call.transcript) {
          updateData.transcriptText = call.transcript;
        }
        if (call.transcript_object) {
          updateData.transcriptObject = call.transcript_object;
        }
        if (call.recording_url) {
          updateData.recordingUrl = call.recording_url;
        }
        if (call.start_timestamp && Number.isFinite(call.start_timestamp) && call.start_timestamp > 0) {
          updateData.startedAt = new Date(call.start_timestamp);
        }
        if (call.end_timestamp && Number.isFinite(call.end_timestamp) && call.end_timestamp > 0) {
          updateData.endedAt = new Date(call.end_timestamp);
        }
      } else if (event === 'call_analyzed') {
        // Only transition to ENDED if not already in a terminal state
        if (!isTerminal) {
          updateData.status = 'ENDED';
        }
        if (call.call_analysis) {
          if (call.call_analysis.call_summary) {
            updateData.summary = call.call_analysis.call_summary;
          }
          if (call.call_analysis.user_sentiment) {
            updateData.sentiment = call.call_analysis.user_sentiment;
          }
          if (call.call_analysis.call_successful !== undefined) {
            updateData.callSuccessful = call.call_analysis.call_successful;
          }
          if (call.call_analysis.custom_analysis_data) {
            updateData.customAnalysis = call.call_analysis.custom_analysis_data;
          }
        }
      } else if (event === 'transcript_updated') {
        if (call.transcript) {
          updateData.transcriptText = call.transcript;
        }
        if (call.transcript_object) {
          updateData.transcriptObject = call.transcript_object;
        }
      }

      // Execute atomic update
      await prisma.call.update({
        where: { id: callRecord.id },
        data: updateData,
      });

      // Mark webhook event as processed
      await prisma.webhookEvent.update({
        where: { id: recordedEvent.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return {
        idempotent: true,
        duplicate: false,
        status: 'PROCESSED',
        providerCallId,
        internalCallId: callRecord.id,
        message: `Successfully processed ${event} event for call ${callRecord.id}`,
      };
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { id: recordedEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: err?.message || 'Failed to process event state update',
        },
      });
      throw err;
    }
  }
}

export const webhookService = new WebhookService();
