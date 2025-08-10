import Class from '../models/classModels.js';
import Resource from '../models/resourceModels.js';
import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';
import { getStudentQuizStats } from './quizController.js';

// Create a new class
export const createClass = async (req, res) => {
  try {
    const { name, subject, level, timing, teacherId } = req.body;
    
    // Validate required fields
    if (!name || !subject || !level || !teacherId) {
      return res.status(400).json({ 
        message: 'Name, subject, level, and teacher ID are required',
        received: { name: !!name, subject: !!subject, level: !!level, teacherId: !!teacherId }
      });
    }
    
    // Validate level
    if (level < 1 || level > 5) {
      return res.status(400).json({ message: 'Level must be between 1 and 5' });
    }
    
    // Validate teacher exists and has correct role
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found with provided ID' });
    }
    
    if (teacher.role !== 'teacher') {
      return res.status(403).json({ message: 'User is not authorized as a teacher' });
    }
    
    // Auto-enroll students of the same level
    const eligibleStudents = await User.find({ 
      role: 'student', 
      selectedLevel: level,
      pathSelected: true 
    });
    
    // Handle timing format - convert object to array if needed
    let formattedTiming = timing;
    if (timing && timing.days && typeof timing.days === 'object' && !Array.isArray(timing.days)) {
      // Convert object like {"0": "Monday"} to array ["Monday"]
      console.log('Converting timing days from object to array:', timing.days);
      formattedTiming = {
        ...timing,
        days: Object.values(timing.days)
      };
      console.log('Formatted timing:', formattedTiming);
    }
    
    const newClass = new Class({
      name,
      subject,
      level,
      teacherId,
      timing: formattedTiming,
      students: eligibleStudents.map(student => student._id),
      schoolId: teacher.schoolId
    });
    
    await newClass.save();
    
    res.status(201).json({
      message: 'Class created successfully',
      class: {
        id: newClass._id,
        name: newClass.name,
        subject: newClass.subject,
        level: newClass.level,
        timing: newClass.timing,
        studentCount: eligibleStudents.length
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get teacher's classes
export const getTeacherClasses = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const classes = await Class.find({ teacherId, isActive: true })
      .populate('students', 'profile.firstName profile.lastName email selectedLevel')
      .sort({ createdAt: -1 });
    
    const classesWithStats = classes.map(cls => ({
      id: cls._id,
      name: cls.name,
      subject: cls.subject,
      level: cls.level,
      timing: cls.timing,
      studentCount: cls.students.length,
      students: cls.students.map(student => ({
        id: student._id,
        name: `${student.profile.firstName} ${student.profile.lastName}`,
        email: student.email,
        level: student.selectedLevel
      })),
      isActive: cls.isActive,
      createdAt: cls.createdAt
    }));
    
    res.json({ classes: classesWithStats });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get students by level for teacher
export const getStudentsByLevel = async (req, res) => {
  try {
    const { level } = req.params;
    
    if (level < 1 || level > 5) {
      return res.status(400).json({ 
        success: false,
        message: 'Level must be between 1 and 5' 
      });
    }
    
    const students = await User.find({ 
      role: 'student', 
      selectedLevel: parseInt(level),
      pathSelected: true 
    }).select('profile.firstName profile.lastName email selectedLevel');
    
    // Get students with quiz statistics
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const quizStats = await getStudentQuizStats(student._id);
        
        return {
          id: student._id,
          email: student.email,
          profile: {
            firstName: student.profile.firstName,
            lastName: student.profile.lastName
          },
          selectedLevel: student.selectedLevel,
          quizStats
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        students: studentsWithStats
      }
    });
  } catch (err) {
    console.error('Get students by level error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Upload resource with notifications
export const uploadResource = async (req, res) => {
  try {
    const { title, description, type, level, subject, tags, url, fileName, fileSize, teacherId } = req.body;
    
    // Validate required fields
    if (!title || !type || !level || !url || !teacherId) {
      return res.status(400).json({ 
        message: 'Title, type, level, URL, and teacher ID are required',
        received: { title: !!title, type: !!type, level: !!level, url: !!url, teacherId: !!teacherId }
      });
    }
    
    // Validate level
    if (level < 1 || level > 5) {
      return res.status(400).json({ message: 'Level must be between 1 and 5' });
    }
    
    // Validate resource type
    const validTypes = ['worksheet', 'video', 'document', 'image', 'simulation'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        message: 'Invalid resource type', 
        validTypes: validTypes,
        received: type 
      });
    }
    
    // Validate teacher exists and has correct role
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found with provided ID' });
    }
    
    if (teacher.role !== 'teacher') {
      return res.status(403).json({ message: 'User is not authorized as a teacher' });
    }
    
    // Handle tags format - convert object to array if needed
    let formattedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        // If tags is a string, split by comma
        formattedTags = tags.split(',').map(tag => tag.trim());
      } else if (typeof tags === 'object' && !Array.isArray(tags)) {
        // Convert object like {"0": "algebra", "1": "math"} to array ["algebra", "math"]
        console.log('Converting tags from object to array:', tags);
        formattedTags = Object.values(tags);
        console.log('Formatted tags:', formattedTags);
      } else if (Array.isArray(tags)) {
        // Already an array
        formattedTags = tags;
      }
    }

    const resource = new Resource({
      title,
      description,
      type,
      level,
      subject,
      tags: formattedTags,
      url,
      fileName,
      fileSize,
      uploadedBy: teacherId,
      schoolId: teacher.schoolId
    });
    
    await resource.save();
    
    // Notify all students of the same level
    const studentsToNotify = await User.find({ 
      role: 'student', 
      selectedLevel: level,
      pathSelected: true 
    });
    
    const teacherName = `${teacher.profile.firstName} ${teacher.profile.lastName}`;
    const notificationMessage = `New ${type} available: "${title}" has been uploaded by ${teacherName} for Level ${level}${subject ? ` - ${subject}` : ''}.`;
    
    // Send notifications to all students of this level
    const notificationPromises = studentsToNotify.map(student => 
      createNotification(
        student._id, 
        'submission', // Using 'submission' type for resource uploads
        notificationMessage, 
        `/resources/level/${level}`
      )
    );
    
    await Promise.all(notificationPromises);
    
    res.status(201).json({
      message: 'Resource uploaded successfully',
      resource: {
        id: resource._id,
        title: resource.title,
        type: resource.type,
        level: resource.level,
        subject: resource.subject
      },
      notificationsSent: studentsToNotify.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get resources by level (for students)
// students will access the resources upoladed by teacher 
export const getResourcesByLevel = async (req, res) => {
  try {
    const { level } = req.params;
    
    if (level < 1 || level > 5) {
      return res.status(400).json({ message: 'Level must be between 1 and 5' });
    }
    
    const resources = await Resource.find({ 
      level: parseInt(level), 
      isPublic: true 
    })
    .populate('uploadedBy', 'profile.firstName profile.lastName')
    .sort({ createdAt: -1 });
    
    const resourceList = resources.map(resource => ({
      id: resource._id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      subject: resource.subject,
      tags: resource.tags,
      url: resource.url,
      fileName: resource.fileName,
      uploadedBy: `${resource.uploadedBy.profile.firstName} ${resource.uploadedBy.profile.lastName}`,
      createdAt: resource.createdAt
    }));
    
    res.json({ 
      level: parseInt(level),
      resourceCount: resourceList.length,
      resources: resourceList 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get teacher's uploaded resources
export const getTeacherResources = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const resources = await Resource.find({ uploadedBy: teacherId })
      .sort({ createdAt: -1 });
    
    const resourceList = resources.map(resource => ({
      id: resource._id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      level: resource.level,
      subject: resource.subject,
      tags: resource.tags,
      fileName: resource.fileName,
      fileSize: resource.fileSize,
      isPublic: resource.isPublic,
      createdAt: resource.createdAt
    }));
    
      res.json({ 
    resourceCount: resourceList.length,
    resources: resourceList 
  });
} catch (err) {
  res.status(500).json({ message: 'Server error', error: err.message });
}
};

// Get all students across all levels for teacher progress monitoring
export const getAllStudentsForTeacher = async (req, res) => {
  try {
    const students = await User.find({ 
      role: 'student',
      pathSelected: true
    }).select('email profile selectedLevel');
    
    // Get students with quiz statistics
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const quizStats = await getStudentQuizStats(student._id);
        
        return {
          id: student._id,
          email: student.email,
          profile: {
            firstName: student.profile.firstName,
            lastName: student.profile.lastName
          },
          selectedLevel: student.selectedLevel,
          quizStats
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        students: studentsWithStats
      }
    });
  } catch (err) {
    console.error('Get all students error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
}; 
