import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Message from './models/Message.js';
import Post from './models/Post.js';
import Call from './models/Call.js';
import Group from './models/Group.js';

dotenv.config();

const app = express();
app.use(cors({
    origin: '*', // Allow all for debugging, we can restrict later
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetalk';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log('Body:', req.body);
    next();
});

// OTP Store
const otps = {};

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for debugging
        methods: ["GET", "POST"]
    }
});

// Auth Routes
app.post('/request-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ message: 'Phone number is required' });

        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otps[phone] = otp;

        console.log(`\n-----------------------------------`);
        console.log(`[OTP] Sent to ${phone}: ${otp}`);
        console.log(`-----------------------------------\n`);

        res.json({ message: 'OTP sent successfully (Simulated)' }); // No OTP in response
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { firstName, lastname, username, phone, password, otp } = req.body;

        if (!otps[phone] || otps[phone] !== otp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const newUser = new User({ firstName, lastname, username, phone, password });
        await newUser.save();

        delete otps[phone];

        res.status(201).json({ user: { id: newUser._id, username: newUser.username, firstName: newUser.firstName } });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const userObj = user.toObject();
        userObj.id = user._id; // Normalize ID for frontend
        res.json({ user: userObj });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Settings & Profile Update
app.put('/users/:userId/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: { settings } },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/users/:userId/profile', async (req, res) => {
    try {
        const { firstName, lastname, username, bio, email, avatar } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { firstName, lastname, username, bio, email, avatar },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/users/:userId/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.params.userId);
        if (user.password !== currentPassword) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }
        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Storage Management
app.delete('/messages/clear/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        await Message.deleteMany({
            $or: [{ sender: userId }, { receiver: userId }]
        });
        res.json({ message: 'All chats cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Feed / Posts
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/posts', async (req, res) => {
    try {
        const { userId, username, content, mediaUrl, mediaType } = req.body;
        const newPost = new Post({ userId, username, content, mediaUrl, mediaType });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/posts/:id/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const index = post.likes.indexOf(userId);
        if (index === -1) {
            post.likes.push(userId);
        } else {
            post.likes.splice(index, 1);
        }
        await post.save();
        res.json({ likes: post.likes.length, isLiked: index === -1 });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/posts/:id/comment', async (req, res) => {
    try {
        const { userId, username, text } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        post.comments.push({ userId, username, text, replies: [] });
        await post.save();
        res.json(post.comments[post.comments.length - 1]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/posts/:id/comment/:commentId/reply', async (req, res) => {
    try {
        const { userId, username, text } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        comment.replies.push({ userId, username, text });
        await post.save();
        res.json(comment.replies[comment.replies.length - 1]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// User Search
app.get('/users/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ message: 'Search query required' });

        const q = query.toLowerCase();
        const foundUsers = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } },
                { firstName: { $regex: q, $options: 'i' } },
                { lastname: { $regex: q, $options: 'i' } }
            ]
        }).limit(20);

        const results = foundUsers.map(u => ({
            id: u._id,
            username: u.username,
            firstName: u.firstName,
            lastname: u.lastname,
            phone: u.phone,
            avatar: (u.firstName?.[0] || '') + (u.lastname?.[0] || '') || '?'
        }));

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Contacts Management
app.get('/contacts/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('contacts');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const contactsList = await Promise.all(user.contacts.map(async (c) => {
            const lastMsg = await Message.findOne({
                $or: [
                    { sender: user._id, receiver: c._id },
                    { sender: c._id, receiver: user._id }
                ]
            }).sort({ timestamp: -1 });

            // Check if archived or starred
            const isArchived = user.archivedChats?.includes(c._id.toString());
            const isStarred = user.starredChats?.includes(c._id.toString());

            return {
                id: c._id,
                name: `${c.firstName} ${c.lastname}`,
                username: c.username,
                avatar: (c.firstName?.[0] || '') + (c.lastname?.[0] || '') || '?',
                lastMessage: lastMsg ? lastMsg.text : 'No messages yet',
                time: lastMsg ? lastMsg.time : '',
                isArchived,
                isStarred
            };
        }));

        res.json(contactsList);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/contacts/add', async (req, res) => {
    try {
        const { userId, contactId } = req.body;
        const user = await User.findById(userId);
        if (!user.contacts.includes(contactId)) {
            user.contacts.push(contactId);
            await user.save();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Blocking System
app.post('/users/:userId/block', async (req, res) => {
    try {
        const { contactId } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user.blocked.includes(contactId)) {
            user.blocked.push(contactId);
            await user.save();
        }
        res.json({ message: 'User blocked', blocked: user.blocked });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/users/:userId/unblock', async (req, res) => {
    try {
        const { contactId } = req.body;
        const user = await User.findById(req.params.userId);
        user.blocked = user.blocked.filter(id => id.toString() !== contactId);
        await user.save();
        res.json({ message: 'User unblocked', blocked: user.blocked });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/users/:userId/blocked', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('blocked', 'firstName lastname username');
        res.json(user.blocked);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Call History Routes
app.get('/calls/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const calls = await Call.find({
            $or: [{ caller: userId }, { receiver: userId }]
        })
            .populate('caller', 'firstName lastname username avatar')
            .populate('receiver', 'firstName lastname username avatar')
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(calls);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/calls', async (req, res) => {
    try {
        const { caller, receiver, type, status, duration } = req.body;
        const newCall = new Call({ caller, receiver, type, status, duration });
        await newCall.save();
        res.status(201).json(newCall);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Message History
app.get('/messages/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: userId1, receiver: userId2 },
                { sender: userId2, receiver: userId1 }
            ]
        }).sort({ timestamp: 1 });

        // Filter out messages if blocked (optional, typically we just stop fetching new ones or sending)
        // For now, allow viewing history even if blocked, but prevent new ones.

        res.json(messages.map(m => ({
            sender: m.sender.toString() === userId1 ? 'me' : 'other',
            text: m.text,
            time: m.time
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined room`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { senderId, receiverId, groupId, text, time } = data;
            const newMessage = new Message({
                sender: senderId,
                receiver: receiverId,
                groupId,
                text,
                time
            });
            await newMessage.save();

            if (groupId) {
                // Emit to group room
                socket.to(groupId).emit('receive_message', {
                    senderId,
                    text,
                    time,
                    groupId
                });
            } else {
                // Emit to receiver's room
                io.to(receiverId).emit('receive_message', {
                    sender: 'other',
                    text,
                    time,
                    senderId
                });
            }
        } catch (error) {
            console.error('Socket message error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});


// === Chat Organization Routes ===

app.post('/users/:userId/chat/:chatId/archive', async (req, res) => {
    try {
        const { userId, chatId } = req.params;
        const user = await User.findById(userId);

        const isArchived = user.archivedChats.includes(chatId);
        if (isArchived) {
            user.archivedChats = user.archivedChats.filter(id => id !== chatId);
        } else {
            user.archivedChats.push(chatId);
        }

        await user.save();
        res.json({ archived: !isArchived, archivedChats: user.archivedChats });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling archive', error: error.message });
    }
});

app.post('/users/:userId/chat/:chatId/star', async (req, res) => {
    try {
        const { userId, chatId } = req.params;
        const user = await User.findById(userId);

        const isStarred = user.starredChats.includes(chatId);
        if (isStarred) {
            user.starredChats = user.starredChats.filter(id => id !== chatId);
        } else {
            user.starredChats.push(chatId);
        }

        await user.save();
        res.json({ starred: !isStarred, starredChats: user.starredChats });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling star', error: error.message });
    }
});

// === Group Management Routes ===
app.post('/groups', async (req, res) => {
    try {
        const { name, description, icon, admins, members, isPublic } = req.body;
        const newGroup = new Group({
            name,
            description,
            icon,
            admins,
            members,
            isPublic
        });
        await newGroup.save();

        // Add group to users
        await User.updateMany(
            { _id: { $in: members } },
            { $push: { groups: newGroup._id } }
        );

        res.status(201).json(newGroup);
    } catch (error) {
        res.status(500).json({ message: 'Error creating group', error: error.message });
    }
});

app.get('/groups/user/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('groups');
        const groups = user.groups || [];

        const groupsWithStatus = groups.map(group => ({
            ...group.toObject(),
            isArchived: user.archivedChats?.includes(group._id.toString()),
            isStarred: user.starredChats?.includes(group._id.toString())
        }));

        res.json(groupsWithStatus);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching groups', error: error.message });
    }
});

app.get('/groups/:groupId/messages', async (req, res) => {
    try {
        const messages = await Message.find({ groupId: req.params.groupId })
            .populate('sender', 'firstName lastname username avatar')
            .sort({ timestamp: 1 });

        res.json(messages.map(m => ({
            ...m.toObject(),
            senderId: m.sender._id,
            sender: m.sender.firstName, // Simple name for now
            text: m.text,
            time: m.time
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching group messages', error: error.message });
    }
});

app.post('/groups/join', async (req, res) => {
    res.json({ message: 'Join logic pending' });
});

