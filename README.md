# 🎬 Anime Uploader

A modern web application for automatically downloading anime episodes and uploading them to Rumble with real-time progress tracking.

![Anime Uploader Interface](screenshot.png)

## ✨ Features

- **Multiple Upload Modes**
  - Single episode upload
  - Bulk upload from multiple URLs
  - Download all episodes from an anime series

- **Smart Episode Detection**
  - Auto-generates episode titles
  - Episode range selection for bulk operations
  - Preview episodes before uploading

- **Real-time Progress Tracking**
  - Live progress bars for downloads and uploads
  - Server-Sent Events (SSE) with automatic reconnection
  - Polling fallback for reliable updates

- **Supported Sources**
  - 9anime URLs
  - Direct M3U8/MP4 video URLs
  - HLS stream downloads with subtitle support

- **Reliable Upload System**
  - Chunked uploads (50MB per chunk)
  - Automatic retry on failure
  - Resource cleanup on job deletion

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rumble account with cookies

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rumble

# Install dependencies (backend + frontend)
npm install

# Create environment file
cp .env.example .env
```

### Configuration

Edit `.env` file with your settings:

```env
PORT=3000
AUTH_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
API_BASE=https://9animetv.to
RUMBLE_UPLOAD_HOST=rumble.com
```

### Running the Application

```bash
# Development mode (runs both backend and frontend)
npm run dev

# Production mode
npm run build
npm start
```

Access the application at `http://localhost:3000`

## 📖 Usage

1. **Login** with your configured password
2. **Get Rumble Cookies**:
   - Open Rumble.com in your browser
   - Press F12 → Network tab
   - Copy cookies from any request
3. **Paste cookies** into the Rumble Cookies field
4. **Choose upload mode**:
   - **Single Episode**: Paste one anime URL
   - **Bulk Upload**: Paste multiple URLs (one per line)
   - **All Episodes**: Enter anime ID and optional episode range
5. **Start Pipeline** and monitor progress in real-time

## 🛠️ Technology Stack

### Backend
- Node.js + Express
- JWT Authentication with refresh tokens
- FFmpeg for video processing
- Chunked file uploads

### Frontend
- React 18 + TypeScript
- Vite build tool
- Tailwind CSS
- Lucide React icons

## 📁 Project Structure

```
rumble/
├── src/                    # Backend source
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth middleware
│   ├── routes/            # API routes
│   ├── extractors/        # Video extractors (9anime, etc.)
│   ├── auth.js            # JWT authentication
│   ├── downloader.js      # Video download logic
│   ├── pipeline.js        # Job orchestration
│   └── uploader.js        # Rumble upload logic
├── frontend/              # React frontend
│   └── src/
│       ├── components/    # React components
│       └── lib/          # Utilities
├── public/               # Static files (build output)
├── temp/                 # Temporary downloads
└── downloaded/           # Processed videos
```

## 🔐 Authentication

The application uses JWT tokens with automatic refresh:
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry
- Automatic token refresh on expiration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is for educational purposes only. Respect copyright laws and terms of service of video platforms.

---

**Note**: This tool is intended for personal use. Always ensure you have the right to download and redistribute content.
