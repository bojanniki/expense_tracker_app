const e = require("express");

//DOM elements for forms and messages
const registrationForm = document.getElementById("registration-form");
const loginForm = document.getElementById("login-form");
const regMessage = document.getElementById("reg-message");
const loginMessage = document.getElementById("login-message");
const accountsList = document.getElementById("accounts-list");
const addAccountForm = document.getElementById("add-account-form");
const expenseAccountSelect = document.getElementById("expense-account");

//function to fetch and display accounts 
const fetchAccounts = async () => {
  try{
  const response = await fetch ("/api/accounts");
  if (response.ok) {
    const accounts = await response.json();
    accountsList.innerHTML=""; //clear the lst before repopulating
    expenseAccountSelect.innerHTML=""; //clear the dropdown
    accounts.forEach(account => {
      const li = document.createElement("li");
      li.textContent = account.account_name;
      accountsList.appendChild(li);

      //Create option for the expense form dropdown
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = account.account_name;
      expenseAccountSelect.appendChild(option);
    });
  }
  
} catch(err) {
  console.error("Failed to fetch accounts:", err);}
};

//event listener for the "add account" form
addAccountForm.addEventListener("submit", async(e) => {
  e.preventDefault();
  const accountName = document.getElementById("account-name").value;
  try {
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body:JSON.stringify({accountName:account_name}),
    });
    if(response.ok) {
      //if the account was added succesfully, refresh the list 
      fetchAccounts();
      addAccountForm.reset(); //Clear the form
    } else {
      const message = await response.text();
      console.error("Failed to add account:", message);
    }
  } catch(err) {
    console.error("An error occured while adding account:", err);
  }
});

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
      //Login successful!
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

//function to check authentication status on page load, updated to call fetchAccounts on success

const checkAuthStatus = async () => {
    try {
        const response = await fetch ("/api/profile");

        if (response.ok) {
            const data = await response.json();
            authContainer.style.display = "none";
            dashboard.style.display = "block";
            welcomeUsername.textContent = data.username;

            //NEW: fetch and display accounts and expenses
            fetchAccounts();
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
checkAuthStatus();
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