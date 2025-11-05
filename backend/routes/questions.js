const express = require('express');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const router = express.Router();

// Add single question
router.post('/', auth, async (req, res) => {
  try {
    console.log('Received question data:', req.body);
    
    const { 
      questionText, 
      unit, 
      co, 
      bl, 
      marks, 
      subject, 
      department, 
      course, 
      semester 
    } = req.body;

    // Validate required fields
    const requiredFields = { questionText, unit, co, bl, marks, subject, department };
    const missingFields = Object.keys(requiredFields).filter(field => !requiredFields[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    const question = new Question({
      questionText: questionText.trim(),
      unit: parseInt(unit),
      co: co.trim(),
      bl: parseInt(bl),
      marks: parseInt(marks),
      subject: subject.trim(),
      department: department.trim(),
      course: (course || '').trim(),
      semester: (semester || '').trim(),
      createdBy: req.user._id
    });

    await question.save();
    
    console.log('Question saved successfully:', question._id);
    
    res.status(201).json({
      message: 'Question added successfully',
      question: question
    });
  } catch (error) {
    console.error('Add question error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error',
        errors: errors 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Bulk add questions - SIMPLIFIED VERSION
router.post('/bulk', auth, async (req, res) => {
  try {
    console.log('Bulk upload request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ 
        message: 'Questions array is required' 
      });
    }

    console.log(`Processing ${questions.length} questions`);

    // Process each question with better error handling
    const questionsToSave = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      try {
        console.log(`Processing question ${i + 1}:`, q);

        // Basic validation
        if (!q.questionText || !q.unit || !q.co || !q.bl || !q.marks || !q.subject || !q.department) {
          errors.push(`Question ${i + 1}: Missing required fields`);
          continue;
        }

        // Create question object
        const questionData = {
          questionText: String(q.questionText).trim(),
          unit: Number(q.unit),
          co: String(q.co).trim(),
          bl: Number(q.bl),
          marks: Number(q.marks),
          subject: String(q.subject).trim(),
          department: String(q.department).trim(),
          course: q.course ? String(q.course).trim() : '',
          semester: q.semester ? String(q.semester).trim() : '',
          createdBy: req.user._id
        };

        // Validate numeric ranges
        if (questionData.unit < 1 || questionData.unit > 6) {
          errors.push(`Question ${i + 1}: Unit must be between 1-6`);
          continue;
        }

        if (questionData.bl < 1 || questionData.bl > 6) {
          errors.push(`Question ${i + 1}: BL must be between 1-6`);
          continue;
        }

        if (questionData.marks < 1 || questionData.marks > 20) {
          errors.push(`Question ${i + 1}: Marks must be between 1-20`);
          continue;
        }

        questionsToSave.push(questionData);
        
      } catch (error) {
        console.error(`Error processing question ${i + 1}:`, error);
        errors.push(`Question ${i + 1}: Processing error - ${error.message}`);
      }
    }

    // Check if we have any valid questions to save
    if (questionsToSave.length === 0) {
      return res.status(400).json({ 
        message: 'No valid questions to save',
        errors: errors 
      });
    }

    console.log(`Attempting to save ${questionsToSave.length} questions`);

    // Save all valid questions
    const savedQuestions = await Question.insertMany(questionsToSave, { ordered: false });
    
    console.log(`Successfully saved ${savedQuestions.length} questions`);

    res.status(201).json({
      message: `Successfully added ${savedQuestions.length} questions`,
      saved: savedQuestions.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      questions: savedQuestions
    });

  } catch (error) {
    console.error('Bulk upload error details:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error in bulk upload',
        errors: errors 
      });
    }

    if (error.name === 'MongoBulkWriteError') {
      return res.status(400).json({ 
        message: 'Database error in bulk upload',
        error: error.message,
        writeErrors: error.writeErrors 
      });
    }

    res.status(500).json({ 
      message: 'Server error during bulk upload',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all questions
router.get('/', auth, async (req, res) => {
  try {
    const questions = await Question.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router;