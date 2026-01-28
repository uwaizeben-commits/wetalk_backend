import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
    origin: '*', // Allow all for debugging, we can restrict later
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log('Body:', req.body);
    next();
});

// In-memory user store (replace with MongoDB later)
const users = [];
const otps = {}; // Store OTPs by phone number: { phone: code }

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for debugging
        methods: ["GET", "POST"]
    }
});

// Auth Routes
app.post('/request-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    // Check if phone already in use
    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Generate a mock 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps[phone] = otp;

    console.log(`[OTP] Generated for ${phone}: ${otp}`);
    res.json({ message: 'OTP sent successfully (Simulated)', otp: otp }); // In real app, don't return otp
});

app.post('/register', (req, res) => {
    const { firstName, lastname, username, phone, password, otp } = req.body;

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already exists' });
    }

    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ message: 'Phone number already exists' });
    }

    // Verify OTP
    if (!otps[phone] || otps[phone] !== otp) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const newUser = { id: Date.now(), firstName, lastname, username, phone, password };
    users.push(newUser);
    delete otps[phone]; // Clear OTP after use

    res.status(201).json({ user: { username: newUser.username, firstName: newUser.firstName } });
});

app.get('/users/search', (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: 'Search query required' });

    const q = query.toLowerCase();
    const foundUsers = users.filter(u => {
        const username = (u.username || '').toLowerCase();
        const phone = u.phone || '';
        const firstName = (u.firstName || '').toLowerCase();
        const lastname = (u.lastname || '').toLowerCase();

        return username.includes(q) ||
            phone.includes(query) ||
            firstName.includes(q) ||
            lastname.includes(q);
    }).map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastname: u.lastname,
        phone: u.phone,
        avatar: (u.firstName?.[0] || '') + (u.lastname?.[0] || '') || '?'
    }));

    res.json(foundUsers);
});

app.get('/users', (req, res) => {
    res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastname: u.lastname,
        avatar: (u.firstName?.[0] || '') + (u.lastname?.[0] || '') || '?'
    })));
});

app.post('/account/delete', (req, res) => {
    const { username } = req.body;
    const index = users.findIndex(u => u.username === username);
    if (index !== -1) {
        users.splice(index, 1);
        return res.json({ message: 'Account deleted successfully. Phone number is now available for registration.' });
    }
    res.status(404).json({ message: 'User not found' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({ user: { username: user.username, firstName: user.firstName } });
});

// Recovery Routes
app.post('/recovery/request-otp', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);

    if (!user) {
        return res.status(404).json({ message: 'No account found with this phone number' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otps[phone] = otp;

    console.log(`[RECOVERY OTP] Generated for ${phone}: ${otp}`);
    res.json({ message: 'Recovery OTP sent', otp }); // Demo: return OTP
});

app.post('/recovery/verify', (req, res) => {
    const { phone, otp } = req.body;

    if (otps[phone] && otps[phone] === otp) {
        const user = users.find(u => u.phone === phone);
        return res.json({
            message: 'OTP Verified',
            username: user.username,
            token: `reset-token-${Date.now()}` // Mock token for reset
        });
    }

    res.status(400).json({ message: 'Invalid or expired OTP' });
});

app.post('/recovery/reset-password', (req, res) => {
    const { phone, otp, newPassword } = req.body;

    if (otps[phone] && otps[phone] === otp) {
        const user = users.find(u => u.phone === phone);
        if (user) {
            user.password = newPassword;
            delete otps[phone];
            return res.json({ message: 'Password reset successful. Please login with your new password.' });
        }
    }

    res.status(400).json({ message: 'Session expired or invalid' });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('send_message', (data) => {
        console.log('Message received:', data);
        // Broadcast message to all connected clients
        io.emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
