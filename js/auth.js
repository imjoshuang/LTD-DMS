  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  import { getDatabase, ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
  import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDZs4aRQZf9yNTfwXIAP4nrm46VHJWIzQ0",
    authDomain: "ltd-dms.firebaseapp.com",
    projectId: "ltd-dms",
    storageBucket: "ltd-dms.firebasestorage.app",
    messagingSenderId: "489092204124",
    appId: "1:489092204124:web:05045b7ab36669ef9c4899",
    measurementId: "G-VQXLMFB1RN"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  
  // Initialize Realtime Database
  const database = getDatabase(app);
  
  // Initialize Firebase Authentication
  const auth = getAuth(app);

  // Database helper functions
  export async function writeData(path, data) {
    try {
      await set(ref(database, path), data);
      console.log("Data written successfully to", path);
      return { success: true };
    } catch (error) {
      console.error("Error writing data:", error);
      return { success: false, error };
    }
  }

  export async function readData(path) {
    try {
      const snapshot = await get(ref(database, path));
      if (snapshot.exists()) {
        return { success: true, data: snapshot.val() };
      } else {
        return { success: true, data: null };
      }
    } catch (error) {
      console.error("Error reading data:", error);
      return { success: false, error };
    }
  }

  export async function updateData(path, updates) {
    try {
      await update(ref(database, path), updates);
      console.log("Data updated successfully at", path);
      return { success: true };
    } catch (error) {
      console.error("Error updating data:", error);
      return { success: false, error };
    }
  }

  export async function deleteData(path) {
    try {
      await remove(ref(database, path));
      console.log("Data deleted successfully from", path);
      return { success: true };
    } catch (error) {
      console.error("Error deleting data:", error);
      return { success: false, error };
    }
  }

  // Authentication functions
  export async function loginUser(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User logged in:", userCredential.user.email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  }

  export async function signupUser(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User created:", userCredential.user.email);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: error.message };
    }
  }

  export async function logoutUser() {
    try {
      await signOut(auth);
      console.log("User logged out");
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, error: error.message };
    }
  }

  export function getCurrentUser() {
    return auth.currentUser;
  }
