const express = require('express');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

/* =======================
   MIDDLEWARE
======================= */
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

/* =======================
   DB CONNECTION
======================= */
mongoose.connect('mongodb://127.0.0.1:27017/schoolDB')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

/* =======================
   SCHEMAS + MODELS
======================= */
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String
});

const User = mongoose.model('User', userSchema);

const courseSchema = new mongoose.Schema({
  title: String
});

const Course = mongoose.model('Course', courseSchema);

const enrollmentSchema = new mongoose.Schema({
  email: String,
  courseTitle: String
});

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

/* =======================
   AUTH MIDDLEWARE
======================= */
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

/* =======================
   ROUTES
======================= */

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Login & Register pages
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));

/* ========= REGISTER ========= */
app.post('/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.send('Passwords do not match <br><a href="/register">Try again</a>');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.send('User already exists <br><a href="/register">Try again</a>');

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashedPassword });

  res.redirect('/login');
});

/* ========= LOGIN ========= */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user.email;
    res.redirect('/dashboard');
  } else {
    res.send('Invalid credentials <br><a href="/login">Try again</a>');
  }
});

/* ========= DASHBOARD ========= */
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send(`
    <h2>Welcome ${req.session.user}</h2>

    <h3>Add Name</h3>
    <form action="/submit-name" method="POST">
      <input type="text" name="name" placeholder="Enter your name" required>
      <button>Save</button>
    </form>

    <h3>Update Email</h3>
    <form action="/update-email" method="POST">
      <input type="email" name="oldEmail" placeholder="Old Email" required>
      <input type="email" name="newEmail" placeholder="New Email" required>
      <button>Update</button>
    </form>

    <h3>Delete User</h3>
    <form action="/delete-user" method="POST">
      <input type="email" name="email" placeholder="Enter email to delete" required>
      <button>Delete</button>
    </form>

    <h3>Courses</h3>
    <a href="/course">Add Course</a><br>
    <form action="/delete-course" method="POST">
      <input type="text" name="title" placeholder="Course Title to delete" required>
      <button>Delete Course</button>
    </form>

    <h3>Enrollments</h3>
    <a href="/enroll">Enroll Student</a><br>

    <br>
    <a href="/users">View Users (JSON)</a><br>
    <a href="/courses">View Courses (JSON)</a><br>
    <a href="/enrollments">View Enrollments (JSON)</a><br><br>

    <a href="/logout">Logout</a>
  `);
});

/* ========= ADD NAME ========= */
app.post('/submit-name', isAuthenticated, async (req, res) => {
  const { name } = req.body;
  await User.updateOne({ email: req.session.user }, { $set: { name } });
  res.send(`Name saved: ${name} <br><a href="/dashboard">Back</a>`);
});

/* ========= UPDATE EMAIL ========= */
app.post('/update-email', isAuthenticated, async (req, res) => {
  const { oldEmail, newEmail } = req.body;
  await User.updateOne({ email: oldEmail }, { $set: { email: newEmail } });
  res.send('Email updated successfully <br><a href="/dashboard">Back</a>');
});

/* ========= DELETE USER ========= */
app.post('/delete-user', isAuthenticated, async (req, res) => {
  const { email } = req.body;
  await User.deleteOne({ email });
  res.send('User deleted <br><a href="/dashboard">Back</a>');
});

/* ========= COURSE ========= */
app.get('/course', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public/course.html')));
app.post('/course', isAuthenticated, async (req, res) => {
  const { title } = req.body;
  await Course.create({ title });
  res.send('Course added <br><a href="/dashboard">Back</a>');
});
app.post('/delete-course', isAuthenticated, async (req, res) => {
  const { title } = req.body;
  await Course.deleteOne({ title });
  res.send('Course deleted <br><a href="/dashboard">Back</a>');
});

/* ========= ENROLL ========= */
app.get('/enroll', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public/enroll.html')));
app.post('/enroll', isAuthenticated, async (req, res) => {
  const { email, courseTitle } = req.body;
  await Enrollment.create({ email, courseTitle });
  res.send('Enrolled successfully <br><a href="/dashboard">Back</a>');
});

/* ========= READ ========= */
app.get('/users', isAuthenticated, async (req, res) => res.json(await User.find()));
app.get('/courses', isAuthenticated, async (req, res) => res.json(await Course.find()));
app.get('/enrollments', isAuthenticated, async (req, res) => res.json(await Enrollment.find()));

/* ========= LOGOUT ========= */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* =======================
   SERVER
======================= */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});