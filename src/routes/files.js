const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { catchAsync } = require('../middleware/errorHandler');
const { validateFileUpload } = require('../middleware/validation');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'), false);
    }
  }
});

// Parse players CSV file
router.post('/parse/players', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const result = await fileProcessingService.parsePlayersCSV(req.file.path);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: result,
    message: `Successfully parsed ${result.length} players`
  });
}));

// Parse team stacks CSV file
router.post('/parse/stacks', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const result = await fileProcessingService.parseTeamStacksCSV(req.file.path);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: result,
    message: `Successfully parsed ${result.length} team stacks`
  });
}));

// Parse DraftKings entries CSV file
router.post('/parse/draftkings', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const result = await fileProcessingService.parseDraftKingsCSV(req.file.path);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: result,
    message: `Successfully parsed ${result.length} DraftKings entries`
  });
}));

// Parse JSON file
router.post('/parse/json', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const result = await fileProcessingService.parseJSON(req.file.path);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: result,
    message: 'Successfully parsed JSON file'
  });
}));

// Validate file format and content
router.post('/validate', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const validation = await fileProcessingService.validateFile(req.file.path, req.body.expectedType);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: validation,
    message: validation.isValid ? 'File validation passed' : 'File validation failed'
  });
}));

// Generate players CSV
router.post('/generate/players-csv', catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  const { players } = req.body;
  
  if (!players || !Array.isArray(players)) {
    return res.status(400).json({
      success: false,
      message: 'Players array is required'
    });
  }
  
  const csvContent = await fileProcessingService.generatePlayersCSV(players);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="players.csv"');
  res.send(csvContent);
}));

// Generate team stacks CSV
router.post('/generate/stacks-csv', catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  const { stacks } = req.body;
  
  if (!stacks || !Array.isArray(stacks)) {
    return res.status(400).json({
      success: false,
      message: 'Stacks array is required'
    });
  }
  
  const csvContent = await fileProcessingService.generateTeamStacksCSV(stacks);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="team-stacks.csv"');
  res.send(csvContent);
}));

// Generate lineups CSV for DraftKings
router.post('/generate/draftkings-csv', catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  const { lineups } = req.body;
  
  if (!lineups || !Array.isArray(lineups)) {
    return res.status(400).json({
      success: false,
      message: 'Lineups array is required'
    });
  }
  
  const csvContent = await fileProcessingService.generateDraftKingsCSV(lineups);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="draftkings-lineups.csv"');
  res.send(csvContent);
}));

// Generate JSON file
router.post('/generate/json', catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  const { data, filename } = req.body;
  
  if (!data) {
    return res.status(400).json({
      success: false,
      message: 'Data is required'
    });
  }
  
  const jsonContent = await fileProcessingService.generateJSON(data);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename || 'data'}.json"`);
  res.send(jsonContent);
}));

// Detect file type
router.post('/detect-type', upload.single('file'), validateFileUpload, catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const fileType = await fileProcessingService.detectFileType(req.file.path);
  
  // Clean up uploaded file
  await fs.unlink(req.file.path);
  
  res.json({
    success: true,
    data: { fileType },
    message: `Detected file type: ${fileType}`
  });
}));

// Clean up temporary files
router.post('/cleanup', catchAsync(async (req, res) => {
  const fileProcessingService = req.app.get('services').fileProcessing;
  
  const result = await fileProcessingService.cleanupTempFiles();
  
  res.json({
    success: true,
    data: result,
    message: `Cleaned up ${result.filesDeleted} temporary files`
  });
}));

module.exports = router;