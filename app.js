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

function formatMoney(point) {
    return point.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function ajaxResponse(status, message, next = '') {
    return {
        status: status,
        message: message,
        next: next
    }
}

function loginAdmin(req) {
    req.session.user_id = 2;
    req.session.username = "관리자";
    req.session.email = "admin";
    req.session.role = "ADMIN";
    req.session.loggedIn = true;
}

//<----------Web---------->
app.use((req, res, next) => {
    res.locals.loggedIn = req.session.loggedIn;
    res.locals.isAdmin = isAdmin(req);
    res.locals.formatMoney = formatMoney;
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
});

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
});

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
});

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
});

app.get('/cart/add', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    const user_id = req.session.user_id;
    const book_id = req.query.book_id;
    await sqlQuery(`insert into cart (user_id, book_id) values (${user_id}, ${book_id});`);
    res.redirect('/cart');
});

app.get('/cart/delete/:num', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    const cart_id = req.params.num;
    await sqlQuery(`delete from cart where cart_id=${cart_id}`);
    res.redirect('/cart');
});

app.get('/cart', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    const user_id = req.session.user_id;
    const cart = await sqlQuery(`select * from cart where user_id=${user_id}`);
    const user = await sqlQuery(`select * from users where user_id=${user_id}`);
    for (var i in cart) {
        const book = await sqlQuery(`select * from books where book_id=${cart[i].book_id}`);
        cart[i].book = book[0];
    }
    res.render('cart', {
        cart: cart,
        user: user[0]
    })
});

app.post('/purchase', async (req, res) => {
    const { selectedItems, useMoney, usePoint } = req.body;
    //오류 처리
    if (!isLoggedIn(req, res)) { return; }
    if (selectedItems.length <= 0) {
        res.json(ajaxResponse("error", "아이템을 선택해주세요"));
        return;
    }
    //정산 및 데이터 수집
    const items = []
    let total = 0;
    for (var i in selectedItems) {
        const book = await sqlQuery(`select * from books where book_id=${selectedItems[i].book_id}`);
        items.push(book[0]);
        selectedItems[i].price = book[0].price;
        selectedItems[i].title = book[0].title;
        total += book[0].price;
    }
    let user = await sqlQuery(`select * from users where user_id=${req.session.user_id}`);
    user = user[0];
    //가격 확인
    if (user.point < usePoint || user.money < useMoney) {
        res.json(ajaxResponse("error", "돈/포인트는 가진 것 보다 많이 사용할 수 없습니다"));
        return;
    } else if (usePoint + useMoney !== total) {
        res.json(ajaxResponse("error", "가격을 확인해주세요"));
        return;
    }
    const addingPoint = Math.floor(0.01 * total)
    const afterMoney = user.money - useMoney;
    const afterPoint = user.point - usePoint + addingPoint;
    await sqlQuery(`update users set point=${afterPoint}, money=${afterMoney} where user_id=${req.session.user_id}`);
    var query = `insert into orders (user_id, item_data, total_price, earned_points) values`
    query += ` (${req.session.user_id}, '${JSON.stringify(selectedItems)}', ${total}, ${addingPoint})`
    await sqlQuery(query);
    for (var i in selectedItems) {
        await sqlQuery(`delete from cart where cart_id=${selectedItems[i].cart_id}`)
        await sqlQuery(`update books set sold_count= sold_count+1 where book_id=${selectedItems[i].book_id} `)
    }
    res.json(ajaxResponse("success", "", "/"));
});

app.get('/admin', (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    res.render('admin')
});

app.get('/admin/orders', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    const orders = await sqlQuery(`select * from orders`);
    for (var i in orders) {
        const user = await sqlQuery(`select * from users where user_id=${orders[i].user_id}`);
        const item_data = JSON.parse(orders[i].item_data);
        orders[i].buyer_name = user[0].username;
        orders[i].info = item_data[0].title;
        orders[i].info += item_data.length > 1 ? ` 외 ${item_data.length - 1}개` : '';
    }
    res.render('admin-orders', { orders: orders });
});

app.get('/admin/products', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    const books = await sqlQuery(`select * from books`);
    res.render('admin-products', { books: books });
});

app.get('/admin/users', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    const users = await sqlQuery(`select * from users`);
    res.render('admin-users', { users: users })
});

app.get('/admin/user/update/:num', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    const user = await sqlQuery(`select * from users where user_id=${req.params.num}`);
    res.render('admin-user-update.ejs', { user: user[0] })
});

app.post('/admin/user/update/:num', async (req, res) => {
    if (!isAdmin(req)) {
        res.redirect("/");
        return;
    }
    const { username, email, role } = req.body;
    var query = `update users set username='${username}',email='${email}',role='${role}' `;
    query += `where user_id=${req.params.num}`;
    console.log(query);
    await sqlQuery(query);
    res.redirect('/admin/users');
});

app.get('/order', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    const orders = await sqlQuery(`select * from orders where user_id=${req.session.user_id}`);
    for (var i in orders) {
        const item_data = JSON.parse(orders[i].item_data);
        orders[i].info = item_data[0].title;
        orders[i].info += item_data.length > 1 ? ` 외 ${item_data.length - 1}개` : '';
    }
    res.render('order', {
        orders: orders
    });
});

app.get('/order/:num', async (req, res) => {
    if (!isLoggedIn(req, res)) { return; }
    var order = await sqlQuery(`select * from orders where order_id=${req.params.num}`);
    order = order[0]
    order.item_data = JSON.parse(order.item_data);
    res.render('order-detail', {
        order: order,
        wasAdminPage: req.query.admin
    })
});


app.listen(5500, () => {
    Log("Start", '서버가 https://127.0.0.1:5500 에서 작동하고 있습니다');
});