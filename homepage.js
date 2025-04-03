import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";

// Firebase configuration
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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Check user authentication state
onAuthStateChanged(auth, async (user) => {
    const loggedInUserId = localStorage.getItem("loggedInUserId");

    if (loggedInUserId) {
        console.log("Logged-in user ID found:", loggedInUserId);

        try {
            const docRef = doc(db, "users", loggedInUserId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                document.getElementById("loggedUserFName").innerText = userData.firstName;
                document.getElementById("loggedUserEmail").innerText = userData.email;
                document.getElementById("loggedUserLName").innerText = userData.lastName;
            } else {
                console.log("No document found matching ID");
            }
        } catch (error) {
            console.error("Error getting document:", error);
        }
    } else {
        console.log("User ID not found in Local Storage");
    }
});

// Logout Functionality
const logoutButton = document.getElementById("logout");
logoutButton.addEventListener("click", () => {
    localStorage.removeItem("loggedInUserId");

    signOut(auth)
        .then(() => {
            window.location.href = "index.html";
        })
        .catch((error) => {
            console.error("Error Signing out:", error);
        });
});
