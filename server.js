require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("store.db");
const PORT = process.env.PORT || 3000;

// Payment account details .env file se aayengi
const JAZZCASH_NUMBER = process.env.JAZZCASH_NUMBER || "";
const JAZZCASH_NAME = process.env.JAZZCASH_NAME || "";

// Database table
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_uid TEXT NOT NULL,
    package_name TEXT NOT NULL,
    amount_pkr INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    payment_reference TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Security settings
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(express.json({
    limit: "20kb"
}));

app.use(session({
    name: "chohan.sid",
    secret: process.env.SESSION_SECRET || "development-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 1000
    }
}));

app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100
}));

// Website files
app.use(express.static(path.join(__dirname, "public")));

// Diamond packages
const packages = {
    "100": {
        name: "100 Diamonds",
        price: 100
    },
    "310": {
        name: "310 Diamonds",
        price: 310
    },
    "520": {
        name: "520 Diamonds",
        price: 520
    }
};

// Admin protection
function requireAdmin(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }

    return res.status(401).json({
        error: "Admin login required."
    });
}

// Get packages
app.get("/api/packages", (req, res) => {
    res.json(packages);
});

// Get JazzCash details
app.get("/api/payment/details", (req, res) => {
    res.json({
        method: "JazzCash",
        accountNumber: JAZZCASH_NUMBER,
        accountName: JAZZCASH_NAME
    });
});

// Create order
app.post("/api/orders", (req, res) => {
    const uid = String(req.body.uid || "").trim();
    const packageId = String(req.body.packageId || "");

    const item = packages[packageId];

    if (!/^[0-9]{5,20}$/.test(uid)) {
        return res.status(400).json({
            error: "Enter a valid player UID."
        });
    }

    if (!item) {
        return res.status(400).json({
            error: "Invalid package."
        });
    }

    const result = db.prepare(`
        INSERT INTO orders
        (player_uid, package_name, amount_pkr)
        VALUES (?, ?, ?)
    `).run(uid, item.name, item.price);

    res.status(201).json({
        orderId: result.lastInsertRowid,
        amount: item.price,
        status: "awaiting_payment",
        payment: {
            method: "JazzCash",
            accountNumber: JAZZCASH_NUMBER,
            accountName: JAZZCASH_NAME
        },
        message: "Order created. Submit transaction ID after payment."
    });
});

// Submit transaction ID
app.post("/api/payment/submit", (req, res) => {
    const orderId = Number(req.body.orderId);
    const reference = String(req.body.reference || "").trim();

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
            error: "Invalid order ID."
        });
    }

    if (!/^[A-Za-z0-9-]{6,40}$/.test(reference)) {
        return res.status(400).json({
            error: "Enter a valid transaction ID."
        });
    }

    const order = db.prepare(
        "SELECT * FROM orders WHERE id = ?"
    ).get(orderId);

    if (!order) {
        return res.status(404).json({
            error: "Order not found."
        });
    }

    if (order.status !== "awaiting_payment") {
        return res.status(400).json({
            error: "This order cannot accept another payment reference."
        });
    }

    const existing = db.prepare(
        "SELECT id FROM orders WHERE payment_reference = ?"
    ).get(reference);

    if (existing) {
        return res.status(400).json({
            error: "This transaction ID has already been submitted."
        });
    }

    db.prepare(`
        UPDATE orders
        SET payment_reference = ?
        WHERE id = ?
    `).run(reference, orderId);

    res.json({
        ok: true,
        message: "Transaction ID submitted. Admin will verify payment."
    });
});

// Admin login
app.post("/api/admin/login", async (req, res) => {
    const username = String(req.body.username || "");
    const password = String(req.body.password || "");

    const expectedUser = process.env.ADMIN_USERNAME || "";
    const expectedHash = process.env.ADMIN_PASSWORD || "";

    if (!expectedUser || !expectedHash || username !== expectedUser) {
        return res.status(401).json({
            error: "Invalid admin credentials."
        });
    }

    const passwordMatch = await bcrypt.compare(
        password,
        expectedHash
    );

    if (!passwordMatch) {
        return res.status(401).json({
            error: "Invalid admin credentials."
        });
    }

    req.session.admin = true;

    res.json({
        ok: true
    });
});
 
    
    

    
    

    
        
        
        
      
    
      
            
        
    

  

    
      
  
;

// Admin logout
app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            ok: true
        });
    });
});

// Get admin orders
app.get("/api/admin/orders", requireAdmin, (req, res) => {
    const rows = db.prepare(
        "SELECT * FROM orders ORDER BY id DESC LIMIT 200"
    ).all();

    res.json(rows);
});

// Update order status
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
    const orderId = Number(req.params.id);
    const status = String(req.body.status || "");

    const allowed = [
        "awaiting_payment",
        "paid",
        "processing",
        "completed",
        "rejected"
    ];

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
            error: "Invalid order ID."
        });
    }

    if (!allowed.includes(status)) {
        return res.status(400).json({
            error: "Invalid order status."
        });
    }

    const order = db.prepare(
        "SELECT * FROM orders WHERE id = ?"
    ).get(orderId);

    if (!order) {
        return res.status(404).json({
            error: "Order not found."
        });
    }

    if (
        ["paid", "processing", "completed"].includes(status) &&
        !order.payment_reference
    ) {
        return res.status(400).json({
            error: "Customer has not submitted a transaction ID."
        });
    }

    db.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
    ).run(status, orderId);

    res.json({
        ok: true,
        message: "Order status updated."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(
        `Chohan Diamond Store running at http://localhost:${PORT}`
    );
});