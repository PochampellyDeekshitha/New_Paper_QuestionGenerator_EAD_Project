const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required']
  },
  unit: {
    type: Number,
    required: [true, 'Unit is required'],
    min: [1, 'Unit must be at least 1'],
    max: [6, 'Unit cannot exceed 6']
  },
  co: {
    type: String,
    required: [true, 'CO is required']
  },
  bl: {
    type: Number,
    required: [true, 'BL is required'],
    min: [1, 'BL must be at least 1'],
    max: [6, 'BL cannot exceed 6']
  },
  marks: {
    type: Number,
    required: [true, 'Marks are required'],
    min: [1, 'Marks must be at least 1'],
    max: [20, 'Marks cannot exceed 20']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  course: {
    type: String,
    default: ''
  },
  semester: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Question', questionSchema);