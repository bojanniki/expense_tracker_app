const e = require("express");

//DOM elements for forms and messages
const registrationForm = document.getElementById("registration-form");
const loginForm = document.getElementById("login-form");
const regMessage = document.getElementById("reg-message");
const loginMessage = document.getElementById("login-message");

//elements for the dashboard
const authContainer = document.getElementById("auth-container");
const dashboard = document.getElementById("dashboard");
const welcomeUsername = document.getElementById("welcome-username");

//event listener for registration form submission
registrationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const message = await response.text();
    if (response.ok) {
      regMessage.style.color = "green";
      regMessage.textContent = " Registration successful! You can now login";
      registrationForm.reset();
    } else {
      regMessage.style.color = "red";
      regMessage.textContent = "An error occurred. Please try again.";
    }
  } catch (err) {
    console.error(err);
    regMessage.style.color = "red";
    regMessage.textContent = "An error occurred.Please try again.";
  }
});

//event listener for login form submission

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault(); //Stop the form from submittin normally

  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const response = await fetch("api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      //Login succesful!
      loginMessage.textContent = "";
      authContainer.style.display = "none"; //hide the login/register forms
      dashboard.style.display = "block"; //Show the dashboard
      welcomeUsername.textContent = data.username; //update the welcome message
    } else {
      loginMessage.style.color = "red";
      loginMessage.textContent = data.message || data;
    }
  } catch (err) {
    console.error(err);
    loginMessage.style.color = "red";
    loginMessage.textContent = "An error occurred. Please try again.";
  }
});

//get the logout button element

const logoutButton = document.getElementById("logout-button");

//function to check authentication status on page load

const checkAuthStatus = async () => {
    try {
        const response = await fetch ("/api/profile");

        if (response.ok) {
            const data = await response.json();
            authContainer.style.display = "none";
            dashboard.style.display = "block";
            welcomeUsername.textContent = data.username;
        } else {
            //user is not logged in, show auth forms
            authContainer.style.display = "block";
            dashboard.style.display = "none";
        }
    } catch (err) {
        console.error("Error checking auth status:", err);
        //fallback to showin login forms on any error
        authContainer.style.display = "block";
        dashboard.style.display = "none";
    }
};

//event listener for the log out button
logoutButton.addEventListener("click" async () => {
    try {
        const response = await fetch ("/api/logout", {
            method:"POST",
        });
        if(response.ok) {
            //logout successful 
            authContainer.style.display = "block"; //Show the auth forms
            dashboard.style.display = "none"; //Hide the dashboard
            welcomeUsername.textContent = ""; //clear the username
            loginMessage.textContent = "You have logged out.";
            loginMessage.style.color = "green";

        } else {
            console.error("Logout failed");
        }
    } catch (err) {
        console.error ("An error occurred during logout:", err);
    }
});