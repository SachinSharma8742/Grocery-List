const firebaseConfig = {
  apiKey: "AIzaSyChCQ6mvdv4BKhfbclhgUehkYRl97umaLM",
  projectId: "login-form-eplq",
  storageBucket: "login-form-eplq.appspot.com",
  messagingSenderId: "678447886805",
  appId: "1:678447886805:web:cf8e92b9825707939d8d5c",
  measurementId: "G-7V1H4F1Y21",
  authDomain: "login-form-eplq.firebaseapp.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Initialize Firebase Authentication
var auth = firebase.auth();

// Initialize Firebase Storage
var storageRef = firebase.storage().ref();
const sachin=69;