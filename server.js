const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = 'uploads';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir);
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDFs are allowed!'), false);
        }
    }
});

app.post('/convert', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const inputPath = req.file.path;
    const outputFilename = `converted_${Date.now()}.docx`;
    const outputPath = path.join('uploads', outputFilename);

    const startTime = Date.now();

    const pythonProcess = spawn('python3', ['convert.py', inputPath, outputPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        console.log(`Conversion took ${duration}ms`);

        if (code !== 0) {
            console.error('Conversion process failed with code', code);
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (e) { console.error('Cleanup error', e); }
            return res.status(500).json({ error: 'Conversion failed' });
        }

        // Custom filename logic: iot.pdf -> iotword.docx
        const originalName = req.file.originalname;
        const nameWithoutExt = path.parse(originalName).name;
        const downloadName = `${nameWithoutExt}word.docx`;

        res.download(outputPath, downloadName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }

            try {
                fs.unlinkSync(inputPath);
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                }, 10000); // Keep file briefly just in case, or delete immediately if download starts
            } catch (cleanupErr) {
                console.error('Error cleaning up files:', cleanupErr);
            }
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
