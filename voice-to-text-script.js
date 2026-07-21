// ===== VOICE TO TEXT CONVERTER SCRIPT =====

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // ===== DOM Elements =====
    const languageSelect = document.getElementById('languageSelect');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const statusText = document.getElementById('statusText');
    const statusDot = document.querySelector('.status-dot');
    const recordingTimer = document.getElementById('recordingTimer');
    const textOutput = document.getElementById('textOutput');
    const copyTextBtn = document.getElementById('copyTextBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const textStatus = document.getElementById('textStatus');
    
    const wordCount = document.getElementById('wordCount');
    const charCount = document.getElementById('charCount');
    const sentenceCount = document.getElementById('sentenceCount');
    const readingTime = document.getElementById('readingTime');

    // ===== State =====
    let recognition = null;
    let isRecording = false;
    let isRestarting = false;
    let manualStop = false;
    let isStarting = false;
    let timerInterval = null;
    let seconds = 0;
    let fullTextRaw = ''; // Храним сырой текст без пунктуации
    let fullText = '';    // Храним текст с пунктуацией
    let restartAttempts = 0;
    const MAX_RESTART_ATTEMPTS = 5;
    const MAX_WORDS = 5000; // Ограничение для защиты от переполнения

    // ============================================
    // ===== PUNCTUATION PROCESSOR =====
    // ============================================
    
    function addPunctuation(text, lang) {
        if (!text || !text.trim()) return text;

        const isRussian = lang.startsWith('ru');
        let words = text.trim().split(/\s+/);
        if (words.length === 0) return text;
        
        let result = [];
        let sentenceWords = [];
        let isQuestion = false;
        
        // Списки слов
        const commaWords = isRussian ? 
            ['но', 'однако', 'хотя', 'несмотря', 'тем не менее', 'следовательно', 'поэтому', 'таким образом', 'соответственно', 'между тем', 'кроме того', 'более того', 'наконец', 'например', 'в частности', 'фактически', 'действительно', 'конечно', 'кстати', 'во-первых', 'во-вторых', 'в-третьих', 'с одной стороны', 'с другой стороны', 'потому что', 'так как', 'поскольку', 'если'] :
            ['but', 'however', 'although', 'though', 'while', 'whereas', 'despite', 'nevertheless', 'nonetheless', 'consequently', 'therefore', 'thus', 'hence', 'accordingly', 'meanwhile', 'furthermore', 'moreover', 'likewise', 'similarly', 'finally', 'ultimately', 'for example', 'for instance', 'in fact', 'indeed', 'of course', 'in addition', 'on the other hand'];
        
        const questionWords = isRussian ?
            ['что', 'кто', 'когда', 'где', 'почему', 'зачем', 'откуда', 'куда', 'как', 'сколько', 'какой', 'какая', 'какое', 'какие', 'чей', 'чья', 'чье', 'чьи', 'ли', 'разве', 'неужели'] :
            ['what', 'when', 'where', 'why', 'who', 'whom', 'whose', 'which', 'how', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must'];
        
        const abbreviations = isRussian ?
            ['г', 'гг', 'др', 'проф', 'доц', 'акад', 'канд', 'д-р', 'чл-кор', 'зав', 'вед', 'нач', 'рук', 'дир', 'ген', 'гл', 'ст', 'ул', 'пр', 'пл', 'пер', 'б-р', 'д', 'кв', 'стр', 'рис', 'табл', 'с', 'см', 'т', 'тт', 'итд', 'итп', 'тыс', 'млн', 'млрд', 'коп', 'руб', 'дол', 'евро'] :
            ['mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'hon', 'sen', 'rep', 'gov', 'lt', 'col', 'gen', 'sgt', 'cpl', 'pvt', 'etc', 'vs', 'inc', 'co', 'corp', 'ltd', 'llc', 'assoc', 'univ', 'dept', 'div', 'ave', 'st', 'blvd', 'rd', 'ln', 'ct', 'pl', 'sq', 'apt', 'bldg', 'fl', 'ste', 'ph', 'fax', 'tel', 'email', 'www', 'http', 'https'];

        function isAbbreviation(word) {
            const clean = word.toLowerCase().replace(/[^a-zа-я]/g, '');
            return abbreviations.some(abbr => clean === abbr);
        }

        function isCommaWord(word) {
            const clean = word.toLowerCase().replace(/[^a-zа-я]/g, '');
            return commaWords.some(cw => clean === cw);
        }

        function isQuestionWord(word) {
            const clean = word.toLowerCase().replace(/[^a-zа-я]/g, '');
            return questionWords.some(qw => clean === qw);
        }

        function isNumber(word) {
            return /^\d+$/.test(word) || /^\d+[.,]\d+$/.test(word);
        }

        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            let nextWord = i + 1 < words.length ? words[i + 1] : '';
            
            const isAbbr = isAbbreviation(word);
            const isNum = isNumber(word);
            
            // Проверка на вопрос (в начале предложения)
            if (isQuestionWord(word) && sentenceWords.length === 0) {
                isQuestion = true;
            }
            
            sentenceWords.push(word);
            
            // Запятая перед союзным словом (только если не число)
            if (isCommaWord(word) && sentenceWords.length > 2 && !isNum) {
                if (result.length > 0) {
                    let lastResult = result[result.length - 1];
                    if (!lastResult.endsWith(',') && !lastResult.endsWith('.') && !lastResult.endsWith('!') && !lastResult.endsWith('?')) {
                        result[result.length - 1] = lastResult + ',';
                    }
                }
            }
            
            // Определяем конец предложения
            let shouldEnd = false;
            
            // 1. Слово уже заканчивается на . ! ? (и не число)
            if (word.match(/[.!?]$/) && !isNum) {
                shouldEnd = true;
                if (word.endsWith('?')) isQuestion = true;
            }
            
            // 2. Следующее слово с заглавной буквы (и не число)
            if (nextWord && nextWord.length > 0 && 
                nextWord[0] === nextWord[0].toUpperCase() && 
                nextWord[0] !== nextWord[0].toLowerCase() &&
                !isAbbr && !isNumber(nextWord)) {
                if (!isRussian && sentenceWords.length >= 3) {
                    shouldEnd = true;
                } else if (isRussian && sentenceWords.length >= 4) {
                    shouldEnd = true;
                }
            }
            
            // 3. Длинное предложение
            const maxWords = isRussian ? 15 : 20;
            if (sentenceWords.length >= maxWords) {
                shouldEnd = true;
            }
            
            // 4. Для английского: местоимения в следующем слове
            if (!isRussian && nextWord && ['I', 'You', 'He', 'She', 'We', 'They'].includes(nextWord)) {
                if (sentenceWords.length >= 3) {
                    shouldEnd = true;
                }
            }
            
            // 5. Для английского: глаголы в начале следующего предложения
            if (!isRussian && nextWord && ['Is', 'Are', 'Was', 'Were', 'Do', 'Does', 'Did', 'Have', 'Has', 'Had'].includes(nextWord)) {
                if (sentenceWords.length >= 3) {
                    shouldEnd = true;
                }
            }
            
            if (shouldEnd && sentenceWords.length > 0) {
                let sentence = sentenceWords.join(' ');
                sentence = sentence.replace(/\.\.+/g, '.');
                
                if (!sentence.match(/[.!?]$/)) {
                    if (isQuestion) {
                        sentence += '?';
                    } else {
                        sentence += '.';
                    }
                }
                
                result.push(sentence);
                sentenceWords = [];
                isQuestion = false;
            }
        }
        
        // Добавляем остаток
        if (sentenceWords.length > 0) {
            let sentence = sentenceWords.join(' ');
            sentence = sentence.replace(/\.\.+/g, '.');
            if (!sentence.match(/[.!?]$/)) {
                const hasQuestion = sentenceWords.some(w => isQuestionWord(w));
                sentence += hasQuestion ? '?' : '.';
            }
            result.push(sentence);
        }
        
        let finalText = result.join(' ');
        
        // Чистка
        finalText = finalText
            .replace(/\s+/g, ' ')
            .replace(/\s\./g, '.')
            .replace(/\s,/g, ',')
            .replace(/\s\?/g, '?')
            .replace(/\s\!/g, '!')
            .replace(/\.\.+/g, '.')
            .replace(/\?\./g, '?')
            .replace(/\.\?/g, '?')
            .replace(/,\s*\./g, '.')
            .trim();

        // Заглавные буквы
        finalText = finalText.replace(/(^|\.\s+|\!\s+|\?\s+)([a-zа-яё])/g, function(match, p1, p2) {
            return p1 + p2.toUpperCase();
        });

        return finalText;
    }

    // ============================================
    // ===== ESCAPE HTML =====
    // ============================================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================
    // ===== SPEECH RECOGNITION =====
    // ============================================
    function initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
            return null;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageSelect.value;

        recognition.onstart = function() {
            isRecording = true;
            isRestarting = false;
            manualStop = false;
            isStarting = false;
            restartAttempts = 0;
            updateRecordingUI(true);
            statusText.textContent = 'Listening... Speak now';
            statusDot.className = 'status-dot recording';
        };

        recognition.onend = function() {
            // Если была ручная остановка — не перезапускаем
            if (manualStop) {
                isRecording = false;
                updateRecordingUI(false);
                statusText.textContent = 'Ready';
                statusDot.className = 'status-dot idle';
                if (fullTextRaw.trim()) {
                    const lang = languageSelect.value;
                    fullText = addPunctuation(fullTextRaw, lang);
                    updateTextOutput(fullText);
                    updateStats(fullText);
                }
                return;
            }

            if (isRecording && !isRestarting && !manualStop) {
                isRestarting = true;
                restartAttempts++;
                
                if (restartAttempts <= MAX_RESTART_ATTEMPTS) {
                    statusText.textContent = 'Reconnecting... (' + restartAttempts + '/' + MAX_RESTART_ATTEMPTS + ')';
                    statusDot.className = 'status-dot processing';
                    
                    setTimeout(() => {
                        if (!manualStop && isRecording) {
                            try {
                                isStarting = true;
                                recognition.start();
                                isStarting = false;
                            } catch (e) {
                                isStarting = false;
                                if (restartAttempts < MAX_RESTART_ATTEMPTS && !manualStop) {
                                    setTimeout(() => {
                                        if (!manualStop && isRecording) {
                                            try {
                                                isStarting = true;
                                                recognition.start();
                                                isStarting = false;
                                            } catch (err) {
                                                isStarting = false;
                                                console.error('Failed to restart recognition:', err);
                                                isRecording = false;
                                                updateRecordingUI(false);
                                                statusText.textContent = 'Error: Could not restart';
                                                statusDot.className = 'status-dot error';
                                            }
                                        }
                                    }, 500);
                                } else {
                                    isRecording = false;
                                    updateRecordingUI(false);
                                    statusText.textContent = 'Stopped after ' + MAX_RESTART_ATTEMPTS + ' attempts';
                                    statusDot.className = 'status-dot error';
                                }
                            }
                        }
                    }, 300);
                } else {
                    isRecording = false;
                    updateRecordingUI(false);
                    statusText.textContent = 'Stopped after max attempts';
                    statusDot.className = 'status-dot error';
                }
            } else if (!isRecording) {
                updateRecordingUI(false);
                statusText.textContent = 'Ready';
                statusDot.className = 'status-dot idle';
                
                if (fullTextRaw.trim()) {
                    const lang = languageSelect.value;
                    fullText = addPunctuation(fullTextRaw, lang);
                    updateTextOutput(fullText);
                    updateStats(fullText);
                }
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            
            if (event.error === 'not-allowed') {
                statusText.textContent = 'Microphone access denied. Please allow microphone access.';
                statusDot.className = 'status-dot error';
                isRecording = false;
                manualStop = true;
                updateRecordingUI(false);
                return;
            }
            
            if (event.error === 'no-speech') {
                statusText.textContent = 'No speech detected. Please speak into the microphone.';
                return;
            }
            
            if (event.error === 'audio-capture') {
                statusText.textContent = 'No microphone found. Please connect a microphone.';
                statusDot.className = 'status-dot error';
                isRecording = false;
                manualStop = true;
                updateRecordingUI(false);
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                return;
            }
            
            if (event.error === 'aborted') {
                // Обрабатываем как корректную остановку
                if (!manualStop) {
                    manualStop = true;
                }
                isRecording = false;
                updateRecordingUI(false);
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                return;
            }
            
            statusText.textContent = 'Error: ' + event.error;
            statusDot.className = 'status-dot error';
            
            if (event.error !== 'no-speech') {
                isRecording = false;
                manualStop = true;
                updateRecordingUI(false);
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }
        };

        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                // Убираем лишний пробел в начале
                if (fullTextRaw === '') {
                    fullTextRaw = finalTranscript;
                } else {
                    fullTextRaw += ' ' + finalTranscript;
                }
                fullTextRaw = fullTextRaw.trim();
                
                // Ограничение по длине
                const words = fullTextRaw.split(/\s+/);
                if (words.length > MAX_WORDS) {
                    fullTextRaw = words.slice(-MAX_WORDS).join(' ');
                }
                
                const lang = languageSelect.value;
                fullText = addPunctuation(fullTextRaw, lang);
                updateTextOutput(fullText);
                updateStats(fullText);
            }
            
            if (interimTranscript) {
                const lang = languageSelect.value;
                const displayText = fullTextRaw + ' ' + interimTranscript;
                const punctuatedInterim = addPunctuation(displayText, lang);
                updateTextOutput(punctuatedInterim, true);
            }
            
            restartAttempts = 0;
        };

        return recognition;
    }

    // ============================================
    // ===== UI UPDATES =====
    // ============================================
    function updateRecordingUI(recording) {
        if (recording) {
            startRecordBtn.style.display = 'none';
            stopRecordBtn.style.display = 'flex';
            recordingTimer.style.display = 'block';
            recordingTimer.classList.add('active');
            startRecordBtn.disabled = true;
        } else {
            startRecordBtn.style.display = 'flex';
            stopRecordBtn.style.display = 'none';
            recordingTimer.style.display = 'none';
            recordingTimer.classList.remove('active');
            startRecordBtn.disabled = false;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                seconds = 0;
                recordingTimer.textContent = '00:00';
            }
        }
    }

    function startRecording() {
        if (isStarting) return;
        
        if (!recognition) {
            recognition = initRecognition();
            if (!recognition) return;
        }

        if (isRecording) return;

        // Сбрасываем флаги
        manualStop = false;
        isRestarting = false;
        restartAttempts = 0;

        recognition.lang = languageSelect.value;
        recognition.continuous = true;
        recognition.interimResults = true;

        try {
            isStarting = true;
            recognition.start();
            isStarting = false;
            isRecording = true;
            
            seconds = 0;
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                seconds++;
                const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
                const secs = String(seconds % 60).padStart(2, '0');
                recordingTimer.textContent = mins + ':' + secs;
            }, 1000);
            
            statusText.textContent = 'Listening... Speak now';
            statusDot.className = 'status-dot recording';
            startRecordBtn.disabled = true;
        } catch (error) {
            isStarting = false;
            console.error('Error starting recording:', error);
            statusText.textContent = 'Error starting recording: ' + error.message;
            statusDot.className = 'status-dot error';
            isRecording = false;
            updateRecordingUI(false);
        }
    }

    function stopRecording() {
        if (recognition && isRecording) {
            manualStop = true;
            isRecording = false;
            isRestarting = false;
            isStarting = false;
            
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            
            try {
                recognition.stop();
            } catch (e) {
                // Игнорируем ошибки остановки
            }
            
            updateRecordingUI(false);
            statusText.textContent = 'Processing...';
            statusDot.className = 'status-dot processing';
            
            setTimeout(() => {
                statusText.textContent = 'Ready';
                statusDot.className = 'status-dot idle';
                if (fullTextRaw.trim()) {
                    const lang = languageSelect.value;
                    fullText = addPunctuation(fullTextRaw, lang);
                    updateTextOutput(fullText);
                    updateStats(fullText);
                }
            }, 500);
        }
    }

    function updateTextOutput(text, isInterim = false) {
        if (!text || !text.trim()) {
            textOutput.innerHTML = `
                <div class="placeholder-text">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    <p>Speak into your microphone</p>
                    <span>The transcription will appear here in real-time</span>
                </div>
            `;
            return;
        }

        // Безопасное экранирование HTML
        textOutput.innerHTML = escapeHtml(text);
        
        if (!isInterim) {
            textStatus.textContent = 'Updated';
            textStatus.className = 'text-status success';
            setTimeout(() => {
                textStatus.className = 'text-status';
            }, 2000);
        }
    }

    function updateStats(text) {
        if (!text || !text.trim()) {
            wordCount.textContent = '0';
            charCount.textContent = '0';
            sentenceCount.textContent = '0';
            readingTime.textContent = '< 1 min';
            return;
        }

        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const chars = text.replace(/\s/g, '').length;
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        
        wordCount.textContent = words.length;
        charCount.textContent = chars;
        sentenceCount.textContent = sentences.length || Math.ceil(words.length / 15);
        
        // Показываем "< 1 min" для коротких текстов
        const minutes = Math.ceil(words.length / 200);
        readingTime.textContent = minutes < 1 ? '< 1 min' : minutes + ' min';
    }

    // ============================================
    // ===== COPY, DOWNLOAD, CLEAR =====
    // ============================================
    function copyText() {
        if (!fullText.trim()) {
            alert('No text to copy. Please transcribe some audio first.');
            return;
        }
        
        navigator.clipboard.writeText(fullText).then(() => {
            textStatus.textContent = 'Copied!';
            textStatus.className = 'text-status success';
            copyTextBtn.classList.add('copied');
            setTimeout(() => {
                textStatus.className = 'text-status';
                copyTextBtn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            // Fallback: выделяем и копируем через execCommand
            const range = document.createRange();
            range.selectNode(textOutput);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            try {
                document.execCommand('copy');
                textStatus.textContent = 'Copied!';
                textStatus.className = 'text-status success';
                setTimeout(() => {
                    textStatus.className = 'text-status';
                }, 2000);
            } catch (e) {
                alert('Could not copy text. Please select and copy manually.');
            }
            window.getSelection().removeAllRanges();
        });
    }

    function downloadTxt() {
        if (!fullText.trim()) {
            alert('No text to download. Please transcribe some audio first.');
            return;
        }
        
        const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'transcription_' + new Date().toISOString().slice(0, 10) + '.txt';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        textStatus.textContent = 'Downloaded!';
        textStatus.className = 'text-status success';
        setTimeout(() => {
            textStatus.className = 'text-status';
        }, 2000);
    }

    function clearText() {
        if (!fullTextRaw.trim()) return;
        if (confirm('Clear all transcribed text?')) {
            fullTextRaw = '';
            fullText = '';
            updateTextOutput('');
            updateStats('');
            textStatus.textContent = 'Cleared';
            setTimeout(() => {
                textStatus.className = 'text-status';
            }, 1000);
        }
    }

    // ============================================
    // ===== EVENT LISTENERS =====
    // ============================================
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    copyTextBtn.addEventListener('click', copyText);
    downloadTxtBtn.addEventListener('click', downloadTxt);
    clearTextBtn.addEventListener('click', clearText);
    
    languageSelect.addEventListener('change', function() {
        if (recognition) {
            recognition.lang = this.value;
        }
        statusText.textContent = 'Language changed to ' + this.options[this.selectedIndex].text;
        statusDot.className = 'status-dot idle';
        if (fullTextRaw.trim()) {
            const lang = this.value;
            fullText = addPunctuation(fullTextRaw, lang);
            updateTextOutput(fullText);
            updateStats(fullText);
        }
    });

    // ===== Keyboard Shortcuts =====
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter' && isRecording) {
            e.preventDefault();
            stopRecording();
        }
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            downloadTxt();
        }
    });

    // ===== Init =====
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        statusText.textContent = 'Speech recognition not supported in this browser';
        statusDot.className = 'status-dot error';
        startRecordBtn.disabled = true;
        startRecordBtn.title = 'Speech recognition not supported';
    } else {
        initRecognition();
    }
    
    updateTextOutput('');
    updateStats('');
});

// ===== MOBILE LANGUAGE SELECT =====
// Создаем клон селекта для тулбара
function createMobileLanguageSelect() {
    const toolbar = document.querySelector('.text-toolbar');
    if (!toolbar) return;
    
    // Проверяем, есть ли уже мобильный селект
    if (toolbar.querySelector('.language-select-mobile')) return;
    
    const originalSelect = document.getElementById('languageSelect');
    if (!originalSelect) return;
    
    // Создаем копию селекта
    const mobileSelect = document.createElement('select');
    mobileSelect.className = 'language-select-mobile';
    mobileSelect.setAttribute('aria-label', 'Select language');
    
    // Копируем опции
    for (let option of originalSelect.options) {
        const newOption = document.createElement('option');
        newOption.value = option.value;
        newOption.textContent = option.textContent;
        if (option.selected) newOption.selected = true;
        mobileSelect.appendChild(newOption);
    }
    
    // Синхронизируем с оригинальным селектом
    mobileSelect.addEventListener('change', function() {
        originalSelect.value = this.value;
        originalSelect.dispatchEvent(new Event('change'));
    });
    
    originalSelect.addEventListener('change', function() {
        mobileSelect.value = this.value;
    });
    
    // Добавляем в тулбар перед text-status
    const textStatus = toolbar.querySelector('.text-status');
    if (textStatus) {
        toolbar.insertBefore(mobileSelect, textStatus);
    } else {
        toolbar.appendChild(mobileSelect);
    }
}

// Создаем мобильный селект при загрузке
if (window.innerWidth <= 1024) {
    createMobileLanguageSelect();
}

// Создаем при изменении размера окна
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (window.innerWidth <= 1024) {
            createMobileLanguageSelect();
        } else {
            // Удаляем мобильный селект на десктопе
            const mobileSelect = document.querySelector('.language-select-mobile');
            if (mobileSelect) mobileSelect.remove();
        }
    }, 250);
});

