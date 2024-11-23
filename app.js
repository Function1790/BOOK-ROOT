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
    console.log(query);
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

function isLoggedIn(req, res) {
    if (req.session?.loggedIn) {
        return true;
    }
    res.redirect('/login');
    return false;
}

function isAdmin(req) {
    if (req.session.role === 'ADMIN') {
        return true;
    }
    return false;
}

//<----------Web---------->
app.use((req, res, next) => {
    res.locals.loggedIn = req.session.loggedIn;
    res.locals.username = req.session?.username || '';
    next();
});

app.get('/', async (req, res) => {
    const sqlResult = await sqlQuery(`select * from books`);
    const top3 = await sqlQuery(`select * from books order by sold_count desc limit 3;`);
    const categories = await sqlQuery(`select * from categories`);

    res.render('index', {
        books: sqlResult,
        top3: top3,
        categories: categories
    });
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
        `select * from users where email='${email}' and password='${password}'`
    );

    if (isEmpty(sqlResult)) {
        res.redirect("/login");
        return;
    }

    const user = sqlResult[0];
    req.session.user_id = user.user_id
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
    if (!username || !email || !password) {
        res.redirect('join');
        return;
    }
    var query = `insert into users(username, email, password) values `;
    query += `('${username}', '${email}', '${password}');`
    await sqlQuery(query)
    res.redirect('/');
    Log("Join", `'${username}'님이 계정을 생성하셨습니다.`)
});

app.get('/book/:id', async (req, res) => {
    const bookId = req.params.id;
    const sqlResult = await sqlQuery(`select * from books where book_id=${bookId}`);
    if (isEmpty(sqlResult)) {
        res.redirect('/');
        return;
    }
    const book = sqlResult[0]
    res.render('book', {
        book: book,
        isAdmin: isAdmin(req)
    });
});

app.get('/write/book', async (req, res) => {
    //TODO: 권한
    const categories = await sqlQuery(`select * from categories`);
    res.render("write", {
        categories: categories
    })
});

app.post('/write/book', upload.single('image_path'), async (req, res, next) => {
    //TODO: 권한
    const { originalname, filename, size } = req.file;
    const body = req.body;
    const [title, author, category_id, price, description] =
        [body.title, body.author, body.category_id, body.price, body.description];
    const isUndefined = !title || !author || !category_id || !price || !description;
    if (isUndefined || !originalname) {
        res.redirect("/write/book");
        return;
    }
    var query = `insert into books (title, author, category_id, price, description, image_path) values `
    query += `('${title}', '${author}', ${category_id}, ${price}, '${description}', '${originalname}')`
    await sqlQuery(query)
    res.redirect("/");
    Log("Write", `'${title}'이라는 제목의 책을 등록하였습니다.`)
})

app.get('/update/book/:id', async (req, res) => {
    //TODO: 권한
    const bookId = req.params.id;
    const sqlResult = await sqlQuery(`select * from books where book_id=${bookId}`);
    if (isEmpty(sqlResult)) {
        res.redirect('/');
        return;
    }

    const book = sqlResult[0];
    const categories = await sqlQuery(`select * from categories`);
    res.render("update", {
        categories: categories,
        book: book
    })
});

app.post('/update/book/:id', upload.single('image_path'), async (req, res, next) => {
    //TODO: 권한
    const { originalname, filename, size } = req.file;
    const body = req.body;
    const [title, author, category_id, price, description] =
        [body.title, body.author, body.category_id, body.price, body.description];
    const isUndefined = !title || !author || !category_id || !price || !description;
    if (isUndefined || !originalname) {
        res.redirect("/write/book");
        return;
    }

    //TODO: 이부분 완성하기
    var query = `up into books (title, author, category_id, price, description, image_path) values `
    query += `('${title}', '${author}', ${category_id}, ${price}, '${description}', '${originalname}')`
    await sqlQuery(query)
    res.redirect("/");
    Log("Write", `'${title}'이라는 제목의 책을 등록하였습니다.`)
})

app.get('/delete/book/:id', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect('/login')
        return
    }
    const bookId = req.params.id;
    await sqlQuery(`delete from books where book_id=${bookId}`);
    res.redirect('/')
});

app.get('/profile', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    const user = await sqlQuery(`select * from users where user_id=${req.session.user_id}`);
    res.render('profile', { user: user[0] });
})

app.get('/search', async (req, res) => {
    const category = req.query.category;
    const keyword = req.query.keyword;

    var condition = '';
    if (category) {
        condition = `where category_id=${category}`
    }
    if (keyword) {
        condition += category ? ' and ' : 'where '
        condition += `category_id=${category}`
    }

    const query = `select * from books ${condition}`;
    const books = await sqlQuery(query);
    const categories = await sqlQuery(`select * from categories`);

    res.render('search', {
        books: books,
        categories: categories
    });
})

app.get('/cart/add',async (req, res) => {
})

app.listen(5500, () => Log("Start", '서버가 https://127.0.0.1:5500 에서 작동하고 있습니다'));