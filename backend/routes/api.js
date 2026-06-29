import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middleware/auth.middleware.js';
import {
  register,
  login,
  logout,
  saveOnboarding,
  saveSubscription,
  getProfile,
  updateProfile
} from '../controllers/auth.controller.js';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getCalendarFeed,
  checkPreviousDayTasks,
  rolloverTasksToToday,
  downloadAttachment
} from '../controllers/task.controller.js';
import { handleVoiceCommand } from '../controllers/voice.controller.js';
import {
  getAuthUrl,
  getGoogleLoginAuthUrl,
  googleCallback,
  getGoogleCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent
} from '../controllers/googleCalendar.controller.js';
import { scheduleTaskReminder, cancelTaskReminder } from '../workers/reminderEngine.js';

const router = express.Router();

// Multer Storage Configuration for task attachments
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // limit to 50MB
});

// Authentication routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/google', getGoogleLoginAuthUrl);
router.post('/auth/logout', logout);
router.get('/auth/profile', protect, getProfile);
router.put('/auth/profile', protect, updateProfile);
router.post('/auth/onboarding', protect, saveOnboarding);
router.post('/auth/subscription', protect, saveSubscription);
router.get('/auth/vapid-key', protect, (req, res) => {
  res.status(200).json({ publicKey: process.env.PUBLIC_VAPID_KEY });
});

// Task routes
router.post('/tasks', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    // Call controller
    await createTask(req, res);
  } catch (error) {
    next(error);
  }
});
router.get('/tasks', protect, getTasks);
router.get('/tasks/calendar-feed', protect, getCalendarFeed);
router.get('/tasks/check-previous-day', protect, checkPreviousDayTasks);
router.post('/tasks/rollover', protect, rolloverTasksToToday);

router.patch('/tasks/:id', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    // Intercept update to schedule/reschedule snooze loops
    const { dueTime, dueDate, isCompleted } = req.body;
    
    // Call controller to update task
    await updateTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/tasks/:id', protect, async (req, res, next) => {
  try {
    const taskId = req.params.id;
    cancelTaskReminder(taskId);
    await deleteTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/tasks/:taskId/attachments/:attachmentId', protect, downloadAttachment);

// Voice assistant processing route
router.post('/voice/process', protect, handleVoiceCommand);

// Google Integration routes
router.get('/integrations/google/auth', protect, getAuthUrl);
router.get('/integrations/google/callback', googleCallback);
router.get('/integrations/google-calendar/events', protect, getGoogleCalendarEvents);
router.post('/integrations/google-calendar/events', protect, createGoogleCalendarEvent);
router.patch('/integrations/google-calendar/events/:eventId', protect, updateGoogleCalendarEvent);

export default router;
