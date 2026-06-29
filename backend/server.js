import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/api.js';
import { initWebPush } from './workers/notificationWorker.js';
import { Task } from './models/Task.model.js';
import { scheduleTaskReminder } from './workers/reminderEngine.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', apiRoutes);

// Simple healthcheck route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// Start Server & Connect Database
const startServer = async () => {
  try {
    await connectDB();
    
    // Initialize Web Push details
    initWebPush();
    
    // Sync scheduled reminders from DB on boot
    const pendingTasks = await Task.find({ isCompleted: false, dueDate: { $ne: null } });
    console.log(`[Startup] Found ${pendingTasks.length} pending tasks. Restoring scheduled reminders...`);
    pendingTasks.forEach(task => {
      scheduleTaskReminder(task);
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  } catch (error) {
    console.error(`Server startup error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
