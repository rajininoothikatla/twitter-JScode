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
      const jwtToken = jwt.sign(payload, 'SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload
        next()
      }
    })
  }
}
const tweetResponse = dbObject => ({
  username: dbObject.username,
  tweet: dbObject.tweet,
  dateTime: dbObject.date_time,
})
// Get the tweets API 3

app.get('/user/tweets/feed/', authentication, async (request, response) => {
  const latestTweets = await db.all(`
  SELECT 
  tweet.tweet_id,
  tweet.user_id,
  user.username,
  tweet.tweet,
  tweet.date_time
  FROM follower 
  LEFT JOIN tweet on tweet.user_id = follower.following_user_id
  LEFT JOIN user on follower.following_user_id = user.user_id 
  WHERE follower.follower_user_id = (SELECT user_id from user WHERE username = '${request.username}')
  ORDER BY tweet.date_time DESC
  LIMIT 4;
  `)
  response.send(latestTweets.map(item => tweetResponse(item)))
})

// Get the user follows API 4
app.get('/user/following/', authentication, async (request, response) => {
  const following = await db.all(`
  SELECT user.name FROM follower
  LEFT JOIN user ON follower.following_user_id = user.user_id 
  WHERE follower.follower_user_id = (SELECT user_id from user WHERE username ='${request.username}');
  `)
  response.send(following)
})

// Get all the followers of the logged in user API 5
app.get('/user/followers/', authentication, async (request, response) => {
  const followers = await db.all(`
  SELECT user.name FROM follower
  LEFT JOIN user ON follower.follower_user_id = user.user_id
  WHERE follower.following_user_id = (SELECT user_id from user WHERE username ='${request.username}');
  `)
  response.send(followers)
})

//Tweet access verification

const follows = async (request, response, next) => {
  const {tweetId} = request.params
  let isFollowing = await db.get(`
  SELECT * FROM follower 
WHERE follower_user_id =  (SELECT user.id from user WHERE username = '${request.username}')
AND 
following_user_id =  (SELECT user.user.id from tweet NATURAL JOIN user WHERE tweet_id = ${tweetId});
`)
  if (isFollowing === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

// Get the tweet API 6
app.get(
  '/tweets/:tweetId/',
  authentication,
  follows,
  async (request, response) => {
    const {tweetId} = request.params
    const {tweet, date_time} = await db.get(`
    SELECT tweet,date_time from tweet WHERE tweet_id = ${tweetId};`)
    const {likes} = await db.get(`
    SELECT count(like_id) as likes from like WHERE tweet_id = ${tweetId};`)
    const {replies} = await db.get(`
    SELECT count(reply_id) as replies from like WHERE tweet_id = ${tweetId};`)
    response.send({tweet, likes, replies, dateTime: date_time})
  },
)

// Get the user follows API 7
app.get(
  '/tweets/:tweetId/likes/',
  authentication,
  follows,
  async (request, response) => {
    const {tweetId} = request.params
    const likedBy = await db.all(`
    SELECT user.username from like natural join user WHERE tweet_id = ${tweetId};
    `)
    response.send({likes: likedBy.map(item => item.username)})
  },
)

// Get the user follows API 8
app.get(
  '/tweets/:tweetId/replies/',
  authentication,
  follows,
  async (request, response) => {
    const {tweetId} = request.params
    const replies = await db.all(`
    SELECT user.name,reply.reply from reply natural join user WHERE tweet_id = ${tweetId};
    `)
    response.send({replies})
  },
)

// Get all the tweet by the logged user API 9
app.get('/user/tweets/', authentication, async (request, response) => {
  const myTweets = await db.all(`
    SELECT tweet,
    COUNT(DISTINCT like.like_id) AS likes,
    COUNT(DISTINCT reply.reply_id) AS replies,
    tweet.date_time
    FROM tweet 
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    
    WHERE tweet.user_id = (SELECT user_id from user WHERE username = '${request.username}')
    GROUP BY tweet.tweet_id;
    `)
  response.send(
    myTweets.map(item => {
      const {date_time, ...rest} = item
      return {...rest, dateTime: date_time}
    }),
  )
})

//(POST) create a tweet API 10

app.post('/user/tweets/', authentication, async (request, response) => {
  const {tweet} = request.body
  const userId = await db.get(`
  SELECT user_id from user WHERE username = '${username}'`)
  await db.run(`
  INSERT INTO tweet(tweet,user_id)
  VALUES('${tweet}',${userId})
  `)
  response.send('Created a Tweet')
})

//Delete a tweet API 11

app.delete('/tweets/:tweetId/', authentication, async (request, response) => {
  const {tweetId} = request.params
  const userTweet =
    await db.get(`SELECT tweet_id,user_id FROM tweet WHERE tweet_id = ${tweetId} 
  AND user_id = (SELECT user_id FROM user WHERE username = '${request.username}');
  `)
  if (userTweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    await db.run(`DELETE FROM tweet WHERE tweet_id =${tweetId}
    `)
    response.send('Tweet Removed')
  }
})
module.exports = app
