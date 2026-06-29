import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  dob: {
    type: Date,
  },
  agentChoice: {
    type: String,
    enum: ['Ayra', 'Jordan'],
    default: 'Jordan',
  },
  habit: {
    type: String,
  },
  reminderPreference: {
    type: String,
    enum: ['morning', 'night', 'none'],
    default: 'morning',
  },
  onboardingAnswers: {
    usualDay: String,
    stuckProblem: String,
    annoyance: String,
  },
  pushSubscription: {
    endpoint: String,
    expirationTime: Number,
    keys: {
      p256dh: String,
      auth: String,
    },
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number,
  },
}, {
  timestamps: true,
});

export const User = mongoose.model('User', UserSchema);
