import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
  filename: String,
  path: String,
  mimetype: String,
  size: Number,
}, { _id: true });

const TaskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  dueDate: {
    type: Date,
  },
  dueTime: {
    type: String, // format: "HH:MM"
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  lastReminderSentAt: {
    type: Date,
  },
  collaborators: [{
    type: String, // Email addresses of collaborators
  }],
  attachments: [AttachmentSchema],
  isGoogleEvent: {
    type: Boolean,
    default: false,
  },
  googleEventId: {
    type: String,
  },
  isRecurringDaily: {
    type: Boolean,
    default: false,
  },
  parentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
}, {
  timestamps: true,
});

export const Task = mongoose.model('Task', TaskSchema);
