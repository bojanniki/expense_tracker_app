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
const logoutButton = document.getElementById("logout-button");

//elements fro the accounts and expenses
const accountsList = document.getElementById("accounts-list");
const addAccountForm = document.getElementById("add-account-form");
const expenseAccountSelect = document.getElementById("expense-account");
const addExpenseForm = document.getElementById("add-expense-form");
const expensesList = document.getElementById("expenses-list");
const addExpenseButton = addExpenseForm.querySelector('button[type="submit"]');

//a global variable to track the expense being edited
let editingExpenseId = null;

//function to fetch and display accounts
const fetchAccounts = async () => {
  try {
    const response = await fetch("/api/accounts");
    if (response.ok) {
      const accounts = await response.json();
      accountsList.innerHTML = ""; //clear the lst before repopulating
      expenseAccountSelect.innerHTML = ""; //clear the dropdown
      accounts.forEach((account) => {
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
  } catch (err) {
    console.error("Failed to fetch accounts:", err);
  }
};

//event listener for the "add account" form
addAccountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const accountName = document.getElementById("account-name").value;
  try {
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName: account_name }),
    });
    if (response.ok) {
      //if the account was added succesfully, refresh the list
      fetchAccounts();
      addAccountForm.reset(); //Clear the form
    } else {
      const message = await response.text();
      console.error("Failed to add account:", message);
    }
  } catch (err) {
    console.error("An error occured while adding account:", err);
  }
});

//event listener for the add/update expense form
addExpenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = document.getElementById("expense-description").value;
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const date = document.getElementById("expense-date").value;
  const account_id = document.getElementById("expense-account").value;

  const expenseData = {
    description,
    amount,
    date,
    account_id,
  };
  let response;
  try {
    if (editingExpenseId) {
      //if we have an ID, we are updating (PUT request)
      response = await fetch("/api/expenses/${editingExpenseId}", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });
    }
    if (response.ok) {
      fetchExpenses();
      addExpenseForm.reset();
      editingExpenseId = null;
      addExpenseButton.textContent = "Add Expense";
    } else {
      const message = await response.text();
      console.error("Failed to save expense:", message);
    }
  } catch (err) {
    console.error("An error occurred while saving expense:", err);
  }
});

//event listener for delete and edit buttons using event delegation
expensesList.addEventListener("click", async (e) => {
  //check if the clicked element has the delete button class
  if (e.target.classList.contains("delete-button")) {
    const expenseId = e.target.dataset.id;
    try {
      const response = await fetch("/api/expenses/${expenseId}", {
        method: "DELETE",
      });
      if (response.ok) {
        fetchExpenses(); //refresh the list
      } else {
        console.error("Failed to delete expense");
      }
    } catch (err) {
      console.error("An error occurred during deletion", err);
    }
  }

  //check if the clicked element has the edit-button class
  if (e.target.classList.contains("edit-button")) {
    const expenseId = e.target.dataset.id;
    //find the expense data from the list
    const expenseToEdit = Array.from(expensesList.children).find((li) => {
      const button = li.querySelector(".edit-button");
      return button && button.dataset.id === expenseId;
    });
    if (expenseToEdit) {
      //get the data from the list item
      const description =
        expenseToEdit.querySelector("span:nth-child(1)").textContent;
      const amount = parseFloat(
        expenseToEdit
          .querySelector("span:nth-child(2)")
          .textContent.substring(1)
      );
      const date = expenseToEdit.querySelector("span:nth-child(3)").textContent;
      const accountId = expenseToEdit
        .querySelector("span:nth-child(4)")
        .textContent.split("")[2]
        .replace(")", "");

      //populate the form with the expense data
      document.getElementById("expense-description").value = description;
      document.getElementById("expense-amount").value = amount;
      document.getElementById("expense-date").value = date;
      document.getElementById("expense-account").value = accountId;

      //update the global state and form button
      editingExpenseId = expenseId;
      addExpenseButton.textContent = "Update Expense";

      //scroll to the form
      addExpenseForm.scrollIntoView({ behavior: "smooth" });
    }
  }
});

//function to fetch and display expenses

const fetchExpenses = async () => {
  try {
    const response = await fetch("/api/expenses");
    if (response.ok) {
      const expenses = await response.json();
      expensesList.innerHTML = ""; //clear the list before repopulating

      //Loop through each expense and create a HTML element
      expenses.forEach((expense) => {
        const li = document.createElement("li");
        li.innerHTML = `
                    <span>${expense.description}</span>
                    <span>$${expense.amount.toFixed(2)}</span>
                    <span>${new Date(expense.date).toLocaleDateString()}</span>
                    <span>(Account ID: ${expense.account_id})</span>
                    <button class="edit-button" data-id="${
                      expense.id
                    }">Edit</button>
                    <button class="delete-button" data-id="${
                      expense.id
                    }">Delete</button>
                `;
        expensesList.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Failed to fetch expenses:", err);
  }
};

//event listener for the add-expense form
addExpenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = document.getElementById("expense-description").value;
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const date = document.getElementById("expense-account").value;

  try {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amount, date, account_id }),
    });
    if (response) {
      //if the expense was added succesfully, refresh the list
      fetchExpenses();
      addExpenseForm.reset(); //clear the form
    } else {
      const message = await response.text();
      console.error("Failed to add expense:", message);
    }
  } catch (err) {
    console.error("An error occured while adding expense:", err);
  }
});

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

//call the function on page load
checkAuthStatus();

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
      authContainer.style.display = "none";
      checkAuthStatus(); //hide the login/register forms
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

//function to check authentication status on page load, updated to call fetchAccounts on success

const checkAuthStatus = async () => {
  try {
    const response = await fetch("/api/profile");

    if (response.ok) {
      const data = await response.json();
      authContainer.style.display = "none";
      dashboard.style.display = "block";
      welcomeUsername.textContent = data.username;

      //NEW: fetch and display accounts and expenses
      fetchAccounts();
      //NEW: fetch and display expenses
      fetchExpenses();
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
logoutButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
    });
    if (response.ok) {
      //logout successful
      checkAuthStatus();
      authContainer.style.display = "block"; //Show the auth forms
      dashboard.style.display = "none"; //Hide the dashboard
      welcomeUsername.textContent = ""; //clear the username
      loginMessage.textContent = "You have logged out.";
      loginMessage.style.color = "green";
    } else {
      console.error("Logout failed");
    }
  } catch (err) {
    console.error("An error occurred during logout:", err);
  }
});
