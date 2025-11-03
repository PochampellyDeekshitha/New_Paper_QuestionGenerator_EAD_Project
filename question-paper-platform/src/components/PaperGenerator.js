import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/PaperGenerator.css';

const PaperGenerator = () => {
  const [filters, setFilters] = useState({
    subject: '',
    class: '',
    units: [],
    cos: []
  });
  const [paperConfig, setPaperConfig] = useState({
    paperName: '',
    totalMarks: 100,
    questionDistribution: []
  });
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [availableCombinations, setAvailableCombinations] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaperConfigChange = (e) => {
    const { name, value } = e.target;
    setPaperConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const searchQuestions = async () => {
    if (!filters.subject || !filters.class) {
      alert('Please enter both Subject and Class to search questions');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.class) params.append('class', filters.class);
      if (filters.units.length > 0) params.append('unit', filters.units.join(','));

      const response = await axios.get(`http://localhost:5000/api/questions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAvailableQuestions(response.data);
      
      // Calculate available combinations for user guidance
      const combinations = {};
      response.data.forEach(q => {
        const key = `${q.marks} marks - BL ${q.bl}`;
        if (!combinations[key]) combinations[key] = 0;
        combinations[key]++;
      });
      setAvailableCombinations(combinations);
      
      alert(`Found ${response.data.length} questions matching your criteria`);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Error searching questions: ' + (error.response?.data?.message || error.message));
    }
  };

  const addDistribution = () => {
    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: [
        ...prev.questionDistribution,
        { marks: '', count: '', bl: '' }
      ]
    }));
  };

  const updateDistribution = (index, field, value) => {
    const updatedDistribution = [...paperConfig.questionDistribution];
    updatedDistribution[index][field] = value;
    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: updatedDistribution
    }));
  };

  const removeDistribution = (index) => {
    const updatedDistribution = paperConfig.questionDistribution.filter((_, i) => i !== index);
    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: updatedDistribution
    }));
  };

  const validateDistribution = () => {
    for (const dist of paperConfig.questionDistribution) {
      if (!dist.marks || !dist.count || !dist.bl) {
        alert('Please fill all fields in question distribution');
        return false;
      }
      if (dist.marks <= 0 || dist.count <= 0) {
        alert('Marks and count must be positive numbers');
        return false;
      }
    }
    return true;
  };

  const autoFillDistribution = () => {
    if (availableQuestions.length === 0) {
      alert('Please search for questions first to see available combinations');
      return;
    }

    // Group questions by marks and create balanced distribution
    const marksDistribution = {};
    availableQuestions.forEach(q => {
      if (!marksDistribution[q.marks]) marksDistribution[q.marks] = [];
      marksDistribution[q.marks].push(q);
    });

    // Create distribution that uses all available question types
    const newDistribution = [];
    
    // For each marks category, distribute questions across different BL levels
    Object.entries(marksDistribution).forEach(([marks, questions]) => {
      const questionsByBL = {};
      questions.forEach(q => {
        if (!questionsByBL[q.bl]) questionsByBL[q.bl] = [];
        questionsByBL[q.bl].push(q);
      });

      // For each BL level in this marks category, add to distribution
      Object.entries(questionsByBL).forEach(([bl, blQuestions]) => {
        // Use at most 2 questions per BL level to keep it balanced
        const count = Math.min(blQuestions.length, 2);
        newDistribution.push({
          marks: parseInt(marks),
          count: count,
          bl: parseInt(bl)
        });
      });
    });

    // If we have multiple question types, limit to a reasonable number
    const finalDistribution = newDistribution.slice(0, 6); // Max 6 different types

    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: finalDistribution
    }));

    alert(`Auto-filled ${finalDistribution.length} question types based on available questions`);
  };

  const setupQuickDistribution = () => {
    if (availableQuestions.length === 0) {
      alert('Please search for questions first');
      return;
    }

    // Simple distribution: use all available marks with 1 question each
    const marksCount = {};
    availableQuestions.forEach(q => {
      marksCount[q.marks] = (marksCount[q.marks] || 0) + 1;
    });

    const newDistribution = Object.entries(marksCount).map(([marks, totalCount]) => {
      // For each marks value, use the most common BL level
      const blCount = {};
      availableQuestions
        .filter(q => q.marks == marks)
        .forEach(q => {
          blCount[q.bl] = (blCount[q.bl] || 0) + 1;
        });
      
      const mostCommonBL = Object.entries(blCount).sort((a, b) => b[1] - a[1])[0][0];
      
      return {
        marks: parseInt(marks),
        count: 1, // Start with 1 question per type
        bl: parseInt(mostCommonBL)
      };
    });

    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: newDistribution
    }));

    alert(`Set up ${newDistribution.length} question types. You can adjust the counts.`);
  };

  const generatePaper = async () => {
    if (!filters.subject || !filters.class) {
      alert('Please enter Subject and Class');
      return;
    }

    if (!paperConfig.paperName) {
      alert('Please enter Paper Name');
      return;
    }

    if (paperConfig.questionDistribution.length === 0) {
      alert('Please add at least one question distribution');
      return;
    }

    if (!validateDistribution()) {
      return;
    }

    // Validate distribution and convert to numbers
    const validatedDistribution = paperConfig.questionDistribution.map(dist => {
      const marks = parseInt(dist.marks);
      const count = parseInt(dist.count);
      const bl = parseInt(dist.bl);

      if (isNaN(marks) || isNaN(count) || isNaN(bl)) {
        throw new Error('All distribution fields must be valid numbers');
      }

      if (marks <= 0 || count <= 0 || bl < 1 || bl > 6) {
        throw new Error('Marks and count must be positive numbers, BL must be between 1-6');
      }

      return { marks, count, bl };
    });

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/paper/generate', {
        paperName: paperConfig.paperName,
        className: filters.class,
        subject: filters.subject,
        questionDistribution: validatedDistribution,
        units: filters.units,
        cos: filters.cos
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Generation response:', response.data);
      setGeneratedPaper(response.data);
      
      if (response.data.questions.length === 0) {
        alert('No questions were generated. The system will now show detailed matching information.');
      } else {
        alert(`Paper generated successfully with ${response.data.questions.length} questions and ${response.data.totalMarks} total marks`);
      }
    } catch (error) {
      console.error('Error generating paper:', error);
      if (error.response?.data?.message) {
        alert('Error generating paper: ' + error.response.data.message);
      } else {
        alert('Error generating paper: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPaper = async (format) => {
    if (!generatedPaper) {
      alert('No paper generated to download');
      return;
    }

    if (generatedPaper.questions.length === 0 && format !== 'json') {
      alert('Cannot download empty paper. Please generate a paper with questions first.');
      return;
    }

    setDownloadLoading(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = format === 'json' ? '/download-json' : '/download-word';
      
      const response = await axios.post(`http://localhost:5000/api/paper${endpoint}`, {
        paperData: generatedPaper
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'blob'
      });

      // Create blob and download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const extension = format === 'json' ? 'json' : 'doc';
      const filename = `${generatedPaper.paperName}.${extension}`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`Paper downloaded successfully as ${filename}`);
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading paper: ' + (error.response?.data?.message || error.message));
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="paper-generator-container">
      <nav className="navbar">
        <div className="nav-brand">Paper Generator</div>
        <div className="nav-items">
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">Back to Dashboard</button>
        </div>
      </nav>

      <div className="container">
        <div className="card">
          <h2>Generate Question Paper</h2>
          
          <div className="form-section">
            <h3>Paper Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Paper Name:</label>
                <input
                  type="text"
                  name="paperName"
                  className="form-control"
                  value={paperConfig.paperName}
                  onChange={handlePaperConfigChange}
                  placeholder="e.g., Final Examination - Semester 1"
                />
              </div>
              <div className="form-group">
                <label>Total Marks:</label>
                <input
                  type="number"
                  name="totalMarks"
                  className="form-control"
                  value={paperConfig.totalMarks}
                  onChange={handlePaperConfigChange}
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Question Bank Search</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Subject:</label>
                <input
                  type="text"
                  name="subject"
                  className="form-control"
                  value={filters.subject}
                  onChange={handleFilterChange}
                  placeholder="e.g., Mathematics"
                  required
                />
              </div>
              <div className="form-group">
                <label>Class:</label>
                <input
                  type="text"
                  name="class"
                  className="form-control"
                  value={filters.class}
                  onChange={handleFilterChange}
                  placeholder="e.g., B.Tech CS"
                  required
                />
              </div>
            </div>
            <button onClick={searchQuestions} className="btn btn-primary">
              Search Available Questions
            </button>
            
            {availableQuestions.length > 0 && (
              <div className="search-results-info">
                <p className="success-message">
                  ✅ Found {availableQuestions.length} questions matching your criteria
                </p>
                
                {Object.keys(availableCombinations).length > 0 && (
                  <div className="available-combinations">
                    <h4>Available Question Types:</h4>
                    <div className="combinations-list">
                      {Object.entries(availableCombinations).map(([key, count]) => (
                        <span key={key} className="combination-tag">
                          {key}: {count} questions
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="distribution-header">
              <h3>Question Distribution</h3>
              {availableQuestions.length > 0 && (
                <div className="distribution-buttons">
                  <button onClick={setupQuickDistribution} className="btn btn-secondary quick-setup-btn">
                    Quick Setup
                  </button>
                  <button onClick={autoFillDistribution} className="btn btn-secondary auto-fill-btn">
                    Auto-Fill All
                  </button>
                </div>
              )}
            </div>
            <p className="help-text">
              Configure how many questions of each type you want in the paper. 
              Use the available question types above as a guide.
            </p>

            {/* Distribution tips based on available questions */}
            {availableQuestions.length > 0 && (
              <div className="distribution-tips">
                <h4>💡 Quick Tips:</h4>
                <div className="tips-grid">
                  {Object.entries(availableCombinations).slice(0, 4).map(([combo, count]) => (
                    <div key={combo} className="tip-item">
                      Use <strong>{combo}</strong> - {count} available
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {paperConfig.questionDistribution.length === 0 ? (
              <div className="no-distribution">
                <p>No distribution configured yet.</p>
                {availableQuestions.length > 0 ? (
                  <div className="setup-suggestions">
                    <p>Try one of these:</p>
                    <ul>
                      <li>Click <strong>"Quick Setup"</strong> for a simple distribution</li>
                      <li>Click <strong>"Auto-Fill All"</strong> to use all available types</li>
                      <li>Or manually add question types below</li>
                    </ul>
                  </div>
                ) : (
                  <p>Search for questions first to see available types.</p>
                )}
              </div>
            ) : (
              paperConfig.questionDistribution.map((dist, index) => (
                <div key={index} className="distribution-row">
                  <div className="form-group">
                    <label>Marks:</label>
                    <input
                      type="number"
                      className="form-control"
                      value={dist.marks}
                      onChange={(e) => updateDistribution(index, 'marks', parseInt(e.target.value) || '')}
                      min="1"
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div className="form-group">
                    <label>Count:</label>
                    <input
                      type="number"
                      className="form-control"
                      value={dist.count}
                      onChange={(e) => updateDistribution(index, 'count', parseInt(e.target.value) || '')}
                      min="1"
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Bloom's Level:</label>
                    <select
                      className="form-control"
                      value={dist.bl}
                      onChange={(e) => updateDistribution(index, 'bl', e.target.value)}
                    >
                      <option value="">Any BL</option>
                      <option value="1">1 - Remember</option>
                      <option value="2">2 - Understand</option>
                      <option value="3">3 - Apply</option>
                      <option value="4">4 - Analyze</option>
                      <option value="5">5 - Evaluate</option>
                      <option value="6">6 - Create</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => removeDistribution(index)}
                    className="btn btn-danger remove-btn"
                    title="Remove this distribution"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
            
            <button onClick={addDistribution} className="btn btn-outline">
              + Add Question Type Manually
            </button>
          </div>

          <div className="generate-section">
            <button 
              onClick={generatePaper} 
              className="btn btn-success generate-btn"
              disabled={loading || paperConfig.questionDistribution.length === 0}
            >
              {loading ? 'Generating Paper...' : 'Generate Question Paper'}
            </button>
          </div>
        </div>

        {availableQuestions.length > 0 && (
          <div className="card">
            <h3>Available Questions ({availableQuestions.length})</h3>
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
                  {availableQuestions.map((question) => (
                    <tr key={question._id}>
                      <td className="question-text">{question.questionText}</td>
                      <td>{question.unit}</td>
                      <td>{question.co}</td>
                      <td>{question.bl}</td>
                      <td><strong>{question.marks}</strong></td>
                      <td>{question.subject}</td>
                      <td>{question.class}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {generatedPaper && (
          <div className="card generated-paper">
            <h3>Generated Paper Preview</h3>
            
            <div className="generation-details">
              <h4>Generation Results:</h4>
              
              {/* Debug Information */}
              <div className="debug-info">
                <h5>📊 Debug Information:</h5>
                <p><strong>Subject:</strong> {filters.subject}</p>
                <p><strong>Class:</strong> {filters.class}</p>
                <p><strong>Total Distribution Criteria:</strong> {paperConfig.questionDistribution.length}</p>
                <p><strong>Available Questions:</strong> {availableQuestions.length}</p>
              </div>

              {generatedPaper.distributionResults && generatedPaper.distributionResults.map((result, index) => (
                <div key={index} className={`distribution-result ${result.found === 0 ? 'no-match' : 'match'}`}>
                  <div className="criteria-details">
                    <span className="criteria">{result.criteria}:</span>
                    <span className="result">
                      {result.found} of {result.requested} found
                      {result.found > 0 && (
                        <span className={`match-type ${result.exactMatch ? 'match-exact' : 'match-flexible'}`}>
                          {result.exactMatch ? 'exact' : result.matchType}
                        </span>
                      )}
                    </span>
                  </div>
                  {result.found === 0 && (
                    <div className="no-match-help">
                      💡 Try adjusting marks or Bloom's level to match available questions
                    </div>
                  )}
                </div>
              ))}
              
              {generatedPaper.distributionResults && generatedPaper.distributionResults.some(r => !r.exactMatch && r.found > 0) && (
                <div className="flexible-match-info">
                  💡 <strong>Flexible matching:</strong> Some questions were matched using flexible criteria when exact matches weren't available.
                </div>
              )}
            </div>

            <div className="paper-header">
              <h4>{generatedPaper.paperName}</h4>
              <p><strong>Class:</strong> {generatedPaper.className} | <strong>Subject:</strong> {generatedPaper.subject} | <strong>Total Marks:</strong> {generatedPaper.totalMarks}</p>
              {generatedPaper.message && (
                <p className={`message ${generatedPaper.questions.length === 0 ? 'error-message' : 'success-message'}`}>
                  {generatedPaper.message}
                </p>
              )}
            </div>
            
            <div className="questions-list">
              {generatedPaper.questions.length === 0 ? (
                <div className="no-questions">
                  <h4>❌ No Questions Generated</h4>
                  <p>Detailed analysis:</p>
                  <ul>
                    <li>Your distribution criteria: {paperConfig.questionDistribution.map(d => `${d.count} questions of ${d.marks} marks (BL ${d.bl})`).join(', ')}</li>
                    <li>Available questions: {availableQuestions.map(q => `${q.marks} marks (BL ${q.bl})`).join(', ')}</li>
                    <li>Try using the "Quick Setup" or "Auto-Fill All" buttons to automatically match available questions</li>
                    <li>Or manually adjust your distribution to match the available question types shown above</li>
                  </ul>
                </div>
              ) : (
                generatedPaper.questions.map((question, index) => (
                  <div key={index} className="question-item">
                    <p className="question-text">
                      <strong>Q{index + 1}. </strong>
                      {question.questionText}
                      <span className="marks-badge">[{question.marks} Marks]</span>
                    </p>
                    <div className="question-meta">
                      <span>Unit: {question.unit}</span>
                      <span>CO: {question.co}</span>
                      <span>BL: {question.bl}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {generatedPaper.questions.length > 0 && (
              <div className="download-section">
                <h4>Download Paper</h4>
                <div className="download-buttons">
                  <button 
                    onClick={() => downloadPaper('doc')} 
                    className="btn btn-primary"
                    disabled={downloadLoading}
                  >
                    {downloadLoading ? 'Downloading...' : 'Download as Word Document'}
                  </button>
                  <button 
                    onClick={() => downloadPaper('json')} 
                    className="btn btn-info"
                    disabled={downloadLoading}
                  >
                    {downloadLoading ? 'Downloading...' : 'Download as JSON'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperGenerator;