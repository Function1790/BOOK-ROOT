const express = require('express')
const app = express()
const fs = require('fs')
const mysql = require('mysql')
const multer = require('multer');

//Express Setting
app.use(express.static('public'))
app.use('/views', express.static('views'))

const path = require('path');
const engine = require('ejs-mate');
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
})
const upload = multer({ storage });

//Mysql
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1790',
    database: 'bookroot'
});
connection.connect();

async function sqlQuery(query) {
    let promise = new Promise((resolve, reject) => {
        const rows = connection.query(query, (error, rows, fields) => {
            resolve(rows);
        })
    })
    let result = await promise;
    return result;
}

//Body Parser
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

//Session
//TODO: Memorystore 사용
const session = require('express-session');
const cookieParser = require("cookie-parser");

app.use(cookieParser('BOOKROOT'));
app.use(session({
    secure: true,
    secret: 'SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        Secure: true
    },
    name: 'data-session',
}));

const cookieConfig = {
    maxAge: 30000,
    path: '/',
    httpOnly: true,
    signed: true
};

//<----------Function---------->
function Log(title, content) {
    console.log(`[${title}] >> ${content}`);
};

function isEmpty(array) {
    return !array || array.length == 0;
}

//<----------Web---------->
app.use((req, res, next) => {
    res.locals.loginHref = req.session.loggedIn ? 'logout' : 'login';
    res.locals.username = req.session?.username || 'not';
    next();
});

app.get('/', async (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const body = req.body;
    const [email, password] = [
        body.email, 
        body.password
    ];
    const sqlResult = await sqlQuery(
        `select * from users where email=${email} and password=${password}`
    );

    if(isEmpty(sqlResult)) {
        res.redirect("/login");
        return;
    }

    const user = sqlResult[0];
    req.session.username = user.username;
    req.session.email = email;
    req.session.role = user.role;
    req.session.loggedIn = true;
    res.redirect("/");
    Log("Login", `'${req.session.username}'님이 로그인하셨습니다`);
})

app.get('/logout', (req, res) => {
    req.session.username = null;
    req.session.email = null;
    req.session.role = null;
    req.session.loggedIn = false;
    res.redirect("/");
});

app.get('/join', (req, res) => {
    res.render('join');
});

app.post('/join', async (req, res) => {
    const body = req.body;
    const [username, email, password] = [body.username, body.email, body.password];
    if(!username || !email || !password) {
        res.redirect('join');
        return;
    }
    var query = `insert into users(username, email, password) values `;
    query += `('${username}', '${email}', '${password}');`
    await sqlQuery(query)
    res.redirect('/');
    Log("Join", `'${username}'님이 계정을 생성하셨습니다.`)
});

app.listen(5500, () => Log("Start", '서버가 https://127.0.0.1:5500 에서 작동하고 있습니다'));