import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

async function loadFirebaseConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error("Could not load Firebase config from /api/config", e);
        return null;
    }
}

const firebaseConfig = await loadFirebaseConfig();

if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("Firebase config is missing or invalid. Check your Vercel Environment Variables.");
}

const app = initializeApp(firebaseConfig || {});
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

function initUI() {
    feather.replace();

    const chatBtn = document.getElementById('chatBtn');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    
    // Auth Elements
    const authContainer = document.getElementById('authContainer');
    const chatContainer = document.getElementById('chatContainer');
    const authForm = document.getElementById('authForm');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authToggleBtn = document.getElementById('authToggleBtn');
    const authToggleText = document.getElementById('authToggleText');
    const authError = document.getElementById('authError');
    const logoutBtn = document.getElementById('logoutBtn');

    // Chat Elements
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    let currentUser = null;
    let isSignupMode = false;

    // --- Rate Limiting ---
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

    // --- UI Toggles ---
    function toggleChat() {
        chatWindow.classList.toggle('hidden');
        chatWindow.classList.toggle('flex');
    }

    chatBtn.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', toggleChat);

    authToggleBtn.addEventListener('click', () => {
        isSignupMode = !isSignupMode;
        if (isSignupMode) {
            authToggleText.textContent = "Already have an account?";
            authToggleBtn.textContent = "Login";
            authSubmitBtn.textContent = "Sign up";
        } else {
            authToggleText.textContent = "Don't have an account?";
            authToggleBtn.textContent = "Sign up";
            authSubmitBtn.textContent = "Login";
        }
        authError.classList.add('hidden');
    });

    // --- Auth Logic ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value;
        const password = authPassword.value;
        authError.classList.add('hidden');
        
        try {
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = "Please wait...";
            if (isSignupMode) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            authError.textContent = error.message;
            authError.classList.remove('hidden');
            authSubmitBtn.textContent = isSignupMode ? "Sign up" : "Login";
            authSubmitBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            // Logged in
            authContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            chatContainer.classList.add('flex');
            logoutBtn.classList.remove('hidden');
            
            // Clear default messages
            chatMessages.innerHTML = '';
            
            // Load messages from Firestore
            await loadMessages(user.uid);
        } else {
            // Logged out
            authContainer.classList.remove('hidden');
            chatContainer.classList.add('hidden');
            chatContainer.classList.remove('flex');
            logoutBtn.classList.add('hidden');
            
            authEmail.value = '';
            authPassword.value = '';
            authSubmitBtn.textContent = isSignupMode ? "Sign up" : "Login";
            authSubmitBtn.disabled = false;
            
            // Note: chat input fields can be left alone, they are hidden now.
        }
    });

    // --- Chat Logic ---
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

    async function saveMessageToFirestore(text, isUser) {
        if (!currentUser) return;
        try {
            await addDoc(collection(db, "messages"), {
                userId: currentUser.uid,
                text: text,
                isUser: isUser,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    }

    async function loadMessages(userId) {
        try {
            const q = query(
                collection(db, "messages"), 
                where("userId", "==", userId), 
                orderBy("timestamp", "asc")
            );
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                // Show default message if no history
                addMessage("Hello! I'm your AI GST Assistant. How can I help you with GST rates, HSN codes, or compliance today?", false);
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                addMessage(data.text, data.isUser);
            });
        } catch (error) {
            console.error("Error loading messages: ", error);
            // Fallback default message
            // Wait, firestore indexes might be needed for this query. If so, it will throw an error in the console. 
            // In the catch block we just show the default message.
            addMessage("Hello! I'm your AI GST Assistant. How can I help you with GST rates, HSN codes, or compliance today?", false);
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

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }

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
        saveMessageToFirestore(text, true);
        
        addLoadingIndicator();
        const response = await callGeminiAPI(text);
        removeLoadingIndicator();
        addMessage(response, false);
        saveMessageToFirestore(response, false);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
} else {
    initUI();
}
