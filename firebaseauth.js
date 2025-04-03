// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
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
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Show messages function
function showMessage(message, divId) {
    var messageDiv = document.getElementById(divId);
    messageDiv.style.display = "block";
    messageDiv.innerHTML = message;
    messageDiv.style.opacity = 1;
    setTimeout(() => {
        messageDiv.style.opacity = 0;
    }, 5000);
}

// Sign-up function
const signUp = document.getElementById("submitSignUp");
signUp.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = document.getElementById("rEmail").value;
    const password = document.getElementById("rPassword").value;
    const firstName = document.getElementById("fName").value;
    const lastName = document.getElementById("lName").value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userData = {
            email: email,
            firstName: firstName,
            lastName: lastName,
            uid: user.uid,
        };

        // Store user details in Firestore
        await setDoc(doc(db, "users", user.uid), userData);

        showMessage("Account Created Successfully", "signUpMessage");
        window.location.href = "index.html";
    } catch (error) {
        console.error("Error:", error);
        if (error.code === "auth/email-already-in-use") {
            showMessage("Email Address Already Exists!", "signUpMessage");
        } else {
            showMessage("Unable to create User", "signUpMessage");
        }
    }
});

// Sign-in function
const signIn = document.getElementById("submitSignIn");
signIn.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        showMessage("Login Successful", "signInMessage");
        localStorage.setItem("loggedInUserId", user.uid);
        window.location.href = "homepage.html";
    } catch (error) {
        console.error("Error:", error);
        if (error.code === "auth/invalid-credential") {
            showMessage("Incorrect Email or Password", "signInMessage");
        } else {
            showMessage("Account does not Exist", "signInMessage");
        }
    }
});
