# 🧪 Cambridge Explorer Labs - Backend API

An interactive, AI-powered e-learning platform delivering Cambridge curriculum content through hands-on simulations, adaptive quizzes, and real-time insights. Built with Node.js, Express.js, and MongoDB.

## 🚀 Features

### ✅ **Core Modules**
- **Authentication & User Management** - Multi-role system (Student/Teacher/Parent/Admin)
- **Learning Path Selection** - Level-based curriculum (1-5) with path tracking
- **Interactive Simulations** - AI-generated virtual science labs with game mechanics
- **Quiz System** - Auto-graded assessments with achievement tracking
- **Notification System** - Real-time alerts for all learning activities
- **Teacher Dashboard** - Class management, resource uploads, student monitoring
- **Parent Portal** - Children's progress tracking and performance insights

### 🎯 **AI Integration**
- **Google Gemini API** - Dynamic simulation generation and content creation
- **Smart Pathways** - Personalized learning sequences based on performance
- **AI Tutor** - On-demand explanations and hints for complex concepts

## 🏗️ Architecture

```
├── config/         # Environment configuration & database
├── controllers/    # Route handlers (thin layer)
├── services/       # Business logic & AI operations
├── models/         # MongoDB schemas via Mongoose
├── middleware/     # Custom middleware (auth, validation)
├── routes/         # API route definitions
├── utils/          # Helper functions
└── app.js          # Main application entry point
```

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES6+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + bcryptjs
- **AI Services**: Google Gemini API
- **Validation**: Custom input validation
- **Architecture**: MVC pattern with service layer

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Google Gemini API key (for AI features)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd CSE471_Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Ensure MongoDB is running
   # Database name: camb
   ```

5. **Start the server**
   ```bash
   npm start          # Production
   npm run dev        # Development (nodemon)
   ```

## ⚙️ Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/camb
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```

## 🔐 Authentication

### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "student|teacher|parent|admin",
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

## 📚 API Endpoints

### 🔐 Authentication Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/debug/:email` - Debug user data

### 👤 User Management
- `POST /api/user/add-child` - Add child to parent account
- `GET /api/user/parent/:parentId/children` - Get parent's children
- `POST /api/user/select-path` - Student path selection (level 1-5)
- `GET /api/user/path-status/:studentId` - Check path selection status

### 🔔 Notifications
- `GET /api/notification/:userId` - Get user notifications
- `PUT /api/notification/:notificationId/read` - Mark notification as read
- `GET /api/notification/:userId/unread-count` - Get unread count

### 👨‍🏫 Teacher Operations
- `POST /api/teacher/create-class` - Create new class
- `GET /api/teacher/:teacherId/classes` - Get teacher's classes
- `GET /api/teacher/students/level/:level` - Get students by level
- `POST /api/teacher/upload-resource` - Upload educational resource
- `GET /api/teacher/resources/level/:level` - Get resources by level
- `GET /api/teacher/:teacherId/resources` - Get teacher's resources
- `GET /api/teacher/students/all` - Get all students for teacher

### 📝 Quiz System
- `POST /api/quiz/save-result` - Save quiz attempt
- `GET /api/quiz/history/:studentId` - Get quiz history
- `GET /api/quiz/achievements/:studentId` - Get student achievements
- `POST /api/quiz/save-achievement` - Save custom achievement

### 🧪 Simulations
- `POST /api/simulation/generate` - Generate AI simulation
- `GET /api/simulation/student/:studentId` - Get student simulations
- `GET /api/simulation/:simulationId` - Get simulation details
- `PUT /api/simulation/:simulationId/state` - Update simulation state
- `POST /api/simulation/:simulationId/start` - Start simulation
- `POST /api/simulation/:simulationId/pause` - Pause simulation
- `POST /api/simulation/:simulationId/resume` - Resume simulation
- `POST /api/simulation/:simulationId/complete` - Complete simulation

### 🎮 Game Mechanics
- `POST /api/game/:simulationId/ai/process-action` - Process game action
- `POST /api/game/:simulationId/ai/mix-chemicals` - Chemical mixing
- `POST /api/game/:simulationId/ai/get-hint` - Get AI hint
- `GET /api/game/leaderboard/:level` - Get level leaderboard

## 🗄️ Database Schema

### Core Collections
- **users** - Multi-role user profiles with learning paths
- **schools** - Multi-tenant school isolation
- **classes** - Teacher-created classes with student enrollment
- **resources** - Educational materials with level targeting
- **simulations** - AI-generated interactive experiments
- **quizzes** - Assessment questions and results
- **achievements** - Student accomplishments and badges
- **notifications** - Real-time system alerts

### Key Relationships
- Students belong to classes and have learning paths
- Teachers manage classes and upload resources
- Parents monitor children's progress
- Simulations track student game states
- Quizzes generate achievements and notifications

## 🔧 Development

### Running Tests
```bash
npm test
```

### Code Style
- ES6+ JavaScript with async/await
- Consistent naming conventions
- JSDoc comments for public functions
- MVC architecture adherence

### Database Operations
- Use Mongoose transactions for multi-document operations
- Implement proper indexing for performance
- Validate data at schema and controller levels

## 🚨 Common Issues & Solutions

### Content-Type Header
Ensure `Content-Type: application/json` is set in requests.

### MongoDB Connection
Verify MongoDB is running and accessible at configured URI.

### AI Service Errors
Check Gemini API key configuration and rate limits.

## 📊 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info"
}
```

### Notifications (Direct Array)
```json
[
  {
    "_id": "...",
    "message": "Notification text",
    "type": "achievement",
    "read": false
  }
]
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control
- Input validation and sanitization
- CORS configuration
- Environment variable protection

## 📈 Performance Optimizations

- MongoDB indexing on frequently queried fields
- TTL indexes for automatic data cleanup
- Pagination for large result sets
- Efficient aggregation pipelines
- Connection pooling

## 🤝 Contributing

1. Follow the established MVC architecture
2. Maintain consistent API response formats
3. Add proper error handling and validation
4. Update documentation for new features
5. Test thoroughly before submitting

## 📄 License

This project is part of CSE471 - Cambridge Explorer Labs.

## 🆘 Support

For technical issues or questions:
- Check the API documentation above
- Review error logs and response messages
- Ensure all environment variables are set correctly
- Verify database connectivity and schema integrity

---

**Built with ❤️ for interactive learning**
