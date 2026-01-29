import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for Group Chats
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // New Group Field
    text: { type: String, required: true },
    time: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For Read Receipts
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String
    }]
});

const Message = mongoose.model('Message', messageSchema);
export default Message;
