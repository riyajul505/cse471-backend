import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import notificationRoutes from './routes/notification.js';
import teacherRoutes from './routes/teacher.js';
import quizRoutes from './routes/quiz.js';

const app = express();

connectDB();

// CORS configuration - Allow frontend origin
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware for parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || 'none';
  const bodyInfo = Object.keys(req.body).length > 0 ? req.body : 'empty';
  console.log(`${req.method} ${req.path}`, 'Body:', bodyInfo, 'Content-Type:', contentType);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/quiz', quizRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get('/', (req, res) => {
  res.send('Hello World');
});


export default app;