import webpush from 'web-push';
import { Task } from '../models/Task.model.js';
import { User } from '../models/User.model.js';

// Map to track active timeouts for reminder starts
const scheduledRemindersMap = new Map();

/**
 * Recursive snooze loop that runs every 5 minutes until a task is marked complete
 * @param {string} taskId 
 */
export const triggerSnoozeNotificationLoop = async (taskId) => {
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      console.log(`[Snooze] Task ${taskId} not found. Terminating snooze loop.`);
      return;
    }

    if (task.isCompleted) {
      console.log(`[Snooze] Task "${task.title}" (${taskId}) is completed. Snooze loop terminated.`);
      return;
    }

    const user = await User.findById(task.userId);
    if (!user || !user.pushSubscription) {
      console.log(`[Snooze] User or push subscription missing for task "${task.title}". Terminating snooze loop.`);
      return;
    }

    // Sound file config
    const soundUrl = '/sounds/custom-alert.wav';

    // Construct the payload
    const payload = JSON.stringify({
      taskId: task._id,
      title: `🚨 Urgent Task Reminder`,
      body: `Your task "${task.title}" is pending!`,
      soundUrl
    });

    console.log(`[Snooze] Sending alert for task: "${task.title}".`);
    
    await webpush.sendNotification(user.pushSubscription, payload).catch(err => {
      console.error(`[Snooze] Failed sending push notification for task ${task.title}:`, err);
    });

    // Schedule next reminder iteration in 5 minutes (300,000ms)
    // For testing/easy demonstration, we will use 1 minute (60,000ms) if process.env.NODE_ENV === 'development' or 5 mins
    const delay = process.env.NODE_ENV === 'development' ? 60 * 1000 : 5 * 60 * 1000;
    
    setTimeout(() => {
      triggerSnoozeNotificationLoop(taskId);
    }, delay);

  } catch (error) {
    console.error(`[Snooze] Error in snooze loop for task ${taskId}:`, error);
  }
};

/**
 * Schedule a task snooze loop to trigger at its due time
 * @param {object} task 
 */
export const scheduleTaskReminder = (task) => {
  if (!task.dueDate || !task.dueTime) return;

  const taskIdStr = task._id.toString();

  // Cancel any existing scheduled reminder for this task
  if (scheduledRemindersMap.has(taskIdStr)) {
    clearTimeout(scheduledRemindersMap.get(taskIdStr));
    scheduledRemindersMap.delete(taskIdStr);
  }

  // Calculate target date-time
  const dateStr = task.dueDate.toISOString().split('T')[0];
  const targetDate = new Date(`${dateStr}T${task.dueTime}:00`);
  const now = new Date();

  const msUntilDue = targetDate.getTime() - now.getTime();

  if (msUntilDue > 0) {
    console.log(`[Scheduler] Scheduling reminder for task "${task.title}" in ${Math.round(msUntilDue / 1000 / 60)} minutes.`);
    
    const timeoutId = setTimeout(() => {
      triggerSnoozeNotificationLoop(task._id);
      scheduledRemindersMap.delete(taskIdStr);
    }, msUntilDue);

    scheduledRemindersMap.set(taskIdStr, timeoutId);
  } else if (Math.abs(msUntilDue) < 15 * 60 * 1000 && !task.isCompleted) {
    // If it's overdue by less than 15 minutes and not completed, trigger snooze loop immediately
    console.log(`[Scheduler] Task "${task.title}" is overdue. Launching snooze loop immediately.`);
    triggerSnoozeNotificationLoop(task._id);
  }
};

/**
 * Cancel a scheduled reminder timeout
 * @param {string} taskId 
 */
export const cancelTaskReminder = (taskId) => {
  const taskIdStr = taskId.toString();
  if (scheduledRemindersMap.has(taskIdStr)) {
    clearTimeout(scheduledRemindersMap.get(taskIdStr));
    scheduledRemindersMap.delete(taskIdStr);
    console.log(`[Scheduler] Cancelled scheduled reminder for task ${taskIdStr}`);
  }
};
