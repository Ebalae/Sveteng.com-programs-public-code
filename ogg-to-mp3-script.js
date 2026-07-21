// ===== OGG TO MP3 CONVERTER SCRIPT =====

document.addEventListener('DOMContentLoaded', function() {
    // ===== DOM Elements =====
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileList = document.getElementById('fileList');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const resultActions = document.getElementById('resultActions');

    const bitrateSlider = document.getElementById('bitrateSlider');
    const bitrateValue = document.getElementById('bitrateValue');
    const variableBitrate = document.getElementById('variableBitrate');
    const normalizeAudio = document.getElementById('normalizeAudio');

    const totalFiles = document.getElementById('totalFiles');
    const totalSizeEl = document.getElementById('totalSize');
    const convertedCount = document.getElementById('convertedCount');
    const avgBitrate = document.getElementById('avgBitrate');

    // ===== State =====
    let files = [];
    let isConverting = false;

    // ===== Audio Context =====
    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    // ===== Utilities =====
    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    function getFileNameWithoutExtension(filename) {
        return filename.replace(/\.[^.]+$/, '');
    }

    // ===== Handle Files =====
    function handleFiles(fileList) {
        const validFiles = Array.from(fileList).filter(file => {
            const ext = getFileExtension(file.name);
            return ext === 'ogg' || file.type === 'audio/ogg';
        });

        if (validFiles.length === 0) {
            alert('Please select OGG audio files.');
            return;
        }

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                files.push({
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result,
                    convertedData: null,
                    convertedSize: null,
                    status: 'ready',
                    duration: 0,
                    bitrate: parseInt(bitrateSlider.value)
                });
                updateUI();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // ===== Drag & Drop =====
    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });

        uploadArea.addEventListener('click', function(e) {
            if (e.target === uploadBtn || e.target.closest('.upload-btn')) return;
            if (fileInput) fileInput.click();
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (fileInput) fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
            this.value = '';
        });
    }

    // ===== Normalize Audio =====
    function normalizeAudioBuffer(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        
        const newBuffer = new AudioBuffer({
            numberOfChannels: numberOfChannels,
            length: length,
            sampleRate: sampleRate
        });

        let peak = 0;
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const data = audioBuffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > peak) peak = abs;
            }
        }

        const target = 0.707;
        const gain = peak > 0 ? target / peak : 1;

        for (let channel = 0; channel < numberOfChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i] * gain;
            }
        }

        return newBuffer;
    }

    // ===== Encode to MP3 using LameJS =====
    function encodeToMP3(audioBuffer, bitrate, useVBR) {
        const sampleRate = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        // Get PCM data
        let pcmData;
        if (channels === 1) {
            pcmData = new Int16Array(length);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(channelData[i] * 32767)));
            }
        } else {
            // Interleave stereo
            pcmData = new Int16Array(length * 2);
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            for (let i = 0; i < length; i++) {
                pcmData[i * 2] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
                pcmData[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
            }
        }

        // Create MP3 encoder
        const encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);

        // Encode
        const mp3Data = [];
        const samplesPerFrame = 1152;
        const bytesPerSample = channels === 1 ? 1 : 2;

        let remaining = pcmData.length;
        for (let i = 0; i < pcmData.length; i += samplesPerFrame * bytesPerSample) {
            const chunkSize = Math.min(samplesPerFrame * bytesPerSample, remaining);
            const chunk = pcmData.subarray(i, i + chunkSize);
            let mp3buf;
            
            if (channels === 1) {
                mp3buf = encoder.encodeBuffer(chunk);
            } else {
                const leftChunk = new Int16Array(chunkSize / 2);
                const rightChunk = new Int16Array(chunkSize / 2);
                for (let j = 0; j < chunkSize / 2; j++) {
                    leftChunk[j] = chunk[j * 2];
                    rightChunk[j] = chunk[j * 2 + 1];
                }
                mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
            }
            
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
            remaining -= chunkSize;
        }

        // Flush encoder
        const mp3buf = encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        // Combine all chunks
        const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of mp3Data) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }

    // ===== Convert Audio =====
    async function convertAudio(fileObj) {
        try {
            fileObj.status = 'processing';
            updateUI();

            const audioCtx = getAudioContext();
            const audioBuffer = await audioCtx.decodeAudioData(fileObj.data.slice(0));

            fileObj.duration = audioBuffer.duration;

            // Normalize if enabled
            let bufferToEncode = audioBuffer;
            if (normalizeAudio && normalizeAudio.checked) {
                bufferToEncode = normalizeAudioBuffer(bufferToEncode);
            }

            // Convert to MP3 using lamejs
            const mp3Data = encodeToMP3(bufferToEncode, parseInt(bitrateSlider.value), variableBitrate.checked);

            fileObj.convertedData = mp3Data;
            fileObj.convertedSize = mp3Data.byteLength;
            fileObj.status = 'converted';
            fileObj.bitrate = parseInt(bitrateSlider.value);

            updateUI();
        } catch (error) {
            console.error('Conversion error:', error);
            fileObj.status = 'error';
            updateUI();
            alert('Conversion failed for ' + fileObj.name + '. Please try again or use a different browser.');
        }
    }

    // ===== Convert All =====
    async function convertAll() {
        if (isConverting) return;
        if (files.length === 0) {
            alert('No OGG files to convert.');
            return;
        }

        isConverting = true;
        if (convertAllBtn) {
            convertAllBtn.disabled = true;
            convertAllBtn.textContent = 'Converting...';
        }

        const pendingFiles = files.filter(f => f.status !== 'converted');
        
        for (const file of pendingFiles) {
            await convertAudio(file);
        }

        isConverting = false;
        if (convertAllBtn) {
            convertAllBtn.disabled = false;
            convertAllBtn.textContent = 'Convert all files';
        }
        updateStats();
    }

    // ===== Update UI =====
    function updateUI() {
        renderFiles();
        updateStats();
        if (resultActions) {
            resultActions.style.display = files.length > 0 ? 'flex' : 'none';
        }
    }

    function renderFiles() {
        if (!fileList) return;

        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="12" x2="16" y2="12"/>
                            <line x1="12" y1="16" x2="16" y2="16"/>
                            <line x1="8" y1="12" x2="8.01" y2="12"/>
                            <line x1="8" y1="16" x2="8.01" y2="16"/>
                        </svg>
                    </div>
                    <p>Upload OGG files to start conversion</p>
                </div>
            `;
            return;
        }

        fileList.innerHTML = '';
        files.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';

            const icon = document.createElement('div');
            icon.className = 'file-icon';
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <path d="M8 13l4 4 4-4"/>
                    <path d="M12 17V9"/>
                </svg>
            `;

            const info = document.createElement('div');
            info.className = 'info';

            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = file.name;

            const size = document.createElement('div');
            size.className = 'size';
            size.textContent = `Size: ${formatSize(file.size)}`;
            if (file.duration > 0) {
                size.textContent += ` • ${Math.round(file.duration)}s`;
            }
            if (file.convertedSize) {
                size.textContent += ` → MP3: ${formatSize(file.convertedSize)}`;
            }

            const status = document.createElement('div');
            status.className = `status ${file.status}`;
            if (file.status === 'ready') status.textContent = 'Ready to convert';
            else if (file.status === 'processing') status.textContent = 'Converting...';
            else if (file.status === 'converted') status.textContent = '✓ Converted!';
            else if (file.status === 'error') status.textContent = '✗ Error';

            info.appendChild(name);
            info.appendChild(size);
            info.appendChild(status);

            const actions = document.createElement('div');
            actions.className = 'actions';

            if (file.status === 'converted') {
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'download-btn';
                downloadBtn.textContent = 'Download';
                downloadBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    downloadFile(file);
                });
                actions.appendChild(downloadBtn);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                files.splice(index, 1);
                updateUI();
            });
            actions.appendChild(removeBtn);

            div.appendChild(icon);
            div.appendChild(info);
            div.appendChild(actions);
            fileList.appendChild(div);
        });
    }

    function updateStats() {
        if (totalFiles) totalFiles.textContent = files.length;

        let totalSizeBytes = 0;
        let convertedCountNum = 0;
        let totalBitrate = 0;

        files.forEach(file => {
            totalSizeBytes += file.size;
            if (file.status === 'converted') {
                convertedCountNum++;
                totalBitrate += file.bitrate || 192;
            }
        });

        if (totalSizeEl) totalSizeEl.textContent = formatSize(totalSizeBytes);
        if (convertedCount) convertedCount.textContent = convertedCountNum;
        
        if (avgBitrate) {
            const avg = convertedCountNum > 0 ? Math.round(totalBitrate / convertedCountNum) : parseInt(bitrateSlider.value);
            avgBitrate.textContent = avg + ' kbps';
        }
    }

    // ===== Download =====
    function downloadFile(fileObj) {
        if (!fileObj.convertedData) return;
        
        const blob = new Blob([fileObj.convertedData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = getFileNameWithoutExtension(fileObj.name) + '.mp3';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ===== Download All =====
    function downloadAll() {
        const convertedFiles = files.filter(f => f.status === 'converted');
        if (convertedFiles.length === 0) {
            alert('No converted files to download.');
            return;
        }

        convertedFiles.forEach((file, index) => {
            setTimeout(() => {
                downloadFile(file);
            }, index * 500);
        });
    }

    // ===== Clear All =====
    function clearAll() {
        if (files.length === 0) return;
        if (confirm('Remove all files?')) {
            files = [];
            updateUI();
        }
    }

    // ===== Event Handlers =====
    if (bitrateSlider && bitrateValue) {
        bitrateSlider.addEventListener('input', function() {
            bitrateValue.textContent = this.value + ' kbps';
        });
    }

    if (convertAllBtn) {
        convertAllBtn.addEventListener('click', convertAll);
    }
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAll);
    }
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAll);
    }

    // ===== Init =====
    updateUI();
});