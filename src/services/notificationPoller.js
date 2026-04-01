const { claimNotifications, completeNotification, failNotification } = require('./supabase');
const { handleEditSubmission } = require('./handlers/editSubmission');
const { handlePostSchedule } = require('./handlers/postSchedule');
const { handleGameDayReminder } = require('./handlers/gameDayReminder');
const { handleUnscheduledAlert } = require('./handlers/unscheduledAlert');
const { handleAdminAlert } = require('./handlers/adminAlert');
const { handleDiscoverySummary } = require('./handlers/discoverySummary');
const { handleAnnouncement } = require('./handlers/announcement');

// Handler registry — extend as new notification types are added
const handlers = {
  edit_submission: handleEditSubmission,
  post_schedule: handlePostSchedule,
  game_day_reminder: handleGameDayReminder,
  unscheduled_alert: handleUnscheduledAlert,
  admin_alert: handleAdminAlert,
  discovery_summary: handleDiscoverySummary,
  announcement: handleAnnouncement,
};

async function pollOnce(client) {
  let claimed;
  try {
    claimed = await claimNotifications(10);
  } catch (err) {
    console.error('[NotificationPoller] Failed to claim notifications:', err.message);
    return;
  }

  if (claimed.length === 0) return;
  console.log(`[NotificationPoller] Processing ${claimed.length} notification(s)`);

  for (const notification of claimed) {
    const handler = handlers[notification.notification_type];
    if (!handler) {
      console.warn(`[NotificationPoller] Unknown type: ${notification.notification_type}`);
      await failNotification(
        notification.id,
        `Unknown notification type: ${notification.notification_type}`
      );
      continue;
    }

    try {
      await handler(client, notification);
      await completeNotification(notification.id);
    } catch (err) {
      console.error(
        `[NotificationPoller] Error handling ${notification.notification_type} (${notification.id}):`,
        err.message
      );
      await failNotification(notification.id, err.message);
    }
  }
}

function startNotificationPoller(client, intervalMs = 30000) {
  console.log(`[NotificationPoller] Started (polling every ${intervalMs / 1000}s)`);

  // Initial poll after a short delay
  setTimeout(() => pollOnce(client), 5000);

  setInterval(() => pollOnce(client), intervalMs);
}

module.exports = { startNotificationPoller, pollOnce };
