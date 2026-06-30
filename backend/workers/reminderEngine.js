import webpush from 'web-push';
import { Task } from '../models/Task.model.js';
import { User } from '../models/User.model.js';

// Map to track active timeouts (kept for fallback compatibility)
const scheduledRemindersMap = new Map();

/**
 * Main stateless engine that queries the database for due tasks
 * and triggers push notifications if they haven't been sent.
 */
export const checkAndTriggerDueReminders = async () => {
  try {
    const now = new Date();
    
    // Find all incomplete tasks that have a due date and time
    const incompleteTasks = await Task.find({
      isCompleted: false,
      dueDate: { $ne: null },
      dueTime: { $ne: null }
    });

    console.log(`[Reminder Engine] Checking ${incompleteTasks.length} incomplete tasks for due reminders...`);

    for (const task of incompleteTasks) {
      try {
        // Parse target due date-time
        const dateStr = task.dueDate.toISOString().split('T')[0];
        const targetDate = new Date(`${dateStr}T${task.dueTime}:00`);

        // Check if current time is past or equal to target due date-time
        if (now >= targetDate) {
          // Nagging interval: 1 minute in development, 5 minutes in production
          const intervalMs = process.env.NODE_ENV === 'development' ? 60 * 1000 : 5 * 60 * 1000;
          const timeSinceLastReminder = task.lastReminderSentAt 
            ? now - new Date(task.lastReminderSentAt) 
            : Infinity;

          if (timeSinceLastReminder >= intervalMs) {
            const user = await User.findById(task.userId);
            if (user && user.pushSubscription) {
              const soundUrl = '/sounds/custom-alert.wav';
              const payload = JSON.stringify({
                taskId: task._id,
                title: `🚨 Urgent Task Reminder`,
                body: `Your task "${task.title}" is pending!`,
                soundUrl
              });

              console.log(`[Reminder Engine] Sending push notification for task "${task.title}" to user ${user.name}`);
              
              await webpush.sendNotification(user.pushSubscription, payload);
              
              // Update lastReminderSentAt in the DB
              task.lastReminderSentAt = now;
              await task.save();
            } else {
              console.log(`[Reminder Engine] User or push subscription missing for task "${task.title}".`);
            }
          }
        }
      } catch (err) {
        console.error(`[Reminder Engine] Error processing task ${task._id}:`, err);
      }
    }
  } catch (error) {
    console.error(`[Reminder Engine] General error checking due reminders:`, error);
  }
};

/**
 * Compat/Fallback helper. Runs the stateless reminder check immediately.
 */
export const scheduleTaskReminder = async (task) => {
  console.log(`[Scheduler] Checking reminders due to task creation/update for "${task.title}"`);
  // Trigger stateless check immediately to see if any reminder is pending
  checkAndTriggerDueReminders();
};

/**
 * Compat/Fallback helper.
 */
export const cancelTaskReminder = (taskId) => {
  console.log(`[Scheduler] Request to cancel reminder for task ${taskId}`);
};

// Start in-memory backup interval that runs every 1 minute
// This keeps the engine warm as long as the server container is running
setInterval(() => {
  console.log('[Interval Checker] Triggering periodic check for reminders...');
  checkAndTriggerDueReminders();
}, 60 * 1000);
