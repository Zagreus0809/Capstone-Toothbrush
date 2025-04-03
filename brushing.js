// Create a new file brushing.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Firebase configuration (same as your existing configuration)
const firebaseConfig = {
    apiKey: "AIzaSyBjQaUXOTiNQq9eYNKEmhsPsjQdISZTuUI",
    authDomain: "log-in-system-cef9e.firebaseapp.com",
    projectId: "log-in-system-cef9e",
    storageBucket: "log-in-system-cef9e.appspot.com",
    messagingSenderId: "464719173794",
    appId: "1:464719173794:web:6cca002d79ca12c38cdffb",
    measurementId: "G-TGMYKPF6NP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const startBrushingButton = document.getElementById('startBrushing');
const stopBrushingButton = document.getElementById('stopBrushing');
const brushingStatus = document.getElementById('brushingStatus');
const trackerStatus = document.getElementById('trackerStatus');
const brushingTimer = document.getElementById('brushingTimer');
const brushingHistory = document.getElementById('brushingHistory');

// Progress bar elements
const upperLeftProgress = document.getElementById('upperLeftProgress');
const upperFrontProgress = document.getElementById('upperFrontProgress');
const upperRightProgress = document.getElementById('upperRightProgress');
const lowerLeftProgress = document.getElementById('lowerLeftProgress');
const lowerFrontProgress = document.getElementById('lowerFrontProgress');
const lowerRightProgress = document.getElementById('lowerRightProgress');

// Progress percentage elements
const upperLeftPercentage = document.getElementById('upperLeftPercentage');
const upperFrontPercentage = document.getElementById('upperFrontPercentage');
const upperRightPercentage = document.getElementById('upperRightPercentage');
const lowerLeftPercentage = document.getElementById('lowerLeftPercentage');
const lowerFrontPercentage = document.getElementById('lowerFrontPercentage');
const lowerRightPercentage = document.getElementById('lowerRightPercentage');

// Teeth section elements
const upperLeft = document.getElementById('upperLeft');
const upperFront = document.getElementById('upperFront');
const upperRight = document.getElementById('upperRight');
const lowerLeft = document.getElementById('lowerLeft');
const lowerFront = document.getElementById('lowerFront');
const lowerRight = document.getElementById('lowerRight');

// WebSocket connection for real-time communication with ESP32
let ws = null;
let currentUserId = null;
let isConnected = false;
let brushingStartTime = null;
let brushingInterval = null;
let currentSession = null;
let coverageData = {
    upperLeft: 0,
    upperFront: 0,
    upperRight: 0,
    lowerLeft: 0,
    lowerFront: 0,
    lowerRight: 0
};

// Get current user ID
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadBrushingHistory();
    } else {
        currentUserId = null;
        // Redirect to login page if not logged in
        window.location.href = "index.html";
    }
});

// Connect to ESP32 WebSocket server
function connectToTracker() {
    // First, try to connect to Raspberry Pi to get ESP32 connection details
    // We'll use a separate endpoint for the Raspberry Pi that will provide ESP32 WiFi credentials
    fetch('/api/get-esp32-connection')
        .then(response => response.json())
        .then(data => {
            // Use the info from Raspberry Pi to connect to ESP32
            const espAddress = data.address || 'ws://esp32-device-address:81';
            
            ws = new WebSocket(espAddress);
            
            ws.onopen = () => {
                isConnected = true;
                brushingStatus.textContent = 'Tracker connected';
                trackerStatus.classList.add('connected');
                startBrushingButton.disabled = false;
            };
            
            ws.onclose = () => {
                isConnected = false;
                brushingStatus.textContent = 'Tracker disconnected';
                trackerStatus.classList.remove('connected');
                startBrushingButton.disabled = true;
                stopBrushingButton.disabled = true;
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                brushingStatus.textContent = 'Connection error';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleBrushingData(data);
            };
        })
        .catch(error => {
            console.error('Failed to get ESP32 connection details:', error);
            brushingStatus.textContent = 'Setup connection failed';
            
            // Fallback to direct connection attempt with default address
            connectWithDefaultAddress();
        });
}

// Fallback connection using default address
function connectWithDefaultAddress() {
    // Default ESP32 WebSocket address - in production, this would be configurable
    const defaultAddress = 'ws://esp32-toothbrush:81';
    
    ws = new WebSocket(defaultAddress);
    
    ws.onopen = () => {
        isConnected = true;
        brushingStatus.textContent = 'Tracker connected';
        trackerStatus.classList.add('connected');
        startBrushingButton.disabled = false;
    };
    
    ws.onclose = () => {
        isConnected = false;
        brushingStatus.textContent = 'Tracker disconnected';
        trackerStatus.classList.remove('connected');
        startBrushingButton.disabled = true;
        stopBrushingButton.disabled = true;
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        brushingStatus.textContent = 'Connection error';
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleBrushingData(data);
    };
}

// Start brushing session
startBrushingButton.addEventListener('click', () => {
    if (!isConnected) {
        connectToTracker();
        return;
    }
    
    brushingStartTime = new Date();
    currentSession = {
        userId: currentUserId,
        startTime: brushingStartTime,
        coverageData: { ...coverageData }
    };
    
    ws.send(JSON.stringify({
        command: 'start_brushing',
        userId: currentUserId
    }));
    
    brushingStatus.textContent = 'Brushing in progress...';
    startBrushingButton.disabled = true;
    stopBrushingButton.disabled = false;
    
    // Reset coverage data
    resetCoverageData();
    
    // Start timer
    startBrushingTimer();
    
    // Reset teeth section highlighting
    resetTeethSections();
});

// Stop brushing session
stopBrushingButton.addEventListener('click', () => {
    const endTime = new Date();
    const duration = Math.floor((endTime - brushingStartTime) / 1000); // in seconds
    
    ws.send(JSON.stringify({
        command: 'stop_brushing'
    }));
    
    brushingStatus.textContent = 'Brushing completed';
    startBrushingButton.disabled = false;
    stopBrushingButton.disabled = true;
    
    // Stop timer
    clearInterval(brushingInterval);
    
    // Save brushing session data
    if (currentSession) {
        currentSession.endTime = endTime;
        currentSession.duration = duration;
        currentSession.coverageData = { ...coverageData };
        saveBrushingSession(currentSession);
    }
    
    // Reset current session
    currentSession = null;
});

// Handle incoming data from ESP32
function handleBrushingData(data) {
    if (!currentSession) return;
    
    if (data.type === 'brushing_data') {
        // Update current active teeth section based on toothbrush position/orientation
        updateActiveTeethSection(data.position);
        
        // Update coverage data
        updateCoverageData(data.position, data.duration);
        
        // Update UI
        updateProgressBars();
    }
}

// Update which teeth section is currently active based on IMU data
function updateActiveTeethSection(position) {
    // Reset all sections
    upperLeft.classList.remove('active');
    upperFront.classList.remove('active');
    upperRight.classList.remove('active');
    lowerLeft.classList.remove('active');
    lowerFront.classList.remove('active');
    lowerRight.classList.remove('active');
    
    // Determine active section based on orientation data from MPU6050
    // This is a simplified implementation - real logic would be more complex
    // depending on the actual orientation data format from the ESP32
    
    // Example implementation - in reality, this would use quaternions or Euler angles
    // from the MPU6050 to determine toothbrush position
    const section = position.section || 'none';
    
    switch (section) {
        case 'upperLeft':
            upperLeft.classList.add('active');
            break;
        case 'upperFront':
            upperFront.classList.add('active');
            break;
        case 'upperRight':
            upperRight.classList.add('active');
            break;
        case 'lowerLeft':
            lowerLeft.classList.add('active');
            break;
        case 'lowerFront':
            lowerFront.classList.add('active');
            break;
        case 'lowerRight':
            lowerRight.classList.add('active');
            break;
    }
    
    // Mark sections as "completed" if they reach a certain threshold
    Object.keys(coverageData).forEach(section => {
        const el = document.getElementById(section);
        if (el && coverageData[section] >= 95) {
            el.classList.add('completed');
        }
    });
}

// Update coverage data based on brushing position and duration
function updateCoverageData(position, duration) {
    // Update coverage percentages based on time spent in each section
    // This is a simplified model - real implementation would use more complex logic
    const section = position.section;
    
    if (section && section in coverageData) {
        // Increment coverage for the active section
        const increment = Math.min(5, 100 - coverageData[section]); // Cap at 100%
        coverageData[section] = Math.min(100, coverageData[section] + increment);
    }
}

// Update progress bars in the UI
function updateProgressBars() {
    upperLeftProgress.style.width = `${coverageData.upperLeft}%`;
    upperFrontProgress.style.width = `${coverageData.upperFront}%`;
    upperRightProgress.style.width = `${coverageData.upperRight}%`;
    lowerLeftProgress.style.width = `${coverageData.lowerLeft}%`;
    lowerFrontProgress.style.width = `${coverageData.lowerFront}%`;
    lowerRightProgress.style.width = `${coverageData.lowerRight}%`;
    
    upperLeftPercentage.textContent = `${coverageData.upperLeft}%`;
    upperFrontPercentage.textContent = `${coverageData.upperFront}%`;
    upperRightPercentage.textContent = `${coverageData.upperRight}%`;
    lowerLeftPercentage.textContent = `${coverageData.lowerLeft}%`;
    lowerFrontPercentage.textContent = `${coverageData.lowerFront}%`;
    lowerRightPercentage.textContent = `${coverageData.lowerRight}%`;
}

// Reset coverage data
function resetCoverageData() {
    coverageData = {
        upperLeft: 0,
        upperFront: 0,
        upperRight: 0,
        lowerLeft: 0,
        lowerFront: 0,
        lowerRight: 0
    };
    updateProgressBars();
}

// Reset teeth section highlighting
function resetTeethSections() {
    const sections = [upperLeft, upperFront, upperRight, lowerLeft, lowerFront, lowerRight];
    sections.forEach(section => {
        section.classList.remove('active');
        section.classList.remove('completed');
    });
}

// Start brushing timer
function startBrushingTimer() {
    let seconds = 0;
    
    brushingInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        brushingTimer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        // Recommended brushing time is 2 minutes (120 seconds)
        if (seconds >= 120) {
            brushingTimer.style.color = 'green';
        }
    }, 1000);
}

// Save brushing session to Firestore
async function saveBrushingSession(session) {
    try {
        await addDoc(collection(db, "brushing_sessions"), {
            userId: session.userId,
            startTime: Timestamp.fromDate(session.startTime),
            endTime: Timestamp.fromDate(session.endTime),
            duration: session.duration,
            coverageData: session.coverageData,
            upperLeftCoverage: session.coverageData.upperLeft,
            upperFrontCoverage: session.coverageData.upperFront,
            upperRightCoverage: session.coverageData.upperRight,
            lowerLeftCoverage: session.coverageData.lowerLeft,
            lowerFrontCoverage: session.coverageData.lowerFront,
            lowerRightCoverage: session.coverageData.lowerRight
        });
        
        console.log("Brushing session saved successfully");
        
        // Reload brushing history
        loadBrushingHistory();
    } catch (error) {
        console.error("Error saving brushing session:", error);
    }
}

// Load brushing history from Firestore
async function loadBrushingHistory() {
    if (!currentUserId) return;
    
    try {
        const q = query(
            collection(db, "brushing_sessions"),
            where("userId", "==", currentUserId),
            orderBy("startTime", "desc"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        brushingHistory.innerHTML = '';
        
        if (querySnapshot.empty) {
            brushingHistory.innerHTML = '<p>No previous brushing sessions</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const startDate = data.startTime.toDate();
            const duration = data.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            
            // Calculate average coverage
            const coverageValues = [
                data.upperLeftCoverage || 0,
                data.upperFrontCoverage || 0,
                data.upperRightCoverage || 0,
                data.lowerLeftCoverage || 0,
                data.lowerFrontCoverage || 0,
                data.lowerRightCoverage || 0
            ];
            
            const avgCoverage = coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length;
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div>${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()}</div>
                <div>${minutes}m ${seconds}s | Avg Coverage: ${avgCoverage.toFixed(1)}%</div>
            `;
            
            brushingHistory.appendChild(historyItem);
        });
    } catch (error) {
        console.error("Error loading brushing history:", error);
    }
}

// Initial connection attempt
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!isConnected) {
            connectToTracker();
        }
    }, 1000);
});