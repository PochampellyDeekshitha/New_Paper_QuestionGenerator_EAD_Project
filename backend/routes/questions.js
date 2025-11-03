const express = require('express');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const router = express.Router();

// Add question
router.post('/', auth, async (req, res) => {
  try {
    const { questionText, unit, co, bl, marks, subject, class: className } = req.body;

    const question = new Question({
      questionText,
      unit,
      co,
      bl,
      marks,
      subject,
      class: className,
      createdBy: req.user._id
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk add questions
router.post('/bulk', auth, async (req, res) => {
  try {
    const { questions } = req.body;
    
    const questionsWithCreator = questions.map(q => ({
      ...q,
      createdBy: req.user._id
    }));

    const savedQuestions = await Question.insertMany(questionsWithCreator);
    res.status(201).json(savedQuestions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get questions (with filters)
router.get('/', auth, async (req, res) => {
  try {
    const { subject, class: className, unit, co, bl } = req.query;
    let filter = {};

    if (subject) filter.subject = subject;
    if (className) filter.class = className;
    if (unit) filter.unit = parseInt(unit);
    if (co) filter.co = co;
    if (bl) filter.bl = parseInt(bl);

    const questions = await Question.find(filter).populate('createdBy', 'name email');
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get question by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate('createdBy', 'name email');
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;