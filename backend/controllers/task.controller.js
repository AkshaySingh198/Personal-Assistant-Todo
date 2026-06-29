import { Task } from '../models/Task.model.js';
import { User } from '../models/User.model.js';
import fs from 'fs';
import path from 'path';
import { scheduleTaskReminder, cancelTaskReminder } from '../workers/reminderEngine.js';

export const createTask = async (req, res) => {
  try {
    const { title, dueDate, dueTime, priority, collaborators, isRecurringDaily } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const taskData = {
      userId: req.user._id,
      title,
      priority: priority || 'medium',
      dueTime,
      isRecurringDaily: isRecurringDaily === 'true' || isRecurringDaily === true,
    };

    if (taskData.isRecurringDaily && !dueDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      taskData.dueDate = new Date(`${todayStr}T00:00:00.000Z`);
    } else if (dueDate) {
      taskData.dueDate = new Date(dueDate);
    }

    if (collaborators) {
      // Allow collaborators as comma separated emails or array of emails
      taskData.collaborators = Array.isArray(collaborators) 
        ? collaborators.map(c => c.trim().toLowerCase()) 
        : collaborators.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    }

    // Handle uploaded files if any
    if (req.files) {
      taskData.attachments = req.files.map(file => ({
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }));
    }

    const task = await Task.create(taskData);
    scheduleTaskReminder(task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email.toLowerCase();

    // 1. Generate instances for daily recurring tasks
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

    const masterTasks = await Task.find({
      userId,
      isRecurringDaily: true
    });

    for (const master of masterTasks) {
      const masterDueDateStr = master.dueDate ? master.dueDate.toISOString().split('T')[0] : null;
      
      if (masterDueDateStr && masterDueDateStr < todayStr) {
        const instanceExists = await Task.findOne({
          userId,
          parentTaskId: master._id,
          dueDate: startOfToday
        });

        if (!instanceExists) {
          console.log(`[Recurring] Creating daily instance for task: "${master.title}"`);
          await Task.create({
            userId,
            title: master.title,
            dueDate: startOfToday,
            dueTime: master.dueTime,
            priority: master.priority,
            collaborators: master.collaborators,
            parentTaskId: master._id,
            isCompleted: false,
            isRecurringDaily: false
          });
        }
      }
    }

    // 2. Query all tasks
    const tasks = await Task.find({
      $or: [
        { userId },
        { collaborators: userEmail }
      ]
    }).sort({ dueDate: 1, dueTime: 1 });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { title, dueDate, dueTime, priority, isCompleted, collaborators, isRecurringDaily } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify ownership or collaboration
    const userEmail = req.user.email.toLowerCase();
    const isOwner = task.userId.toString() === req.user._id.toString();
    const isCollaborator = task.collaborators.includes(userEmail);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    if (title) task.title = title;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (dueTime !== undefined) task.dueTime = dueTime;
    if (priority) task.priority = priority;
    if (isCompleted !== undefined) task.isCompleted = isCompleted;
    if (isRecurringDaily !== undefined) {
      task.isRecurringDaily = isRecurringDaily === 'true' || isRecurringDaily === true;
    }

    if (collaborators !== undefined) {
      task.collaborators = Array.isArray(collaborators)
        ? collaborators.map(c => c.trim().toLowerCase())
        : collaborators.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    }

    // Handle new uploaded files if any (append)
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }));
      task.attachments = [...task.attachments, ...newAttachments];
    }

    const updatedTask = await task.save();
    if (updatedTask.isCompleted) {
      cancelTaskReminder(updatedTask._id);
    } else {
      scheduleTaskReminder(updatedTask);
    }
    res.status(200).json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify ownership
    if (task.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }

    // Delete attachment files from filesystem
    if (task.attachments && task.attachments.length > 0) {
      task.attachments.forEach(att => {
        if (fs.existsSync(att.path)) {
          fs.unlinkSync(att.path);
        }
      });
    }

    cancelTaskReminder(req.params.id);
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCalendarFeed = async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const tasks = await Task.find({
      $or: [
        { userId: req.user._id },
        { collaborators: userEmail }
      ],
      dueDate: { $ne: null }
    });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkPreviousDayTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get date thresholds for yesterday relative to current server date
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startOfYesterday = new Date(`${yesterdayStr}T00:00:00.000Z`);

    // Find unfinished tasks that were due yesterday or earlier
    const unfinishedTasks = await Task.find({
      userId,
      dueDate: { $gte: startOfYesterday, $lt: startOfToday },
      isCompleted: false
    });

    res.status(200).json({
      unfinishedCount: unfinishedTasks.length,
      tasks: unfinishedTasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rolloverTasksToToday = async (req, res) => {
  try {
    const userId = req.user._id;
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startOfYesterday = new Date(`${yesterdayStr}T00:00:00.000Z`);

    // Batch update yesterday's uncompleted tasks to target today's date instead
    const updateResult = await Task.updateMany(
      { userId, dueDate: { $gte: startOfYesterday, $lt: startOfToday }, isCompleted: false },
      { $set: { dueDate: startOfToday } }
    );

    res.status(200).json({ 
      message: "Tasks successfully rolled over to today's view.", 
      modifiedCount: updateResult.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadAttachment = async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify auth
    const userEmail = req.user.email.toLowerCase();
    const isOwner = task.userId.toString() === req.user._id.toString();
    const isCollaborator = task.collaborators.includes(userEmail);
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Not authorized to access this file' });
    }

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(attachment.path, attachment.filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
