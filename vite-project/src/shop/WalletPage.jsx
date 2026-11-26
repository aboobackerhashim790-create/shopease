import { useEffect, useState } from "react";
import API, { isSuccess } from "../api/client.js";
import "./WalletPage.css";

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      try {
        const response = await API.get("/profile/wallet");
        if (!isSuccess(response)) {
          throw new Error(response.data?.message || "Could not load your wallet.");
        }
        if (active) {
          setBalance(response.data.balance || 0);
          setTransactions(response.data.transactions || []);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Could not load your wallet.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWallet();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="wallet-page">
      <header className="wallet-page__header">
        <p className="wallet-eyebrow">YOUR ACCOUNT</p>
        <h1>ShopEase Wallet</h1>
        <p>View your wallet balance and refunds from cancelled paid orders.</p>
      </header>

      <section className="wallet-balance-card" aria-label="Wallet balance">
        <div>
          <span>Available wallet balance</span>
          <strong>{loading ? "Loading…" : formatMoney(balance)}</strong>
        </div>
        <span className="wallet-balance-card__icon" aria-hidden="true">
          ₹
        </span>
      </section>

      {error && (
        <p className="wallet-message wallet-message--error" role="alert">
          {error}
        </p>
      )}

      <section className="wallet-transactions">
        <div className="wallet-transactions__heading">
          <div>
            <h2>Wallet activity</h2>
            <p>Credits and debits are listed here in date order.</p>
          </div>
          <span>
            {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <p className="wallet-message">Loading wallet activity…</p>
        ) : transactions.length === 0 ? (
          <div className="wallet-empty">
            <h3>No wallet activity yet</h3>
            <p>Refunds credited to your ShopEase Wallet will appear here.</p>
          </div>
        ) : (
          <ul className="wallet-transaction-list">
            {transactions.map((transaction) => (
              <li className="wallet-transaction" key={transaction._id}>
                <span
                  className={`wallet-transaction__symbol wallet-transaction__symbol--${transaction.type.toLowerCase()}`}
                  aria-hidden="true"
                >
                  {transaction.type === "Credit" ? "+" : "−"}
                </span>
                <div className="wallet-transaction__details">
                  <strong>{transaction.description}</strong>
                  <span>{formatDate(transaction.createdAt)}</span>
                </div>
                <strong
                  className={`wallet-transaction__amount wallet-transaction__amount--${transaction.type.toLowerCase()}`}
                >
                  {transaction.type === "Credit" ? "+" : "−"}
                  {formatMoney(transaction.amount)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="wallet-footnote">
        ShopEase Wallet refunds are stored as wallet credit. Cash on Delivery cancellations do not
        add credit because payment was not collected.
      </p>
    </main>
  );
}

export default WalletPage;
