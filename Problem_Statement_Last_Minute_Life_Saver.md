# Project Document: The Last-Minute Life Saver (Voithos)

## 📌 Title
**Voithos: The Last-Minute Life Saver — An Intelligent, Proactive Personal Organizer**

---

## 👥 Audience / Target Users
Students, busy professionals, freelancers, and entrepreneurs who struggle with time management, experience "reminder fatigue," or frequently miss important deadlines, meetings, bills, and commitments.

---

## 🔍 Background & Problem Statement
In today's fast-paced digital environment, individuals are bombarded with tasks, events, and deadlines across multiple channels. Despite the abundance of digital calendars and to-do list apps, users consistently fail to meet their commitments. 

### Key Issues with Existing Solutions:
1. **Passive Reminders:** Current productivity tools rely on a single, easily ignorable notification. Once dismissed or snoozed once, the task is forgotten.
2. **High Friction of Entry:** Manually typing out task details (title, description, dates, times, tags) is tedious, leading to users abandoning the habit of planning.
3. **Siloed Calendars:** Internal tasks are separated from external schedules (like Google Calendar), leading to double-booking and schedule conflicts.
4. **No Proactive Planning Nudges:** Traditional apps do not prompt the user to plan their days or reflect on unfinished work, leading to accumulated stress.

---

## 💡 The Solution (Voithos)
**Voithos** (meaning "helper" in Greek) solves these pitfalls by acting as a proactive, conversational "buddy" that handles the friction of planning and actively pushes you to complete your tasks.

### 1. Smart Speech-to-Text Voice Sphere
* **Frictionless Entry:** Instead of typing, users can perform a natural voice "brain-dump". The speech engine listens and automatically extracts tasks.
* **OpenAI Command Router:** Using GPT-4, the system translates natural speech (e.g., *"Set a high priority reminder for my coding interview tomorrow at 3 PM and upload the resume document"*) into structured database entries.
* **Stateful Pause Detection:** If the user stops talking, the assistant asks, *"Is there anything left, Sir/Ma'am?"* to ensure complete daily planning.

### 2. Persistent Nagging & Snooze Engine
* To eliminate the issue of easily ignored alerts, Voithos uses a **persistent reminder loop**. 
* When a task reminder strikes, the system fires desktop and mobile push notifications.
* If the user ignores the reminder, the background engine **nags them every 5 minutes** until the task is marked completed in the database.

### 3. Unified Aggregated Calendar
* Aggregates local database tasks and external **Google Calendar** events into one unified dashboard.
* Users can reschedule tasks or Google events on the fly with drag-and-drop actions.

### 4. Automatic Rollover and Smart Prompts
* **Night and Morning Cron-Alerts:** Nudges users automatically (7:00 AM / 10:00 PM) to plan their schedules.
* **Task Rollover:** The system reviews yesterday's unfinished items and asks to roll them over to today's schedule, ensuring nothing falls through the cracks.

---

## 🛠️ Technologies Used

### Frontend:
* **Vite + React.js:** Fast, modern frontend framework and build system.
* **FullCalendar:** Interactive calendar scheduler interface.
* **Lucide React:** Modern, lightweight iconography.
* **Axios:** For handling asynchronous HTTP requests to the backend.

### Backend:
* **Node.js + Express:** Scalable runtime and routing framework for the application logic.
* **MongoDB + Mongoose:** Document database and Object Data Modeling (ODM) for managing users, sessions, and tasks.
* **Multer:** Handling user file attachments (up to 50MB) on task items.
* **Web-Push:** Library for standard W3C Web Push notifications to trigger OS-level alerts.
* **Node-Cron:** Cron-job manager for handling scheduled morning/night prompts.

### Artificial Intelligence:
* **OpenAI API (GPT-4):** Used for parsing conversational speech and classifying tasks dynamically.
* **Zod:** Schema validation to enforce structured outputs (`zodResponseFormat`) from OpenAI API calls.

---

## ☁️ Google Technologies Utilized

1. **Google Cloud Run:** Hosts the entire fullstack application in a containerized environment, scaling compute down to zero when idle to minimize costs.
2. **Google Cloud Build / Buildpacks:** Automates the container building process from source repositories without needing a manual Dockerfile.
3. **Google OAuth 2.0:** Secure authorization protocol allowing users to sign in and grant calendar integration access.
4. **Google Calendar API:** Enables bi-directional synchronization of calendar events, allowing users to view, create, and drag-and-drop reschedule events.
5. **Web Speech API (Chrome Engine):** Powers the voice assistant, utilizing built-in browser speech recognition (Speech-to-Text) and speech synthesis (Text-to-Speech) for conversational interaction.
