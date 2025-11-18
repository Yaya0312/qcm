document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultsScreen = document.getElementById('results-screen');

    const fileInput = document.getElementById('file-input');
    const fileNameSpan = document.getElementById('file-name');
    const resultsFileInput = document.getElementById('results-file-input');
    const resultsFileNameSpan = document.getElementById('results-file-name');
    const errorMessage = document.getElementById('error-message');

    const questionCounter = document.getElementById('question-counter');
    const timerSpan = document.getElementById('timer');
    const bookmarkIcon = document.getElementById('bookmark-icon');
    const questionText = document.getElementById('question-text');
    const questionNote = document.getElementById('question-note');
    const optionsContainer = document.getElementById('options-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const navDropdown = document.getElementById('nav-dropdown');

    const scoreSpan = document.getElementById('score');
    const percentageSpan = document.getElementById('percentage');
    const summaryContainer = document.getElementById('summary-container');
    const showOnlyIncorrectCheckbox = document.getElementById('show-only-incorrect');
    const restartBtn = document.getElementById('restart-btn');
    const exportBtn = document.getElementById('export-btn');

    const analysisSection = document.getElementById('analysis-section');
    const adviceText = document.getElementById('advice-text');
    const tagsChartCanvas = document.getElementById('tags-chart');

    // --- State ---
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let quizResults = {};
    let tagsChart = null;
    let timerInterval = null;
    let remainingTime = 3600; // 60 minutes
    let bookmarkedQuestions = new Set();

    // --- Functions ---

    const resetQuiz = () => {
        questions = [];
        currentQuestionIndex = 0;
        userAnswers = [];
        quizResults = {};
        bookmarkedQuestions.clear();
        
        welcomeScreen.classList.add('active');
        quizScreen.classList.remove('active');
        resultsScreen.classList.remove('active');

        fileInput.value = '';
        resultsFileInput.value = '';
        fileNameSpan.textContent = 'Aucun fichier choisi';
        resultsFileNameSpan.textContent = 'Aucun fichier choisi';
        errorMessage.style.display = 'none';
        summaryContainer.innerHTML = '';
        analysisSection.style.display = 'none';
        showOnlyIncorrectCheckbox.checked = false;

        if (tagsChart) {
            tagsChart.destroy();
            tagsChart = null;
        }
        stopTimer();
        timerSpan.textContent = "60:00";
    };

    const handleQuestionFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedJson = JSON.parse(event.target.result);
                if (!Array.isArray(parsedJson) || parsedJson.length === 0) throw new Error("Le JSON de questions est invalide.");
                questions = parsedJson;
                userAnswers = new Array(questions.length).fill(null);
                startQuiz();
            } catch (error) {
                showError(error.message);
            }
        };
        reader.readAsText(file);
    };
    
    const handleResultsFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resultsFileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedJson = JSON.parse(event.target.result);
                if (!parsedJson.score || !parsedJson.percentage || !parsedJson.results) throw new Error("Fichier de résultats JSON invalide.");
                quizResults = parsedJson;
                displayResults(parsedJson);
            } catch (error) {
                showError(error.message);
            }
        };
        reader.readAsText(file);
    };

    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => { errorMessage.style.display = 'none'; }, 5000);
    };

    const startQuiz = () => {
        welcomeScreen.classList.remove('active');
        resultsScreen.classList.remove('active');
        quizScreen.classList.add('active');
        populateNavDropdown();
        displayQuestion();
        startTimer();
    };

    const startTimer = () => {
        stopTimer(); // Ensure no multiple timers
        remainingTime = 3600;
        timerInterval = setInterval(() => {
            remainingTime--;
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            timerSpan.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            if (remainingTime <= 0) {
                stopTimer();
                alert("Le temps est écoulé ! Le quiz va se terminer.");
                calculateAndShowResults();
            }
        }, 1000);
    };

    const stopTimer = () => {
        clearInterval(timerInterval);
        timerInterval = null;
    };

    const displayQuestion = () => {
        // Save answer of the current question before navigating away
        const existingOptions = optionsContainer.querySelectorAll('input');
        if (existingOptions.length > 0) {
            const selectedOptions = Array.from(existingOptions).filter(i => i.checked).map(input => input.value);
            userAnswers[currentQuestionIndex] = selectedOptions;
        }

        const question = questions[currentQuestionIndex];
        questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
        questionText.textContent = question.question;
        questionNote.textContent = question.note || '';
        optionsContainer.innerHTML = '';
        const isMultipleChoice = question.answers.length > 1;

        for (const [key, value] of Object.entries(question.options)) {
            const optionElement = document.createElement('div');
            optionElement.classList.add('option');
            const inputType = isMultipleChoice ? 'checkbox' : 'radio';
            const input = document.createElement('input');
            input.type = inputType;
            input.name = 'option';
            input.value = key;
            input.id = `option-${key}`;
            // Restore checked state
            if (userAnswers[currentQuestionIndex] && userAnswers[currentQuestionIndex].includes(key)) {
                input.checked = true;
            }
            const label = document.createElement('label');
            label.htmlFor = `option-${key}`;
            label.textContent = value;
            optionElement.appendChild(input);
            optionElement.appendChild(label);
            optionsContainer.appendChild(optionElement);
        }
        
        // Update UI states
        nextBtn.textContent = (currentQuestionIndex === questions.length - 1) ? 'Terminer' : 'Suivant';
        prevBtn.disabled = currentQuestionIndex === 0;
        nextBtn.disabled = false; // Re-enable in case it was disabled
        navDropdown.value = currentQuestionIndex;
        updateBookmarkIcon();
    };

    const populateNavDropdown = () => {
        navDropdown.innerHTML = '';
        questions.forEach((q, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Question ${index + 1}`;
            navDropdown.appendChild(option);
        });
    };

    const updateNavDropdownWithBookmarks = () => {
        for (const option of navDropdown.options) {
            const index = parseInt(option.value, 10);
            if (bookmarkedQuestions.has(index)) {
                option.textContent = `Question ${index + 1} ★`;
            } else {
                option.textContent = `Question ${index + 1}`;
            }
        }
    };
    
    const changeQuestion = (newIndex) => {
        if (newIndex >= 0 && newIndex < questions.length) {
            currentQuestionIndex = newIndex;
            displayQuestion();
        }
    };

    const handleNavigation = (direction) => {
        changeQuestion(currentQuestionIndex + direction);
    };

    const toggleBookmark = () => {
        if (bookmarkedQuestions.has(currentQuestionIndex)) {
            bookmarkedQuestions.delete(currentQuestionIndex);
        } else {
            bookmarkedQuestions.add(currentQuestionIndex);
        }
        updateBookmarkIcon();
        updateNavDropdownWithBookmarks();
    };

    const updateBookmarkIcon = () => {
        if (bookmarkedQuestions.has(currentQuestionIndex)) {
            bookmarkIcon.classList.add('bookmarked');
        } else {
            bookmarkIcon.classList.remove('bookmarked');
        }
    };

    const calculateAndShowResults = () => {
        stopTimer();
        // Save final answer
        const selectedOptions = Array.from(optionsContainer.querySelectorAll('input:checked')).map(input => input.value);
        userAnswers[currentQuestionIndex] = selectedOptions;

        let score = 0;
        const resultsDetails = questions.map((question, index) => {
            const correctAnswers = question.answers.sort();
            const givenAnswers = userAnswers[index] ? userAnswers[index].sort() : [];
            const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(givenAnswers);
            if (isCorrect) score++;
            return {
                question: question.question,
                options: question.options,
                tags: question.tags || [],
                correctAnswers,
                givenAnswers,
                isCorrect
            };
        });
        const percentage = questions.length > 0 ? ((score / questions.length) * 100).toFixed(1) : 0;
        quizResults = {
            date: new Date().toISOString(),
            score: `${score} / ${questions.length}`,
            percentage,
            results: resultsDetails
        };
        displayResults(quizResults);
    };

    const displayResults = (resultsData) => {
        quizScreen.classList.remove('active');
        welcomeScreen.classList.remove('active');
        resultsScreen.classList.add('active');

        scoreSpan.textContent = resultsData.score;
        percentageSpan.textContent = resultsData.percentage;
        summaryContainer.innerHTML = '';

        resultsData.results.forEach((result, index) => {
            const summaryItem = document.createElement('div');
            summaryItem.classList.add('summary-item');
            summaryItem.dataset.correct = result.isCorrect; // For filtering

            const summaryQuestion = document.createElement('p');
            summaryQuestion.innerHTML = `<strong>${index + 1}. ${result.question}</strong> ${result.isCorrect ? '<span style="color: var(--correct-color);">(Correct)</span>' : '<span style="color: var(--incorrect-color);">(Incorrect)</span>'}`;
            summaryItem.appendChild(summaryQuestion);
            for (const [key, value] of Object.entries(result.options)) {
                const optionSummary = document.createElement('span');
                optionSummary.classList.add('summary-option');
                optionSummary.textContent = `${key}. ${value}`;
                const wasCorrect = result.correctAnswers.includes(key);
                const wasSelected = result.givenAnswers.includes(key);
                if (wasCorrect && wasSelected) optionSummary.classList.add('correct', 'selected');
                else if (wasCorrect && !wasSelected) optionSummary.classList.add('correct', 'missed');
                else if (!wasCorrect && wasSelected) optionSummary.classList.add('incorrect', 'selected');
                else optionSummary.classList.add('neutral');
                summaryItem.appendChild(optionSummary);
            }
            summaryContainer.appendChild(summaryItem);
        });

        const tagPerformance = analyzeTags(resultsData.results);
        if (Object.keys(tagPerformance).length > 0) {
            analysisSection.style.display = 'block';
            renderTagChart(tagPerformance);
            generateRevisionAdvice(tagPerformance);
        } else {
            analysisSection.style.display = 'none';
        }
    };

    const analyzeTags = (results) => {
        const tagStats = {};
        results.forEach(result => {
            if (result.tags && result.tags.length > 0) {
                result.tags.forEach(tag => {
                    if (!tagStats[tag]) tagStats[tag] = { correct: 0, total: 0 };
                    tagStats[tag].total++;
                    if (result.isCorrect) tagStats[tag].correct++;
                });
            }
        });
        const tagPercentages = {};
        for (const tag in tagStats) {
            tagPercentages[tag] = (tagStats[tag].correct / tagStats[tag].total) * 100;
        }
        return tagPercentages;
    };

    const renderTagChart = (tagPerformance) => {
        if (tagsChart) tagsChart.destroy();
        const labels = Object.keys(tagPerformance);
        const data = Object.values(tagPerformance);
        tagsChart = new Chart(tagsChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '% de réussite par sujet',
                    data: data,
                    backgroundColor: data.map(p => p < 85 ? 'rgba(255, 99, 132, 0.2)' : 'rgba(75, 192, 192, 0.2)'),
                    borderColor: data.map(p => p < 85 ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)'),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (value) => value + "%" } } },
                plugins: { legend: { display: false } }
            }
        });
    };

    const generateRevisionAdvice = (tagPerformance) => {
        const topicsToRevise = Object.entries(tagPerformance)
            .filter(([, percentage]) => percentage < 85)
            .sort((a, b) => a[1] - b[1])
            .map(([tag]) => tag);
        if (topicsToRevise.length > 0) {
            adviceText.textContent = `Vos résultats suggèrent de vous concentrer sur : ${topicsToRevise.join(', ')}.`;
        } else {
            adviceText.textContent = "Félicitations ! Vos résultats sont excellents dans tous les domaines.";
        }
    };

    const filterIncorrectAnswers = (e) => {
        const isChecked = e.target.checked;
        const summaryItems = document.querySelectorAll('.summary-item');
        summaryItems.forEach(item => {
            if (isChecked && item.dataset.correct === 'true') {
                item.style.display = 'none';
            } else {
                item.style.display = 'block';
            }
        });
    };

    const exportResultsToJson = () => {
        if (Object.keys(quizResults).length === 0) {
            showError("Aucun résultat à exporter.");
            return;
        }
        const jsonString = JSON.stringify(quizResults, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz-results-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleQuestionFileUpload);
    resultsFileInput.addEventListener('change', handleResultsFileUpload);
    prevBtn.addEventListener('click', () => handleNavigation(-1));
    nextBtn.addEventListener('click', () => {
        if (nextBtn.textContent === 'Terminer') {
            calculateAndShowResults();
        } else {
            handleNavigation(1);
        }
    });
    navDropdown.addEventListener('change', (e) => changeQuestion(parseInt(e.target.value, 10)));
    bookmarkIcon.addEventListener('click', toggleBookmark);
    showOnlyIncorrectCheckbox.addEventListener('change', filterIncorrectAnswers);
    restartBtn.addEventListener('click', resetQuiz);
    exportBtn.addEventListener('click', exportResultsToJson);

    // --- Initial Call ---
    resetQuiz();
});




