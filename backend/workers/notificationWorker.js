import cron from 'node-cron';
import webpush from 'web-push';
import { User } from '../models/User.model.js';

// Setup VAPID keys
export const initWebPush = () => {
  const publicKey = process.env.PUBLIC_VAPID_KEY;
  const privateKey = process.env.PRIVATE_VAPID_KEY;

  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      'mailto:personal-todo-assistant@example.com',
      publicKey,
      privateKey
    );
    console.log("Web-Push VAPID details configured successfully.");
  } else {
    console.warn("Web-Push VAPID keys are missing. Push notifications will fail until configured.");
  }
};

const sendPush = async (user, title, body, soundUrl = '/sounds/custom-alert.wav') => {
  if (!user.pushSubscription) return;

  const payload = JSON.stringify({
    title,
    body,
    soundUrl,
    taskId: 'daily-reminder', // generic id
  });

  try {
    await webpush.sendNotification(user.pushSubscription, payload);
    console.log(`Push notification sent successfully to user ${user.name}`);
  } catch (error) {
    console.error(`Failed to send push to user ${user._id}:`, error);
    // Cleanup expired subscriptions (HTTP 410 Gone)
    if (error.statusCode === 410) {
      user.pushSubscription = null;
      await user.save();
      console.log(`Cleared expired push subscription for user ${user._id}`);
    }
  }
};

// Worker function to trigger reminders
export const triggerScheduledReminders = async (preference) => {
  try {
    const users = await User.find({
      reminderPreference: preference,
      pushSubscription: { $ne: null }
    });

    console.log(`Found ${users.length} users subscribing to ${preference} reminders.`);

    for (const user of users) {
      const message = preference === 'morning'
        ? `Good morning, ${user.name}! ☀️ Time to structure your day. Click here to talk to your assistant.`
        : `Ready for bed, ${user.name}? 🌙 Dump tomorrow's tasks now so you don't forget them!`;
      
      await sendPush(user, `Assistant Reminder 🤖`, message);
    }
  } catch (error) {
    console.error(`Error in scheduled reminders worker for preference: ${preference}`, error);
  }
};

// Schedule Jobs:
// 1. Morning Cron: 7:00 AM daily
cron.schedule('0 7 * * *', () => {
  console.log("Running Morning Reminder Cron Job...");
  triggerScheduledReminders('morning');
});

// 2. Night Cron: 10:00 PM daily
cron.schedule('0 22 * * *', () => {
  console.log("Running Night Reminder Cron Job...");
  triggerScheduledReminders('night');
});
