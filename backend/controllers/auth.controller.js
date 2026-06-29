import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'jwt_fallback_secret_key', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, dob, agentChoice, habit, reminderPreference } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email and password' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      dob,
      agentChoice: agentChoice || 'Jordan',
      habit,
      reminderPreference: reminderPreference || 'morning',
    });

    const token = generateToken(user._id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // set to true if on production HTTPS
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      agentChoice: user.agentChoice,
      reminderPreference: user.reminderPreference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      agentChoice: user.agentChoice,
      reminderPreference: user.reminderPreference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

export const saveOnboarding = async (req, res) => {
  try {
    const { usualDay, stuckProblem, annoyance } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.onboardingAnswers = { usualDay, stuckProblem, annoyance };
    await user.save();

    res.status(200).json({ message: 'Onboarding answers saved successfully', onboardingAnswers: user.onboardingAnswers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.pushSubscription = subscription;
    await user.save();

    res.status(200).json({ message: 'Push subscription saved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.dob = req.body.dob || user.dob;
    user.agentChoice = req.body.agentChoice || user.agentChoice;
    user.habit = req.body.habit || user.habit;
    user.reminderPreference = req.body.reminderPreference || user.reminderPreference;

    if (req.body.password) {
      user.password = hashPassword(req.body.password);
    }

    const updatedUser = await user.save();
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      agentChoice: updatedUser.agentChoice,
      reminderPreference: updatedUser.reminderPreference,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
