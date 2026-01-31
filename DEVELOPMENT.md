# Rumble 9Anime Uploader - Development Guide

## Project Structure

```
rumble/
├── public/                 # Built frontend files (auto-generated from frontend)
├── frontend/              # React frontend source code
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── src/
│   ├── controllers/       # API controllers
│   ├── middleware/        # Express middleware
│   ├── routes/           # API routes
│   └── extractors/       # Video extractors
├── server.js             # Express server
└── package.json          # Root package.json
```

## Development Workflow

### First Time Setup

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Development Mode

**Option 1: Run both server and frontend separately (recommended)**

Terminal 1 - Backend server:
```bash
npm run dev
```

Terminal 2 - Frontend dev server:
```bash
npm run dev:frontend
```

This runs:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:8080` (with hot reload)
- Frontend proxies API calls to backend automatically

**Option 2: Run only backend (serve production build)**
```bash
npm start
```

Access at `http://localhost:3000`

### Building for Production

**Build frontend to public folder:**
```bash
npm run build
```

This will:
1. Build the React app using Vite
2. Output files directly to `public/` folder
3. Clean the public folder before building (removes old files)

**Build and start:**
```bash
npm run build
npm start
```

### Making Frontend Changes

1. Make changes in `frontend/src/`
2. Changes will hot-reload if running `npm run dev:frontend`
3. When ready to deploy, run `npm run build`
4. Built files go directly to `public/` folder
5. Restart the backend server if needed: `npm start`

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start backend in development mode (nodemon) |
| `npm run dev:frontend` | Start frontend dev server with hot reload |
| `npm run build` | Build frontend to public folder |
| `npm run build:frontend` | Same as `npm run build` |

## Environment Variables

Create a `.env` file in the root:

```env
PORT=3000
AUTH_PASSWORD=your_password_here
API_BASE=https://anime-api-itzzzme.vercel.app/api
RUMBLE_UPLOAD_HOST=https://web17.rumble.com
```

## API Routes

All routes are organized in `src/routes/`:
- `/api/login` - Authentication
- `/api/pipelines` - Pipeline management
- `/api/episodes/:animeId` - Fetch episodes
- `/api/start-download` - Start single download
- `/api/start-bulk-download` - Start bulk download
- `/api/start-bulk-episodes` - Start all episodes from anime

## Notes

- Frontend builds directly to `public/` folder - no manual copying needed
- The public folder is cleaned on each build
- Keep `robots.txt` and other static files in `public/` - they won't be deleted
- Vite config includes proxy for API calls during development
