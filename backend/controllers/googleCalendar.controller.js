import { google } from 'googleapis';
import { User } from '../models/User.model.js';
import { Task } from '../models/Task.model.js';
import jwt from 'jsonwebtoken';

// Setup OAuth2 client function (lazily loaded to ensure environment variables are present)
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    process.env.GOOGLE_REDIRECT_URL || 'http://localhost:5000/api/integrations/google/callback'
  );
};

export const getAuthUrl = (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: req.user._id.toString() // Pass userId to map tokens on callback
    });
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Initiate Google Auth for general Login/Signup
export const getGoogleLoginAuthUrl = (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: 'oauth-login-signup'
    });
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (state === 'oauth-login-signup') {
      // Exchange tokens for user info
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
      });
      
      const userInfoRes = await oauth2.userinfo.get();
      const { email, name } = userInfoRes.data;

      if (!email) {
        throw new Error('No email returned from Google');
      }

      // Check if user exists, otherwise create
      let user = await User.findOne({ email: email.toLowerCase() });
      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        user = await User.create({
          name: name || 'Google User',
          email: email.toLowerCase(),
          password: Math.random().toString(36).slice(-10), // Random password
          agentChoice: 'Ayra',
          reminderPreference: 'morning'
        });
      }

      // Save Google tokens
      user.googleTokens = tokens;
      await user.save();

      // Generate JWT Token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'jwt_fallback_secret_key', {
        expiresIn: '30d'
      });

      res.cookie('token', token, {
        httpOnly: true,
        secure: false, // set to true if on production HTTPS
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      // Redirect user to frontend with query parameters to complete auth
      res.redirect(`${frontendUrl}/?oauth=success&new=${isNewUser}`);
    } else {
      // Save tokens securely to the User profile document in MongoDB (from integrations linking)
      const userId = state;
      await User.findByIdAndUpdate(userId, { googleTokens: tokens });
      res.redirect(`${frontendUrl}/profile?linked=success`);
    }
  } catch (error) {
    console.error("Google OAuth error:", error);
    if (state === 'oauth-login-signup') {
      res.redirect(`${frontendUrl}/?oauth=error`);
    } else {
      res.redirect(`${frontendUrl}/profile?linked=error`);
    }
  }
};

export const getGoogleCalendarEvents = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.googleTokens || !user.googleTokens.access_token) {
      return res.status(200).json({ googleLinked: false, events: [] });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(user.googleTokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Fetch upcoming events from yesterday onwards
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 1);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.status(200).json({ googleLinked: true, events: response.data.items || [] });
  } catch (error) {
    // If token expired, clear tokens so user can re-authenticate
    if (error.code === 400 || error.code === 401 || (error.message && error.message.includes('invalid_grant'))) {
      await User.findByIdAndUpdate(req.user._id, { $unset: { googleTokens: 1 } });
      return res.status(200).json({ googleLinked: false, events: [], message: "Google authorization expired. Please reconnect." });
    }
    res.status(200).json({ googleLinked: false, events: [], error: error.message });
  }
};

export const createGoogleCalendarEvent = async (req, res) => {
  try {
    const { title, startDateTime, endDateTime } = req.body;
    const user = await User.findById(req.user._id);
    if (!user || !user.googleTokens) {
      return res.status(400).json({ message: "Google Calendar not linked" });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(user.googleTokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: title,
      start: {
        dateTime: startDateTime || new Date().toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDateTime || new Date(Date.now() + 3600000).toISOString(), // +1 hour
        timeZone: 'UTC',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.status(201).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGoogleCalendarEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, newDate } = req.body; // newDate is YYYY-MM-DD
    const user = await User.findById(req.user._id);

    if (!user || !user.googleTokens) {
      return res.status(400).json({ message: "Google Calendar not linked" });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(user.googleTokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch original event
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId
    });

    const resource = { ...event.data };
    if (title) resource.summary = title;
    
    if (newDate) {
      // Keep original time components if possible, otherwise set default
      const origStart = new Date(event.data.start.dateTime || event.data.start.date);
      const timeStr = origStart.toISOString().split('T')[1];
      const startDateTime = new Date(`${newDate}T${timeStr}`);
      resource.start = { dateTime: startDateTime.toISOString() };
      
      const origEnd = new Date(event.data.end.dateTime || event.data.end.date);
      const endDuration = origEnd.getTime() - origStart.getTime();
      const endDateTime = new Date(startDateTime.getTime() + endDuration);
      resource.end = { dateTime: endDateTime.toISOString() };
    }

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      resource,
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
