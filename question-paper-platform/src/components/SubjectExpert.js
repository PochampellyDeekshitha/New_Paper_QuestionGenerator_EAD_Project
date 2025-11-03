import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/SubjectExpert.css';

const SubjectExpert = () => {
  const [questions, setQuestions] = useState([]);
  const [formData, setFormData] = useState({
    questionText: '',
    unit: '',
    co: '',
    bl: '',
    marks: '',
    subject: '',
    class: ''
  });
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchQuestions();
  }, [navigate]);

  const fetchQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/questions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/questions', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Question added successfully!');
      setFormData({
        questionText: '',
        unit: '',
        co: '',
        bl: '',
        marks: '',
        subject: '',
        class: ''
      });
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding question');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    try {
      const lines = bulkInput.split('\n').filter(line => line.trim());
      const questions = lines.map(line => {
        const [questionText, unit, co, bl, marks, subject, className] = line.split('|').map(item => item.trim());
        return {
          questionText,
          unit: parseInt(unit),
          co,
          bl: parseInt(bl),
          marks: parseInt(marks),
          subject,
          class: className
        };
      });

      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/questions/bulk', { questions }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Questions added successfully!');
      setBulkInput('');
      setShowBulkForm(false);
      fetchQuestions();
    } catch (error) {
      alert('Error in bulk upload. Please check the format.');
    }
  };

  return (
    <div className="subject-expert-container">
      <nav className="navbar">
        <div className="nav-brand">Subject Expert Portal</div>
        <div className="nav-items">
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">Back to Dashboard</button>
        </div>
      </nav>

      <div className="container">
        <div className="card">
          <h2>Add Questions</h2>
          <button 
            onClick={() => setShowBulkForm(!showBulkForm)} 
            className="btn btn-secondary"
          >
            {showBulkForm ? 'Single Question Form' : 'Bulk Upload'}
          </button>

          {!showBulkForm ? (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Question Text:</label>
                  <textarea
                    name="questionText"
                    className="form-control"
                    rows="3"
                    required
                    value={formData.questionText}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Unit:</label>
                  <input
                    type="number"
                    name="unit"
                    className="form-control"
                    required
                    value={formData.unit}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>CO (Course Outcome):</label>
                  <input
                    type="text"
                    name="co"
                    className="form-control"
                    required
                    value={formData.co}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>BL (Bloom's Level):</label>
                  <select
                    name="bl"
                    className="form-control"
                    required
                    value={formData.bl}
                    onChange={handleChange}
                  >
                    <option value="">Select BL</option>
                    <option value="1">1 - Remember</option>
                    <option value="2">2 - Understand</option>
                    <option value="3">3 - Apply</option>
                    <option value="4">4 - Analyze</option>
                    <option value="5">5 - Evaluate</option>
                    <option value="6">6 - Create</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Marks:</label>
                  <input
                    type="number"
                    name="marks"
                    className="form-control"
                    required
                    value={formData.marks}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>Subject:</label>
                  <input
                    type="text"
                    name="subject"
                    className="form-control"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>Class:</label>
                  <input
                    type="text"
                    name="class"
                    className="form-control"
                    required
                    value={formData.class}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Adding...' : 'Add Question'}
              </button>
            </form>
          ) : (
            <div className="bulk-form">
              <div className="form-group">
                <label>Bulk Input (Format: Question Text | Unit | CO | BL | Marks | Subject | Class):</label>
                <textarea
                  className="form-control"
                  rows="10"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Question 1 text here | 1 | CO1 | 2 | 5 | Mathematics | B.Tech CS&#10;Question 2 text here | 1 | CO2 | 3 | 10 | Mathematics | B.Tech CS"
                />
              </div>
              <button onClick={handleBulkSubmit} className="btn btn-success">
                Upload Questions
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Question Bank ({questions.length} questions)</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Unit</th>
                  <th>CO</th>
                  <th>BL</th>
                  <th>Marks</th>
                  <th>Subject</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question._id}>
                    <td>{question.questionText}</td>
                    <td>{question.unit}</td>
                    <td>{question.co}</td>
                    <td>{question.bl}</td>
                    <td>{question.marks}</td>
                    <td>{question.subject}</td>
                    <td>{question.class}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubjectExpert;