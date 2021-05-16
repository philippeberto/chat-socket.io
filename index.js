const express = require('express')
const app = express()
const cors = require('cors')
const session = require('express-session')
const sharedSession = require('express-socket.io-session')
const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const Room = require('./models/room')
const Message = require('./models/message')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const PORT = process.env.PORT || 3000
const jwt_secret = process.env.JWT_SECRET || 'chat-socket.io'

app.use(cors())
app.options('*', cors())

app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const appSession = session({
  saveUninitialized: false,
  resave: false,
  secret: 'socketio',
  cookie: {
    maxAge: 360000
  }
})
app.use(appSession)

// o socket.io atua fortemente na camada de comunicação, para isso importamos o http
// que faz parte do core do express. Posteriormente que ouvirá a aplicação não será
// o app e sim o http
const http = require('http').Server(app)
const io = require('socket.io')(http)
const redis = require('socket.io-redis') //redis work as a balancer between different servers
io.adapter(redis())
io.use(sharedSession(appSession, { autoSave: true }))
io.use(async (socket, next) => {
  const verify = await jwt.verify(socket.handshake.query.token, jwt_secret)
  if (!verify) {
    next(new Error('Authentication failed.'))
  } else {
    next()
  }
})


app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.render('home')
})

app.post('/auth', async (req, res) => {
  const token = jwt.sign({
    name: req.body.name
  }, jwt_secret)
  res.send({ token })
})

app.get('/room', (req, res) => {
  if (!req.session.user) {
    res.redirect('/')
  } else {
    res.render('room', {
      name: req.session.user.name
    })
  }
})

io.on('connection', socket => {
  // existing rooms
  Room.find({}, (err, rooms) => {
    socket.emit('roomList', rooms)
  })

  socket.on('addRoom', roomName => {
    const room = new Room({
      name: roomName
    })
    room.save().then(() => {
      io.emit('newRoom', room)
    })
  })

  socket.on('join', async roomId => {
    socket.join(roomId)
    const msgs = await Message.find({ room: roomId })
    socket.emit('msgsList', msgs)
  })

  socket.on('sendMsg', async msg => {
    const message = new Message({
      author: socket.handshake.session.user.name,
      createdAt: new Date(),
      msgType: 'text',
      message: msg.msg,
      room: msg.room
    })
    await message.save()
    await io.to(msg.room).emit('newMsg', message)
  })

  socket.on('sendAudio', async msg => {
    const message = new Message({
      author: socket.handshake.session.user.name,
      createdAt: new Date(),
      msgType: 'audio',
      message: msg.data,
      room: msg.room
    })
    await message.save()
    await io.to(msg.room).emit('newAudio', message)
  })
})

mongoose
  .connect('mongodb://localhost/chat-socketio', {
    useUnifiedTopology: true,
    useNewUrlParser: true
  })
  .then(() => {
    http.listen(PORT, () => {
      console.log(`Listening on ${PORT}...`)
    })
  })

