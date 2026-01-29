import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: { type: String, enum: ['missed', 'completed', 'rejected'], default: 'completed' },
    timestamp: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 } // in seconds
});

export default mongoose.model('Call', callSchema);
