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
   SCHEMAS
======================= */
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  }
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
   AUTH
======================= */
function isAuthenticated(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session.role === 'admin') next();
  else res.send('Admins only');
}

/* =======================
   ROUTES
======================= */
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));

/* REGISTER */
app.post('/register', async (req, res) => {
  const { email, password, confirmPassword, role } = req.body;

  if (password !== confirmPassword) {
    return res.send('Passwords do not match');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.send('User exists');

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    email,
    password: hashedPassword,
    role
  });

  await newUser.save();

  res.redirect('/login');
});

/* LOGIN */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user.email;
    req.session.role = user.role;
    res.redirect('/dashboard');
  } else {
    res.send('Invalid credentials');
  }
});

/* DASHBOARD */
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send(`
    <h2>Welcome ${req.session.user} (${req.session.role})</h2>

    ${req.session.role === 'admin' ? `
      <h3>Admin Actions</h3>
      <a href="/course">Add Course</a><br>

      <form action="/delete-course" method="POST">
        <input type="text" name="title" placeholder="Course Title" required>
        <button>Delete Course</button>
      </form>

      <form action="/delete-user" method="POST">
        <input type="email" name="email" placeholder="User Email" required>
        <button>Delete User</button>
      </form>
    ` : ''}

    <h3>Enroll</h3>
    <a href="/enroll">Enroll Course</a><br><br>

    <a href="/logout">Logout</a>
  `);
});

/* COURSE (ADMIN ONLY) */
app.get('/course', isAuthenticated, isAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, 'public/course.html'))
);

app.post('/course', isAuthenticated, isAdmin, async (req, res) => {
  const { title } = req.body;

  const newCourse = new Course({ title });
  await newCourse.save();

  res.send('Course added');
});

app.post('/delete-course', isAuthenticated, isAdmin, async (req, res) => {
  await Course.deleteOne({ title: req.body.title });
  res.send('Course deleted');
});

/* ENROLL */
app.get('/enroll', isAuthenticated, (req, res) =>
  res.sendFile(path.join(__dirname, 'public/enroll.html'))
);

app.post('/enroll', isAuthenticated, async (req, res) => {
  const { email, courseTitle } = req.body;

  const newEnrollment = new Enrollment({ email, courseTitle });
  await newEnrollment.save();

  res.send('Enrolled successfully');
});

/* DELETE USER (ADMIN) */
app.post('/delete-user', isAuthenticated, isAdmin, async (req, res) => {
  const{email}=req.body
  await User.deleteOne({ email});
  res.send('User deleted');
});

/* LOGOUT */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* SERVER */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});