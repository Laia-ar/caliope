# Environment Configuration

## Required Environment Variables

### Backend (`.env` en la raíz del repo)
```
SECRET_KEY=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OPENROUTER_API_KEY=your-openrouter-api-key
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
# Optional cookie sharing settings for multi-domain setups
# SESSION_COOKIE_DOMAIN=.laia.ar
# SESSION_COOKIE_SECURE=true
# SESSION_COOKIE_SAMESITE=Lax
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:5000
```

## Online Development Environments

For online development environments (Gitpod, Codespaces, etc.):

1. Set `BACKEND_URL` and `FRONTEND_URL` to the preview URLs provided by your environment
2. Update the Google OAuth credentials in the developer console to include the new redirect URLs
3. The CORS configuration will automatically allow requests from common online dev domains

## Running Locally

1. Copy `.env.example` to `.env` (root for backend) and create `frontend/.env.local` for frontend
2. Fill in the required values
3. Start the backend: `cd backend && python app.py`
4. Start the frontend: `cd frontend && npm run dev`
