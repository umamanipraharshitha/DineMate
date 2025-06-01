const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'],
  methods: ['POST', 'GET','DELETE'],
  credentials: true
}));

require('dotenv').config();

app.use(bodyParser.json());

// MongoDB Atlas connection string (directly in code)
const MONGO_URI = process.env.MONGO_URI;


// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { fullname, email, password, confirm } = req.body;
    if (!fullname || !email || !password || !confirm)
      return res.status(400).json({ msg: 'All fields are required.' });

    if (password !== confirm)
      return res.status(400).json({ msg: 'Passwords do not match.' });

    // Use part of email before @ as username
    const username = email.split('@')[0];

    // Check if email or username exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser)
      return res.status(400).json({ msg: 'Email or username already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ fullname, email, username, password: hashedPassword });
    await user.save();

    res.status(201).json({ msg: 'Registration successful.' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ msg: 'All fields are required.' });

    // Special case: Hardcoded admin credentials
    if (username.toLowerCase() === 'admin' && password === 'admin') {
      return res.status(200).json({ 
        msg: 'Admin login successful.',
        user: { 
          isAdmin: true,
          username: 'admin',
          fullname: 'Administrator'
        }
      });
    }

    // Normal user authentication
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ]
    });
    
    if (!user)
      return res.status(400).json({ msg: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: 'Invalid credentials.' });

    res.status(200).json({ 
      msg: 'Login successful.', 
      user: { 
        isAdmin: false,
        fullname: user.fullname, 
        email: user.email, 
        username: user.username 
      } 
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});
// Booking Schema
const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  guests: { type: Number }
});
const Booking = mongoose.model('Booking', bookingSchema);

// User books a table
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, date, time, guests } = req.body;
    if (!name || !date || !time) {
      return res.status(400).json({ msg: 'Name, date, and time are required.' });
    }
    const booking = new Booking({ name, date, time, guests });
    await booking.save();
    res.status(201).json({ msg: 'Booking successful.', booking });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});

// Admin fetches all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});
// Order Schema
const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  items: [{ menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }, quantity: Number }],
  orderType: { type: String, enum: ['dine-in', 'takeaway'], default: 'dine-in' },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// User places an order
app.post('/api/orders', async (req, res) => {
  try {
    const { name, items, orderType } = req.body;
    if (!name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ msg: 'Name and items are required.' });
    }
    const order = new Order({ name, items, orderType });
    await order.save();
    res.status(201).json({ msg: 'Order placed.', order });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});

// Admin fetches all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('items.menuItem');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});
// Menu Schema
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  photoUrl: String
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Admin adds menu item
app.post('/api/menu', async (req, res) => {
  try {
    const { name, price, photoUrl } = req.body;
    if (!name || !price) {
      return res.status(400).json({ msg: 'Name and price are required.' });
    }
    const menuItem = new MenuItem({ name, price, photoUrl });
    await menuItem.save();
    res.status(201).json({ msg: 'Menu item added.', menuItem });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});

// User fetches menu
app.get('/api/menu', async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    res.json(menuItems);
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});
app.delete('/api/menu/:id', async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Menu item deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error.', error: err.message });
  }
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
