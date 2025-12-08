import User from '../models/userModel.js';
import fetch from 'node-fetch';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, reply) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    return reply.code(400).send({ error: 'User already exists' });
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  if (user) {
    const token = req.server.jwt.sign({ id: user._id, email: user.email });
    return reply.code(201).send({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } else {
    return reply.code(400).send({ error: 'Invalid user data' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, reply) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    const token = req.server.jwt.sign({ id: user._id, email: user.email });
    return reply.send({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } else {
    return reply.code(401).send({ error: 'Invalid email or password' });
  }
};

// @desc    Google OAuth Callback
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = async (req, reply) => {
  try {
    const token = await req.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)
    
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token.token.access_token}`
      }
    })
    const userInfo = await userInfoResponse.json()
    
    let user = await User.findOne({ googleId: userInfo.id })
    
    if (!user) {
      user = await User.findOne({ email: userInfo.email })
      if (user) {
        user.googleId = userInfo.id
        await user.save()
      } else {
        user = await User.create({
          name: userInfo.name,
          email: userInfo.email,
          googleId: userInfo.id,
        })
      }
    }

    const jwtToken = req.server.jwt.sign({ id: user._id, email: user.email })
    
    // Redirect to editor with token
    return reply.redirect(`/editor.html?token=${jwtToken}`)
  } catch (error) {
    req.log.error(error)
    return reply.redirect('/login.html?error=google_auth_failed')
  }
};
