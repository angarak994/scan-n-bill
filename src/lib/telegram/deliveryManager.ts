/**
 * QControl Telegram Bot - Webhook & Delivery Lifecycle Manager
 * 
 * Provides:
 * 1. Self-healing webhook registration & verification.
 * 2. Automated health inspection (pending update backlog, error messages).
 * 3. Safe handoff between worker long-polling and serverless webhook.
 * 4. Zero avoidable downtime: automatically re-registers webhook if dropped.
 */

import { TelegramClient } from './telegramClient';

export interface WebhookStatus {
  isConfigured: boolean;
  isCorrectUrl: boolean;
  currentUrl: string;
  expectedUrl: string;
  pendingUpdateCount: number;
  lastErrorDate?: string;
  lastErrorMessage?: string;
  hasCustomCertificate: boolean;
}

export class DeliveryManager {
  /**
   * Derives the canonical production webhook URL from environment.
   */
  public static getCanonicalWebhookUrl(): string {
    const baseUrl =
      process.env.APP_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'https://scan-n-bill.vercel.app';

    const normalized = baseUrl.replace(/\/+$/, '');
    return `${normalized}/api/telegram-webhook`;
  }

  /**
   * Inspects Telegram Webhook status and health.
   */
  public static async getWebhookStatus(): Promise<WebhookStatus> {
    const expectedUrl = this.getCanonicalWebhookUrl();
    const infoRes = await TelegramClient.getWebhookInfo();

    if (!infoRes.ok || !infoRes.result) {
      return {
        isConfigured: false,
        isCorrectUrl: false,
        currentUrl: '',
        expectedUrl,
        pendingUpdateCount: 0,
        hasCustomCertificate: false,
        lastErrorMessage: infoRes.description || 'Failed to query Telegram getWebhookInfo',
      };
    }

    const currentUrl = infoRes.result.url || '';
    const isConfigured = Boolean(currentUrl && currentUrl.length > 0);
    const isCorrectUrl = isConfigured && currentUrl.toLowerCase() === expectedUrl.toLowerCase();

    return {
      isConfigured,
      isCorrectUrl,
      currentUrl,
      expectedUrl,
      pendingUpdateCount: infoRes.result.pending_update_count || 0,
      lastErrorDate: infoRes.result.last_error_date ? new Date(infoRes.result.last_error_date * 1000).toISOString() : undefined,
      lastErrorMessage: infoRes.result.last_error_message,
      hasCustomCertificate: Boolean(infoRes.result.has_custom_certificate),
    };
  }

  /**
   * Ensures the production webhook is registered with Telegram.
   * Restores it automatically if missing, mismatched, or broken.
   */
  public static async ensureWebhookRegistered(options: { force?: boolean; dropPending?: boolean } = {}): Promise<{
    success: boolean;
    previousUrl?: string;
    newUrl?: string;
    actionTaken: 'restored' | 'already_active' | 'failed';
    message?: string;
  }> {
    const status = await this.getWebhookStatus();

    if (!options.force && status.isCorrectUrl) {
      return {
        success: true,
        previousUrl: status.currentUrl,
        newUrl: status.expectedUrl,
        actionTaken: 'already_active',
        message: 'Webhook is already correctly registered and active',
      };
    }

    console.log(`[DeliveryManager] Restoring webhook -> ${status.expectedUrl} (previous: "${status.currentUrl}")`);

    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || 'qcontrol_secure_webhook_123';
    const setRes = await TelegramClient.setWebhook(
      status.expectedUrl,
      secretToken,
      options.dropPending ?? false
    );

    if (setRes.ok) {
      console.log(`[DeliveryManager] ✅ Webhook successfully restored to ${status.expectedUrl}`);
      return {
        success: true,
        previousUrl: status.currentUrl,
        newUrl: status.expectedUrl,
        actionTaken: 'restored',
        message: 'Successfully registered Telegram webhook',
      };
    } else {
      console.error(`[DeliveryManager] ❌ Failed to set webhook:`, setRes.description);
      return {
        success: false,
        previousUrl: status.currentUrl,
        newUrl: status.expectedUrl,
        actionTaken: 'failed',
        message: setRes.description || 'Telegram rejected setWebhook request',
      };
    }
  }

  /**
   * Prepares Telegram for local long-polling worker mode by removing conflicting webhook.
   */
  public static async prepareForPolling(): Promise<boolean> {
    console.log('[DeliveryManager] Disabling webhook for polling mode...');
    const dropRes = await TelegramClient.deleteWebhook(false);
    return dropRes.ok;
  }

  /**
   * Gracefully restores production webhook when a worker shuts down.
   */
  public static async restoreWebhookOnWorkerExit(): Promise<void> {
    try {
      console.log('[DeliveryManager] Process exit triggered: restoring production webhook...');
      await this.ensureWebhookRegistered({ force: true, dropPending: false });
    } catch (e: any) {
      console.error('[DeliveryManager] Error restoring webhook on exit:', e.message || e);
    }
  }
}
