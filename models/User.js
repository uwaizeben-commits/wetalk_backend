import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastname: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    bio: { type: String, default: 'Available' },
    avatar: { type: String },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    archivedChats: [{ type: String }], // Array of UserIDs or GroupIDs
    starredChats: [{ type: String }], // Array of UserIDs or GroupIDs
    settings: {
        privacy: {
            lastSeen: { type: Boolean, default: true },
            readReceipts: { type: Boolean, default: true },
            twoFactor: { type: Boolean, default: false }
        },
        chat: {
            theme: { type: String, default: 'light' },
            wallpaper: { type: String, default: 'default' },
            fontSize: { type: String, default: 'medium' },
            mediaAutoDownload: { type: Boolean, default: true }
        },
        notifications: {
            pushEnabled: { type: Boolean, default: true },
            soundEnabled: { type: Boolean, default: true },
            previewEnabled: { type: Boolean, default: true }
        }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
export default User;
