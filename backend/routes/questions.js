const express = require('express');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const router = express.Router();


// MASTER SUBJECT + BRANCH LIST WITH ALIASES
const subjectAliases = {
  // Subjects
  "Problem Solving and Programming (Python)": ["psp","PSP", "problemsolvingandprogramming", "python programming"],
  "Object Oriented and Programming Python": ["oop","OOP", "objectorientedprogramming"],
  "Digital Logic and Computer Architecture": ["dlca","DLCA", "digitallogicandcomputerarchitecture"],
  "Data Structures and Algorithms": ["dsa","DSA", "datastructuresandalgorithms"],
  "Discrete Mathematics": ["dma","DMA", "discretemathematics"],
  "Java Programming": ["jp", "JP","javaprogramming"],
  "Operating Systems": ["os", "OS", "operatingsystems"],
  "Database Management System": ["dbms","DBMS", "databasemanagementsystem"],
  "Design and Analysis of Algorithms": ["daa",  "DAA","designandanalysisofalgorithms"],
  "Data Analysis and Visualization": ["dav","DAV", "dataanalysisandvisualization"],
  "Software Engineering": ["se","SE", "softwareengineering"],
  "Enterprise and Application Development": ["ead", "EAD","enterpriseandapplicationdevelopment"],
  "Machine Learning": ["ml", "ML","machinelearning"],
  "Computer Networks": ["cn",  "CN","computernetworks"],
  "Formal Language and Automata Theory": ["flat",  "FLAT","formallanguageandautomatatheory"],
  "Cyber Security": ["cs","CS", "cybersecurity"],
  // Branches
  "Information Technology": ["it","IT", "informationtechnology", "information technology"],
  "Computer Science and Engineering": ["cse", "CSE","computerscienceengineering"],
  "Electronics and Communication Engineering": ["ece","ECE", "electronicsandcommunicationengineering"],
  "Electrical and Electronics Engineering": ["eee","EEE", "electricalandelectronicsengineering"],
  "Mechanical Engineering": ["mech", "MECH", "mechanicalengineering"],
  "Civil Engineering": ["civil","CIVIL", "civilengineering"],
  "Artificial Intelligence and Data Science": ["ai&ds", "AI & DS","artificialintelligenceanddatascience"],
  "Artificial Intelligence and Machine Learning": ["ai&ml",   "AI & ML","artificialintelligenceandmachinelearning"],
  "Chemical Engineering": ["chemical","CHEMICAL", "chemicalengineering"],
  "Biotechnology Engineering": ["biotech",  "BIOTECH","biotechnologyengineering"]
};


// Clean helper
function clean(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // removes spaces, &, (), dots
    .trim();
}


// Normalize subject automatically
function normalizeSubject(input) {
  if (!input || typeof input !== "string") return input;

  const cleanedInput = clean(input);

  for (const standard in subjectAliases) {
    const aliases = subjectAliases[standard];

    if (
      clean(standard) === cleanedInput ||
      aliases.some(alias => clean(alias) === cleanedInput)
    ) {
      return standard;
    }
  }

  return input.trim(); // fallback
}


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
      subject: normalizeSubject(subject),
      department: department.trim(),
      course: (course || '').trim(),
      semester: (semester || '').trim(),
      createdBy: req.user._id
    });

    await question.save();

    res.status(201).json({
      message: 'Question added successfully',
      question: question
    });

  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});


// Bulk add questions
router.post('/bulk', auth, async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        message: 'Questions array is required'
      });
    }

    const questionsToSave = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      try {

        if (!q.questionText || !q.unit || !q.co || !q.bl || !q.marks || !q.subject || !q.department) {
          errors.push(`Question ${i + 1}: Missing required fields`);
          continue;
        }

        const questionData = {
          questionText: String(q.questionText).trim(),
          unit: Number(q.unit),
          co: String(q.co).trim(),
          bl: Number(q.bl),
          marks: Number(q.marks),
          subject: normalizeSubject(q.subject),
          department: String(q.department).trim(),
          course: q.course ? String(q.course).trim() : '',
          semester: q.semester ? String(q.semester).trim() : '',
          createdBy: req.user._id
        };

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
        errors.push(`Question ${i + 1}: Processing error - ${error.message}`);
      }
    }

    if (questionsToSave.length === 0) {
      return res.status(400).json({
        message: 'No valid questions to save',
        errors: errors
      });
    }

    const savedQuestions = await Question.insertMany(questionsToSave, { ordered: false });

    res.status(201).json({
      message: `Successfully added ${savedQuestions.length} questions`,
      saved: savedQuestions.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      questions: savedQuestions
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      message: 'Server error during bulk upload',
      error: error.message
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
