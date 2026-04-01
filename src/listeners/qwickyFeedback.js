'use strict';

const QWICKY_CHANNEL_ID = '1467942158135853218';
const MIN_CONTENT_LENGTH = 15;
const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Forwards #qwicky channel messages to the Paperclip routine webhook.
 * Fire-and-forget — never throws.
 *
 * @param {import('discord.js').Message} message
 */
async function handleQwickyFeedback(message) {
  if (message.author.bot) return;
  if (message.channelId !== QWICKY_CHANNEL_ID) return;
  if (message.content.trim().length < MIN_CONTENT_LENGTH) return;

  const webhookUrl = process.env.PAPERCLIP_QWICKY_WEBHOOK_URL;
  const webhookSecret = process.env.PAPERCLIP_QWICKY_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${webhookSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message.content,
        author: message.author.username,
        authorId: message.author.id,
        timestamp: message.createdTimestamp,
        guildId: message.guildId,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error('[QwickyFeedback] Failed to forward message to webhook:', err.message);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { handleQwickyFeedback };
