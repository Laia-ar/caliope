# Google OAuth Configuration Guide

## Prerequisites
1. Google Cloud Platform account
2. Project with OAuth consent screen configured

## Setup Steps

### 1. Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add these authorized redirect URIs:
   - `http://localhost:5000/login/callback`
   - `http://localhost:3000/login/callback`
7. Click "Create" and note your Client ID and Client Secret

### 2. Configure .env File
Add these variables to your `.env` file:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SECRET_KEY=a_strong_random_secret_key
```

### 3. Enable Required APIs
1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Enable these APIs:
   - Google+ API
   - People API

### 4. Configure OAuth Consent Screen
1. In Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Set application type to "External"
3. Add required scopes:
   - `openid`
   - `email`
   - `profile`
4. Add your email as a test user

### 5. Restart Application
Restart your Flask backend and Next.js frontend for changes to take effect.

## Testing
1. Visit your application
2. Click "Continue with Google"
3. You should be redirected to Google's login page
4. After successful login, you should be redirected back to your app
