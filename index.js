const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4tlkf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        await client.connect();

        const bikePartCollection = client.db('bike-manufacturer').collection('bikeparts');
        const bookingCollection = client.db('bike-manufacturer').collection('booking');
        const userCollection = client.db('bike-manufacturer').collection('users');
        const productCollection = client.db('bike-manufacturer').collection('product');

        const verifyAdmin = async(req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            } else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.get('/bikepart', async(req, res) => {
            const query = {};
            const cursor = bikePartCollection.find(query);
            const bikeParts = await cursor.toArray();
            res.send(bikeParts);
        })

        app.get('/user', async(req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/admin/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async(req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result);

        })

        app.put('/user/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' })
            res.send({ result, token });
        })


        app.get('/booking', verifyJWT, async(req, res) => {
            const myEmail = req.query.myEmail;
            const decodedEmail = req.decoded.email;
            if (myEmail === decodedEmail) {
                const query = { myEmail: myEmail };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            } else {
                return res.status(403).send({ message: 'forbidden access' })
            }

        })

        app.post('/bikepart', verifyJWT, async(req, res) => {
            const newParts = req.body;
            const result = await bikePartCollection.insertOne(newParts);
            res.send(result);
        })

        app.post('/product', verifyJWT, verifyAdmin, async(req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        app.post('/booking', async(req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

    } finally {

    }

}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Daves Bike parts');
});

app.listen(port, () => {
    console.log(`Bikeparts manufacturer  ${port}`);
})