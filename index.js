require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const bookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  bookingDateTime: Date,
  transactionId: String,
  formFilingDateTime: Number,
});

const Booking = mongoose.model("Booking", bookingSchema);

// Create
app.post("/bookings", async (req, res) => {
  try {
    // const newBooking = new Booking(req.body);
    const newBooking = new Booking({
      name: req.body.name,
      phone: req.body.phone,
      bookingDateTime: req.body.bookingDateTime,
      transactionId: req.body.transactionId,
      formFilingDateTime: Date.now(),
    });
    // const newBooking = req.body;
    newBooking.formFilingDateTime = Date.now();
    await newBooking.save();
    // console.log("BOOKED");
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Read All
app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read One
app.get("/bookings/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Not Found" });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update
app.put("/bookings/:id", async (req, res) => {
  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedBooking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete
app.delete("/bookings/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//--------SAREE SECTION----------

const sareeSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String,
  date: { type: Date, default: Date.now },
  sell: Boolean,
});

const Saree = mongoose.model("Saree", sareeSchema);

const buyerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  transactionId: String,
  sareeId: { type: mongoose.Schema.Types.ObjectId, ref: "Saree" },
  address: String,
  time: { type: Date, default: Date.now },
});
const Buyer = mongoose.model("Buyer", buyerSchema);
// Create a new saree
app.post("/sarees", async (req, res) => {
  try {
    const newSaree = new Saree(req.body);
    req.body.sell = false;
    console.log(req.body);
    await newSaree.save();
    res.status(201).json(newSaree);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all sarees
app.get("/sarees", async (req, res) => {
  try {
    const sarees = await Saree.find();
    res.json(sarees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single saree by ID
app.get("/sarees/:id", async (req, res) => {
  try {
    const saree = await Saree.findById(req.params.id);
    if (!saree) return res.status(404).json({ message: "Not Found" });
    res.json(saree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a saree
app.put("/sarees/:id", async (req, res) => {
  try {
    const updatedSaree = await Saree.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    console.log(req.body);
    res.json(updatedSaree);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a saree
app.delete("/sarees/:id", async (req, res) => {
  try {
    await Saree.findByIdAndDelete(req.params.id);
    res.json({ message: "Saree deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//------buyer api ---------

app.post("/buyers", async (req, res) => {
  try {
    const newBuyer = new Buyer(req.body);
    console.log(req.body);
    await newBuyer.save();
    res.status(201).json(newBuyer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all buyers
app.get("/buyers", async (req, res) => {
  try {
    const buyers = await Buyer.find().populate("sareeId");
    res.json(buyers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single buyer by ID
app.get("/buyers/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id).populate("sareeId");
    if (!buyer) return res.status(404).json({ message: "Not Found" });
    res.json(buyer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update buyer details
app.put("/buyers/:id", async (req, res) => {
  try {
    const updatedBuyer = await Buyer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedBuyer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a buyer
app.delete("/buyers/:id", async (req, res) => {
  try {
    await Buyer.findByIdAndDelete(req.params.id);
    res.json({ message: "Buyer deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
