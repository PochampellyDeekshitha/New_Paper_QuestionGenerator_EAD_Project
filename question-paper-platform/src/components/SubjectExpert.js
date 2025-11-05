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
    department: '',
    course: '',
    semester: ''
  });
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
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
      alert('Error fetching questions: ' + (error.response?.data?.message || error.message));
    }
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
        questionText: '', unit: '', co: '', bl: '', marks: '',
        subject: '', department: '', course: '', semester: ''
      });
      fetchQuestions();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.errors?.join(', ') || 
                      'Error adding question';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    setBulkError('');
    setLoading(true);

    try {
      // Parse the bulk input
      const lines = bulkInput.split('\n')
        .filter(line => line.trim() && 
               !line.includes('Format:') && 
               !line.includes('Example:') &&
               !line.includes('---') &&
               !line.includes('Bulk Input'));

      const questionsToUpload = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split('|').map(part => part.trim());
        
        if (parts.length >= 7) {
          questionsToUpload.push({
            questionText: parts[0] || '',
            unit: parts[1] || '',
            co: parts[2] || '',
            bl: parts[3] || '',
            marks: parts[4] || '',
            subject: parts[5] || '',
            department: parts[6] || '',
            course: parts[7] || '',
            semester: parts[8] || ''
          });
        }
      }

      console.log('Questions to upload:', questionsToUpload);

      if (questionsToUpload.length === 0) {
        setBulkError('No valid questions found. Please check the format.');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/questions/bulk', 
        { questions: questionsToUpload }, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('Upload response:', response.data);

      if (response.data.errors && response.data.errors.length > 0) {
        setBulkError(`Upload completed with some errors:\n${response.data.errors.join('\n')}`);
      } else {
        alert(`Successfully added ${response.data.saved} questions!`);
        setBulkInput('');
        setShowBulkForm(false);
      }
      
      fetchQuestions();

    } catch (error) {
      console.error('Full upload error:', error);
      
      let errorMessage = 'Upload failed: ';
      
      if (error.response) {
        // Server responded with error
        const serverError = error.response.data;
        errorMessage += `Server Error (${error.response.status}): `;
        
        if (serverError.errors) {
          errorMessage += serverError.errors.join(', ');
        } else if (serverError.message) {
          errorMessage += serverError.message;
        } else {
          errorMessage += JSON.stringify(serverError);
        }
      } else if (error.request) {
        // No response received
        errorMessage += 'No response from server. Check if backend is running.';
      } else {
        // Other errors
        errorMessage += error.message;
      }
      
      setBulkError(errorMessage);
      console.error('Detailed error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test with this simple data first
  const testData = `What is React? | 1 | CO1 | 2 | 5 | Computer Networks | IT | B.Tech | IV
Explain components | 1 | CO2 | 3 | 5 | Computer Networks | IT | B.Tech | IV`;

  return (
    <div className="subject-expert-container">
      <nav className="navbar">
        <div className="nav-brand">Subject Expert Portal</div>
        <div className="nav-items">
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="container">
        <div className="card">
          <h2>Add Questions</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={() => setShowBulkForm(!showBulkForm)} 
              className="btn btn-secondary"
            >
              {showBulkForm ? 'Single Question Form' : 'Bulk Upload'}
            </button>
            {showBulkForm && (
              <button 
                onClick={() => setBulkInput(testData)}
                className="btn btn-secondary"
                style={{ marginLeft: '10px' }}
              >
                Load Test Data
              </button>
            )}
          </div>

          {!showBulkForm ? (
            <form onSubmit={handleSubmit}>
              {/* Your existing single question form */}
            </form>
          ) : (
            <div className="bulk-form">
              <div className="form-group">
                <label>
                  Bulk Input (Format: Question | Unit | CO | BL | Marks | Subject | Department | Course | Semester)
                </label>
                <textarea
                  className="form-control"
                  rows="8"
                  value={bulkInput}
                  onChange={(e) => {
                    setBulkInput(e.target.value);
                    setBulkError('');
                  }}
                  placeholder="What is React? | 1 | CO1 | 2 | 5 | Computer Networks | IT | B.Tech | IV"
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  {bulkInput.split('\n').filter(line => line.trim()).length} questions detected
                </div>
              </div>
              
              {bulkError && (
                <div className="error-message">
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{bulkError}</pre>
                </div>
              )}
              
              <button 
                onClick={handleBulkSubmit} 
                className="btn btn-success"
                disabled={loading || !bulkInput.trim()}
                style={{ marginTop: '15px' }}
              >
                {loading ? 'Uploading...' : 'Upload Questions'}
              </button>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Question Bank ({questions.length} questions)</h2>
          <div className="table-container">
            <table className="questions-table">
              <thead>
                <tr className="table-header">
                  <th>#</th>
                  <th>Question</th>
                  <th>Unit</th>
                  <th>CO</th>
                  <th>BL</th>
                  <th>Marks</th>
                  <th>Subject</th>
                  <th>Department</th>
                  <th>Course</th>
                  <th>Semester</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question._id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td className="serial-number">{index + 1}</td>
                    <td className="question-text">{question.questionText}</td>
                    <td className="unit-cell">{question.unit}</td>
                    <td className="co-cell">{question.co}</td>
                    <td className="bl-cell">
                      <span className={`bl-badge bl-${question.bl}`}>
                        {question.bl}
                      </span>
                    </td>
                    <td className="marks-cell">
                      <span className="marks-badge">{question.marks}</span>
                    </td>
                    <td className="subject-cell">{question.subject}</td>
                    <td className="department-cell">{question.department}</td>
                    <td className="course-cell">{question.course}</td>
                    <td className="semester-cell">
                      <span className="semester-badge">{question.semester}</span>
                    </td>
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