document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    const chatBtn = document.getElementById('chatBtn');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // Simple Client-Side Rate Limiting
    const RATE_LIMIT_MAX_REQUESTS = 5; // Max messages
    const RATE_LIMIT_WINDOW_MS = 60000; // per 1 minute
    let requestTimestamps = [];

    function checkRateLimit() {
        const now = Date.now();
        requestTimestamps = requestTimestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
        
        if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
            return false;
        }
        requestTimestamps.push(now);
        return true;
    }

    function toggleChat() {
        chatWindow.classList.toggle('hidden');
        chatWindow.classList.toggle('flex');
    }

    chatBtn.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', toggleChat);

    function addMessage(text, isUser = false) {
        const msgDiv = document.createElement('div');
        if (isUser) {
            msgDiv.className = 'bg-slate-800 p-4 rounded-2xl w-5/6 shrink-0';
            // Simple escape
            msgDiv.textContent = text;
        } else {
            msgDiv.className = 'bg-sky-500 p-4 rounded-2xl text-white ml-auto w-5/6 shrink-0';
            msgDiv.innerHTML = text;
        }
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.className = 'typing text-slate-300 pt-2 ml-auto shrink-0';
        indicator.innerText = 'AI is analyzing GST compliance...';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    async function callGeminiAPI(prompt) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                // Convert simple markdown to HTML (bold tags)
                let formattedText = data.candidates[0].content.parts[0].text;
                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                formattedText = formattedText.replace(/\n/g, '<br>');
                return formattedText;
            } else if (data.error) {
                console.error("API Error:", data.error);
                return `API Error: ${data.error.message || data.error}`;
            }
            return "Sorry, I couldn't process that request.";
        } catch (error) {
            console.error(error);
            return `Error connecting to AI Assistant: ${error.message}`;
        }
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        if (!checkRateLimit()) {
            addMessage("You are sending messages too quickly. Please wait a minute before asking another question.", false);
            return;
        }

        addMessage(text, true);
        chatInput.value = '';
        
        addLoadingIndicator();
        const response = await callGeminiAPI(text);
        removeLoadingIndicator();
        addMessage(response, false);
    });
});
