document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processingState = document.getElementById('processing-state');
    const resultState = document.getElementById('result-state');
    const errorState = document.getElementById('error-state');
    const timeTakenSpan = document.getElementById('time-taken');
    const downloadAgainBtn = document.getElementById('download-again-btn');
    const tryAgainBtn = document.getElementById('try-again-btn');
    const errorMessage = document.getElementById('error-message');

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('dragover');
    }

    function unhighlight(e) {
        dropZone.classList.remove('dragover');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Click to browse
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                uploadFile(file);
            } else {
                showError('Please upload a PDF file');
            }
        }
    }

    async function uploadFile(file) {
        showState('processing');
        const startTime = Date.now();

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Conversion failed');
            }

            // Get filename from header or default
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'converted.docx';
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            const duration = Date.now() - startTime;
            timeTakenSpan.textContent = `${duration}ms`; // server + network time

            // Artificial delay just to let the user see the loader if it's too fast?
            // No, the user wants "within a second", so show it immediately.
            showState('result');

        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    function showState(state) {
        dropZone.classList.add('hidden');
        processingState.classList.add('hidden');
        resultState.classList.add('hidden');
        errorState.classList.add('hidden');

        if (state === 'drop') dropZone.classList.remove('hidden');
        if (state === 'processing') processingState.classList.remove('hidden');
        if (state === 'result') resultState.classList.remove('hidden');
        if (state === 'error') errorState.classList.remove('hidden');
    }

    function showError(msg) {
        errorMessage.textContent = msg || 'Something went wrong';
        showState('error');
    }

    downloadAgainBtn.addEventListener('click', () => {
        showState('drop');
        fileInput.value = '';
    });

    tryAgainBtn.addEventListener('click', () => {
        showState('drop');
        fileInput.value = '';
    });
});
