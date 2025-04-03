// Create a new file dental.js

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
const startScanButton = document.getElementById('startScan');
const takePictureButton = document.getElementById('takePicture');
const cameraPreview = document.getElementById('cameraPreview');
const scanStatus = document.getElementById('scanStatus');
const cameraStatus = document.getElementById('cameraStatus');
const scanResults = document.getElementById('scanResults');
const plaqueCoverage = document.getElementById('plaqueCoverage');
const decayDetected = document.getElementById('decayDetected');
const resultImage = document.getElementById('resultImage');
const scanHistory = document.getElementById('scanHistory');

// WebSocket connection for real-time communication with Raspberry Pi
let ws = null;
let currentUserId = null;
let isConnected = false;

// Get current user ID
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadScanHistory();
    } else {
        currentUserId = null;
        // Redirect to login page if not logged in
        window.location.href = "index.html";
    }
});

// Connect to Raspberry Pi WebSocket server
function connectToCamera() {
    // Replace with your Raspberry Pi's IP address or hostname
    ws = new WebSocket('ws://your-raspberry-pi-address:8765');
    
    ws.onopen = () => {
        isConnected = true;
        scanStatus.textContent = 'Camera connected';
        cameraStatus.classList.add('connected');
        startScanButton.disabled = false;
    };
    
    ws.onclose = () => {
        isConnected = false;
        scanStatus.textContent = 'Camera disconnected';
        cameraStatus.classList.remove('connected');
        startScanButton.disabled = true;
        takePictureButton.disabled = true;
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        scanStatus.textContent = 'Connection error';
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'preview') {
            // Update camera preview with base64 image
            cameraPreview.src = 'data:image/jpeg;base64,' + data.image;
            takePictureButton.disabled = false;
        } else if (data.type === 'analysis') {
            // Display analysis results
            displayResults(data);
        }
    };
}

// Start camera preview
startScanButton.addEventListener('click', () => {
    if (!isConnected) {
        connectToCamera();
    }
    
    ws.send(JSON.stringify({
        command: 'start_preview'
    }));
    
    scanStatus.textContent = 'Preview active';
});

// Take picture and analyze
takePictureButton.addEventListener('click', () => {
    scanStatus.textContent = 'Analyzing...';
    
    ws.send(JSON.stringify({
        command: 'take_picture',
        userId: currentUserId
    }));
});

// Display scan results
function displayResults(data) {
    plaqueCoverage.textContent = data.plaqueCoverage.toFixed(1) + '%';
    decayDetected.textContent = data.decayDetected ? 'Yes' : 'No';
    
    // Display result image
    resultImage.src = 'data:image/jpeg;base64,' + data.resultImage;
    
    // Show results container
    scanResults.style.display = 'block';
    
    // Save results to Firestore
    saveScanResults(data);
    
    // Update scan history
    loadScanHistory();
}

// Save scan results to Firestore
async function saveScanResults(data) {
    try {
        const docRef = await addDoc(collection(db, "dental_scans"), {
            userId: currentUserId,
            scanDate: Timestamp.now(),
            plaqueCoverage: data.plaqueCoverage,
            decayDetected: data.decayDetected,
            decayLocations: data.decayLocations || [],
            imageUrl: data.imageUrl || null
        });
        console.log("Scan saved with ID: ", docRef.id);
    } catch (error) {
        console.error("Error saving scan: ", error);
    }
}

// Load scan history
async function loadScanHistory() {
    if (!currentUserId) return;
    
    try {
        const q = query(
            collection(db, "dental_scans"),
            where("userId", "==", currentUserId),
            orderBy("scanDate", "desc"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        scanHistory.innerHTML = '';
        
        if (querySnapshot.empty) {
            scanHistory.innerHTML = '<p>No previous scans</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const scanDate = data.scanDate.toDate();
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div>${scanDate.toLocaleDateString()} ${scanDate.toLocaleTimeString()}</div>
                <div>Plaque: ${data.plaqueCoverage.toFixed(1)}% | Decay: ${data.decayDetected ? 'Yes' : 'No'}</div>
            `;
            
            scanHistory.appendChild(historyItem);
        });
    } catch (error) {
        console.error("Error loading scan history: ", error);
    }
}

// Initial connection attempt
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!isConnected) {
            connectToCamera();
        }
    }, 1000);
});