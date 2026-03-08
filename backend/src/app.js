require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoute = require('./routes/auth.route');
const profileRoute = require('./routes/profile.route');
const postRoute = require('./routes/post.route');
const userRoute = require('./routes/user.route');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoute);
app.use('/api/profile', profileRoute);
app.use('/api/posts', postRoute);
app.use('/api/users', userRoute);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
