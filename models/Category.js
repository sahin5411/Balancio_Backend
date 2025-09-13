const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  color: { type: String, default: '#3B82F6' },
  icon: { type: String, default: 'category' }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);