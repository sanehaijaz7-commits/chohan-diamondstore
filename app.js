let selectedPackage = "100";

document.getElementById("year").textContent =
  new Date().getFullYear();

document.querySelectorAll(".package").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".package").forEach(x =>
      x.classList.remove("selected")
    );

    button.classList.add("selected");
    selectedPackage = button.dataset.package;
  });
});

const orderForm = document.getElementById("orderForm");
const notice = document.getElementById("notice");

orderForm.addEventListener("submit", async event => {
  event.preventDefault();

  const uid = document.getElementById("uid").value.trim();

  notice.textContent = "Creating your order...";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uid,
        packageId: selectedPackage
      })
    });

    const data = await response.json();

    if (!response.ok) {
      notice.textContent = data.error || "Order failed.";
      return;
    }

    notice.textContent = "Order created successfully!";

    showPayment(data);

  } catch (error) {
    notice.textContent =
      "Could not connect. Please try again.";
  }
});

function showPayment(order) {

  let paymentBox = document.getElementById("paymentBox");

  if (!paymentBox) {
    paymentBox = document.createElement("section");
    paymentBox.id = "paymentBox";
    paymentBox.className = "panel";

    orderForm.parentElement.after(paymentBox);
  }

  paymentBox.replaceChildren();

  function addText(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    paymentBox.appendChild(element);
    return element;
  }

  addText("h2", "JazzCash Payment");

  addText("p", "Your Order ID: " + order.orderId);

  addText("p", "Amount: Rs. " + order.amount);

  addText("p", "Account Name: " +
    order.payment.accountName);

  addText("p", "JazzCash Number: " +
    order.payment.accountNumber);

  addText("p",
    "Send the exact amount to this JazzCash account.");

  addText("p",
    "After payment, enter your Transaction ID below.");

  const transactionForm = document.createElement("form");

  const label = document.createElement("label");
  label.textContent = "JazzCash Transaction ID";

  const input = document.createElement("input");
  input.type = "text";
  input.required = true;
  input.minLength = 6;
  input.maxLength = 40;
  input.placeholder = "Enter Transaction ID";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "gold-btn";
  submitButton.textContent = "SUBMIT PAYMENT";

  const result = document.createElement("p");
  result.setAttribute("role", "status");

  transactionForm.appendChild(label);
  transactionForm.appendChild(input);
  transactionForm.appendChild(submitButton);
  transactionForm.appendChild(result);

  paymentBox.appendChild(transactionForm);

  transactionForm.addEventListener("submit", async event => {

    event.preventDefault();

    const reference = input.value.trim();

    result.textContent = "Submitting transaction ID...";

    submitButton.disabled = true;

    try {

      const response = await fetch("/api/payment/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId: order.orderId,
          reference: reference
        })
      });

      const data = await response.json();

      if (!response.ok) {
        result.textContent =
          data.error || "Submission failed.";

        submitButton.disabled = false;
        return;
      }

      result.textContent =
        "Transaction ID submitted! Payment verification is pending.";

      input.disabled = true;

    } catch (error) {

      result.textContent =
        "Connection failed. Please try again.";

      submitButton.disabled = false;
    }

  });

  paymentBox.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}