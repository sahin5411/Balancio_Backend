const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  googleId: { type: String },
  githubId: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  monthlyBudget: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    alertThresholds: {
      warning: { type: Number, default: 80 }, // 80% of budget
      critical: { type: Number, default: 95 } // 95% of budget
    },
    lastAlertSent: {
      warning: { type: Date },
      critical: { type: Date }
    }
  },
  settings: {
    emailNotifications: { type: Boolean, default: true },
    budgetAlerts: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: true },
    reportFormat: { type: String, enum: ['pdf', 'excel'], default: 'excel' },
    twoFactorEnabled: { type: Boolean, default: false }
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);