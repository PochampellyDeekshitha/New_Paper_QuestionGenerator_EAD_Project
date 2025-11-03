const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true
  },
  unit: {
    type: Number,
    required: true
  },
  co: {
    type: String,
    required: true
  },
  bl: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  marks: {
    type: Number,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  class: {
    type: String,
    required: true
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