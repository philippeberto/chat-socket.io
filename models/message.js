const mongoose = require('mongoose')

const Messagechema = mongoose.Schema({
  author: String,
  createdAt: Date,
  msgType: String,
  message: String,
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }
})

const Message = mongoose.model('Message', Messagechema)
module.exports = Message