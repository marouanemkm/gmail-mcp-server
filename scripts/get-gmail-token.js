/**
 * Script to help obtain Gmail OAuth refresh token
 * Run with: node scripts/get-gmail-token.js
 */

import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

async function getAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n📧 Gmail OAuth Setup\n');
  console.log('1. Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Sign in and authorize the application');
  console.log('3. Copy the authorization code from the page');
  console.log('4. Paste it below\n');

  return authUrl;
}

async function getToken(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Success! Add this to your .env file:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    if (tokens.access_token) {
      console.log('Access token:', tokens.access_token.substring(0, 20) + '...');
    }
  } catch (error) {
    console.error('❌ Error getting token:', error.message);
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error('❌ Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env');
    console.error('Please add them first and try again.');
    process.exit(1);
  }

  await getAuthUrl();

  rl.question('Enter the authorization code: ', async (code) => {
    rl.close();
    await getToken(code);
    process.exit(0);
  });
}

main();

