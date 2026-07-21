// ===== BASE64 LOGIC =====
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const mode = document.getElementById('mode');
    const charset = document.getElementById('charset');
    const inputText = document.getElementById('inputText');
    const convertBtn = document.getElementById('convertBtn');
    const swapBtn = document.getElementById('swapBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtnBase64 = document.getElementById('clearBtnBase64');
    const downloadBtn = document.getElementById('downloadBtn');
    const fileUpload = document.getElementById('fileUpload');
    const resultDisplay = document.getElementById('resultDisplay');
    const infoMode = document.getElementById('infoMode');
    const infoInputLength = document.getElementById('infoInputLength');
    const infoResultLength = document.getElementById('infoResultLength');
    const infoStatus = document.getElementById('infoStatus');

    let currentResult = '';
    let currentMode = 'encode';

    // ===== Convert =====
    function convert() {
        console.log('convert() called'); // Для отладки
        const text = inputText.value;
        const isEncode = mode.value === 'encode';
        const modeLabel = isEncode ? 'Encode' : 'Decode';
        const selectedCharset = charset.value;
        
        infoMode.textContent = modeLabel;
        currentMode = mode.value;

        if (!text || text.trim() === '') {
            resultDisplay.innerHTML = `<span style="color: var(--text-muted);">Enter text and click "Convert"</span>`;
            infoInputLength.textContent = '0';
            infoResultLength.textContent = '0';
            infoStatus.textContent = 'Empty input';
            infoStatus.className = 'info-value';
            copyBtn.disabled = true;
            downloadBtn.disabled = true;
            currentResult = '';
            return;
        }

        try {
            let result;
            if (isEncode) {
                if (selectedCharset === 'utf8' || selectedCharset === 'ascii') {
                    result = btoa(unescape(encodeURIComponent(text)));
                } else {
                    const encoder = new TextEncoder();
                    const bytes = encoder.encode(text);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    result = btoa(binary);
                }
            } else {
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (!base64Regex.test(text)) {
                    throw new Error('Invalid Base64 characters');
                }
                const decoded = atob(text);
                if (selectedCharset === 'utf8' || selectedCharset === 'ascii') {
                    result = decodeURIComponent(escape(decoded));
                } else {
                    const bytes = new Uint8Array(decoded.length);
                    for (let i = 0; i < decoded.length; i++) {
                        bytes[i] = decoded.charCodeAt(i);
                    }
                    const decoder = new TextDecoder(selectedCharset);
                    result = decoder.decode(bytes);
                }
            }
            
            currentResult = result;
            resultDisplay.innerHTML = `<span class="result-success">${escapeHtml(result)}</span>`;
            infoInputLength.textContent = text.length;
            infoResultLength.textContent = result.length;
            infoStatus.textContent = 'Success ✓';
            infoStatus.className = 'info-value status-success';
            copyBtn.disabled = false;
            downloadBtn.disabled = false;
            
        } catch (error) {
            let errorMsg = 'Invalid input';
            if (!isEncode) {
                errorMsg = 'Invalid Base64 string. Please check your input and character set.';
            } else {
                errorMsg = 'Encoding error: ' + error.message;
            }
            resultDisplay.innerHTML = `<span class="result-error">${errorMsg}</span>`;
            infoInputLength.textContent = text.length;
            infoResultLength.textContent = '—';
            infoStatus.textContent = 'Error';
            infoStatus.className = 'info-value status-error';
            copyBtn.disabled = true;
            downloadBtn.disabled = true;
            currentResult = '';
        }
    }

    // ===== Escape HTML =====
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== Copy to Clipboard =====
    function copyResult() {
        if (!currentResult) return;
        navigator.clipboard.writeText(currentResult).then(() => {
            copyBtn.textContent = 'Copied! ✓';
            setTimeout(() => {
                copyBtn.textContent = 'Copy Result';
            }, 2000);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = currentResult;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            copyBtn.textContent = 'Copied! ✓';
            setTimeout(() => {
                copyBtn.textContent = 'Copy Result';
            }, 2000);
        });
    }

    // ===== Download Result =====
    function downloadResult() {
        if (!currentResult) return;
        const isEncode = mode.value === 'encode';
        const ext = '.txt';
        const name = isEncode ? 'base64-encoded' : 'base64-decoded';
        const blob = new Blob([currentResult], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== File Upload =====
    function handleFile(file) {
        console.log('handleFile called', file.name); // Для отладки
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                if (mode.value === 'encode') {
                    const content = e.target.result;
                    inputText.value = content;
                    
                    const bytes = new Uint8Array(content.length);
                    for (let i = 0; i < content.length; i++) {
                        bytes[i] = content.charCodeAt(i);
                    }
                    let binary = '';
                    const chunkSize = 8192;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
                        for (let j = 0; j < chunk.length; j++) {
                            binary += String.fromCharCode(chunk[j]);
                        }
                    }
                    const encoded = btoa(binary);
                    currentResult = encoded;
                    resultDisplay.innerHTML = `<span class="result-success">${escapeHtml(encoded)}</span>`;
                    infoInputLength.textContent = content.length;
                    infoResultLength.textContent = encoded.length;
                    infoStatus.textContent = 'Success ✓';
                    infoStatus.className = 'info-value status-success';
                    copyBtn.disabled = false;
                    downloadBtn.disabled = false;
                } else {
                    const content = e.target.result;
                    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                    if (!base64Regex.test(content.trim())) {
                        throw new Error('File does not contain valid Base64 data');
                    }
                    const decoded = atob(content);
                    inputText.value = decoded;
                    convert();
                }
            } catch (err) {
                inputText.value = 'Error: ' + err.message;
                convert();
            }
        };
        
        reader.onerror = function() {
            inputText.value = 'Error: Failed to read file';
            convert();
        };
        
        reader.readAsText(file);
    }

    // ===== Swap Mode =====
    function swapMode() {
        const currentMode = mode.value;
        const newMode = currentMode === 'encode' ? 'decode' : 'encode';
        mode.value = newMode;
        updatePlaceholder();
        if (inputText.value && inputText.value.trim() !== '') {
            convert();
        }
    }

    function updatePlaceholder() {
        const isEncode = mode.value === 'encode';
        inputText.placeholder = isEncode 
            ? 'Enter text to encode to Base64...' 
            : 'Enter Base64 string to decode...';
    }

    // ===== Clear All =====
    function clearAll() {
        inputText.value = '';
        fileUpload.value = '';
        const wrapper = document.querySelector('.file-upload-wrapper');
        const label = wrapper?.querySelector('#fileLabel');
        if (label) {
            label.textContent = 'Choose File';
            wrapper?.classList.remove('has-file');
        }
        resultDisplay.innerHTML = `<span style="color: var(--text-muted);">Enter text and click "Convert"</span>`;
        infoInputLength.textContent = '0';
        infoResultLength.textContent = '0';
        infoStatus.textContent = 'Ready';
        infoStatus.className = 'info-value';
        copyBtn.disabled = true;
        downloadBtn.disabled = true;
        currentResult = '';
    }

    // ===== Examples =====
    const examples = {
        'hello': 'Hello World!',
        'base64': 'SGVsbG8gV29ybGQh',
        'emoji': 'Hello 😀 World 🌍',
        'json': JSON.stringify({ name: 'John', age: 30, city: 'New York' }, null, 2),
        'long': 'This is a longer text example that demonstrates how Base64 encoding works with multiple sentences. It handles spaces, punctuation, and special characters! 1234567890 @#$%^&*()'
    };

    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const key = this.dataset.example;
            const value = examples[key];
            if (value !== undefined) {
                const isBase64 = key === 'base64';
                if (isBase64 && mode.value === 'encode') {
                    mode.value = 'decode';
                } else if (!isBase64 && mode.value === 'decode') {
                    mode.value = 'encode';
                }
                updatePlaceholder();
                inputText.value = value;
                convert();
            }
        });
    });

    // ===== Event Listeners =====
    convertBtn.addEventListener('click', function() {
        console.log('Convert button clicked'); // Для отладки
        convert();
    });
    
    copyBtn.addEventListener('click', copyResult);
    downloadBtn.addEventListener('click', downloadResult);
    swapBtn.addEventListener('click', swapMode);
    clearBtnBase64.addEventListener('click', clearAll);

    mode.addEventListener('change', function() {
        updatePlaceholder();
        if (inputText.value && inputText.value.trim() !== '') {
            convert();
        }
    });

    charset.addEventListener('change', function() {
        if (inputText.value && inputText.value.trim() !== '') {
            convert();
        }
    });

    let debounceTimeout;
    inputText.addEventListener('input', function() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (inputText.value && inputText.value.trim() !== '') {
                convert();
            } else {
                resultDisplay.innerHTML = `<span style="color: var(--text-muted);">Enter text and click "Convert"</span>`;
                infoInputLength.textContent = '0';
                infoResultLength.textContent = '0';
                infoStatus.textContent = 'Empty input';
                infoStatus.className = 'info-value';
                copyBtn.disabled = true;
                downloadBtn.disabled = true;
                currentResult = '';
            }
        }, 400);
    });

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            convertBtn.click();
        }
    });

    // ===== Drag and Drop Support =====
    const dropZone = document.querySelector('.calc-form');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--primary)';
            this.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
        });

        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '';
            this.style.boxShadow = '';
        });

        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '';
            this.style.boxShadow = '';
            const files = e.dataTransfer.files;
            if (files && files[0]) {
                if (files[0].size > 100 * 1024 * 1024) {
                    alert('File size exceeds 100MB limit.');
                    return;
                }
                const wrapper = document.querySelector('.file-upload-wrapper');
                const label = wrapper?.querySelector('#fileLabel');
                if (label) {
                    label.textContent = files[0].name.length > 30 
                        ? files[0].name.slice(0, 27) + '...' 
                        : files[0].name;
                    wrapper?.classList.add('has-file');
                }
                handleFile(files[0]);
            }
        });
    }

    // ===== File Upload с обновлением имени =====
    if (fileUpload) {
        fileUpload.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const wrapper = this.closest('.file-upload-wrapper');
                const label = wrapper?.querySelector('#fileLabel');
                
                if (label) {
                    label.textContent = file.name.length > 30 
                        ? file.name.slice(0, 27) + '...' 
                        : file.name;
                    wrapper?.classList.add('has-file');
                }
                
                if (file.size > 100 * 1024 * 1024) {
                    alert('File size exceeds 100MB limit. Please choose a smaller file.');
                    this.value = '';
                    if (label) {
                        label.textContent = 'Choose File';
                        wrapper?.classList.remove('has-file');
                    }
                    return;
                }
                
                handleFile(file);
            } else {
                const wrapper = this.closest('.file-upload-wrapper');
                const label = wrapper?.querySelector('#fileLabel');
                if (label) {
                    label.textContent = 'Choose File';
                    wrapper?.classList.remove('has-file');
                }
            }
        });
    }

    // ===== Init =====
    updatePlaceholder();
    infoMode.textContent = 'Encode';
    infoStatus.textContent = 'Ready';
    infoStatus.className = 'info-value';
});