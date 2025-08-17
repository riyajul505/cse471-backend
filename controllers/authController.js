import User from '../models/userModels.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  try {
    const { email, password, role, profile, children } = req.body;
    
    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({ 
        message: 'Email, password, and role are required',
        received: { email: !!email, password: !!password, role: !!role }
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    const validRoles = ['student', 'teacher', 'parent', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role',
        validRoles: validRoles,
        received: role
      });
    }
    
    // Debug logging
    console.log(`Registration attempt for email: ${email}, role: ${role}`);
    
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Email already exists: ${email}`);
      return res.status(409).json({ message: 'Email already registered' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    
    if (role === 'parent' && children && children.length > 0) {
      const createdChildren = [];
      for (const child of children) {
        if (!child.email || !child.firstName || !child.lastName) {
          return res.status(400).json({ message: 'Each child must have email, firstName, and lastName' });
        }
        
        const existingChild = await User.findOne({ email: child.email });
        if (existingChild) {
          return res.status(409).json({ message: `Child email ${child.email} already registered` });
        }
        
        const childPassword = await bcrypt.hash(child.password || 'defaultPassword123', 10);
        const childUser = new User({
          email: child.email,
          password: childPassword,
          role: 'student',
          profile: {
            firstName: child.firstName,
            lastName: child.lastName,
            grade: child.grade || 1
          }
        });
        
        const savedChild = await childUser.save();
        createdChildren.push(savedChild._id);
      }
      
      const parentData = { 
        email, 
        password: hashed, 
        role,
        profile: {
          ...profile,
          children: createdChildren
        }
      };
      
      const parent = new User(parentData);
      const savedParent = await parent.save();
      
      return res.status(201).json({ 
        message: 'Parent and children registered successfully', 
        parentId: savedParent._id,
        childrenIds: createdChildren
      });
    }
    
    const userData = { email, password: hashed, role };
    if (profile) userData.profile = profile;
    
    const user = new User(userData);
    const savedUser = await user.save();
    
    console.log(`User registered successfully: ${savedUser.email}, ID: ${savedUser._id}`);
    
    res.status(201).json({ 
      message: 'User registered successfully', 
      userId: savedUser._id 
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Debug endpoint to check user existence (for development only)
export const debugUser = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ message: 'Email parameter is required' });
    }
    
    const user = await User.findOne({ email }).select('email role profile createdAt lastActive');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found', email });
    }
    
    res.json({
      message: 'User found',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        createdAt: user.createdAt,
        lastActive: user.lastActive
      }
    });
  } catch (err) {
    console.error('Debug user error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required',
        received: { email: !!email, password: !!password }
      });
    }
    
    // Debug logging for development
    console.log(`Login attempt for email: ${email}`);
    
    const user = await User.findOne({ email }).populate('profile.children', 'email profile');
    if (!user) {
      console.log(`User not found: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // console.log(user, "userrr data");
    console.log(`User found: ${user.email}, Role: ${user.role}`);
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log(`Password mismatch for user: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    console.log(`Login successful for user: ${email}`);
    
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    
    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role, 
        profile: user.profile 
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}; 