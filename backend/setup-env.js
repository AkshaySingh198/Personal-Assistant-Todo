import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpush from 'web-push';

const envPath = path.resolve('.env');

const generateRandomSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

const setupEnv = () => {
  console.log("Setting up environment variables...");
  let envContent = '';
  let existingEnv = {};

  if (fs.existsSync(envPath)) {
    const fileContent = fs.readFileSync(envPath, 'utf8');
    fileContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        existingEnv[key] = val;
      }
    });
    console.log("Existing .env file found. Preserving current values.");
  } else {
    console.log("Creating new .env file.");
  }

  // Generate VAPID keys if not present
  let vapidKeys = {};
  if (!existingEnv.PUBLIC_VAPID_KEY || !existingEnv.PRIVATE_VAPID_KEY) {
    console.log("Generating new VAPID keys for Web Push Notifications...");
    vapidKeys = webpush.generateVAPIDKeys();
  }

  const finalEnv = {
    PORT: existingEnv.PORT || '5000',
    MONGO_URI: existingEnv.MONGO_URI ,
    JWT_SECRET: existingEnv.JWT_SECRET,
    OPENAI_API_KEY: existingEnv.OPENAI_API_KEY ,
    GOOGLE_CLIENT_ID: existingEnv.GOOGLE_CLIENT_ID ,
    GOOGLE_CLIENT_SECRET: existingEnv.GOOGLE_CLIENT_SECRET ,
    GOOGLE_REDIRECT_URL: existingEnv.GOOGLE_REDIRECT_URL ,
    FRONTEND_URL: existingEnv.FRONTEND_URL ,
    PUBLIC_VAPID_KEY: existingEnv.PUBLIC_VAPID_KEY || vapidKeys.publicKey,
    PRIVATE_VAPID_KEY: existingEnv.PRIVATE_VAPID_KEY || vapidKeys.privateKey,
    NODE_ENV: existingEnv.NODE_ENV 
  };

  const outputLines = Object.entries(finalEnv).map(([key, val]) => `${key}=${val}`);
  fs.writeFileSync(envPath, outputLines.join('\n') + '\n', 'utf8');
  console.log(".env file successfully written/updated with VAPID keys and secrets!");
};

setupEnv();
