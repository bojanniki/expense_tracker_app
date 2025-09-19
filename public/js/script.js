//DOM elements for forms and messages
const registrationForm = document.getElementById("registration-form");
const loginForm = document.getElementById("login-form");
const regMessage = document.getElementById("reg-message");
const loginMessage = document.getElementById("login-message");
const addCategoryForm = document.getElementById("add-category-form");
const filterByCategory = document.getElementById("filter-by-category");
const filterByMonth = document.getElementById("filter-by-month");
const expensesList = document.getElementById("expenses-list");

//elements for the dashboard
const authContainer = document.getElementById("auth-container");
const dashboard = document.getElementById("dashboard");
const welcomeUsername = document.getElementById("welcome-username");
const logoutButton = document.getElementById("logout-button");

//elements for the accounts and expenses
const accountsList = document.getElementById("accounts-list");
const addAccountForm = document.getElementById("add-account-form");
const expenseAccountSelect = document.getElementById("expense-account-id");
const addExpenseForm = document.getElementById("add-expense-form");
const addExpenseButton = addExpenseForm.querySelector('button[type="submit"]');
const categoriesList = document.getElementById("expense-category-id");

//a global variable to track the expense being edited
let editingExpenseId = null;
let categoriesMap = new Map();

//function to check authentication status on page load
const checkAuthStatus = async () => {
  try {
    const response = await fetch("/api/profile");
    if (response.ok) {
      const data = await response.json();
      authContainer.style.display = "none";
      dashboard.style.display = "block";
      welcomeUsername.textContent = data.username;

      // CRITICAL FIX: Await fetching categories first on page load
      await fetchCategories();

      // Then fetch accounts and expenses
      fetchAccounts();
      fetchExpenses();
    } else {
      authContainer.style.display = "block";
      dashboard.style.display = "none";
    }
  } catch (err) {
    console.error("Error checking auth status:", err);
    authContainer.style.display = "block";
    dashboard.style.display = "none";
  }
};

//function to fetch and display accounts
const fetchAccounts = async () => {
  try {
    const response = await fetch("/api/accounts");
    if (response.ok) {
      const accounts = await response.json();
      accountsList.innerHTML = "";
      expenseAccountSelect.innerHTML = "";
      accounts.forEach((account) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${account.account_name}</span>
          <span>$${account.balance.toFixed(2)}</span>
        `;
        accountsList.appendChild(li);

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

//function to fetch categories
const fetchCategories = async () => {
  try {
    const response = await fetch("/api/categories");
    if (response.ok) {
      const categories = await response.json();
      filterByCategory.innerHTML = '<option value="">All Categories</option>';
      categoriesList.innerHTML = "";
      categoriesMap.clear();

      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categoriesList.appendChild(option);
        categoriesMap.set(category.id, category.name);

        const filterOption = document.createElement("option");
        filterOption.value = category.id;
        filterOption.textContent = category.name;
        filterByCategory.appendChild(filterOption);
      });
    }
  } catch (err) {
    console.error("Failed to fetch categories:", err);
  }
};

//function to fetch and display expenses
const fetchExpenses = async () => {
  try {
    // Check if categories are loaded; if not, load them first
    if (categoriesMap.size === 0) {
      console.log(
        "Categories map is empty, fetching categories before expenses."
      );
      await fetchCategories();
    }

    const categoryId = filterByCategory.value;
    const month = filterByMonth.value;
    let url = `/api/expenses`;

    const params = new URLSearchParams();
    if (categoryId) {
      params.append("category", categoryId);
    }
    if (month) {
      const currentYear = new Date().getFullYear();
      const formattedMonth = `${currentYear}-${month}`;
      params.append("month", formattedMonth);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const expenses = await response.json();
      expensesList.innerHTML = "";
      if (expenses.length === 0) {
        expensesList.innerHTML = "<p>No expenses found.</p>";
      } else {
        expenses.forEach((expense) => {
          const li = document.createElement("li");
          const categoryName =
            categoriesMap.get(expense.category_id) || "Uncategorized";
          const amountClass =
            expense.transaction_type === "income"
              ? "income-amount"
              : "expense-amount";
          const sign = expense.transaction_type === "income" ? "+" : "-";

          li.dataset.accountId = expense.account_id;
          li.dataset.categoryId = expense.category_id;

          li.innerHTML = `
            <span class="expense-description">${expense.description}</span>
            <span class="expense-category">${categoryName}</span>
            <span class="${amountClass}">${sign}$${expense.amount.toFixed(
            2
          )}</span>
            <span class="expense-date">${new Date(
              expense.date
            ).toLocaleDateString()}</span>
            <button class="edit-button" data-id="${expense.id}">Edit</button>
            <button class="delete-button" data-id="${
              expense.id
            }">Delete</button>
          `;
          expensesList.appendChild(li);
        });
      }
    } else {
      if (response.status === 401) {
        authContainer.style.display = "block";
        dashboard.style.display = "none";
        loginMessage.textContent =
          "Your session has expired. Please log in again.";
      }
      throw new Error("Failed to fetch expenses.");
    }
  } catch (err) {
    console.error("Error fetching expenses:", err);
    expensesList.innerHTML = "<p>Error loading expenses. Please try again.</p>";
  }
};

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
      regMessage.textContent = "Registration successful! You can now login";
      registrationForm.reset();
    } else {
      regMessage.style.color = "red";
      regMessage.textContent = message;
    }
  } catch (err) {
    console.error(err);
    regMessage.style.color = "red";
    regMessage.textContent = "An error occurred. Please try again.";
  }
});

//event listener for login form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      loginMessage.textContent = "";
      checkAuthStatus();
    } else {
      const message = await response.text();
      loginMessage.style.color = "red";
      loginMessage.textContent = message;
    }
  } catch (err) {
    console.error(err);
    loginMessage.style.color = "red";
    loginMessage.textContent = "An error occurred. Please try again.";
  }
});

//event listener for the log out button
logoutButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
    });
    if (response.ok) {
      checkAuthStatus();
      authContainer.style.display = "block";
      dashboard.style.display = "none";
      welcomeUsername.textContent = "";
      loginMessage.textContent = "You have logged out.";
      loginMessage.style.color = "green";
    } else {
      console.error("Logout failed");
    }
  } catch (err) {
    console.error("An error occurred during logout:", err);
  }
});

//event listener for the "add account" form
addAccountForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const accountName = document.getElementById("account-name").value;
  const initialBalance = document.getElementById("account-balance").value;

  try {
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_name: accountName,
        balance: initialBalance,
      }),
    });

    if (response.ok) {
      fetchAccounts();
      addAccountForm.reset();
    } else {
      const message = await response.text();
      console.error("Failed to add account:", message);
      alert(`Failed to add account: ${message}`);
    }
  } catch (err) {
    console.error("An error occurred while adding account:", err);
    alert("An error occurred while adding account.");
  }
});

//event listener for the add/update expense form
addExpenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const type = document.getElementById("transaction-type").value;
  const description = document.getElementById("expense-description").value;
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const date = document.getElementById("expense-date").value;
  const accountId = document.getElementById("expense-account-id").value;
  const categoryId = document.getElementById("expense-category-id").value;

  if (
    !type ||
    !description ||
    isNaN(amount) ||
    !date ||
    !accountId ||
    !categoryId
  ) {
    alert("Please fill out all fields!");
    return;
  }

  const expenseData = {
    type,
    description,
    amount,
    date,
    account_id: accountId,
    category_id: categoryId,
  };

  try {
    let response;
    if (editingExpenseId) {
      response = await fetch(`/api/expenses/${editingExpenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });
    } else {
      response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });
    }
    if (response.ok) {
      alert(
        `Transaction ${editingExpenseId ? "updated" : "added"} successfully`
      );
      addExpenseForm.reset();
      editingExpenseId = null;
      addExpenseButton.textContent = "Add Transaction";
      fetchAccounts();
      fetchExpenses(); // The fetchExpenses function will now handle fetching categories itself if needed
    } else {
      const message = await response.text();
      console.error("Failed to save transaction:", message);
      alert(`Error: ${message}`);
    }
  } catch (err) {
    console.error("An error occurred while saving transaction", err);
    alert("An error occurred. Please check the console for details.");
  }
});

//event listener for delete and edit buttons using event delegation
expensesList.addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-button")) {
    const expenseId = e.target.dataset.id;
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchExpenses();
        fetchAccounts();
      } else {
        console.error("Failed to delete expense");
      }
    } catch (err) {
      console.error("An error occurred during deletion", err);
    }
  }

  if (e.target.classList.contains("edit-button")) {
    const expenseId = e.target.dataset.id;
    try {
      const response = await fetch(`/api/expenses?id=${expenseId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch expense details for editing.");
      }
      const expenses = await response.json();
      const expenseToEdit = expenses.find((exp) => exp.id == expenseId);

      if (expenseToEdit) {
        document.getElementById("transaction-type").value =
          expenseToEdit.transaction_type;
        document.getElementById("expense-description").value =
          expenseToEdit.description;
        document.getElementById("expense-amount").value = expenseToEdit.amount;
        document.getElementById("expense-date").value =
          expenseToEdit.date.substring(0, 10);
        document.getElementById("expense-account-id").value =
          expenseToEdit.account_id;
        document.getElementById("expense-category-id").value =
          expenseToEdit.category_id;

        editingExpenseId = expenseId;
        addExpenseButton.textContent = "Update Expense";
        addExpenseForm.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      console.error("An error occurred while getting expense data:", err);
    }
  }
});

//event listener for the add category form
addCategoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const categoryNameInput = document.getElementById("category-name");
  const name = categoryNameInput.value;
  try {
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      alert("Category added successfully!");
      categoryNameInput.value = "";
      fetchCategories();
    } else {
      const error = await response.text();
      alert(`Error adding category: ${error}`);
    }
  } catch (err) {
    console.error("An error occurred while adding category:", err);
  }
});

//add event listeners to the new filter elements
filterByCategory.addEventListener("change", fetchExpenses);
filterByMonth.addEventListener("change", fetchExpenses);

//call the function on page load
checkAuthStatus();
