import PDFDocument from 'pdfkit';
import User from '../models/userModels.js';
import { Submission } from '../models/assignmentModels.js';
import { QuizResult, Achievement } from '../models/quizModels.js';
import { LabBooking, LabSlot } from '../models/labModels.js';
import aiService from '../services/aiService.js';

/**
 * Generate Student Performance Report (PDF)
 * GET /api/reports/student/:studentId
 */
export const getStudentPerformanceReport = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student
    const student = await User.findById(studentId).lean();
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' }
      });
    }

    // Fetch data in parallel
    const [submissions, quizResults, achievements, labBookings] = await Promise.all([
      Submission.find({ studentId })
        .populate('assignmentId', 'title subject level dueDate totalPoints teacherId')
        .sort({ submittedAt: -1 })
        .lean(),
      QuizResult.find({ studentId })
        .sort({ completedAt: -1 })
        .lean(),
      Achievement.find({ studentId })
        .sort({ unlockedAt: -1 })
        .lean(),
      LabBooking.find({ studentId })
        .populate('slotId')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Compute summary metrics
    const gradedSubmissions = submissions.filter(s => s.grade && s.grade.totalScore !== undefined && s.grade.totalScore !== null);
    const avgAssignmentPercentage = gradedSubmissions.length > 0
      ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.grade.percentage || 0), 0) / gradedSubmissions.length)
      : 0;

    const avgQuizScore = quizResults.length > 0
      ? Math.round(quizResults.reduce((sum, q) => sum + (q.score || 0), 0) / quizResults.length)
      : 0;

    const completedLabBookings = labBookings.filter(b => b.status === 'completed').length;

    // Prepare PDF response
    const fileName = `student_report_${student.profile?.firstName || 'student'}_${student.profile?.lastName || ''}`.replace(/\s+/g, '_') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Colors & layout
    const colors = {
      primary: '#2563eb',
      secondary: '#10b981',
      accent: '#f59e0b',
      danger: '#ef4444',
      gray: '#6b7280',
      white: '#ffffff',
      black: '#111827'
    };
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header banner
    doc.save();
    doc.rect(doc.page.margins.left, doc.page.margins.top - 20, pageWidth, 60).fill(colors.primary);
    doc.fillColor(colors.white).fontSize(22).text('Student Performance Report', doc.page.margins.left + 16, doc.page.margins.top - 8, { align: 'left' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, doc.page.margins.left + 16, doc.page.margins.top + 18, { align: 'left' });
    doc.restore();
    doc.moveDown(2.5);

    // Student Info
    const studentName = `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim() || 'Student';
    drawSectionHeader(doc, 'Student Information', colors.secondary, pageWidth);
    doc.fillColor(colors.black)
      .fontSize(12)
      .text(`Name: ${studentName}`)
      .text(`Email: ${student.email}`)
      .text(`Level: ${student.selectedLevel || 'N/A'}`)
      .moveDown(1);

    // Summary
    drawSectionHeader(doc, 'Summary', colors.accent, pageWidth);
    drawSummaryTiles(doc, pageWidth, [
      { label: 'Assignments Submitted', value: String(submissions.length), color: colors.primary },
      { label: 'Graded', value: String(gradedSubmissions.length), color: colors.secondary },
      { label: 'Avg Assignment %', value: `${avgAssignmentPercentage}%`, color: colors.accent },
      { label: 'Quizzes Taken', value: String(quizResults.length), color: '#8b5cf6' },
      { label: 'Avg Quiz %', value: `${avgQuizScore}%`, color: '#ec4899' },
      { label: 'Achievements', value: String(achievements.length), color: '#06b6d4' },
      { label: 'Lab Booked', value: String(labBookings.length), color: '#f59e0b' },
      { label: 'Lab Completed', value: String(completedLabBookings), color: '#22c55e' }
    ]);
    doc.moveDown(0.5);

    // AI Insights via Gemini (with safe fallback)
    let insights = await generateAIInsights({ student, submissions, quizResults, achievements, labBookings, avgAssignmentPercentage, avgQuizScore });
    drawSectionHeader(doc, 'AI Insights & Recommendations', colors.primary, pageWidth);
    renderInsights(doc, insights, colors, pageWidth);
    doc.moveDown(0.5);

    // Assignments Section
    drawSectionHeader(doc, 'Assignments', colors.secondary, pageWidth);
    if (submissions.length === 0) {
      doc.fillColor(colors.gray).fontSize(12).text('No submissions yet.').moveDown(1);
    } else {
      submissions.slice(0, 20).forEach((s, idx) => {
        const a = s.assignmentId || {};
        const status = (s.grade && s.grade.totalScore !== undefined && s.grade.totalScore !== null) ? 'graded' : (s.status || 'submitted');
        const gradeStr = status === 'graded' ? `${s.grade.totalScore}/${s.grade.maxScore} (${s.grade.percentage}%)` : '—';
        doc
          .fillColor(colors.black)
          .fontSize(12)
          .text(`${idx + 1}. ${a.title || 'Assignment'} [${a.subject || 'N/A'}] - Level ${a.level || 'N/A'}`)
          .text(`   Submitted: ${s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'}  |  Status: ${status}  |  Grade: ${gradeStr}`)
          .moveDown(0.3);
      });
      if (submissions.length > 20) {
        doc.fillColor(colors.gray).fontSize(10).text(`...and ${submissions.length - 20} more`).moveDown(1);
      } else {
        doc.moveDown(1);
      }
    }

    // Quizzes Section
    drawSectionHeader(doc, 'Quizzes', '#8b5cf6', pageWidth);
    if (quizResults.length === 0) {
      doc.fillColor(colors.gray).fontSize(12).text('No quizzes taken yet.').moveDown(1);
    } else {
      quizResults.slice(0, 20).forEach((q, idx) => {
        doc
          .fillColor(colors.black)
          .fontSize(12)
          .text(`${idx + 1}. ${q.resourceTitle || 'Quiz'} - Score: ${q.score}% (${q.correctAnswers}/${q.totalQuestions})`)
          .text(`   Completed: ${q.completedAt ? new Date(q.completedAt).toLocaleString() : 'N/A'}`)
          .moveDown(0.3);
      });
      if (quizResults.length > 20) {
        doc.fillColor(colors.gray).fontSize(10).text(`...and ${quizResults.length - 20} more`).moveDown(1);
      } else {
        doc.moveDown(1);
      }
    }

    // Achievements Section
    drawSectionHeader(doc, 'Achievements', '#06b6d4', pageWidth);
    if (achievements.length === 0) {
      doc.fillColor(colors.gray).fontSize(12).text('No achievements yet.').moveDown(1);
    } else {
      achievements.slice(0, 20).forEach((ach, idx) => {
        doc
          .fillColor(colors.black)
          .fontSize(12)
          .text(`${idx + 1}. ${ach.title} (${ach.level}) - Score: ${ach.score}`)
          .text(`   Unlocked: ${ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleString() : 'N/A'}`)
          .moveDown(0.3);
      });
      if (achievements.length > 20) {
        doc.fillColor(colors.gray).fontSize(10).text(`...and ${achievements.length - 20} more`).moveDown(1);
      } else {
        doc.moveDown(1);
      }
    }

    // Lab Sessions Section
    drawSectionHeader(doc, 'Lab Sessions', colors.accent, pageWidth);
    if (labBookings.length === 0) {
      doc.fillColor(colors.gray).fontSize(12).text('No lab sessions booked yet.').moveDown(1);
    } else {
      labBookings.slice(0, 20).forEach((b, idx) => {
        const slot = b.slotId || {};
        doc
          .fillColor(colors.black)
          .fontSize(12)
          .text(`${idx + 1}. ${slot.topic || 'Lab Session'} (Level ${slot.level || 'N/A'}) - ${slot.date || ''} ${slot.startTime || ''}-${slot.endTime || ''}`)
          .text(`   Location: ${slot.location || 'N/A'}  |  Status: ${b.status}  |  Booked: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}`)
          .moveDown(0.3);
      });
      if (labBookings.length > 20) {
        doc.fillColor(colors.gray).fontSize(10).text(`...and ${labBookings.length - 20} more`).moveDown(1);
      } else {
        doc.moveDown(1);
      }
    }

    // Footer
    doc.moveDown(1).fontSize(10).text('End of Report', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate report', details: error.message }
    });
  }
};

// --- Styled helpers and AI insight generator ---
function drawSectionHeader(doc, title, color, pageWidth) {
  doc.moveDown(0.5);
  const x = doc.page.margins.left;
  const y = doc.y;
  const height = 22;
  doc.save();
  doc.roundedRect(x, y, pageWidth, height, 6).fill(color);
  doc.fillColor('#ffffff').fontSize(13).text(` ${title}`, x + 8, y + 6);
  doc.restore();
  doc.moveDown(1);
}

function drawSummaryTiles(doc, pageWidth, tiles) {
  const colWidth = (pageWidth - 20) / 2;
  const rowHeight = 42;
  let col = 0;
  let startX = doc.page.margins.left;
  let y = doc.y;
  tiles.forEach((tile) => {
    const x = startX + (col * (colWidth + 20));
    doc.save();
    doc.roundedRect(x, y, colWidth, rowHeight, 8).fill(tile.color);
    doc.fillColor('#ffffff').fontSize(10).text(tile.label, x + 10, y + 8);
    doc.fontSize(16).text(tile.value, x + 10, y + 22);
    doc.restore();
    col = (col + 1) % 2;
    if (col === 0) {
      y += rowHeight + 10;
    }
  });
  doc.y = y + (col === 1 ? rowHeight + 10 : 0);
}

async function generateAIInsights({ student, submissions, quizResults, achievements, labBookings, avgAssignmentPercentage, avgQuizScore }) {
  // Enhanced attention span metrics
  const lateCount = submissions.filter(s => s.isLate).length;
  const lateRatio = submissions.length > 0 ? lateCount / submissions.length : 0;
  const completedLabs = labBookings.filter(b => b.status === 'completed').length;
  const labCompletionRatio = labBookings.length > 0 ? completedLabs / labBookings.length : 0;
  
  // Quiz-taking behavior analysis
  const quizBehavior = analyzeQuizBehavior(quizResults);
  
  // Activity frequency analysis
  const activityPatterns = analyzeActivityPatterns(submissions, quizResults, labBookings);
  
  // Task completion analysis
  const completionMetrics = analyzeCompletionMetrics(submissions, quizResults, labBookings);
  
  // Comprehensive attention span assessment
  const attentionSpan = assessAttentionSpan({
    lateRatio,
    labCompletionRatio,
    quizBehavior,
    activityPatterns,
    completionMetrics
  });
  
  const accuracy = Math.round(((avgAssignmentPercentage || 0) + (avgQuizScore || 0)) / 2);

  const baseline = {
    focusAreas: avgQuizScore < 70 || avgAssignmentPercentage < 70 ? ['Reinforce fundamentals in current subject areas', 'Practice with targeted quizzes to build confidence'] : ['Maintain current study habits', 'Challenge with advanced practice sets'],
    weaknesses: avgQuizScore < 65 ? ['Low quiz accuracy across attempts'] : (avgAssignmentPercentage < 65 ? ['Assignment rubric criteria need attention'] : ['None significant at the moment']),
    attentionSpan: attentionSpan,
    accuracy: { percent: accuracy, comment: accuracy >= 80 ? 'Strong accuracy overall' : (accuracy >= 60 ? 'Developing accuracy' : 'Accuracy requires focused improvement') },
    studyPlan: [
      'Set 3 short, focused study sessions (25 minutes) per week',
      'Practice 2 quizzes in weaker topics and review mistakes',
      'Break assignments into smaller milestones with mini-deadlines',
      'Use spaced repetition flashcards for key concepts',
      'Schedule one weekly lab-style hands-on activity'
    ]
  };

  try {
    if (aiService.apiKey) {
      const compactData = {
        level: student.selectedLevel,
        assignments: submissions.slice(0, 20).map(s => ({ graded: !!(s.grade && s.grade.totalScore !== undefined && s.grade.totalScore !== null), percentage: s.grade?.percentage ?? null, isLate: !!s.isLate })),
        quizzes: quizResults.slice(0, 20).map(q => ({ score: q.score })),
        achievements: achievements.length,
        labs: { total: labBookings.length, completed: completedLabs },
        summary: { avgAssignmentPercentage, avgQuizScore }
      };

      const prompt = `You are an educational coach. Analyze this student's performance data and return a compact JSON with keys: focusAreas (array of strings), weaknesses (array of strings), attentionSpan { status: one of [okay, moderate, needs attention], reason: string }, accuracy { percent: number (0-100), comment: string }, studyPlan (array of 3-6 short actionable steps).\nStrictly return JSON only, no extra text.\nData: ${JSON.stringify(compactData)}`;

      const responseText = await aiService.callGeminiAPI(prompt);
      let clean = responseText.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/```json\s*/i, '').replace(/```$/, '').replace(/```$/, '');
      }
      const parsed = JSON.parse(clean);
      if (!parsed.focusAreas || !parsed.studyPlan) throw new Error('Incomplete AI response');
      console.log('AI insights: using Gemini');
      return parsed;
    }
  } catch (e) {
    console.warn('AI insights fallback:', e.message);
  }
  return baseline;
}

function renderInsights(doc, insights, colors, pageWidth) {
  const x = doc.page.margins.left;
  const box = (title, items, color) => {
    const startY = doc.y;
    doc.save();
    doc.roundedRect(x, startY, pageWidth, 22, 6).fill(color);
    doc.fillColor('#ffffff').fontSize(12).text(` ${title}`, x + 8, startY + 6);
    doc.restore();
    doc.moveDown(0.6);
    doc.fillColor('#111827').fontSize(11);
    if (Array.isArray(items)) {
      items.forEach((t) => { doc.circle(x + 6, doc.y + 6, 2).fill(color).fillColor('#111827').text(`  ${t}`, x + 12, doc.y); doc.moveDown(0.2); });
    } else if (items && typeof items === 'object') {
      Object.entries(items).forEach(([k, v]) => { doc.fillColor('#111827').text(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`, { width: pageWidth }); doc.moveDown(0.2); });
    } else if (typeof items === 'string') {
      doc.text(items);
    }
    doc.moveDown(0.5);
  };

  box('Focus Areas', insights.focusAreas || ['—'], '#10b981');
  box('Weaknesses', insights.weaknesses || ['—'], '#ef4444');
  box('Attention Span', [`Status: ${insights.attentionSpan?.status || 'unknown'}`, `${insights.attentionSpan?.reason || ''}`, `Quiz Behavior: ${insights.attentionSpan?.quizBehavior || 'N/A'}`, `Activity Pattern: ${insights.attentionSpan?.activityPattern || 'N/A'}`, `Completion Rate: ${insights.attentionSpan?.completionRate || 'N/A'}%`], '#f59e0b');
  box('Accuracy', [`${insights.accuracy?.percent ?? '—'}%`, `${insights.accuracy?.comment || ''}`], '#8b5cf6');
  box('Suggested Study Plan', insights.studyPlan || ['—'], '#2563eb');
}

// Enhanced attention span analysis functions
function analyzeQuizBehavior(quizResults) {
  if (quizResults.length === 0) return 'No quiz data available';
  
  // Analyze quiz retake patterns
  const quizAttempts = {};
  quizResults.forEach(quiz => {
    const key = quiz.resourceId || quiz.resourceTitle;
    if (!quizAttempts[key]) quizAttempts[key] = [];
    quizAttempts[key].push(quiz);
  });
  
  const retakeCount = Object.values(quizAttempts).filter(attempts => attempts.length > 1).length;
  const avgAttemptsPerQuiz = Object.values(quizAttempts).reduce((sum, attempts) => sum + attempts.length, 0) / Object.keys(quizAttempts).length;
  
  // Analyze score improvement patterns
  const improvementPatterns = Object.values(quizAttempts)
    .filter(attempts => attempts.length > 1)
    .map(attempts => {
      const sorted = attempts.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
      const firstScore = sorted[0].score;
      const lastScore = sorted[sorted.length - 1].score;
      return lastScore - firstScore;
    });
  
  const avgImprovement = improvementPatterns.length > 0 ? 
    improvementPatterns.reduce((sum, improvement) => sum + improvement, 0) / improvementPatterns.length : 0;
  
  if (avgAttemptsPerQuiz > 2) return 'Frequent retakes, may indicate focus issues';
  if (avgImprovement > 15) return 'Shows improvement through practice';
  if (retakeCount > quizResults.length * 0.3) return 'High retake rate, needs confidence building';
  return 'Consistent first-attempt performance';
}

function analyzeActivityPatterns(submissions, quizResults, labBookings) {
  const allActivities = [
    ...submissions.map(s => ({ type: 'assignment', date: new Date(s.submittedAt), completed: true })),
    ...quizResults.map(q => ({ type: 'quiz', date: new Date(q.completedAt), completed: true })),
    ...labBookings.map(l => ({ type: 'lab', date: new Date(l.createdAt), completed: l.status === 'completed' }))
  ];
  
  if (allActivities.length === 0) return 'No activity data available';
  
  // Group by week to analyze frequency
  const weeklyActivity = {};
  allActivities.forEach(activity => {
    const weekStart = new Date(activity.date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyActivity[weekKey]) weeklyActivity[weekKey] = 0;
    weeklyActivity[weekKey]++;
  });
  
  const activityWeeks = Object.keys(weeklyActivity).length;
  const totalActivities = allActivities.length;
  const avgActivitiesPerWeek = totalActivities / activityWeeks;
  
  // Analyze consistency
  const activityValues = Object.values(weeklyActivity);
  const consistency = activityValues.length > 1 ? 
    (Math.max(...activityValues) - Math.min(...activityValues)) / Math.max(...activityValues) : 0;
  
  if (avgActivitiesPerWeek < 1) return 'Low activity frequency';
  if (consistency < 0.3) return 'Consistent weekly engagement';
  if (consistency > 0.7) return 'Irregular activity patterns';
  return 'Moderate consistency in engagement';
}

function analyzeCompletionMetrics(submissions, quizResults, labBookings) {
  const totalTasks = submissions.length + quizResults.length + labBookings.length;
  if (totalTasks === 0) return { completionRate: 0, taskBreakdown: 'No tasks assigned' };
  
  const completedTasks = submissions.length + quizResults.length + 
    labBookings.filter(l => l.status === 'completed').length;
  
  const completionRate = Math.round((completedTasks / totalTasks) * 100);
  
  const taskBreakdown = {
    assignments: submissions.length,
    quizzes: quizResults.length,
    labs: labBookings.length,
    completedLabs: labBookings.filter(l => l.status === 'completed').length
  };
  
  return { completionRate, taskBreakdown };
}

function assessAttentionSpan({ lateRatio, labCompletionRatio, quizBehavior, activityPatterns, completionMetrics }) {
  let score = 0;
  let reasons = [];
  
  // Late submission penalty
  if (lateRatio > 0.3) {
    score -= 30;
    reasons.push('High proportion of late submissions');
  } else if (lateRatio > 0.1) {
    score -= 15;
    reasons.push('Some late submissions');
  }
  
  // Lab completion assessment
  if (labCompletionRatio < 0.5 && labCompletionRatio > 0) {
    score -= 20;
    reasons.push('Low lab session completion rate');
  }
  
  // Quiz behavior assessment
  if (quizBehavior.includes('focus issues') || quizBehavior.includes('retake')) {
    score -= 25;
    reasons.push('Quiz behavior suggests attention challenges');
  } else if (quizBehavior.includes('improvement')) {
    score += 15;
    reasons.push('Shows learning improvement through practice');
  }
  
  // Activity pattern assessment
  if (activityPatterns.includes('Irregular') || activityPatterns.includes('Low frequency')) {
    score -= 20;
    reasons.push('Irregular or low activity patterns');
  } else if (activityPatterns.includes('Consistent')) {
    score += 15;
    reasons.push('Consistent engagement patterns');
  }
  
  // Completion rate assessment
  if (completionMetrics.completionRate < 60) {
    score -= 25;
    reasons.push('Low task completion rate');
  } else if (completionMetrics.completionRate > 85) {
    score += 20;
    reasons.push('High task completion rate');
  }
  
  // Determine status based on score
  let status, reason;
  if (score >= 20) {
    status = 'excellent';
    reason = 'Strong attention span with consistent engagement and completion patterns';
  } else if (score >= 0) {
    status = 'okay';
    reason = 'Generally good attention span with some areas for improvement';
  } else if (score >= -30) {
    status = 'moderate';
    reason = 'Attention span needs improvement: ' + reasons.slice(0, 2).join(', ');
  } else {
    status = 'needs attention';
    reason = 'Significant attention span concerns: ' + reasons.slice(0, 3).join(', ');
  }
  
  return {
    status,
    reason,
    quizBehavior,
    activityPattern: activityPatterns,
    completionRate: completionMetrics.completionRate,
    score: score
  };
}

