import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
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

// Serve frontend static files in production
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all to serve index.html for SPA routing (React Router)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server & Connect Database
const startServer = async () => {
  try {
    await connectDB();
    
    // Debug directory structure on Cloud Run
    const publicPath = path.join(__dirname, 'public');
    if (fs.existsSync(publicPath)) {
      console.log(`[Startup] public folder exists. Contents:`, fs.readdirSync(publicPath));
      const assetsPath = path.join(publicPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        console.log(`[Startup] public/assets folder exists. Contents:`, fs.readdirSync(assetsPath));
      } else {
        console.log(`[Startup] public/assets folder does NOT exist!`);
      }
    } else {
      console.log(`[Startup] public folder does NOT exist at ${publicPath}!`);
    }

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
