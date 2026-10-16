/**
 * QControl Telegram Bot - Resilient API Client
 * 
 * Guarantees:
 * 1. Strict network timeouts (AbortSignal.timeout) to prevent hanging event loops.
 * 2. Transient error retries (ECONNRESET, ETIMEDOUT, 502/503/504) with exponential backoff.
 * 3. Telegram 429 Too Many Requests rate-limit compliance (respects retry_after).
 * 4. Zero silent failures: detailed structured logging on anomalies.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_TIMEOUT_MS = 6000;
const MAX_RETRIES = 2;

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
    migrate_to_chat_id?: number;
  };
}

export class TelegramClient {
  private static getApiBase(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('[TelegramClient] TELEGRAM_BOT_TOKEN is not defined in environment');
    }
    return `https://api.telegram.org/bot${token}`;
  }

  /**
   * Core request executor with timeout and retry logic
   */
  public static async call<T = any>(
    method: string,
    payload?: any,
    options: { timeoutMs?: number; retries?: number } = {}
  ): Promise<TelegramApiResponse<T>> {
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const maxRetries = options.retries ?? MAX_RETRIES;
    const url = `${this.getApiBase()}/${method}`;

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle Telegram HTTP 429 Too Many Requests
        if (res.status === 429) {
          const rateData = (await res.json().catch(() => ({}))) as TelegramApiResponse<T>;
          const retryAfterSec = rateData.parameters?.retry_after || 1;
          console.warn(`[TelegramClient] 429 Rate limited on ${method}. Waiting ${retryAfterSec}s...`);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
            continue;
          }
          return rateData;
        }

        // Handle server errors (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
        if (res.status >= 500 && attempt < maxRetries) {
          const backoff = 500 * Math.pow(2, attempt);
          console.warn(`[TelegramClient] HTTP ${res.status} on ${method}. Retrying in ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        const data = (await res.json()) as TelegramApiResponse<T>;
        if (!data.ok) {
          console.warn(`[TelegramClient] ${method} returned ok=false: ${data.description} (code ${data.error_code})`);
        }
        return data;
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
        const isTransient = isAbort || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message?.includes('fetch failed');

        if (isTransient && attempt < maxRetries) {
          const backoff = 400 * Math.pow(2, attempt);
          console.warn(`[TelegramClient] Network blip on ${method} (${err.message}). Retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        console.error(`[TelegramClient] Failed call to ${method}:`, err.message || err);
        break;
      }
    }

    return {
      ok: false,
      description: lastError?.message || 'Network request failed after retries',
      error_code: -1,
    };
  }

  // --- Convenience Methods ---

  public static async sendMessage(chatId: string | number, text: string, replyMarkup?: any, timeoutMs?: number) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }, { timeoutMs: timeoutMs || 5000 });
  }

  public static async editMessageText(chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
    const finalReplyMarkup = replyMarkup === undefined ? { inline_keyboard: [] } : replyMarkup;
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: finalReplyMarkup,
    }, { timeoutMs: 5000 });
  }

  public static async editMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup: any) {
    return this.call('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    }, { timeoutMs: 4000 });
  }

  public static async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }, { timeoutMs: 4000 });
  }

  public static async getWebhookInfo() {
    return this.call('getWebhookInfo', undefined, { timeoutMs: 5000 });
  }

  public static async setWebhook(url: string, secretToken?: string, dropPendingUpdates = false) {
    return this.call('setWebhook', {
      url,
      secret_token: secretToken || process.env.TELEGRAM_WEBHOOK_SECRET || 'qcontrol_secure_webhook_123',
      drop_pending_updates: dropPendingUpdates,
      allowed_updates: ['message', 'callback_query'],
    }, { timeoutMs: 10000 });
  }

  public static async deleteWebhook(dropPendingUpdates = false) {
    return this.call('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    }, { timeoutMs: 8000 });
  }

  public static async getMe() {
    return this.call('getMe', undefined, { timeoutMs: 5000 });
  }

  public static async getUpdates(offset: number, timeout = 25, allowedUpdates = ['message', 'callback_query']) {
    return this.call('getUpdates', {
      offset,
      timeout,
      allowed_updates: allowedUpdates,
    }, { timeoutMs: (timeout + 10) * 1000 });
  }
}
