const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DBError: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

//(POST) register API 1

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const selectQuery = `
  SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectQuery)
  if (dbUser === undefined) {
    const createUserQuery = `
    INSERT INTO 
        user(username,password,name,gender)
    VALUES (
        '${username}',
        '${hashedPassword}',
        '${name}',
        '${gender}'
        );`
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      await db.run(createUserQuery)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//(POST) login API 2

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const addUserQuery = `
  SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(addUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'myrajinisarthak')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken.authHeader.split('')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'myrajinisarthak', async (error, payload) => {
      if (error) {
        response.send(401)
        response.send('Invalid JWT Token')
      } else {
        console.log(payload)
        next()
      }
    })
  }
}

// Get the tweets API 3

app.get('user/tweets/feed/', authenticateToken, async (request, response) => {
  const {userId} = request.params
  const getUserQuery = `
  SELECT 
    * 
  FROM 
    tweet 
  WHERE user_id = '${userId}'
  LIMIT 4;`
  const dbUser = await db.get(getUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid JWT Token')
  } else {
    response.send(dbUser)
  }
})

// Get the user follows API 4
app.get('/user/:following/', async (request, response) => {
  const {userId} = request.params
  const getUserQuery = `
   SELECT * FROM user WHERE user_id = ${userId};`
   const 
  const followerArray = await db.all(getUserQuery)
  response.send(followerArray)
})

// Get the user follows API 5
app.get('/user/:followers/', async (request, response) => {
  const getUserQuery = `
SELECT * FROM follower ORDER BY follower_user_id;`
  const followerArray = await db.get(getUserQuery)
  response.send(followerArray)
})

// Get the tweet API 6
app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const getUserQuery = `
SELECT * FROM tweet WHERE tweet_id = ${tweetId};`
  const tweetResponse = await db.get(getUserQuery)
  const userFollowerQuery = `
  SELECT * FROM follower INNER JOIN user 
  ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${user.userId};`
  const userFollowers = await db.all(userFollowerQuery)
  if (
    userFollowers.some(item => item.following_user_id === tweetResponse.user_id)
  ) {
    response.send(userFollowers)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

// Get the user follows API 7
app.get('/tweets/:tweetId/likes/', async (request, response) => {
  const {tweetId} = request.params
  const getUserQuery = `
SELECT * FROM tweet WHERE tweet_id = ${tweetId};`
  const tweetResponse = await db.get(getUserQuery)
  console.log(tweetResponse)
  const userFollowerQuery = `
  SELECT * FROM follower INNER JOIN user 
  ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${tweetId};`
  const userFollowers = await db.all(userFollowerQuery)
  if (
    userFollowers.some(item => item.following_user_id === tweetResponse.user_id)
  ) {
    response.send(userFollowers)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

// Get the user follows API 8
app.get('/tweets/:tweetId/replies/', async (request, response) => {
  const {tweetId} = request.params
  const getUserQuery = `
SELECT * FROM tweet WHERE tweet_id = ${tweetId};`
  const tweetResponse = await db.get(getUserQuery)
  console.log(tweetResponse)
  const userFollowerQuery = `
SELECT * FROM follower INNER JOIN user 
  ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${tweetId};`
  const userFollowers = await db.all(userFollowerQuery)
  if (
    userFollowers.some(item => item.following_user_id === tweetResponse.user_id)
  ) {
    response.send(userFollowers)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

// Get the user follows API 9
app.get('/user/:tweets/', async (request, response) => {
  const {tweetId} = request.params
  const getUserQuery = `
SELECT * FROM tweet WHERE tweet_id = ${tweetId};`
  const followerArray = await db.all(getUserQuery)
  response.send(followerArray)
})

//(POST) create a tweet API 10

app.post('/user/tweets/', async (request, response) => {
  const {tweet} = request.body
  const addTweetQuery = `
  INSERT INTO 
    tweet(tweet)
  VALUES (
    '${tweet}'
  )`
  const dbResponse = await db.run(addTweetQuery)
  response.send('Created a Tweet')
})

//Delete a tweet API 11

app.delete('/tweets/:tweetId/', async (request, response) => {
  const {tweetId} = request.params
  const deleteTweetQuery = `
  DELETE FROM tweet WHERE tweet_id =${tweetId};`
  const dbResponse = await db.run(deleteTweetQuery)
  if (dbResponse !== undefined) {
    response.status(200)
    response.send('Tweet Removed')
  } else {
    response.send(`Invalid Request`)
  }
})
module.exports = app
