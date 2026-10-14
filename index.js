
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");


dns.setServers([
  '1.1.1.1',
  '8.8.8.8'
])
const app = express();

app.use(cors());
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// --------------------------------------------------
// MongoDB Connection
// --------------------------------------------------

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// --------------------------------------------------
// Booking Schema
// isCompleted is OPTIONAL and defaults to false.
// New bookings do not need to send this field.
// --------------------------------------------------

const bookingSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  bookingDateTime: Date,
  transactionId: { type: String, trim: true },

  formFilingDateTime: {
    type: Number,
    default: Date.now,
  },

  isCompleted: {
    type: Boolean,
    default: false,
  },

  time: {
    type: String,
    trim: true,
  },
});

const Booking = mongoose.model("Booking", bookingSchema);

// --------------------------------------------------
// Password Verification
// Set BOOKING_PASSWORD in your .env file.
// --------------------------------------------------

const BOOKING_PASSWORD =
  process.env.BOOKING_PASSWORD || "secret123";


// --------------------------------------------------
// MongoDB Connection + Detailed Debug Logs
// --------------------------------------------------

let mongoConnectionError = null;
let mongoConnectionPromise = null;

function connectDB() {
  console.log("[DB] connectDB called", {
    timestamp: new Date().toISOString(),
    readyState: mongoose.connection.readyState,
    uriConfigured: Boolean(process.env.MONGODB_URI),
    vercel: Boolean(process.env.VERCEL),
  });

  if (mongoose.connection.readyState === 1) {
    console.log("[DB] Already connected");
    return Promise.resolve(mongoose.connection);
  }

  if (!process.env.MONGODB_URI) {
    const error = new Error("MONGODB_URI is missing");
    mongoConnectionError = error.message;
    console.error("[DB] Configuration error:", error.message);
    return Promise.reject(error);
  }

  if (!mongoConnectionPromise) {
    console.log("[DB] Starting MongoDB connection...");

    mongoConnectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 5,
      })
      .then(() => {
        mongoConnectionError = null;

        console.log("[DB] CONNECTED SUCCESSFULLY", {
          host: mongoose.connection.host,
          database: mongoose.connection.name,
          readyState: mongoose.connection.readyState,
          timestamp: new Date().toISOString(),
        });

        return mongoose.connection;
      })
      .catch((error) => {
        mongoConnectionError = error.message;
        mongoConnectionPromise = null;

        console.error("[DB] CONNECTION FAILED", {
          name: error.name,
          message: error.message,
          code: error.code,
          codeName: error.codeName,
          cause: error.cause
            ? {
                name: error.cause.name,
                message: error.cause.message,
                code: error.cause.code,
              }
            : null,
          readyState: mongoose.connection.readyState,
          timestamp: new Date().toISOString(),
        });

        throw error;
      });
  }

  return mongoConnectionPromise;
}

// Connection lifecycle events
mongoose.connection.on("connected", () => {
  console.log("[DB EVENT] connected");
});

mongoose.connection.on("open", () => {
  console.log("[DB EVENT] open");
});

mongoose.connection.on("disconnected", () => {
  console.error("[DB EVENT] disconnected");
  mongoConnectionPromise = null;
});

mongoose.connection.on("reconnected", () => {
  console.log("[DB EVENT] reconnected");
});

mongoose.connection.on("error", (error) => {
  mongoConnectionError = error.message;

  console.error("[DB EVENT] error", {
    name: error.name,
    message: error.message,
    code: error.code,
  });
});

// Start initial connection without blocking server startup.
connectDB().catch((error) => {
  console.error("[DB STARTUP] Initial connection failed:", error.message);
});


// --------------------------------------------------
// Health Check
// --------------------------------------------------


// --------------------------------------------------
// Detailed Health Check
// --------------------------------------------------

app.get("/health", async (req, res) => {
  const startedAt = Date.now();

  console.log("[HEALTH] Request received", {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    readyState: mongoose.connection.readyState,
  });

  try {
    await connectDB();

    // Test an actual database operation.
    await mongoose.connection.db.admin().ping();

    const result = {
      success: true,
      server: "running",
      database: "connected",
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      databaseName: mongoose.connection.name,
      ping: "successful",
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };

    console.log("[HEALTH] SUCCESS", result);

    return res.status(200).json(result);
  } catch (error) {
    const result = {
      success: false,
      server: "running",
      database: "unavailable",
      readyState: mongoose.connection.readyState,
      error: error.message,
      errorName: error.name,
      errorCode: error.code || null,
      lastConnectionError: mongoConnectionError,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };

    console.error("[HEALTH] FAILED", result);

    return res.status(503).json(result);
  }
});


// --------------------------------------------------
// Verify Booking Password
// --------------------------------------------------

app.post("/api/verify-booking-password", (req, res) => {
  const { password } = req.body || {};

  if (password && password === BOOKING_PASSWORD) {
    return res.json({ success: true });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid password",
  });
});

// --------------------------------------------------
// Create Booking
// New bookings default to Pending.
// --------------------------------------------------


app.post("/bookings", async (req, res) => {
  try {
    const {
      name,
      phone,
      bookingDateTime,
      transactionId,
      time,
    } = req.body || {};

    // Validate transaction ID
    

    const normalizedTransactionId = transactionId.trim();

    // Check whether transaction ID already exists
    const existingBooking = await Booking.findOne({
      transactionId: normalizedTransactionId,
    }).lean();

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message:
          "This transaction ID has already been used for a booking. Please verify your payment details.",
        transactionId: normalizedTransactionId,
      });
    }

    // Create booking only if transaction ID is unique
    const newBooking = new Booking({
      name,
      phone,
      bookingDateTime,
      transactionId: normalizedTransactionId,
      time,
      formFilingDateTime: Date.now(),
      // isCompleted defaults to false
    });

    await newBooking.save();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking: newBooking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking. Please try again.",
      error: error.message,
    });
  }
});


// --------------------------------------------------
// Read All Bookings
// Newest submissions first.
// --------------------------------------------------

app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({
      formFilingDateTime: -1,
      _id: -1,
    });

    return res.json(bookings);
  } catch (error) {
    console.error("Fetch bookings error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --------------------------------------------------
// Read One Booking
// --------------------------------------------------

app.get("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json(booking);
  } catch (error) {
    console.error("Fetch booking error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --------------------------------------------------
// Update Booking
// Supports completion switch and edit popup.
// --------------------------------------------------

app.put("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const allowedFields = [
      "name",
      "phone",
      "bookingDateTime",
      "transactionId",
      "time",
      "isCompleted",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
      ) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        "isCompleted"
      ) &&
      typeof updates.isCompleted !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isCompleted must be true or false",
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Update booking error:", error);

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/* --------------------------------------------------
   BOOKING DELETE ROUTES
   Keep these before DELETE /bookings/:id.
-------------------------------------------------- */

// Delete all bookings
app.delete("/bookings", async (req, res) => {
  try {
    const result = await Booking.deleteMany({});

    return res.status(200).json({
      success: true,
      message: "All bookings deleted successfully",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error("Delete all bookings error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete past bookings
// Example: DELETE /bookings/delete-past/2026-10-11T00%3A00%3A00.000Z
app.delete("/bookings/delete-past/:cutoff", async (req, res) => {
  try {
    const cutoff = new Date(req.params.cutoff);

    if (Number.isNaN(cutoff.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid cutoff date",
      });
    }

    const result = await Booking.deleteMany({
      bookingDateTime: { $lt: cutoff },
    });

    return res.status(200).json({
      success: true,
      message: "Past bookings deleted successfully",
      deletedCount: result.deletedCount || 0,
      cutoff: cutoff.toISOString(),
    });
  } catch (error) {
    console.error("Delete past bookings error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete one booking
app.delete("/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json({
      success: true,
      message: "Booking deleted successfully",
      bookingId: id,
    });
  } catch (error) {
    console.error("Delete booking error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


/* --------------------------------------------------
   SAREE SECTION
-------------------------------------------------- */

const sareeSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String,
  date: {
    type: Date,
    default: Date.now,
  },
  sell: {
    type: Boolean,
    default: false,
  },
});

const Saree = mongoose.model("Saree", sareeSchema);

// Create a new saree
app.post("/sarees", async (req, res) => {
  try {
    const newSaree = new Saree({
      ...req.body,
      sell: false,
    });

    await newSaree.save();

    return res.status(201).json(newSaree);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
});

// Get all sarees
app.get("/sarees", async (req, res) => {
  try {
    const sarees = await Saree.find();
    return res.json(sarees);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Get one saree
app.get("/sarees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid saree ID",
      });
    }

    const saree = await Saree.findById(id);

    if (!saree) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json(saree);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Update a saree
app.put("/sarees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid saree ID",
      });
    }

    const updatedSaree = await Saree.findByIdAndUpdate(
      id,
      { $set: req.body },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedSaree) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json(updatedSaree);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
});

// Delete a saree
app.delete("/sarees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid saree ID",
      });
    }

    const deletedSaree = await Saree.findByIdAndDelete(id);

    if (!deletedSaree) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json({
      message: "Saree deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});


/* --------------------------------------------------
   BUYER API
-------------------------------------------------- */

const buyerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  transactionId: String,

  sareeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Saree",
  },

  address: String,

  time: {
    type: Date,
    default: Date.now,
  },
});

const Buyer = mongoose.model("Buyer", buyerSchema);

// Create buyer
app.post("/buyers", async (req, res) => {
  try {
    const newBuyer = new Buyer(req.body);

    await newBuyer.save();

    return res.status(201).json(newBuyer);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
});

// Get all buyers
app.get("/buyers", async (req, res) => {
  try {
    const buyers = await Buyer.find().populate("sareeId");
    return res.json(buyers);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Get one buyer
app.get("/buyers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid buyer ID",
      });
    }

    const buyer = await Buyer.findById(id).populate("sareeId");

    if (!buyer) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json(buyer);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Update buyer
app.put("/buyers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid buyer ID",
      });
    }

    const updatedBuyer = await Buyer.findByIdAndUpdate(
      id,
      { $set: req.body },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedBuyer) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json(updatedBuyer);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
});

// Delete buyer
app.delete("/buyers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid buyer ID",
      });
    }

    const deletedBuyer = await Buyer.findByIdAndDelete(id);

    if (!deletedBuyer) {
      return res.status(404).json({
        message: "Not Found",
      });
    }

    return res.json({
      message: "Buyer deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});


/* --------------------------------------------------
   START SERVER
-------------------------------------------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
