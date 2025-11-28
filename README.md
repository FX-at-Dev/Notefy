# Notefy

A modern, web-based note-taking application with powerful import capabilities, rich markdown editing, and offline-first architecture.

![Notefy](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)

## ✨ Features

### 📝 Rich Note-Taking Experience
- **Dual-Mode Editor**: CodeMirror-powered rich editor with automatic fallback to plain textarea
- **Live Markdown Preview**: Real-time rendering with syntax highlighting
- **Drawing Pad**: Built-in canvas for sketches and diagrams
- **Offline-First**: IndexedDB storage for seamless offline access
- **Quick Switcher**: Fast navigation between notes with `Ctrl/Cmd+P`

### 📥 Powerful Import System
- **PDF Import**: Extract text and images from PDF documents
- **PowerPoint (PPTX) Support**: Convert presentations to markdown notes
- **OCR Processing**: Extract text from scanned documents
- **Flexible Import Modes**:
  - Single note (all content combined)
  - One note per page/slide
  - Slides mode (with `---` separators)

### 🔄 Background Processing
- **BullMQ Job Queue**: Asynchronous processing for large imports
- **Python Worker**: Dedicated microservice for PPTX parsing
- **Progress Tracking**: Real-time job status monitoring

### 🔗 Smart Features
- **Backlinks**: Automatic bidirectional linking between notes
- **Search**: Full-text search across all notes with tag support
- **Auto-Save**: Never lose your work with intelligent debounced saving
- **Export**: Download notes as Markdown files

### 🔐 Authentication & Sync (In Development)
- Email/password authentication
- Google OAuth integration
- Google Drive sync capabilities

## 🚀 Getting Started

### Prerequisites

- **Node.js** 16.0.0 or higher
- **Redis** 6.0 or higher
- **PostgreSQL** 12 or higher
- **Python** 3.8 or higher (for PPTX import)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/FX-at-Dev/Notefy.git
   cd Notefy
   ```

2. **Set up the Backend**
   ```bash
   cd Backend
   npm install
   ```

3. **Set up the Python Worker**
   ```bash
   cd Backend/python-worker
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**
   
   Create a `.env` file in the `Backend` directory:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/notefy
   
   # Redis
   REDIS_URL=redis://127.0.0.1:6379
   
   # Authentication
   JWT_SECRET=your-secret-key-here
   
   # Python Worker
   PYTHON_WORKER_URL=http://localhost:8000
   
   # OAuth (optional)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

5. **Set up the Database**
   ```bash
   cd Backend
   npm run migrate
   ```

6. **Start Redis**
   ```bash
   redis-server
   ```

### Running the Application

You'll need **three terminal sessions**:

**Terminal 1 - Backend API Server:**
```bash
cd Backend
npm run dev
```
The API server will run on `http://localhost:4000`

**Terminal 2 - Python Worker:**
```bash
cd Backend/python-worker
uvicorn main:app --port 8000
```
The Python worker will run on `http://localhost:8000`

**Terminal 3 - Import Worker:**
```bash
cd Backend
npm run worker
```

**Frontend:**

Open `Frontend/index.html` in your browser, or use a local server:
```bash
cd Frontend
npx serve .
```

Visit `http://localhost:3000` (or the port shown)

### Quick Start Demo

For a quick test without full setup:

1. Start only the backend server:
   ```bash
   cd Backend
   npm start
   ```

2. Open `Frontend/editor.html` directly in your browser

3. Click "Continue offline" to use local storage mode

## 💡 Usage

### Creating Notes

1. Click **New** to create a fresh note
2. Type your content in Markdown format
3. Changes auto-save after 900ms of inactivity
4. Press `Ctrl/Cmd+S` to force an immediate save

### Importing Documents

1. Click **Import** in the toolbar
2. Select a PDF or PPTX file
3. Choose import mode:
   - **Single note**: Combines all content
   - **Pages**: Creates separate notes per page/slide
   - **Slides**: Uses `---` separator between slides
4. Enable OCR for scanned documents
5. Click **Start Import**

### Drawing & Sketches

1. Click **Draw** to open the drawing pad
2. Adjust brush size with the slider
3. Draw using mouse/touch
4. Click **Save** to download as PNG
5. Click **Clear** to reset the canvas

### Quick Navigation

- Press `Ctrl/Cmd+P` to open Quick Switcher
- Type to search across note titles and content
- Click a result to open that note

### Exporting

- Click **Export** to download the current note as a `.md` file

## 🏗️ Architecture

### Frontend
- **Vanilla JavaScript** with ES6 modules
- **CodeMirror 6** for rich text editing
- **IndexedDB** via Dexie.js for offline storage
- **markdown-it** for preview rendering

### Backend
- **Fastify** - Fast, low-overhead web framework
- **BullMQ** - Redis-based queue for background jobs
- **PostgreSQL** - Primary data store
- **IORedis** - Redis client for job queues

### Python Worker
- **FastAPI** - Modern Python web framework
- **python-pptx** - PowerPoint parsing library
- **uvicorn** - ASGI server

### Project Structure
```
Notefy/
├── Backend/
│   ├── server.js           # Main API server
│   ├── config/             # Configuration modules
│   ├── controllers/        # Request handlers
│   ├── jobs/               # Background workers
│   ├── middlewares/        # Express/Fastify middleware
│   ├── migrations/         # Database schemas
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── python-worker/      # PPTX parsing microservice
│   └── tests/              # Test suites
└── Frontend/
    ├── index.html          # Login page
    ├── editor.html         # Main editor
    ├── import.html         # Import interface
    ├── css/                # Stylesheets
    └── js/                 # Frontend modules
```

## 🧪 Testing

Run the test suite:

```bash
cd Backend
npm test
```

Tests cover:
- Authentication flows
- Note CRUD operations
- Import processing
- Search functionality
- Drive sync

## 🛠️ Development

### Running in Development Mode

```bash
cd Backend
npm run dev  # Uses nodemon for auto-restart
```

### Database Migrations

Create a new migration:
```bash
# Add a new .sql file in Backend/migrations/
# e.g., 007_add_feature.sql
```

Run migrations:
```bash
npm run migrate
```

### Adding New Import Formats

1. Add parser logic in `Backend/jobs/importWorker.js`
2. Update Python worker if needed in `Backend/python-worker/main.py`
3. Add file type to `Frontend/import.html` accept attribute

## 📚 API Reference

### Authentication

#### POST `/api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:** `{ "token": "jwt-token" }`

#### GET `/api/auth/google`
Initiates Google OAuth flow

### Notes

#### GET `/api/notes`
**Headers:** `Authorization: Bearer <token>`
**Response:** Array of note objects

### Import

#### POST `/api/import`
**Content-Type:** `multipart/form-data`
**Fields:**
- `file`: PDF or PPTX file
- `ocr`: "true" or "false"
- `mode`: "single" | "pages" | "slides"

**Response:** `{ "jobId": "123", "status": "queued" }`

#### GET `/api/import/:jobId/status`
**Response:** 
```json
{
  "jobId": "123",
  "status": "completed",
  "progress": 100,
  "result": { "createdNotes": ["note-id-1"], "notes": [...] }
}
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow existing code style
- Keep PRs focused and atomic

## 📝 Roadmap

- [ ] Full Google Drive bidirectional sync
- [ ] Collaborative editing (real-time multiplayer)
- [ ] Mobile app (React Native)
- [ ] End-to-end encryption
- [ ] Plugin system for custom import/export formats
- [ ] Advanced search with filters and operators
- [ ] Note templates
- [ ] Kanban board view
- [ ] Web clipper browser extension

## ⚠️ Known Issues

- Google OAuth is currently a stub implementation
- Some database models are empty (migrations needed)
- Search functionality requires full implementation
- Drive sync is partially implemented

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Maintainers

- **FX-at-Dev** - [GitHub Profile](https://github.com/FX-at-Dev)

## 🙏 Acknowledgments

- [CodeMirror](https://codemirror.net/) - Versatile text editor
- [Fastify](https://www.fastify.io/) - Fast web framework
- [BullMQ](https://docs.bullmq.io/) - Premium job queue
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [python-pptx](https://python-pptx.readthedocs.io/) - PowerPoint parsing

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/FX-at-Dev/Notefy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/FX-at-Dev/Notefy/discussions)
- **Documentation**: [Wiki](https://github.com/FX-at-Dev/Notefy/wiki)

---

**Made with ❤️ by the Notefy team**
