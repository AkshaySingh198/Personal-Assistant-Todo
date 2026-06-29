import OpenAI from 'openai';
import { z } from 'zod';
import { Task } from '../models/Task.model.js';
import { scheduleTaskReminder, cancelTaskReminder } from '../workers/reminderEngine.js';

// Define structure using Zod
const VoiceActionSchema = z.object({
  actionType: z.enum(["CREATE","ADD", "UPDATE", "DELETE","REMOVE"]).describe(
    "CREATE or ADD: For adding new items. UPDATE: For changing times, priorities, or completing tasks. DELETE or REMOVE: For removing/clearing items."
  ),
  targetScope: z.enum(["SINGLE_TASK", "ENTIRE_DAY"]).describe(
    "SINGLE_TASK if it targets an individual item. ENTIRE_DAY if it targets a whole day's plan."
  ),
  targetSearchQuery: z.string().optional().describe(
    "Keywords to find the specific existing task being updated or deleted (e.g., if user says 'delete the vegetable task', this should be 'vegetable'). Leave blank for CREATE."
  ),
  targetDate: z.string().optional().describe(
    "ISO format (YYYY-MM-DD) if an entire day is referenced or targeted (e.g., 'today', 'tomorrow')."
  ),
  taskPayload: z.object({
    taskTitle: z.string().optional(),
    dueDate: z.string().optional().describe("ISO format (YYYY-MM-DD) relative to today."),
    dueTime: z.string().optional().describe("24-hour time format (HH:MM)."),
    priority: z.enum(["high", "medium", "low"]).optional(),
    isCompleted: z.boolean().optional().describe("Set to true if user says things like 'mark the meeting as done'.")
  }).optional()
});

const VoiceRouterSchema = z.object({
  actions: z.array(VoiceActionSchema).describe("List of sequential actions extracted from the user's voice command.")
});

// A fallback heuristic parser for testing when API key is missing
const heuristicVoiceParser = (text) => {
  console.log("Using local heuristic fallback parser (OpenAI API key missing or invalid)");
  const actions = [];

  // Split combined commands (e.g. "task A and create task B")
  const splitRegex = /\s+\b(?:and|then|and\s+then)\s+(?=add|create|new|delete|remove|cancel|done|complete|finish|update|change|make)\b/i;
  const parts = text.split(splitRegex);

  for (const part of parts) {
    const cleanPart = part.trim();
    if (!cleanPart) continue;

    const lowerPart = cleanPart.toLowerCase();

    // Check if it's a DELETE command
    if (lowerPart.startsWith('delete') || lowerPart.startsWith('remove') || lowerPart.startsWith('cancel') || lowerPart.includes(' delete ') || lowerPart.includes(' remove ')) {
      if (lowerPart.includes('everything') || lowerPart.includes('all tasks') || lowerPart.includes('all')) {
        let dateStr = new Date().toISOString().split('T')[0];
        if (lowerPart.includes("tomorrow")) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateStr = tomorrow.toISOString().split('T')[0];
        }
        actions.push({
          actionType: "DELETE",
          targetScope: "ENTIRE_DAY",
          targetDate: dateStr
        });
      } else {
        let query = cleanPart.replace(/^(delete|remove|cancel)\s+/i, '').replace(/\btask\b/i, '').trim();
        actions.push({
          actionType: "DELETE",
          targetScope: "SINGLE_TASK",
          targetSearchQuery: query || "task"
        });
      }
    } 
    // Check if it's an UPDATE / COMPLETE command
    else if (lowerPart.includes('done') || lowerPart.includes('complete') || lowerPart.includes('finish') || lowerPart.startsWith('update') || lowerPart.startsWith('change')) {
      let query = cleanPart.replace(/^(done|complete|finish|update|change)\s+/i, '').replace(/\btask\b/i, '').trim();
      
      let isCompleted = undefined;
      if (lowerPart.includes('done') || lowerPart.includes('complete') || lowerPart.includes('finish')) {
        isCompleted = true;
        query = query.replace(/\b(done|complete|finish)\b/i, '').trim();
      }

      let priority = undefined;
      if (lowerPart.includes('high')) priority = 'high';
      else if (lowerPart.includes('medium')) priority = 'medium';
      else if (lowerPart.includes('low')) priority = 'low';

      actions.push({
        actionType: "UPDATE",
        targetScope: "SINGLE_TASK",
        targetSearchQuery: query || "task",
        taskPayload: {
          isCompleted,
          priority
        }
      });
    } 
    // Default: Treat as CREATE command
    else {
      // Extract title (remove common verbs at the start of command)
      let title = cleanPart.replace(/^(add|create|new|plan|please|can you add|could you add|schedule|remind me to)\s+/i, '').trim();
      
      // Clean up common filler words like "a task for", "task for"
      title = title.replace(/^(a task for|task for|task to|remind me to)\s+/i, '').trim();
      
      // Parse time, supporting formats like "5 pm", "5pm", "17:30", "5:30 pm", "4:00 p.m."
      let time = "12:00";
      const timeMatch = lowerPart.match(/(\d+)(?::(\d+))?\s*(a\.?m\.?|p\.?m\.?)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        let minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3].replace(/\./g, '').toLowerCase();
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Remove time pattern from title
        title = title.replace(/\b(?:at\s+)?\d+(?::\d+)?\s*(a\.?m\.?|p\.?m\.?)\b/i, '').trim();
      } else {
        // Look for HH:MM format (e.g. 15:30)
        const militaryTimeMatch = lowerPart.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (militaryTimeMatch) {
          time = `${militaryTimeMatch[1].padStart(2, '0')}:${militaryTimeMatch[2]}`;
          title = title.replace(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i, '').trim();
        }
      }

      // Parse priority
      let priority = "medium";
      if (lowerPart.includes("high priority") || lowerPart.includes("important") || lowerPart.includes("urgent")) {
        priority = "high";
        title = title.replace(/\b(high priority|important|urgent)\b/i, '').trim();
      } else if (lowerPart.includes("low priority") || lowerPart.includes("not important")) {
        priority = "low";
        title = title.replace(/\b(low priority|not important)\b/i, '').trim();
      }

      // Parse date (today / tomorrow etc.)
      let dateStr = new Date().toISOString().split('T')[0];
      if (lowerPart.includes("tomorrow")) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
        title = title.replace(/\btomorrow\b/i, '').trim();
      } else if (lowerPart.includes("today")) {
        title = title.replace(/\btoday\b/i, '').trim();
      }

      // Clean up trailing/leading spaces or punctuation in title
      title = title.replace(/^[,\s\-\:\.]+|[,\s\-\:\.]+$/g, '').trim();

      actions.push({
        actionType: "CREATE",
        targetScope: "SINGLE_TASK",
        taskPayload: {
          taskTitle: title || "New Voice Task",
          dueDate: dateStr,
          dueTime: time,
          priority,
          isCompleted: false
        }
      });
    }
  }

  return { actions };
};

export const handleVoiceCommand = async (req, res) => {
  const { rawText } = req.body;
  const userId = req.user._id;

  if (!rawText || rawText.trim() === '') {
    return res.status(400).json({ success: false, message: "No voice text provided" });
  }

  console.log(`Processing voice command: "${rawText}" for user: ${req.user.email}`);

  let parsedData;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.startsWith('your_openai')) {
    // API key is missing/placeholder, use local heuristic fallback
    parsedData = heuristicVoiceParser(rawText);
  } else {
    try {
      const openai = new OpenAI({ apiKey });
      const prompt = `You are a voice assistant task manager. Current date is: ${new Date().toISOString().split('T')[0]}. Parse the following voice instruction into database actions: "${rawText}"`;
      
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o-mini", // fallback or default model for fast structured output
        messages: [
          { role: "system", content: "You are a precise voice command router for a todo application. Split commands into sequence of actions." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "voice_router",
            schema: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      actionType: { type: "string", enum: ["CREATE", "UPDATE", "DELETE"] },
                      targetScope: { type: "string", enum: ["SINGLE_TASK", "ENTIRE_DAY"] },
                      targetSearchQuery: { type: "string" },
                      targetDate: { type: "string" },
                      taskPayload: {
                        type: "object",
                        properties: {
                          taskTitle: { type: "string" },
                          dueDate: { type: "string" },
                          dueTime: { type: "string" },
                          priority: { type: "string", enum: ["high", "medium", "low"] },
                          isCompleted: { type: "boolean" }
                        }
                      }
                    },
                    required: ["actionType", "targetScope"]
                  }
                }
              },
              required: ["actions"]
            }
          }
        }
      });

      parsedData = JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error("OpenAI error, falling back to heuristic parser:", error);
      parsedData = heuristicVoiceParser(rawText);
    }
  }

  // Execute the parsed actions
  try {
    const executedActions = [];
    
    for (const intent of parsedData.actions) {
      const actionType = intent.actionType === "ADD" ? "CREATE"
                       : intent.actionType === "REMOVE" ? "DELETE"
                       : intent.actionType;
      switch (actionType) {
        
        case "CREATE": {
          const payload = intent.taskPayload || {};
          const title = payload.taskTitle || "New Task";
          
          let dueDate = new Date();
          if (payload.dueDate) {
            dueDate = new Date(payload.dueDate);
          }
          
          const dueTime = payload.dueTime || "12:00";
          
          const newTask = await Task.create({
            userId,
            title,
            dueDate,
            dueTime,
            priority: payload.priority || 'medium',
            isCompleted: payload.isCompleted || false
          });
          
          scheduleTaskReminder(newTask);
          executedActions.push({ type: 'CREATE', status: 'SUCCESS', details: newTask });
          break;
        }

        case "UPDATE": {
          if (intent.targetScope === "SINGLE_TASK") {
            const query = intent.targetSearchQuery;
            if (!query) continue;

            const updateData = {};
            const payload = intent.taskPayload || {};
            
            if (payload.taskTitle) updateData.title = payload.taskTitle;
            if (payload.dueDate) updateData.dueDate = new Date(payload.dueDate);
            if (payload.dueTime) updateData.dueTime = payload.dueTime;
            if (payload.priority) updateData.priority = payload.priority;
            if (payload.isCompleted !== undefined) updateData.isCompleted = payload.isCompleted;

            const updatedTask = await Task.findOneAndUpdate(
              { userId, title: { $regex: query, $options: "i" } },
              { $set: updateData },
              { new: true }
            );

            if (updatedTask) {
              if (updatedTask.isCompleted) {
                cancelTaskReminder(updatedTask._id);
              } else {
                scheduleTaskReminder(updatedTask);
              }
            }

            executedActions.push({ 
              type: 'UPDATE', 
              status: updatedTask ? 'SUCCESS' : 'NOT_FOUND', 
              query, 
              details: updatedTask 
            });
          }
          break;
        }

        case "DELETE": {
          if (intent.targetScope === "SINGLE_TASK") {
            const query = intent.targetSearchQuery;
            if (!query) continue;

            const deletedTask = await Task.findOneAndDelete({ 
              userId, 
              title: { $regex: query, $options: "i" } 
            });

            if (deletedTask) {
              cancelTaskReminder(deletedTask._id);
            }

            executedActions.push({ 
              type: 'DELETE_SINGLE', 
              status: deletedTask ? 'SUCCESS' : 'NOT_FOUND', 
              query 
            });
          } else if (intent.targetScope === "ENTIRE_DAY") {
            const targetDateStr = intent.targetDate || new Date().toISOString().split('T')[0];
            const parts = targetDateStr.split('-');
            const startOfDay = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
            const endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);

            const tasksToDelete = await Task.find({
              userId,
              dueDate: { $gte: startOfDay, $lte: endOfDay }
            });
            tasksToDelete.forEach(t => cancelTaskReminder(t._id));

            const deleteResult = await Task.deleteMany({
              userId,
              dueDate: { $gte: startOfDay, $lte: endOfDay }
            });

            executedActions.push({ 
              type: 'DELETE_DAY', 
              status: 'SUCCESS', 
              date: targetDateStr, 
              count: deleteResult.deletedCount 
            });
          }
          break;
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      actions: executedActions, 
      parsedActions: parsedData.actions 
    });

  } catch (dbError) {
    res.status(500).json({ success: false, error: dbError.message });
  }
};
