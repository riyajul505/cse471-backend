import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';
import { getStudentQuizStats } from './quizController.js';

export const addChildToParent = async (req, res) => {
  try {
    const { parentId, childEmail } = req.body;
    
    if (!parentId || !childEmail) {
      return res.status(400).json({ message: 'Parent ID and child email are required' });
    }
    
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ message: 'Parent not found' });
    }
    
    const child = await User.findOne({ email: childEmail, role: 'student' });
    if (!child) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    if (parent.profile.children && parent.profile.children.includes(child._id)) {
      return res.status(409).json({ message: 'Child is already linked to this parent' });
    }
    
    if (!parent.profile.children) {
      parent.profile.children = [];
    }
    parent.profile.children.push(child._id);
    
    await parent.save();
    
    res.json({ 
      message: 'Child added successfully',
      child: {
        id: child._id,
        name: `${child.profile.firstName} ${child.profile.lastName}`,
        email: child.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getParentChildren = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    const parent = await User.findById(parentId).populate('profile.children', 'email profile selectedLevel pathSelected');
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({ message: 'Parent not found' });
    }
    
    // Get children with quiz statistics
    const childrenWithStats = await Promise.all(
      (parent.profile.children || []).map(async (child) => {
        const quizStats = await getStudentQuizStats(child._id);
        
        return {
          id: child._id,
          email: child.email,
          profile: {
            firstName: child.profile.firstName,
            lastName: child.profile.lastName,
            grade: child.profile.grade
          },
          selectedLevel: child.selectedLevel || null,
          pathSelected: child.pathSelected || false,
          quizStats
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        children: childrenWithStats
      }
    });
  } catch (err) {
    console.error('Get parent children error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

export const selectPath = async (req, res) => {
  try {
    const { studentId, level } = req.body;
    
    if (!studentId || !level) {
      return res.status(400).json({ message: 'Student ID and level are required' });
    }
    
    if (level < 1 || level > 5) {
      return res.status(400).json({ message: 'Level must be between 1 and 5' });
    }
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    if (student.pathSelected) {
      return res.status(409).json({ message: 'Path already selected' });
    }
    
    student.pathSelected = true;
    student.selectedLevel = level;
    await student.save();
    
    // Create notification for student
    const studentMessage = `You have successfully selected Level ${level} for your learning path. Start your journey now!`;
    await createNotification(studentId, 'path_selection', studentMessage, '/dashboard');
    
    // Find and notify parent(s)
    const parents = await User.find({ 
      role: 'parent', 
      'profile.children': studentId 
    });
    
    for (const parent of parents) {
      const parentMessage = `${student.profile.firstName} ${student.profile.lastName} has selected Level ${level} for their learning path.`;
      await createNotification(parent._id, 'path_selection', parentMessage, `/child/${studentId}/progress`);
    }
    
    res.json({ 
      message: 'Learning path selected successfully',
      selectedLevel: level,
      notificationsSent: parents.length + 1 // student + parents
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getPathStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json({
      pathSelected: student.pathSelected || false,
      selectedLevel: student.selectedLevel || null
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 