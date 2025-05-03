// wallet.js - Digital Wallet functionality

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    Timestamp, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Firebase configuration (same as existing configuration)
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
const balanceDisplay = document.getElementById('balanceDisplay');
const accountId = document.getElementById('accountId');
const transactionHistory = document.getElementById('transactionHistory');
const amountInput = document.getElementById('amount');
const recipientInput = document.getElementById('recipient');
const sendButton = document.getElementById('sendButton');
const depositButton = document.getElementById('depositButton');
const qrCodeDisplay = document.getElementById('qrCodeDisplay');
const generateQRButton = document.getElementById('generateQRButton');
const scanQRButton = document.getElementById('scanQRButton');
const qrScannerContainer = document.getElementById('qrScannerContainer');
const scanResult = document.getElementById('scanResult');
const closeScanner = document.getElementById('closeScanner');
const notificationElement = document.getElementById('notification');

// Current user data
let currentUserId = null;
let currentUserData = null;
let scanner = null;

// Check if user is logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        await loadUserWallet();
        loadTransactionHistory();
    } else {
        currentUserId = null;
        // Redirect to login page if not logged in
        window.location.href = "index.html";
    }
});

// Load user's wallet information
async function loadUserWallet() {
    try {
        // Get user document
        const userRef = doc(db, "users", currentUserId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            
            // Check if wallet exists
            if (!currentUserData.wallet) {
                // Create wallet if it doesn't exist
                await updateDoc(userRef, {
                    wallet: {
                        balance: 0,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    }
                });
                
                // Refresh user data
                const updatedUserSnap = await getDoc(userRef);
                currentUserData = updatedUserSnap.data();
            }
            
            // Display user information
            updateWalletUI();
        } else {
            console.error("User document does not exist");
            showNotification("Error loading wallet. Please try again.", "error");
        }
    } catch (error) {
        console.error("Error loading wallet:", error);
        showNotification("Error loading wallet. Please try again.", "error");
    }
}

// Update wallet UI with current data
function updateWalletUI() {
    if (currentUserData && currentUserData.wallet) {
        // Display balance and format as currency
        const formattedBalance = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
        }).format(currentUserData.wallet.balance);
        
        balanceDisplay.textContent = formattedBalance;
        
        // Display account ID (using first 8 chars of UID for display)
        accountId.textContent = currentUserId.substring(0, 8);
    }
}

// Load transaction history
async function loadTransactionHistory() {
    if (!currentUserId) return;
    
    try {
        // Query for transactions where user is sender or receiver
        const q1 = query(
            collection(db, "transactions"),
            where("senderId", "==", currentUserId),
            orderBy("timestamp", "desc"),
            limit(10)
        );
        
        const q2 = query(
            collection(db, "transactions"),
            where("recipientId", "==", currentUserId),
            orderBy("timestamp", "desc"),
            limit(10)
        );
        
        // Get both sent and received transactions
        const [sentSnap, receivedSnap] = await Promise.all([
            getDocs(q1),
            getDocs(q2)
        ]);
        
        // Combine transactions
        const transactions = [];
        
        sentSnap.forEach(doc => {
            transactions.push({id: doc.id, ...doc.data(), type: "sent"});
        });
        
        receivedSnap.forEach(doc => {
            transactions.push({id: doc.id, ...doc.data(), type: "received"});
        });
        
        // Sort by timestamp (descending)
        transactions.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
        
        // Take only the most recent 10
        const recentTransactions = transactions.slice(0, 10);
        
        // Display transactions
        displayTransactions(recentTransactions);
    } catch (error) {
        console.error("Error loading transaction history:", error);
        transactionHistory.innerHTML = '<p>Could not load transactions</p>';
    }
}

// Display transactions in the UI
function displayTransactions(transactions) {
    transactionHistory.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionHistory.innerHTML = '<p>No transactions yet</p>';
        return;
    }
    
    transactions.forEach(transaction => {
        const transactionDate = transaction.timestamp.toDate();
        const isIncoming = transaction.recipientId === currentUserId;
        const formattedAmount = new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD' 
        }).format(transaction.amount);
        
        const transactionItem = document.createElement('div');
        transactionItem.className = `transaction-item ${isIncoming ? 'received' : 'sent'}`;
        
        transactionItem.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-type">
                    ${isIncoming ? 
                        '<i class="fas fa-arrow-down incoming"></i> Received from' : 
                        '<i class="fas fa-arrow-up outgoing"></i> Sent to'}
                </div>
                <div class="transaction-party">
                    ${isIncoming ? transaction.senderName : transaction.recipientName}
                </div>
                <div class="transaction-date">
                    ${transactionDate.toLocaleDateString()} ${transactionDate.toLocaleTimeString()}
                </div>
            </div>
            <div class="transaction-amount ${isIncoming ? 'incoming' : 'outgoing'}">
                ${isIncoming ? '+' : '-'}${formattedAmount}
            </div>
        `;
        
        transactionHistory.appendChild(transactionItem);
    });
}

// Send money function
async function sendMoney(recipientId, amount) {
    if (!currentUserId || !currentUserData) {
        showNotification("You need to be logged in to send money.", "error");
        return false;
    }
    
    // Convert amount to number
    amount = parseFloat(amount);
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
        showNotification("Please enter a valid amount.", "error");
        return false;
    }
    
    // Check if user has enough balance
    if (currentUserData.wallet.balance < amount) {
        showNotification("Insufficient balance.", "error");
        return false;
    }
    
    // Check if recipient exists
    try {
        const recipientQuery = query(
            collection(db, "users"),
            where("uid", "==", recipientId)
        );
        
        const recipientSnapshot = await getDocs(recipientQuery);
        
        if (recipientSnapshot.empty) {
            showNotification("Recipient not found.", "error");
            return false;
        }
        
        const recipientData = recipientSnapshot.docs[0].data();
        
        // Start transaction
        // Note: Firestore doesn't have native transactions like SQL databases
        // In production, you'd use a transaction or batch write to ensure atomicity
        
        // Update sender balance
        const senderRef = doc(db, "users", currentUserId);
        await updateDoc(senderRef, {
            "wallet.balance": currentUserData.wallet.balance - amount,
            "wallet.lastUpdated": serverTimestamp()
        });
        
        // Update recipient balance
        const recipientRef = doc(db, "users", recipientData.uid);
        const recipientSnap = await getDoc(recipientRef);
        
        if (recipientSnap.exists()) {
            const recipientCurrentData = recipientSnap.data();
            
            // Initialize wallet if it doesn't exist
            if (!recipientCurrentData.wallet) {
                await updateDoc(recipientRef, {
                    wallet: {
                        balance: amount,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    }
                });
            } else {
                await updateDoc(recipientRef, {
                    "wallet.balance": recipientCurrentData.wallet.balance + amount,
                    "wallet.lastUpdated": serverTimestamp()
                });
            }
        }
        
        // Record transaction
        await addDoc(collection(db, "transactions"), {
            senderId: currentUserId,
            senderName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            recipientId: recipientData.uid,
            recipientName: `${recipientData.firstName} ${recipientData.lastName}`,
            amount: amount,
            timestamp: serverTimestamp(),
            status: "completed"
        });
        
        // Update local data
        currentUserData.wallet.balance -= amount;
        
        // Update UI
        updateWalletUI();
        loadTransactionHistory();
        
        showNotification(`Successfully sent ${amount.toFixed(2)} to ${recipientData.firstName}`, "success");
        return true;
    } catch (error) {
        console.error("Error sending money:", error);
        showNotification("Failed to send money. Please try again.", "error");
        return false;
    }
}

// Deposit money (for demo purposes)
async function depositMoney(amount) {
    if (!currentUserId || !currentUserData) {
        showNotification("You need to be logged in to deposit money.", "error");
        return;
    }
    
    // Convert amount to number
    amount = parseFloat(amount);
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
        showNotification("Please enter a valid amount.", "error");
        return;
    }
    
    try {
        // Update user balance
        const userRef = doc(db, "users", currentUserId);
        await updateDoc(userRef, {
            "wallet.balance": currentUserData.wallet.balance + amount,
            "wallet.lastUpdated": serverTimestamp()
        });
        
        // Record deposit transaction
        await addDoc(collection(db, "transactions"), {
            senderId: "system",
            senderName: "Deposit",
            recipientId: currentUserId,
            recipientName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            amount: amount,
            timestamp: serverTimestamp(),
            status: "completed"
        });
        
        // Update local data
        currentUserData.wallet.balance += amount;
        
        // Update UI
        updateWalletUI();
        loadTransactionHistory();
        
        showNotification(`Successfully deposited ${amount.toFixed(2)}`, "success");
    } catch (error) {
        console.error("Error depositing money:", error);
        showNotification("Failed to deposit money. Please try again.", "error");
    }
}

// Generate QR code for receiving money
function generateQRCode() {
    if (!currentUserId) return;
    
    // Create payment request object
    const paymentRequest = {
        action: "payment",
        recipientId: currentUserId,
        recipientName: `${currentUserData.firstName} ${currentUserData.lastName}`,
        timestamp: Date.now()
    };
    
    // Convert to JSON string
    const paymentRequestStr = JSON.stringify(paymentRequest);
    
    // Generate QR code using QRCode.js library
    qrCodeDisplay.innerHTML = '';
    
    // Create QR code
    new QRCode(qrCodeDisplay, {
        text: paymentRequestStr,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Show QR code
    document.getElementById('qrSection').style.display = 'block';
}

// Initialize QR Scanner
function initQRScanner() {
    // Create scanner instance
    scanner = new Html5QrcodeScanner("qrScanner", { fps: 10, qrbox: 250 });
    
    // Callback when QR is detected successfully
    const onScanSuccess = (decodedText) => {
        // Stop scanner
        scanner.clear();
        
        try {
            // Parse payment request
            const paymentRequest = JSON.parse(decodedText);
            
            if (paymentRequest.action === "payment" && paymentRequest.recipientId) {
                // Close scanner
                qrScannerContainer.style.display = 'none';
                
                // Show payment form
                document.getElementById('paymentFormContainer').style.display = 'block';
                
                // Set recipient ID
                recipientInput.value = paymentRequest.recipientId;
                document.getElementById('recipientName').textContent = paymentRequest.recipientName || 'Unknown';
            } else {
                showNotification("Invalid QR code format.", "error");
            }
        } catch (error) {
            console.error("Error parsing QR code:", error);
            showNotification("Invalid QR code.", "error");
        }
    };
    
    // Start scanner
    scanner.render(onScanSuccess);
}

// Show notification
function showNotification(message, type = "info") {
    notificationElement.textContent = message;
    notificationElement.className = `notification ${type}`;
    notificationElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notificationElement.style.display = 'none';
    }, 5000);
}

// Event Listeners
if (sendButton) {
    sendButton.addEventListener('click', async () => {
        const recipient = recipientInput.value.trim();
        const amount = amountInput.value;
        
        if (!recipient || !amount) {
            showNotification("Please enter recipient ID and amount.", "error");
            return;
        }
        
        const success = await sendMoney(recipient, amount);
        
        if (success) {
            // Clear form
            recipientInput.value = '';
            amountInput.value = '';
            document.getElementById('paymentFormContainer').style.display = 'none';
        }
    });
}

if (depositButton) {
    depositButton.addEventListener('click', () => {
        const amount = amountInput.value;
        
        if (!amount) {
            showNotification("Please enter an amount.", "error");
            return;
        }
        
        depositMoney(amount);
    });
}

if (generateQRButton) {
    generateQRButton.addEventListener('click', generateQRCode);
}

if (scanQRButton) {
    scanQRButton.addEventListener('click', () => {
        qrScannerContainer.style.display = 'block';
        initQRScanner();
    });
}

if (closeScanner) {
    closeScanner.addEventListener('click', () => {
        if (scanner) {
            scanner.clear();
        }
        qrScannerContainer.style.display = 'none';
    });
}

// Initialize wallet on page load
window.addEventListener('load', () => {
    // Load user wallet when auth state is resolved
    if (currentUserId) {
        loadUserWallet();
        loadTransactionHistory();
    }
});