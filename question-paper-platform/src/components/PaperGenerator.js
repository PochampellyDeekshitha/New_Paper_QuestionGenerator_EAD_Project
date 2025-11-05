import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import '../styles/PaperGenerator.css';

const PaperGenerator = () => {
  const [filters, setFilters] = useState({
    subject: '',
    department: '',
    course: '',
    units: [],
    cos: []
  });
  const [paperConfig, setPaperConfig] = useState({
    paperName: 'Mid-1 Exam',
    totalMarks: 20,
    collegeName: 'CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY (Autonomous)',
    program: 'B.E',
    semester: 'V',
    examinationType: 'Main/Backlog',
    monthYear: 'April 2025',
    time: '1 Hour',
    note: 'Answer ALL questions from Part-A & Part-B (Internal Choice) at one place in the same order',
    commonTo: 'IT',
    questionDistribution: []
  });
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [availableCombinations, setAvailableCombinations] = useState({});
  const [searchLoading, setSearchLoading] = useState(false);
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

  // Calculate available combinations from actual questions
  const calculateCombinations = (questions) => {
    const combinations = {};
    
    questions.forEach(question => {
      const key = `${question.marks} marks - BL ${question.bl}`;
      combinations[key] = (combinations[key] || 0) + 1;
    });
    
    return combinations;
  };

  // Fetch questions from the same API as SubjectExpert
  const searchQuestions = async () => {
    if (!filters.subject || !filters.department) {
      alert('Please enter both Subject and Department to search questions');
      return;
    }

    setSearchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/questions', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Filter questions based on subject and department
      const filteredQuestions = response.data.filter(question => 
        question.subject === filters.subject && 
        question.department === filters.department
      );

      setAvailableQuestions(filteredQuestions);
      
      // Calculate available combinations
      const combinations = calculateCombinations(filteredQuestions);
      setAvailableCombinations(combinations);
      
      alert(`Found ${filteredQuestions.length} questions matching your criteria`);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Error fetching questions: ' + (error.response?.data?.message || error.message));
    } finally {
      setSearchLoading(false);
    }
  };

  const addDistribution = () => {
    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: [
        ...(prev.questionDistribution || []),
        { marks: '', count: '', bl: '', section: 'Part-A' }
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
    if (!paperConfig.questionDistribution || paperConfig.questionDistribution.length === 0) {
      alert('Please add at least one question distribution');
      return false;
    }

    let totalConfiguredMarks = 0;
    for (const dist of paperConfig.questionDistribution) {
      if (!dist.marks || !dist.count || !dist.bl || !dist.section) {
        alert('Please fill all fields in question distribution');
        return false;
      }
      if (dist.marks <= 0 || dist.count <= 0) {
        alert('Marks and count must be positive numbers');
        return false;
      }
      totalConfiguredMarks += dist.marks * dist.count;
    }

    // Check if configured marks match total marks
    if (totalConfiguredMarks !== paperConfig.totalMarks) {
      alert(`Configured marks (${totalConfiguredMarks}) do not match total marks (${paperConfig.totalMarks}). Please adjust your distribution.`);
      return false;
    }

    return true;
  };

  const setupQuickDistribution = () => {
    if (Object.keys(availableCombinations).length === 0) {
      alert('Please search for questions first to see available combinations');
      return;
    }

    // Create distribution based on available combinations
    const newDistribution = Object.entries(availableCombinations).map(([combo, count]) => {
      const [marksStr, blStr] = combo.split(' - BL ');
      const marks = parseInt(marksStr.split(' ')[0]);
      const bl = parseInt(blStr);
      const section = marks <= 5 ? 'Part-A' : 'Part-B';
      
      return {
        marks: marks,
        count: 1, // Start with 1 question per type
        bl: bl,
        section: section
      };
    });

    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: newDistribution
    }));

    alert(`Set up ${newDistribution.length} question types. You can adjust the counts.`);
  };

  const autoFillDistribution = () => {
    if (Object.keys(availableCombinations).length === 0) {
      alert('Please search for questions first to see available combinations');
      return;
    }

    // Create distribution that uses all available question types with reasonable counts
    const newDistribution = Object.entries(availableCombinations).map(([combo, availableCount]) => {
      const [marksStr, blStr] = combo.split(' - BL ');
      const marks = parseInt(marksStr.split(' ')[0]);
      const bl = parseInt(blStr);
      const section = marks <= 5 ? 'Part-A' : 'Part-B';
      
      // Use 1-2 questions per type, but not more than available
      const count = Math.min(2, Math.max(1, Math.floor(availableCount / 2)));
      
      return {
        marks: marks,
        count: count,
        bl: bl,
        section: section
      };
    });

    setPaperConfig(prev => ({
      ...prev,
      questionDistribution: newDistribution
    }));

    alert(`Auto-filled ${newDistribution.length} question types based on available questions`);
  };

  const generatePaper = async () => {
    if (!filters.subject || !filters.department) {
      alert('Please enter Subject and Department');
      return;
    }

    if (!paperConfig.paperName) {
      alert('Please enter Paper Name');
      return;
    }

    if (!paperConfig.questionDistribution || paperConfig.questionDistribution.length === 0) {
      alert('Please add at least one question distribution');
      return;
    }

    if (!validateDistribution()) {
      return;
    }

    setLoading(true);
    try {
      // Generate paper based on distribution using actual available questions
      const generatedQuestions = [];
      let totalMarks = 0;
      const usedQuestionIds = new Set(); // To avoid duplicate questions

      for (const dist of paperConfig.questionDistribution) {
        const { marks, count, bl, section } = dist;
        
        // Filter available questions that match the criteria and haven't been used
        const matchingQuestions = availableQuestions.filter(q => 
          q.marks === marks && 
          q.bl === bl &&
          !usedQuestionIds.has(q._id)
        ).slice(0, count);

        // If not enough matching questions, show warning but continue
        if (matchingQuestions.length < count) {
          console.warn(`Not enough questions for ${marks} marks BL ${bl}. Requested: ${count}, Found: ${matchingQuestions.length}`);
        }

        matchingQuestions.forEach(question => {
          generatedQuestions.push({
            ...question,
            section: section
          });
          usedQuestionIds.add(question._id);
          totalMarks += question.marks;
        });
      }

      const generatedPaperData = {
        paperName: paperConfig.paperName,
        subject: filters.subject,
        department: filters.department,
        questions: generatedQuestions,
        totalMarks: totalMarks,
        message: generatedQuestions.length > 0 
          ? `Paper generated successfully with ${generatedQuestions.length} questions and ${totalMarks} total marks`
          : 'No questions were generated. Please check the available question types and adjust your distribution.'
      };

      setGeneratedPaper(generatedPaperData);
      
      if (generatedQuestions.length === 0) {
        alert('No questions were generated. Please check the available question types and adjust your distribution.');
      } else {
        alert(`Paper generated successfully with ${generatedQuestions.length} questions and ${totalMarks} total marks`);
      }
    } catch (error) {
      console.error('Error generating paper:', error);
      alert('Error generating paper: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!generatedPaper) {
      alert('No paper generated to download');
      return;
    }

    if (generatedPaper.questions.length === 0) {
      alert('Cannot download empty paper. Please generate a paper with questions first.');
      return;
    }

    setDownloadLoading(true);
    try {
      // Create new PDF document
      const pdf = new jsPDF();
      
      // Set initial y position
      let yPosition = 20;
      
      // Add college name (centered)
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(paperConfig.collegeName, 105, yPosition, { align: 'center' });
      yPosition += 10;
      
      // Add program and semester
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Program: ${paperConfig.program}`, 20, yPosition);
      pdf.text(`Semester: ${paperConfig.semester}`, 150, yPosition);
      yPosition += 8;
      
      // Add examination details
      pdf.text(`Examination: ${paperConfig.examinationType}`, 20, yPosition);
      pdf.text(`Month & Year: ${paperConfig.monthYear}`, 150, yPosition);
      yPosition += 8;
      
      // Add time and common to
      pdf.text(`Time: ${paperConfig.time}`, 20, yPosition);
      pdf.text(`Common To: ${paperConfig.commonTo}`, 150, yPosition);
      yPosition += 15;
      
      // Add paper name
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Paper: ${generatedPaper.paperName}`, 105, yPosition, { align: 'center' });
      yPosition += 8;
      
      // Add subject and department
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Subject: ${generatedPaper.subject}`, 20, yPosition);
      pdf.text(`Department: ${generatedPaper.department}`, 150, yPosition);
      yPosition += 8;
      
      // Add total marks
      pdf.text(`Total Marks: ${generatedPaper.totalMarks}`, 20, yPosition);
      yPosition += 15;
      
      // Add note
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Note: ${paperConfig.note}`, 20, yPosition);
      yPosition += 15;
      
      // Add Part A heading
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PART - A', 20, yPosition);
      yPosition += 10;
      
      // Add Part A questions
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      const partAQuestions = generatedPaper.questions.filter(q => q.section === 'Part-A');
      partAQuestions.forEach((question, index) => {
        const questionText = `Q${index + 1}. ${question.questionText} [${question.marks} Marks]`;
        
        // Split long questions into multiple lines
        const splitText = pdf.splitTextToSize(questionText, 170);
        
        // Check if we need a new page
        if (yPosition + (splitText.length * 7) > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.text(splitText, 20, yPosition);
        yPosition += (splitText.length * 7) + 3;
      });
      
      // Add Part B heading
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      } else {
        yPosition += 10;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PART - B', 20, yPosition);
      yPosition += 10;
      
      // Add Part B questions
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      const partBQuestions = generatedPaper.questions.filter(q => q.section === 'Part-B');
      partBQuestions.forEach((question, index) => {
        const questionText = `Q${partAQuestions.length + index + 1}. ${question.questionText} [${question.marks} Marks]`;
        
        // Split long questions into multiple lines
        const splitText = pdf.splitTextToSize(questionText, 170);
        
        // Check if we need a new page
        if (yPosition + (splitText.length * 7) > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.text(splitText, 20, yPosition);
        yPosition += (splitText.length * 7) + 3;
      });
      
      // Add end of paper
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      } else {
        yPosition += 10;
      }
      
      pdf.setFont('helvetica', 'italic');
      pdf.text('--- End of Question Paper ---', 105, yPosition, { align: 'center' });
      
      // Save the PDF
      pdf.save(`${generatedPaper.paperName.replace(/\s+/g, '_')}.pdf`);
      
      alert('Paper downloaded successfully as PDF');
    } catch (error) {
      console.error('PDF download error:', error);
      alert('Error downloading PDF: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadLoading(false);
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
      if (format === 'json') {
        // Download as JSON
        const dataStr = JSON.stringify(generatedPaper, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${generatedPaper.paperName.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Paper downloaded successfully as JSON');
      } else if (format === 'pdf') {
        downloadPDF();
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading paper: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadLoading(false);
    }
  };

  // Auto-fill demo data for quick testing
  const autoFillDemoData = () => {
    setFilters({
      subject: 'Computer Networks',
      department: 'Information Technology',
      course: 'B.Tech',
      units: [],
      cos: []
    });
  };

  return (
    <div className="subject-expert-container">
      <nav className="navbar">
        <div className="nav-brand">Question Paper Generator</div>
        <div className="nav-items">
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="container">
        <div className="card">
          <h2>Generate Question Paper</h2>
          
          <div className="form-section">
            <h3>College & Paper Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>College Name:</label>
                <input
                  type="text"
                  name="collegeName"
                  className="form-control"
                  value={paperConfig.collegeName}
                  onChange={handlePaperConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Program:</label>
                <input
                  type="text"
                  name="program"
                  className="form-control"
                  value={paperConfig.program}
                  onChange={handlePaperConfigChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Semester:</label>
                <input
                  type="text"
                  name="semester"
                  className="form-control"
                  value={paperConfig.semester}
                  onChange={handlePaperConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Examination Type:</label>
                <select
                  name="examinationType"
                  className="form-control"
                  value={paperConfig.examinationType}
                  onChange={handlePaperConfigChange}
                >
                  <option value="Main/Backlog">Main/Backlog</option>
                  <option value="Regular">Regular</option>
                  <option value="Backlog">Backlog</option>
                  <option value="Supplementary">Supplementary</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Month & Year:</label>
                <input
                  type="text"
                  name="monthYear"
                  className="form-control"
                  value={paperConfig.monthYear}
                  onChange={handlePaperConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Common To (Departments):</label>
                <input
                  type="text"
                  name="commonTo"
                  className="form-control"
                  value={paperConfig.commonTo}
                  onChange={handlePaperConfigChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Paper Name:</label>
                <input
                  type="text"
                  name="paperName"
                  className="form-control"
                  value={paperConfig.paperName}
                  onChange={handlePaperConfigChange}
                  placeholder="e.g., Mid-1 Examination"
                  required
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
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Time Duration:</label>
                <input
                  type="text"
                  name="time"
                  className="form-control"
                  value={paperConfig.time}
                  onChange={handlePaperConfigChange}
                />
              </div>
              <div className="form-group full-width">
                <label>Instructions/Note:</label>
                <textarea
                  name="note"
                  className="form-control"
                  rows="2"
                  value={paperConfig.note}
                  onChange={handlePaperConfigChange}
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
                  placeholder="e.g., Computer Networks"
                  required
                />
              </div>
              <div className="form-group">
                <label>Department:</label>
                <input
                  type="text"
                  name="department"
                  className="form-control"
                  value={filters.department}
                  onChange={handleFilterChange}
                  placeholder="e.g., Information Technology"
                  required
                />
              </div>
              <div className="form-group">
                <label>Course:</label>
                <input
                  type="text"
                  name="course"
                  className="form-control"
                  value={filters.course}
                  onChange={handleFilterChange}
                  placeholder="e.g., B.Tech"
                />
              </div>
            </div>
            <div className="form-buttons">
              <button onClick={autoFillDemoData} className="btn btn-secondary">
                Auto-fill Demo Data
              </button>
              <button onClick={searchQuestions} className="btn btn-primary" disabled={searchLoading}>
                {searchLoading ? 'Searching...' : 'Search Available Questions'}
              </button>
            </div>
            
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
              {Object.keys(availableCombinations).length > 0 && (
                <div className="distribution-buttons">
                  <button onClick={setupQuickDistribution} className="btn btn-secondary">
                    Quick Setup
                  </button>
                  <button onClick={autoFillDistribution} className="btn btn-secondary">
                    Auto-Fill All
                  </button>
                </div>
              )}
            </div>
            <p className="help-text">
              Configure how many questions of each type you want in the paper. 
              Use the available question types above as a guide.
            </p>

            {Object.keys(availableCombinations).length > 0 && (
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
            
            {!paperConfig.questionDistribution || paperConfig.questionDistribution.length === 0 ? (
              <div className="no-distribution">
                <p>No distribution configured yet.</p>
                {Object.keys(availableCombinations).length > 0 ? (
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
                    <label>Section:</label>
                    <select
                      className="form-control"
                      value={dist.section}
                      onChange={(e) => updateDistribution(index, 'section', e.target.value)}
                    >
                      <option value="Part-A">Part-A</option>
                      <option value="Part-B">Part-B</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Marks:</label>
                    <input
                      type="number"
                      className="form-control"
                      value={dist.marks}
                      onChange={(e) => updateDistribution(index, 'marks', parseInt(e.target.value) || '')}
                      min="1"
                      max="20"
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
                      placeholder="e.g., 2"
                    />
                  </div>
                  <div className="form-group">
                    <label>Bloom's Level:</label>
                    <select
                      className="form-control"
                      value={dist.bl}
                      onChange={(e) => updateDistribution(index, 'bl', e.target.value)}
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
            
            <button onClick={addDistribution} className="btn btn-secondary">
              + Add Question Type
            </button>
          </div>

          <div className="generate-section">
            <button 
              onClick={generatePaper} 
              className="btn btn-success generate-btn"
              disabled={loading || !paperConfig.questionDistribution || paperConfig.questionDistribution.length === 0}
            >
              {loading ? 'Generating Paper...' : 'Generate Question Paper'}
            </button>
          </div>
        </div>

        {availableQuestions.length > 0 && (
          <div className="card">
            <h2>Available Questions ({availableQuestions.length} questions)</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {availableQuestions.map((question, index) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {generatedPaper && (
          <div className="card">
            <h2>Generated Paper Preview</h2>
            
            <div className="paper-preview">
              <div className="paper-header">
                <h3>{generatedPaper.paperName}</h3>
                <p><strong>Subject:</strong> {generatedPaper.subject} | <strong>Department:</strong> {generatedPaper.department} | <strong>Total Marks:</strong> {generatedPaper.totalMarks}</p>
                {generatedPaper.message && (
                  <p className={`message ${generatedPaper.questions.length === 0 ? 'error' : 'success'}`}>
                    {generatedPaper.message}
                  </p>
                )}
              </div>
              
              <div className="questions-list">
                {generatedPaper.questions.length === 0 ? (
                  <div className="no-questions">
                    <h4>No questions were generated</h4>
                    <p>Please adjust your distribution criteria to match available questions.</p>
                  </div>
                ) : (
                  generatedPaper.questions.map((question, index) => (
                    <div key={index} className="question-item">
                      <p className="question-text">
                        <strong>Q{index + 1}. </strong>
                        {question.questionText}
                        <span className="marks">[{question.marks} Marks]</span>
                      </p>
                      <div className="question-meta">
                        <span>Unit: {question.unit}</span>
                        <span>CO: {question.co}</span>
                        <span>BL: {question.bl}</span>
                        <span>Section: {question.section}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {generatedPaper.questions.length > 0 && (
                <div className="download-section">
                  <button 
                    onClick={() => downloadPaper('pdf')} 
                    className="btn btn-primary"
                    disabled={downloadLoading}
                  >
                    {downloadLoading ? 'Downloading...' : 'Download as PDF'}
                  </button>
                  <button 
                    onClick={() => downloadPaper('json')} 
                    className="btn btn-secondary"
                    disabled={downloadLoading}
                    style={{ marginLeft: '10px' }}
                  >
                    {downloadLoading ? 'Downloading...' : 'Download as JSON'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperGenerator;