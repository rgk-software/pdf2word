const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

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
            // Keep original name for libreoffice converting logic which might rely on extension
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            cb(null, Date.now() + '_' + safeName);
        }
    }),
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type!'), false);
        }
    }
});

const SOFFICE_PATH = '/Applications/LibreOffice.app/Contents/MacOS/soffice';

// Helper to run python script
const runPython = (mode, input, output) => {
    return new Promise((resolve, reject) => {
        const python = spawn('python3', ['universal_convert.py', mode, input, output]);

        python.stdout.on('data', (data) => console.log(`Py out: ${data} `));
        python.stderr.on('data', (data) => console.error(`Py err: ${data} `));

        python.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Python script failed with code ${code} `));
        });
    });
};

// Helper to run LibreOffice
const runLibreOffice = (input, outputDir) => {
    return new Promise((resolve, reject) => {
        // --convert-to pdf
        const cmd = `"${SOFFICE_PATH}" --headless --convert-to pdf "${input}" --outdir "${outputDir}"`;
        console.log("Running:", cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error("LibreOffice Error:", error);
                reject(error);
            } else {
                console.log("LibreOffice Out:", stdout);
                resolve();
            }
        });
    });
};

app.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const conversionType = req.body.conversionType; // e.g., 'pdf-to-word', 'word-to-pdf'
    const inputPath = path.resolve(req.file.path);
    const inputDir = path.dirname(inputPath);
    const originalName = req.file.originalname;
    const nameWithoutExt = path.parse(originalName).name;

    let outputFilename = `converted_${Date.now()} `;
    let outputPath = '';

    try {
        const startTime = Date.now();

        if (conversionType === 'pdf-to-word') {
            outputFilename = `${nameWithoutExt} word.docx`;
            outputPath = path.join(inputDir, outputFilename);
            await runPython('pdf-to-word', inputPath, outputPath);

        } else if (conversionType === 'pdf-to-ppt') {
            outputFilename = `${nameWithoutExt}.pptx`;
            outputPath = path.join(inputDir, outputFilename);
            await runPython('pdf-to-ppt', inputPath, outputPath);

        } else if (conversionType === 'pdf-to-image') {
            // Python logical will decide if zip or png. We name it .png generically, script might swap it.
            // Actually script determines zip vs png.
            // Let's name it generic and check what exists? or force script to name it.
            // Script logic: "if output_file ends with .png... zip logic renames"
            outputFilename = `${nameWithoutExt}.png`;
            outputPath = path.join(inputDir, outputFilename);
            await runPython('pdf-to-image', inputPath, outputPath);

            // Check if zip was created
            if (fs.existsSync(outputPath.replace('.png', '.zip'))) {
                outputPath = outputPath.replace('.png', '.zip');
                outputFilename = outputFilename.replace('.png', '.zip');
            }

        } else if (conversionType === 'word-to-pdf' || conversionType === 'ppt-to-pdf') {
            await runLibreOffice(inputPath, inputDir);
            // LibreOffice outputs same basename + .pdf
            const generatedPdfName = path.parse(req.file.filename).name + '.pdf';
            const generatedPdfPath = path.join(inputDir, generatedPdfName);

            outputFilename = `${nameWithoutExt}.pdf`;
            outputPath = generatedPdfPath; // We will rename or just download this

        } else if (conversionType === 'ppt-to-image') {
            // Chain: PPT -> PDF -> Image
            await runLibreOffice(inputPath, inputDir);
            const generatedPdfName = path.parse(req.file.filename).name + '.pdf';
            const tempPdfPath = path.join(inputDir, generatedPdfName);

            outputFilename = `${nameWithoutExt}.png`;
            outputPath = path.join(inputDir, outputFilename);

            await runPython('pdf-to-image', tempPdfPath, outputPath);
            // Check zip
            if (fs.existsSync(outputPath.replace('.png', '.zip'))) {
                outputPath = outputPath.replace('.png', '.zip');
                outputFilename = outputFilename.replace('.png', '.zip');
            }
            // Cleanup intermediate PDF
            try { fs.unlinkSync(tempPdfPath); } catch (e) { }

        } else {
            throw new Error("Unsupported conversion type");
        }

        const duration = Date.now() - startTime;
        console.log(`Conversion took ${duration} ms`);

        res.download(outputPath, outputFilename, (err) => {
            if (err) console.error("Download Error", err);
            // Cleanup
            try {
                fs.unlinkSync(inputPath);
                setTimeout(() => { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); }, 10000);
            } catch (e) { console.error("Cleanup Error", e); }
        });

    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({ error: 'Conversion failed', details: error.message });
        // cleanup
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (e) { }
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
