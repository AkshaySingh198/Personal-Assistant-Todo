personal asis ()todo
 techstack- MERN stack. 
 architecture:- feature based (frontend), seperate backend and frontend folder .
 design:9(1)for(darkmode) https://www.figma.com/design/j38vPQBPvWRo3o4ap0is0N/UpTodo---Todo-list-app-UI-Kit--Community-?node-id=0-1&p=f&t=Vd0ZLBT2QZYF2Uqr-0

 (2)(base design)https://www.figma.com/design/qbAuLhOcXjXNvAQ8Tt60IJ/Todoist-Free-UI-Kit---By-Marvilo--Community-?node-id=0-1&p=f&t=1w9ZKg6f2FknTIln-0
 
flow:- login or register->pre-home page->index page(contain all todo)
login ->google auth latest , or email +password (jwt authentication and cookies).
registeration ->form :name (full name),email, password,DOB ,agent(option:- Ayra ,Jordan),habbit(optional), first notification prefferance -morning,or night.
page 2 - question -["What best describes your usual day?"option-Options: Mostly at a desk / Mix of field and desk / Always on the move / Varies completely,"When you're stuck on a problem, what do you usually do first?" Options: Google it / Think it through myself / Ask someone / Just try things until it works,"When someone explains something, what annoys you most?"Options: Too much detail / Too vague / Skips the why / Talks down to me.]

##Ai part:
  name of agent -Ayra or Jordan as user select on registeration.
  pre-home page (page of ai for voice recognition)

  feature AI:-To handle adding, updating, and deleting tasks—for both a specific item or an entire day's schedule—we need to expand our backend processor from a basic extractor into a full Voice Command Router.

Instead of assuming every voice message is a new task, the AI will now look at the user's intent and label each action as "CREATE", "UPDATE", or "DELETE". It will also give you a clean database query target (like matching by text tokens or a specific target date).

Here is the robust schema and architecture to handle this.

1. The Dynamic Command Router Schema (Node.js)
We use Zod to allow the AI to output an array of multi-action commands. This means a user could say, "Add a meeting at 4 PM and delete my grocery task" in a single breath, and your system can process both.

JavaScript
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the shape of a single processed command action
const VoiceActionSchema = z.object({
  actionType: z.enum(["CREATE", "UPDATE", "DELETE"]).description(
    "CREATE: For adding new items. UPDATE: For changing times, priorities, or completing tasks. DELETE: For removing/clearing items."
  ),
  targetScope: z.enum(["SINGLE_TASK", "ENTIRE_DAY"]).description(
    "SINGLE_TASK if it targets an individual item (e.g., 'fix the bug'). ENTIRE_DAY if it targets a whole day's plan (e.g., 'clear today's schedule' or 'move all tasks from today to tomorrow')."
  ),
  // Target identifier data (used by your database query to find the right item)
  targetSearchQuery: z.string().optional().description(
    "Keywords to find the specific existing task being updated or deleted (e.g., if user says 'delete the vegetable task', this should be 'vegetable'). Leave blank for CREATE."
  ),
  targetDate: z.string().optional().description(
    "ISO format (YYYY-MM-DD) if an entire day is referenced or targeted (e.g., 'today', 'tomorrow')."
  ),
  // Payload fields (primarily used for CREATE or updating specific values)
  taskPayload: z.object({
    taskTitle: z.string().optional(),
    dueDate: z.string().optional().description("ISO format (YYYY-MM-DD) relative to today."),
    dueTime: z.string().optional().description("24-hour time format (HH:MM)."),
    priority: z.enum(["high", "medium", "low"]).optional(),
    isCompleted: z.boolean().optional().description("Set to true if user says things like 'mark the meeting as done'.")
  }).optional()
});

const VoiceRouterSchema = z.object({
  actions: z.array(VoiceActionSchema).description("List of sequential actions extracted from the user's voice command.")
});
2. Real-World Execution Examples
Let's see exactly how this schema cleanly translates tricky user phrases into clear database instructions:

Case A: Modifying a Specific Task
User Says: "Hey, change the priority of my bug fixing task to high and make it for 6 PM instead."

AI Structured Output:

JSON
{
  "actions": [
    {
      "actionType": "UPDATE",
      "targetScope": "SINGLE_TASK",
      "targetSearchQuery": "bug fixing",
      "taskPayload": {
        "dueTime": "18:00",
        "priority": "high"
      }
    }
  ]
}
Case B: Deleting a Specific Task
User Says: "Actually, delete the vegetable task from my list."

AI Structured Output:

JSON
{
  "actions": [
    {
      "actionType": "DELETE",
      "targetScope": "SINGLE_TASK",
      "targetSearchQuery": "vegetables"
    }
  ]
}
Case C: Clearing an Entire Day's Plan
User Says: "Cancel everything I have planned for today."

AI Structured Output:

JSON
{
  "actions": [
    {
      "actionType": "DELETE",
      "targetScope": "ENTIRE_DAY",
      "targetDate": "2026-06-25"
    }
  ]
}
3. Processing the Actions in Express & MongoDB
Once your Node backend receives this array of actions from the OpenAI API, you loop through them using a switch statement to run the corresponding Mongoose commands.

Here is how you handle the execution routing:

JavaScript
export const handleVoiceController = async (req, res) => {
  const { rawText } = req.body;
  const userId = req.user.id; // From your auth middleware

  // 1. Get structured JSON from OpenAI (using the schema above)
  const parsedData = await getOpenAIStructuredOutput(rawText); 

  // 2. Process each action sequentially
  for (const intent of parsedData.actions) {
    switch (intent.actionType) {
      
      case "CREATE":
        await Task.create({
          userId,
          title: intent.taskPayload.taskTitle,
          dueDate: new Date(`${intent.taskPayload.dueDate}T${intent.taskPayload.dueTime || '23:59'}:00`),
          priority: intent.taskPayload.priority || 'medium'
        });
        break;

      case "UPDATE":
        if (intent.targetScope === "SINGLE_TASK") {
          // Use regex token matching to find the closest task title for that user
          await Task.findOneAndUpdate(
            { userId, title: { $regex: intent.targetSearchQuery, $options: "i" } },
            { $set: intent.taskPayload },
            { new: true }
          );
        }
        break;

      case "DELETE":
        if (intent.targetScope === "SINGLE_TASK") {
          // Delete one specific matching item
          await Task.findOneAndDelete({ 
            userId, 
            title: { $regex: intent.targetSearchQuery, $options: "i" } 
          });
        } else if (intent.targetScope === "ENTIRE_DAY") {
          // Delete all tasks falling within that specific target date string window
          const startOfDay = new Date(`${intent.targetDate}T00:00:00.000Z`);
          const endOfDay = new Date(`${intent.targetDate}T23:59:59.999Z`);
          
          await Task.deleteMany({
            userId,
            dueDate: { $gte: startOfDay, $lte: endOfDay }
          });
        }
        break;
    }
  }

  res.status(200).json({ success: true, message: "Voice actions executed successfully!" });
};



feature if user take a pause of 30sec :-To build this specific conversational flow, we need to move away from treating voice input as a single "one-and-done" API request. Instead, we need to create a stateful voice session managed in your React frontend, supported by a specialized backend route to check historical task completion statuses.

Here is how you can implement the 20-second pause detection, the dynamic follow-up prompts, and the previous-day rollover check using the browser's native Web Speech API in React.

1. The React Voice Assistant Component
This component manages the 20-second timeout tracking. If the user stops talking, a timer starts. If 20 seconds pass without speech, it triggers the helper audio/text prompts.

JavaScript
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SmartVoiceAssistant = () => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  
  const recognitionRef = useRef(null);
  const pauseTimerRef = useRef(null);

  // Text-to-Speech Helper so the assistant can talk back
  const speak = (text) => {
    setAssistantText(text);
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      // Clear the pause timer every time the user says something new
      resetPauseTimer();

      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start(); // Keep listening unless explicitly stopped
      }
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [isListening]);

  // Start the 20-second countdown whenever there is silence
  const resetPauseTimer = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    
    pauseTimerRef.current = setTimeout(() => {
      handlePauseInSpeech();
    }, 20000); // 20 seconds
  };

  const startAssistant = () => {
    setIsListening(true);
    setTranscript('');
    recognitionRef.current.start();
    speak("I am listening. Go ahead with your tasks.");
    resetPauseTimer();
  };

  // Triggered when user pauses for 20 seconds
  const handlePauseInSpeech = () => {
    recognitionRef.current.stop(); // Temporarily pause listening while AI speaks
    speak("Is there anything left, Sir or Ma'am?");
    
    // Listen for a quick "Yes" or "No" confirmation
    setTimeout(() => {
      waitForConfirmation();
    }, 2000); 
  };

  const waitForConfirmation = () => {
    const confirmationRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    confirmationRecognition.lang = 'en-US';
    confirmationRecognition.start();

    confirmationRecognition.onresult = async (event) => {
      const answer = event.results[0][0].transcript.toLowerCase();
      
      if (answer.includes("yes")) {
        speak("Alright, continuing to list your tasks.");
        recognitionRef.current.start();
        resetPauseTimer();
      } else {
        speak("Processing your schedule. Let me check your previous day's data.");
        await processFinalSession(transcript);
      }
    };
  };

  // Runs at the very end when user says "No" (nothing left)
  const processFinalSession = async (fullText) => {
    setIsListening(false);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    try {
      // 1. Process and save the newly spoken tasks first
      await axios.post('/api/voice/process', { rawText: fullText });

      // 2. Check the status of yesterday's tasks from backend
      const response = await axios.get('/api/tasks/check-previous-day');
      const { unfinishedCount } = response.data;

      if (unfinishedCount > 0) {
        speak(`You have ${unfinishedCount} pending tasks left from yesterday. Would you like to roll them over to today?`);
        // Optional: Trigger another quick Yes/No listener here to execute rollover API
      } else {
        speak("Congratulations! All tasks from your previous day were completely finished!");
      }
    } catch (err) {
      console.error("Error finalizing session:", err);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Smart Voice Assistant Dashboard</h2>
      <button onClick={startAssistant} disabled={isListening}>Start Assistant Session</button>
      <div style={{ marginTop: '20px', background: '#f5f5f5', padding: '10px' }}>
        <strong>Live Transcript:</strong> {transcript || "(Listening for speech...)"}
      </div>
      <div style={{ marginTop: '10px', color: 'blue' }}>
        <strong>Assistant Response:</strong> {assistantText}
      </div>
    </div>
  );
};

export default SmartVoiceAssistant;
2. The Backend Endpoints (Node.js & MongoDB)
To make the previous-day check happen at the end of the voice flow, you need a backend route that looks back exactly 24 hours to find any uncompleted tasks.

JavaScript
import { Task } from "../models/Task.model.js";

export const checkPreviousDayTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get date thresholds for yesterday (relative to absolute current date)
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startOfYesterday = new Date(`${yesterdayStr}T00:00:00.000Z`);

    // Find any task that fell in yesterday's window and is NOT completed
    const unfinishedTasks = await Task.find({
      userId,
      dueDate: { $gte: startOfYesterday, $lt: startOfToday },
      isCompleted: false
    });

    return res.status(200).json({
      unfinishedCount: unfinishedTasks.length,
      tasks: unfinishedTasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Optional Endpoint: If user says 'Yes' to add yesterday's items to today
export const rolloverTasksToToday = async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const startOfYesterday = new Date(`${yesterdayStr}T00:00:00.000Z`);

    // Batch update yesterday's uncompleted tasks to target today instead
    const updateResult = await Task.updateMany(
      { userId, dueDate: { $gte: startOfYesterday, $lt: startOfToday }, isCompleted: false },
      { $set: { dueDate: startOfToday } }
    );

    return res.status(200).json({ message: "Tasks successfully rolled over to today's view." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
How this works together step-by-step:
The Brain-Dump: The user opens the app and says: "Hey today I have a project meeting at 4 PM... [silence for 20 seconds while thinking]"

The Prompt: The application recognizes the silence, breaks the loop, and naturally announces via computer speech: "Is there anything left, Sir or Ma'am?"

The Answer: * If the user says "Yes", the application restarts the microphone and appends their next string of speech to the current buffer.

If the user says "No", it instantly ships the whole text payload off to your OpenAI-powered action processor.

The Post-Check: Once the data is processed, the system triggers the check-previous-day API hook. If yesterday's Mongo documents have any outstanding tasks where isCompleted: false, it reads out the total to let the user decide if they want them bumped forward. If everything is checked off, it gives the verbal congrats(HELLO SIR/MA'AM YOU HAVE COMPLETED YOUR ALL TASK CONGRATS )!.


FEATURE Notification:-To handle personalized morning or night reminders based on the user's preference, we need to implement a scheduled notification worker on your backend.

Since you are using the MERN stack, the most robust way to build this is combining Node-cron (to handle the timed scheduling) with Web Push Notifications (so the assistant can alert them directly on their desktop or phone browser, even if your website isn't open).

Here is the step-by-step architecture to link user profiles to automated voice-todo reminders.

1. Update the User Database Schema
First, ensure your MongoDB User model tracks what time they want to be pinged to plan their day.

JavaScript
// models/User.model.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  reminderPreference: {
    type: String,
    enum: ['morning', 'night', 'none'],
    default: 'morning'
  },
  // Store the browser's unique push notification subscription object
  pushSubscription: {
    type: Object,
    default: null
  }
});

export const User = mongoose.model('User', UserSchema);
2. Backend Notification Cron Job (Node.js)
We will use node-cron to check the database twice a day:

7:00 AM: Find all users who want a morning push to plan their upcoming day.

10:00 PM: Find all users who want a night push to plan ahead for tomorrow.

Install the necessary backend packages: npm install node-cron web-push

JavaScript
// workers/notificationWorker.js
import cron from 'node-cron';
import webpush from 'web-push';
import { User } from '../models/User.model.js';

// Setup your public/private VAPID keys for secure push streams
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

// Helper function to blast out the push payloads
const triggerReminders = async (preferenceType, messageText) => {
  try {
    const users = await User.find({ reminderPreference: preferenceType, pushSubscription: { $ne: null } });

    for (const user of users) {
      const payload = JSON.stringify({
        title: `Hey ${user.name || 'there'}! 👋`,
        body: messageText,
        icon: '/assistant-logo.png', // path to your UI icon
      });

      webpush.sendNotification(user.pushSubscription, payload).catch(err => {
        console.error(`Failed sending notification to user ${user._id}:`, err);
        // Clean up dead subscriptions if a user uninstalls permissions
        if (err.statusCode === 410) {
          user.pushSubscription = null;
          user.save();
        }
      });
    }
  } catch (error) {
    console.error(`Error running ${preferenceType} reminder loop:`, error);
  }
};

// 1. MORNING CRON: Runs everyday at 07:00 AM
cron.schedule('0 7 * * *', () => {
  console.log('Running morning reminder script...');
  triggerReminders('morning', "Good morning! Time to organize your day. Tap here to speak your tasks to your assistant.");
});

// 2. NIGHT CRON: Runs everyday at 10:00 PM (22:00)
cron.schedule('0 22 * * *', () => {
  console.log('Running night reflection script...');
  triggerReminders('night', "Ready for bed? Take a quick dump of tomorrow's tasks so you don't forget them.");
});
3. Frontend Setup: Subscribing the User (React)
For web push notifications to hit a user's operating system, your frontend must register a Service Worker file (sw.js) in your project's public directory and request permission.

The React Component Triggers Permission:
JavaScript
// components/NotificationOptIn.jsx
import React from 'react';
import axios from 'axios';

const NotificationOptIn = () => {

  const subscribeToReminders = async () => {
    // 1. Request browser system permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert("You denied notification permissions.");
      return;
    }

    // 2. Register Service Worker and generate a target endpoint token
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_PUBLIC_VAPID_KEY)
    });

    // 3. Send subscription blueprint object to your express server to save in the User Document
    await axios.post('/api/users/save-subscription', { subscription });
    alert("Awesome! I'll remind you based on your profile preference schedule.");
  };

  return (
    <div className="settings-card">
      <h3>Voice Assistant Reminders</h3>
      <p>Never forget to structure your schedule. Enable automated check-ins.</p>
      <button onClick={subscribeToReminders}>Enable Daily Check-Ins</button>
    </div>
  );
};

// Small utility to handle base64 public VAPID string conversion
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default NotificationOptIn;
The Service Worker Event Listener (public/sw.js)
This simple file sits in your frontend background waiting for the backend cron event to trigger:

JavaScript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    vibrate: [100, 50, 100],
    data: { url: '/' } // Redirects them to your homepage when clicked
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Open application on click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
How this ties it all together beautifully:
When a user updates their preference to "night" in your MERN profile dashboard, it sets reminderPreference: 'night' in MongoDB.

Clicking "Enable Daily Check-Ins" binds their specific browser device token safely into your User collection.

At exactly 10:00 PM, the server sees they prefer evening prompts, targets their push payload, and a native system notification pops up saying: "Ready for bed? Take a quick dump of tomorrow's tasks..."

Clicking that notification launches your assistant dashboard, activating the mic seamlessly!

feature reminder:-When an alarm time strikes, the backend sends a high-priority web-push packet. If the user doesn't click "Done," a background worker waits 5 minutes and blasts another push notification with a custom sound payload. This loops indefinitely until your MongoDB state switches to isCompleted: true.

1. Custom Sound Configuration (Service Worker)
To make a push notification play a unique, distinct alert sound, you must pass a sound attribute in the notification options. The audio file needs to live inside your frontend's public/ folder.

Update your public/sw.js file to intercept the custom sound payload:

JavaScript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/badge.png', // Small icon shown in system status bar
    vibrate: [300, 100, 300, 100, 400], // Aggressive vibration pattern
    sound: data.soundUrl || '/sounds/default-reminder.mp3', // <-- CUSTOM SOUND PATH
    tag: data.taskId, // Grouping notifications by Task ID prevents duplicates
    renotify: true, // Forces the phone/PC to vibrate & play sound again even if notification isn't cleared
    data: {
      url: `/dashboard?task=${data.taskId}`,
      taskId: data.taskId
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Direct user to the specific task details when they tap the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
⚠️ Browser Note: Android devices and desktop browsers natively support the sound parameter if the user's system volume is up. For iOS Web-Apps (PWA), custom sounds rely on standard system notification tones, but the vibration and layout patterns remain fully controllable.

2. The Backend Recursive Snooze Engine (Node.js)
Instead of a single cron job that runs once and forgets, we will build a function that calls itself every 5 minutes if and only if the database indicates the task is still pending.

JavaScript
// controllers/reminderEngine.js
import webpush from 'web-push';
import { Task } from '../models/Task.model.js';
import { User } from '../models/User.model.js';

export const triggerSnoozeNotificationLoop = async (taskId) => {
  try {
    // 1. Fetch the absolute latest state of the task from MongoDB
    const task = await Task.findById(taskId);
    if (!task || task.isCompleted) {
      console.log(`Task ${taskId} is completed or deleted. Snooze loop terminated.`);
      return; // 🛑 ESCAPE HATCH: Stop looping if the user clicked "Done"
    }

    // 2. Fetch the assigned user's push endpoint token
    const user = await User.findById(task.userId);
    if (!user || !user.pushSubscription) return;

    // 3. Construct the notification package
    const payload = JSON.stringify({
      taskId: task._id,
      title: `🚨 Persistent Reminder`,
      body: `Your task "${task.title}" requires your attention!`,
      soundUrl: '/sounds/custom-alert.mp3' // Points to your custom asset
    });

    // 4. Send the push payload via webpush hardware
    await webpush.sendNotification(user.pushSubscription, payload);
    console.log(`Notification sent for task: ${task.title}. Snoozing for 5 minutes...`);

    // 5. RECURSIVE SNOOZE TRIGGER
    // Schedule this exact function to execute again in 5 minutes
    setTimeout(() => {
      triggerSnoozeNotificationLoop(taskId);
    }, 5 * 60 * 1000); // 5 Minutes in milliseconds

  } catch (error) {
    console.error(`Snooze loop error on task ${taskId}:`, error);
  }
};
3. Completing the Interaction (React Frontend)
When the notification brings the user back to the dashboard, clicking the Done button will hit your API controller. This updates MongoDB, which automatically invalidates the next setTimeout iteration on the backend.

JavaScript
// components/TaskItem.jsx
import React from 'react';
import axios from 'axios';

const TaskItem = ({ task, onTaskCompleted }) => {

  const handleMarkAsDone = async () => {
    try {
      // Hit the backend to switch isCompleted to true
      await axios.patch(`/api/tasks/${task._id}/complete`);
      
      // Update local state to clear out UI
      onTaskCompleted(task._id); 
    } catch (err) {
      console.error("Failed completing task:", err);
    }
  };

  return (
    <div className="task-item-card" style={{ borderLeft: task.isOverdue ? '4px solid red' : '4px solid gray' }}>
      <div>
        <h4>{task.title}</h4>
        <p>Due: {task.dueTime}</p>
      </div>
      <button onClick={handleMarkAsDone} className="done-action-btn">
        ✓ Done
      </button>
    </div>
  );
};

export default TaskItem;
Why this notification model is much better:
Zero Battery Drain: The frontend doesn't need to run messy long-polling intervals or hold active audio channels open in the background.

Survives Device Reboots: Since the tracking loop lives inside your Node.js server memory runtime, even if the user turns off their phone or computer and turns it back on an hour later, the backend will continue firing the 5-minute notification alerts the second their device connects back to the internet.

Clean UI Interface: Instead of an aggressive screen takeover, it sits elegantly in their native operating system notification drawer, building up importance until they clear it.


feature calendar:-Instead of duplicating Google Calendar data inside your MongoDB database (which creates data-matching bugs when events change outside your app), your calendar should pull dynamically from two distinct pipelines:

Internal Feed: Direct Mongoose queries hitting your Tasks collection filtering by dueDate.

External Feed: Real-time API fetching from Google Calendar using temporary OAuth tokens.

Your React UI will act as an aggregator, blending both data streams into a single, cohesive calendar view.

1. The Frontend UI Component (React)
Instead of building a calendar grid completely from scratch (which involves complex date-manipulation math), you should use a high-performance framework like FullCalendar or React Big Calendar. They are fully customizable, support drag-and-drop task rescheduling, and integrate perfectly with API-driven data sources.

Install the wrapper packages: npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction

JavaScript
// components/AssistantCalendar.jsx
import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';

const AssistantCalendar = () => {
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    fetchUnifiedEvents();
  }, []);

  const fetchUnifiedEvents = async () => {
    try {
      // 1. Fetch internal tasks from your MongoDB database
      const internalRes = await axios.get('/api/tasks/calendar-feed');
      const internalEvents = internalRes.data.map(task => ({
        id: task._id,
        title: `📌 ${task.title}`,
        start: task.dueDate, // ISO string format
        backgroundColor: task.priority === 'high' ? '#ef4444' : '#3b82f6',
        extendedProps: { source: 'internal' }
      }));

      // 2. Fetch linked Google Calendar events from your server's Google API gateway
      let googleEvents = [];
      try {
        const googleRes = await axios.get('/api/integrations/google-calendar/events');
        googleEvents = googleRes.data.map(event => ({
          id: event.id,
          title: `🌐 ${event.summary}`,
          start: event.start.dateTime || event.start.date,
          backgroundColor: '#10b981', // Distinct emerald color for Google events
          extendedProps: { source: 'google' }
        }));
      } catch (gErr) {
        console.log("Google Calendar integration not linked or unauthorized yet.");
      }

      // 3. Merge both feeds cleanly into the state
      setCalendarEvents([...internalEvents, ...googleEvents]);
    } catch (error) {
      console.error("Error aggregating calendar streams:", error);
    }
  };

  // Drag & drop update handler to make the UI ultra-premium
  const handleEventDrop = async (info) => {
    const { id, extendedProps } = info.event;
    const newDate = info.event.startStr;

    if (extendedProps.source === 'internal') {
      // Instantly update task date in MongoDB when dragged to a new day
      await axios.patch(`/api/tasks/${id}`, { dueDate: newDate });
    } else if (extendedProps.source === 'google') {
      // Push date change upstream to Google's servers via API
      await axios.patch(`/api/integrations/google-calendar/events/${id}`, { newDate });
    }
  };

  return (
    <div className="calendar-wrapper" style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={calendarEvents}
        editable={true}
        eventDrop={handleEventDrop}
        selectable={true}
      />
    </div>
  );
};

export default AssistantCalendar;
2. Linking Google Calendar (The Node.js Backend Gateway)
To connect third-party accounts safely, you must implement an OAuth2 verification flow using Google's official library.

Install the toolkit: npm install googleapis

Step A: The Authorization Setup
When the user clicks "Link Google Calendar" in their profile, redirect them to a secure Google login screen generated by your server:

JavaScript
// controllers/googleCalendar.controller.js
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL // Your backend callback endpoint (e.g., /api/integrations/google/callback)
);

export const getAuthUrl = (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Gives you a refresh_token so access doesn't expire in 1 hour
    scope: ['https://www.googleapis.auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']
  });
  return res.status(200).json({ url });
};
Step B: Capturing the Token and Fetching Events
Once the user authorizes access, Google sends a validation code back to your redirection endpoint. You swap that code for a secure access token, save it to their user profile, and use it to extract live data:

JavaScript
export const googleCallback = async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens securely to the logged-in User profile document in MongoDB
    await User.findByIdAndUpdate(req.user.id, { googleTokens: tokens });
    
    // Redirect back to the frontend calendar dashboard page
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/calendar?linked=success`);
  } catch (error) {
    res.status(500).send("Authentication failed.");
  }
};

// Route to fetch live external data to feed into the client-side calendar
export const getGoogleCalendarEvents = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.googleTokens) return res.status(400).json({ message: "No linked account found" });

    oauth2Client.setCredentials(user.googleTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(), // Fetch upcoming tasks from right now onwards
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.status(200).json(response.data.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
3. Merging with Your Smart Voice Engine
The ultimate power of combining your Voice Intent Parser with this Unified Calendar is that you can now schedule items across ecosystems using pure speech.

Because the system understands parameters natively, if the user turns on the voice interface and says:

"Hey, add a high-priority meeting to my schedule for next Tuesday at 3 PM and make sure it goes on my Google Calendar too."

Your OpenAI schema will catch the instruction, and instead of just calling Task.create(), your backend router will simultaneously call calendar.events.insert() to create a real calendar event block visible across their desktop, phone, or any smart display device instantly!

feature:- add section of group for multiple people (through email).

things to remember :-All the task should be shown on the task bar and also in calendar section .


feature:-create profile section having user details.
feature :- in task make a attachment section also .