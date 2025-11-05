const firebaseConfig = {
  apiKey: "AIzaSyBVAFiJCyDxUO3A2n7Zek2hH62VSO8_650",
  authDomain: "DATN-2025",
  databaseURL: "https://datn-2025-10496-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "datn-2025-10496",
  storageBucket: "datn-2025-10496.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database() 