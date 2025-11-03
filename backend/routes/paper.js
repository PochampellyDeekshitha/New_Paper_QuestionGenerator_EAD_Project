const express = require('express');
const Question = require('../models/Question');
const auth = require('../middleware/auth');
const router = express.Router();

// Generate question paper
router.post('/generate', auth, async (req, res) => {
  try {
    const { 
      paperName, 
      className, 
      subject, 
      questionDistribution,
      units,
      cos
    } = req.body;

    console.log('=== PAPER GENERATION STARTED ===');
    console.log('Paper details:', { paperName, className, subject });
    console.log('Question distribution:', JSON.stringify(questionDistribution, null, 2));

    let filter = { subject, class: className };
    
    if (units && units.length > 0) filter.unit = { $in: units };
    if (cos && cos.length > 0) filter.co = { $in: cos };

    // Get all questions matching filters
    const allQuestions = await Question.find(filter);
    console.log(`Found ${allQuestions.length} questions matching filters`);

    // Show available marks and BL combinations
    const availableCombinations = {};
    allQuestions.forEach(q => {
      const key = `${q.marks} marks - BL ${q.bl}`;
      if (!availableCombinations[key]) availableCombinations[key] = 0;
      availableCombinations[key]++;
    });
    console.log('Available combinations:', availableCombinations);

    // If no questions found, return empty paper
    if (allQuestions.length === 0) {
      return res.json({
        paperName,
        className,
        subject,
        totalMarks: 0,
        questions: [],
        distribution: questionDistribution,
        distributionResults: [],
        availableCombinations,
        message: 'No questions found matching the criteria'
      });
    }

    // Select questions based on distribution
    const selectedQuestions = [];
    const usedQuestionIds = new Set();
    const distributionResults = [];

    // Process question distribution
    for (const dist of questionDistribution) {
      const { marks, count, bl } = dist;
      
      console.log(`\nProcessing distribution: ${count} questions of ${marks} marks (BL ${bl})`);
      
      // Convert to numbers for comparison
      const targetMarks = parseInt(marks);
      const targetBL = parseInt(bl);
      const targetCount = parseInt(count);

      // Find questions that match the criteria exactly
      let matchingQuestions = allQuestions.filter(q => 
        !usedQuestionIds.has(q._id.toString()) && 
        q.marks === targetMarks && 
        q.bl === targetBL
      );

      console.log(`Found ${matchingQuestions.length} exact matching questions`);

      let selected = [];
      let matchType = 'exact';

      // If no exact matches, try flexible matching
      if (matchingQuestions.length === 0) {
        // Try matching by marks only
        matchingQuestions = allQuestions.filter(q => 
          !usedQuestionIds.has(q._id.toString()) && 
          q.marks === targetMarks
        );
        matchType = 'marks_only';
        console.log(`Found ${matchingQuestions.length} questions with same marks`);

        // If still no matches, try matching by BL only
        if (matchingQuestions.length === 0) {
          matchingQuestions = allQuestions.filter(q => 
            !usedQuestionIds.has(q._id.toString()) && 
            q.bl === targetBL
          );
          matchType = 'bl_only';
          console.log(`Found ${matchingQuestions.length} questions with same BL`);
        }

        // If still no matches, use any available questions
        if (matchingQuestions.length === 0) {
          matchingQuestions = allQuestions.filter(q => 
            !usedQuestionIds.has(q._id.toString())
          );
          matchType = 'any';
          console.log(`Found ${matchingQuestions.length} any available questions`);
        }
      }

      // Select questions if available
      if (matchingQuestions.length > 0) {
        // Shuffle and select required number of questions
        const shuffled = [...matchingQuestions].sort(() => 0.5 - Math.random());
        selected = shuffled.slice(0, Math.min(targetCount, matchingQuestions.length));
        
        selected.forEach(q => {
          selectedQuestions.push(q);
          usedQuestionIds.add(q._id.toString());
        });

        console.log(`Selected ${selected.length} questions for this distribution`);
      }

      distributionResults.push({
        criteria: `${count} questions of ${marks} marks (BL ${bl})`,
        requested: targetCount,
        found: selected.length,
        questions: selected,
        matchType: matchType,
        exactMatch: matchType === 'exact'
      });
    }

    // Calculate total marks
    const calculatedTotalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

    console.log(`\n=== PAPER GENERATION COMPLETED ===`);
    console.log(`Generated paper with ${selectedQuestions.length} questions, total marks: ${calculatedTotalMarks}`);
    console.log('Distribution results:', distributionResults);

    // Generate helpful message
    let message = '';
    if (selectedQuestions.length === 0) {
      message = 'No questions were generated. Please check your distribution criteria against available questions.';
    } else {
      const exactMatches = distributionResults.filter(r => r.exactMatch).length;
      const totalRequested = distributionResults.reduce((sum, r) => sum + r.requested, 0);
      message = `Generated paper with ${selectedQuestions.length} of ${totalRequested} requested questions.`;
      
      if (exactMatches < distributionResults.length) {
        message += ' Some questions were matched using flexible criteria.';
      }
    }

    res.json({
      paperName,
      className,
      subject,
      totalMarks: calculatedTotalMarks,
      questions: selectedQuestions,
      distribution: questionDistribution,
      distributionResults,
      availableCombinations,
      message
    });
  } catch (error) {
    console.error('Error generating paper:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Download question paper as Word document
router.post('/download-word', auth, async (req, res) => {
  try {
    const { paperData } = req.body;
    
    if (!paperData || !paperData.questions) {
      return res.status(400).json({ message: 'Invalid paper data' });
    }

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${paperData.paperName || 'Question Paper'}</title>
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            margin: 1in; 
            line-height: 1.5;
            font-size: 12pt;
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .question { 
            margin-bottom: 20px; 
            page-break-inside: avoid;
          }
          .question-text {
            margin-bottom: 8px;
          }
          .meta { 
            font-size: 10pt; 
            color: #555;
            margin-top: 5px;
            font-style: italic;
          }
          .total-marks {
            text-align: right;
            font-weight: bold;
            margin-top: 40px;
            border-top: 1px solid #000;
            padding-top: 10px;
          }
          .instructions {
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .question-number {
            font-weight: bold;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${paperData.paperName || 'QUESTION PAPER'}</h1>
          <h2>${paperData.className || ''}</h2>
          <h3>${paperData.subject || ''}</h3>
          <h4>Time: 3 Hours &nbsp;&nbsp;&nbsp; Maximum Marks: ${paperData.totalMarks || 'N/A'}</h4>
        </div>
        
        <div class="instructions">
          <strong>Instructions:</strong>
          <ol>
            <li>Attempt all questions</li>
            <li>Figures to the right indicate full marks</li>
            <li>Assume suitable data if necessary</li>
            <li>Mobile phones and other electronic gadgets are not permitted</li>
          </ol>
        </div>
    `;

    paperData.questions.forEach((question, index) => {
      htmlContent += `
        <div class="question">
          <div class="question-text">
            <span class="question-number">Q${index + 1}.</span>
            ${question.questionText}
            <strong>[${question.marks} Marks]</strong>
          </div>
          <div class="meta">
            Unit: ${question.unit} | CO: ${question.co} | Bloom's Level: ${question.bl}
          </div>
        </div>
      `;
    });

    htmlContent += `
        <div class="total-marks">
          Total Marks: ${paperData.totalMarks || 'N/A'}
        </div>
      </body>
      </html>
    `;

    // Set headers for Word document download
    res.setHeader('Content-Type', 'application/vnd.ms-word');
    res.setHeader('Content-Disposition', `attachment; filename="${(paperData.paperName || 'question_paper')}.doc"`);
    res.send(htmlContent);

  } catch (error) {
    console.error('Error generating Word document:', error);
    res.status(500).json({ message: 'Error generating document: ' + error.message });
  }
});

// Download as JSON
router.post('/download-json', auth, async (req, res) => {
  try {
    const { paperData } = req.body;
    
    if (!paperData) {
      return res.status(400).json({ message: 'Invalid paper data' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${(paperData.paperName || 'question_paper')}.json"`);
    res.send(JSON.stringify(paperData, null, 2));

  } catch (error) {
    console.error('Error generating JSON:', error);
    res.status(500).json({ message: 'Error generating JSON: ' + error.message });
  }
});

module.exports = router;