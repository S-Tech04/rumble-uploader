# Quick Start Guide

## Setup Complete! ✅

Your project is now configured to build the React frontend directly to the `public/` folder.

## Daily Workflow

### For Development (with Hot Reload):

**Terminal 1** - Start the backend:
```bash
npm run dev
```

**Terminal 2** - Start the frontend dev server:
```bash
npm run dev:frontend
```

Then open: `http://localhost:8080`

### For Production Build:

Build the frontend and start the server:
```bash
npm run serve
```

Or build separately and start:
```bash
npm run build
npm start
```

## Making Changes

1. Edit files in `frontend/src/`
2. Changes auto-reload when running `npm run dev:frontend`
3. When ready to deploy: `npm run build`
4. Built files automatically go to `public/` folder
5. Start the server: `npm start`

## Available Commands

- `npm start` - Start the production server
- `npm run dev` - Start backend in dev mode (auto-restart)
- `npm run dev:frontend` - Start frontend dev server (hot reload)
- `npm run build` - Build frontend to public folder
- `npm run serve` - Build and start in one command

## What Changed?

✅ Vite config now builds to `../public` instead of `dist`
✅ Public folder is cleaned on each build
✅ Frontend proxies API calls to backend during development
✅ No more manual copying of files!
✅ Controllers and routes properly organized

## Project Structure

```
rumble/
├── public/                  # ← Built files go here (auto-generated)
├── frontend/               # ← Edit your frontend here
│   └── src/
├── src/
│   ├── controllers/        # ← API logic
│   ├── routes/            # ← API routes
│   └── middleware/        # ← Auth middleware
└── server.js              # ← Express server
```

Need more details? See [DEVELOPMENT.md](DEVELOPMENT.md)
